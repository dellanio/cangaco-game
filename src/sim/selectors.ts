import type { GameState, Predio, Unidade } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

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
    if (!predio) continue;
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

interface CaixaEmTiles {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function centroDeCaixas(caixas: readonly CaixaEmTiles[]): PontoEmTiles {
  const x0 = Math.min(...caixas.map((c) => c.x0));
  const y0 = Math.min(...caixas.map((c) => c.y0));
  const x1 = Math.max(...caixas.map((c) => c.x1));
  const y1 = Math.max(...caixas.map((c) => c.y1));
  return { gx: (x0 + x1) / 2, gy: (y0 + y1) / 2 };
}

function caixaDoPredio(predio: Predio, dados: GameData): CaixaEmTiles | null {
  const def = dados.predios.find((p) => p.id === predio.tipo);
  const [largura, altura] = def?.tamanho ?? [];
  if (largura === undefined || altura === undefined) return null;
  return { x0: predio.gx, y0: predio.gy, x1: predio.gx + largura, y1: predio.gy + altura };
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
