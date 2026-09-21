import type { GameState, Predio, Unidade } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { caixaDoPredio } from './footprint';
import { estaDesbloqueado } from './desbloqueio';
import { custoDoPasso } from './pathfinding';
import { custoDoPredio } from './systems/build';
import type { CaixaEmTiles } from './footprint';

/**
 * Agregados puros sobre o `GameState`. Vivem aqui, e nao em `ui/`, porque
 * `ui/` so pode ler estado e emitir comando — nao varrer prédios por conta
 * propria (CLAUDE.md secao 3). Se o HUD precisar de outro agregado, ele
 * nasce ao lado, neste mesmo arquivo.
 */

/** Soma as duas gavetas (`entrada` + `saida`) de todo predio. E o numero que
 *  o jogador ve na barra de recursos — o jogo internamente sabe a diferenca
 *  entre as duas, o jogador nao precisa saber. */
export function estoqueTotal(state: GameState): Readonly<Record<string, number>> {
  const total: Record<string, number> = {};
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    // Obra nao guarda mercadoria: o que ja foi entregue a ela e custo - obra.faltam.
    if (!predio || predio.estado !== 'completo') continue;
    for (const gaveta of [predio.estoque.entrada, predio.estoque.saida]) {
      for (const [mercadoria, quantidade] of Object.entries(gaveta)) {
        total[mercadoria] = (total[mercadoria] ?? 0) + quantidade;
      }
    }
  }
  return total;
}

/** Quantas unidades existem de cada tipo (`serf`, `laborer`, ...). */
export function contagemPorTipo(state: GameState): Readonly<Record<string, number>> {
  const contagem: Record<string, number> = {};
  for (const id of state.unidades.ordem) {
    const unidade = state.unidades.porId[id];
    if (!unidade) continue;
    contagem[unidade.tipo] = (contagem[unidade.tipo] ?? 0) + 1;
  }
  return contagem;
}

/** Visao simples e serializavel do estado, para `npm run sim` imprimir e
 *  para qualquer teste que precise do "resumo" em vez do estado bruto. */
export interface ResumoDoEstado {
  readonly tick: number;
  readonly predios: ReadonlyArray<{
    readonly id: string;
    readonly tipo: string;
    readonly gx: number;
    readonly gy: number;
    readonly estado: string;
    readonly hp: number;
  }>;
  readonly estoqueTotal: Readonly<Record<string, number>>;
  readonly unidadesPorTipo: Readonly<Record<string, number>>;
}

export function resumoDoEstado(state: GameState): ResumoDoEstado {
  const predios = state.predios.ordem
    .map((id) => state.predios.porId[id])
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({
      id: p.id, tipo: p.tipo, gx: p.gx, gy: p.gy, estado: p.estado, hp: p.hp,
    }));
  return {
    tick: state.tick,
    predios,
    estoqueTotal: estoqueTotal(state),
    unidadesPorTipo: contagemPorTipo(state),
  };
}

/** Soma de `estoqueTotal` restrita as mercadorias de `economia.grupos.comida`.
 *  A lista de quais mercadorias contam como comida vem do dado — este
 *  selector nao conhece nenhum id de comida por conta propria. */
export function comidaTotal(state: GameState, dados: GameData = gameData): number {
  const total = estoqueTotal(state);
  let soma = 0;
  for (const id of dados.economia.grupos.comida) soma += total[id] ?? 0;
  return soma;
}

export interface Populacao {
  readonly civil: number;
  readonly militar: number;
}

/** Classifica cada unidade pelo `tipo` contra `unidades.civis`/`militares` do
 *  dado. Um tipo desconhecido nao vira civil por omissao: nao entra em
 *  nenhuma das duas contagens (ver teste que afirma civil+militar contra o
 *  total de unidades). */
export function populacaoPorGrupo(state: GameState, dados: GameData = gameData): Populacao {
  const idsCivis = new Set(dados.unidades.civis.tipos.map((t) => t.id));
  const idsMilitares = new Set(dados.unidades.militares.tipos.map((t) => t.id));
  let civil = 0;
  let militar = 0;
  for (const id of state.unidades.ordem) {
    const unidade = state.unidades.porId[id];
    if (!unidade) continue;
    if (idsCivis.has(unidade.tipo)) civil += 1;
    else if (idsMilitares.has(unidade.tipo)) militar += 1;
  }
  return { civil, militar };
}

/**
 * Ponto em unidades de tile, possivelmente fracionario (o centro de um
 * bounding box com largura impar cai no meio de um tile). NAO e `Tile`
 * (`render/grid.ts`): nao indexa o mapa, nao entra no `GameState`, e nenhum
 * sistema de `sim/` deveria guardar isto num campo de coordenada.
 */
export interface PontoEmTiles {
  readonly gx: number;
  readonly gy: number;
}

function centroDeCaixas(caixas: readonly CaixaEmTiles[]): PontoEmTiles {
  const x0 = Math.min(...caixas.map((c) => c.x0));
  const y0 = Math.min(...caixas.map((c) => c.y0));
  const x1 = Math.max(...caixas.map((c) => c.x1));
  const y1 = Math.max(...caixas.map((c) => c.y1));
  return { gx: (x0 + x1) / 2, gy: (y0 + y1) / 2 };
}

function caixaDaUnidade(unidade: Unidade): CaixaEmTiles {
  return { x0: unidade.gx, y0: unidade.gy, x1: unidade.gx + 1, y1: unidade.gy + 1 };
}

/**
 * Onde a camera deveria centralizar na abertura. Cadeia de fallback
 * explicita, nao excecao (CLAUDE.md — condicao do operador):
 *
 * 1. ha predio -> centro do bounding box dos footprints;
 * 2. sem predio mas com unidade -> centro do bounding box das unidades;
 * 3. nem uma coisa nem outra -> centro do mapa.
 */
export function centroDaVila(state: GameState, dados: GameData = gameData): PontoEmTiles {
  const predios = state.predios.ordem
    .map((id) => state.predios.porId[id])
    .filter((p): p is Predio => p !== undefined);
  if (predios.length > 0) {
    const caixas = predios
      .map((p) => caixaDoPredio(p, dados))
      .filter((c): c is CaixaEmTiles => c !== null);
    if (caixas.length > 0) return centroDeCaixas(caixas);
  }

  const unidades = state.unidades.ordem
    .map((id) => state.unidades.porId[id])
    .filter((u): u is Unidade => u !== undefined);
  if (unidades.length > 0) {
    return centroDeCaixas(unidades.map(caixaDaUnidade));
  }

  const { largura, altura } = dados.terreno.mapaPadrao;
  return { gx: largura / 2, gy: altura / 2 };
}

/** Uma linha do menu Build: tudo que o painel precisa para desenhar, sem ele
 *  varrer predios nem ler `sim/data`. Nomes de tela sao do tema, na `ui/`. */
export interface OpcaoDoMenuBuild {
  readonly id: string;
  readonly custo: { readonly timber: number; readonly stone: number };
  readonly tamanho: readonly number[];
  readonly desbloqueado: boolean;
  /** Id do predio que falta para liberar este; `null` se ja esta liberado ou
   *  se o dado nao aponta nenhum (`desbloqueadoPor: null`, ex.: storehouse). */
  readonly requer: string | null;
}

/** O que a estrada custa por tile, para o painel mostrar sem ler `sim/data`. */
export function custoDaEstrada(dados: GameData = gameData): { readonly stone: number } {
  return { stone: dados.terreno.estrada.custoStonePorTile };
}

/** Na ordem de `data/buildings.json`. */
export function opcoesDoMenuBuild(
  state: GameState, dados: GameData = gameData,
): readonly OpcaoDoMenuBuild[] {
  return dados.predios.map((def) => {
    const desbloqueado = estaDesbloqueado(state, def.id, dados);
    return {
      id: def.id,
      custo: custoDoPredio(def),
      tamanho: def.tamanho,
      desbloqueado,
      requer: desbloqueado ? null : def.desbloqueadoPor,
    };
  });
}

/** Uma posicao no mapa em tiles, FRACIONARIA (a unidade pode estar no meio de um passo). */
export interface PosicaoNoMapa {
  readonly gx: number;
  readonly gy: number;
}

/**
 * Onde a unidade esta DE VERDADE, para o render desenhar (F10). Funcao pura do estado: o
 * tile onde ela esta (`gx`, `gy`) mais a fracao `progresso / custo do passo` rumo ao
 * proximo tile do caminho. Sem relogio de render e sem posicao anterior guardada — e por
 * isso o movimento e observavel mesmo antes do laco de 10 Hz (F11), que so acrescenta a
 * interpolacao ENTRE ticks por cima disto.
 */
export function posicaoDaUnidade(
  state: GameState, unidade: Unidade, dados: GameData = gameData,
): PosicaoNoMapa {
  const proximo = unidade.fsmData.caminho?.[0];
  const progresso = unidade.fsmData.progresso ?? 0;
  if (!proximo || progresso === 0) return { gx: unidade.gx, gy: unidade.gy };
  const fracao = progresso / custoDoPasso(state.estradas, { gx: unidade.gx, gy: unidade.gy }, proximo, dados);
  return {
    gx: unidade.gx + (proximo.gx - unidade.gx) * fracao,
    gy: unidade.gy + (proximo.gy - unidade.gy) * fracao,
  };
}
