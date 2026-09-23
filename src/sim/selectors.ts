import type { GameState, Predio, Unidade } from './state';
import { ID_DO_ARMAZEM } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { caixaDoPredio } from './footprint';
import { estaDesbloqueado } from './desbloqueio';
import { predioLigadoAoArmazem } from './estradas';
import { custoDeTreino, ehEscolaCompleta, filaDaEscola, ouroNecessario } from './escola';
import { custoDoPasso } from './pathfinding';
import { custoDoPredio } from './obra';
import { trabalhadorDoTipo } from './ocupacao';
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

/**
 * O estoque que o jogador PODE GASTAR: as duas gavetas (`entrada` + `saida`) dos ARMAZENS
 * completos, e so deles. E o numero da barra de recursos: a estrada (F08) e as obras (F10)
 * so tiram de armazem, entao somar a saida de uma pedreira faria o HUD mostrar pedra que
 * ninguem consegue usar (`estoqueTotal`, que soma todos os predios, continua para outros usos).
 *
 * O RESERVADO por uma tarefa nao e descontado: a pedra ainda esta la, e a previa da estrada ja
 * explica a recusa. A mercadoria em transito (na mao de um serf) nao esta em armazem nenhum e
 * nao conta. Obra nao guarda mercadoria.
 */
export function estoqueDosArmazens(state: GameState): Readonly<Record<string, number>> {
  const total: Record<string, number> = {};
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    if (!predio || predio.estado !== 'completo' || predio.tipo !== ID_DO_ARMAZEM) continue;
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

/** Por que a fila de uma escola nao anda. Tres causas, tres acoes diferentes (F13b). */
export type MotivoDeEspera = 'a-caminho' | 'sem-estrada' | 'sem-ouro';

/** Um slot da fila de treino, como o painel o desenha. */
export interface ItemDoPainelDeTreino {
  readonly id: string;
  /** Id NEUTRO do civil (`stonemason`). Quem traduz e o tema, na `ui/`. */
  readonly unidade: string;
  readonly estado: 'aguardando' | 'treinando';
  /** Em [0,1). Vale 0 em `aguardando`. Derivado de `restam`: `ItemDeFila` nao guarda progresso. */
  readonly progresso: number;
  /** Por que este item nao comecou. `null` quando treina ou quando o ouro ja chegou. */
  readonly motivo: MotivoDeEspera | null;
}

/** Tudo que o painel da escola desenha (F13b). */
export interface PainelDaEscola {
  readonly predio: string;
  readonly slots: number;
  readonly itens: readonly ItemDoPainelDeTreino[];
  readonly podeEnfileirar: boolean;
  /** Os civis de `data/units.json`, na ordem do dado. Um botao por tipo. */
  readonly tiposTreinaveis: readonly string[];
  readonly custoPorUnidade: number;
}

/**
 * F13b — por que a fila desta escola esta parada. Tres causas, NESTA ordem,
 * porque pedem acoes opostas do jogador: esperar o carregador, puxar uma
 * estrada, ou ir atras de dinheiro. Mostrar o mesmo texto nas tres seria o
 * defeito da fila parada de novo, em menor escala.
 *
 * Nada aqui e campo novo. A tarefa ja esta no quadro — `gerarTarefasDeOuro` so a
 * cria quando ha ouro NAO RESERVADO e rota ate o armazem — e a ligacao e
 * derivada na hora (`predioLigadoAoArmazem`, F08).
 */
function motivoDaEspera(
  state: GameState, predioId: string, escola: Predio, dados: GameData,
): MotivoDeEspera | null {
  if (ouroNecessario(state, predioId, dados) <= 0) return null;
  const temTarefa = state.jobs.tarefas.ordem.some((id) => {
    const tarefa = state.jobs.tarefas.porId[id];
    return tarefa !== undefined
      && tarefa.tipo === 'ouro-para-escola' && tarefa.destino === predioId;
  });
  if (temTarefa) return 'a-caminho';
  return predioLigadoAoArmazem(state, escola, dados) ? 'sem-ouro' : 'sem-estrada';
}

/**
 * F13b — tudo que o painel da escola desenha, num objeto so. Mora aqui, e nao na
 * `ui/`, porque `ui/` nao varre estado (CLAUDE.md §3): o painel recebe isto
 * pronto e so escreve DOM. `null` quando o id nao e de uma escola completa — e
 * assim que o painel se fecha sozinho se o predio cair.
 *
 * O MOTIVO e da FILA, nao do item: `ouroNecessario` e um agregado da escola, e
 * nao existe "o ouro deste item".
 */
export function painelDaEscola(
  state: GameState, predioId: string, dados: GameData = gameData,
): PainelDaEscola | null {
  const escola = state.predios.porId[predioId];
  if (!ehEscolaCompleta(escola)) return null;

  const motivo = motivoDaEspera(state, predioId, escola, dados);
  const total = dados.economia.schoolhouse.ticksPorTreino;
  const itens = filaDaEscola(state, predioId).map((item) => ({
    id: item.id,
    unidade: item.unidade,
    estado: item.estado,
    progresso: item.estado === 'treinando' ? (total - item.restam) / total : 0,
    motivo: item.estado === 'treinando' ? null : motivo,
  }));

  return {
    predio: predioId,
    slots: dados.economia.schoolhouse.slotsDeFila,
    itens,
    podeEnfileirar: itens.length < dados.economia.schoolhouse.slotsDeFila,
    tiposTreinaveis: dados.unidades.civis.tipos.map((civil) => civil.id),
    custoPorUnidade: custoDeTreino(dados),
  };
}

/**
 * F13b — que predio ocupa este tile, ou `null`. Varre `predios.ordem` (nunca
 * `Object.keys`) e compara com o FOOTPRINT inteiro, nao com o canto: o jogador
 * clica no meio do predio. A porta fica fora do footprint, entao clicar nela nao
 * seleciona nada — e a mesma borda sul por onde o serf entra.
 */
export function predioNoTile(
  state: GameState, gx: number, gy: number, dados: GameData = gameData,
): string | null {
  for (const id of state.predios.ordem) {
    const predio = state.predios.porId[id];
    if (predio === undefined) continue;
    const caixa = caixaDoPredio(predio, dados);
    if (caixa === null) continue;
    if (gx >= caixa.x0 && gx < caixa.x1 && gy >= caixa.y0 && gy < caixa.y1) return id;
  }
  return null;
}

/** Uma linha de gaveta, como o painel a desenha (F16b). */
export interface ItemDeEstoque {
  /** Id NEUTRO da mercadoria (`stone`). Quem traduz e o tema, na `ui/`. */
  readonly mercadoria: string;
  readonly quantidade: number;
}

/** O ocupante de um predio, para o painel (F16b). */
export interface OcupanteDoPainel {
  /** Id da unidade (`u7`). */
  readonly unidade: string;
  /** Id NEUTRO do civil (`stonemason`). Quem traduz e o tema, na `ui/`. */
  readonly tipo: string;
}

/**
 * F16b — tudo que o painel de um predio QUALQUER desenha, num objeto so. Mora
 * aqui pela mesma razao que `PainelDaEscola`: `ui/` nao varre `GameState`
 * (CLAUDE.md §3), e o Vitest roda em `node`, entao uma regra que morasse no DOM
 * ficaria sem teste.
 */
export interface PainelDoPredio {
  readonly predio: string;
  /** Id NEUTRO do tipo (`quarry`); o NOME que o jogador le vem do tema. */
  readonly tipo: string;
  readonly estado: 'obra' | 'completo';
  /** HP ja martelado em obra; o `hp` do dado quando completo. */
  readonly hp: number;
  /** `def.hp` de `buildings.json` — o total nunca e guardado no estado. */
  readonly hpTotal: number;
  /** `hp / hpTotal`, em [0,1]. Vale 1 no predio completo. */
  readonly progresso: number;
  /** So em obra: o que ainda falta ENTREGAR. `null` no completo. */
  readonly faltam: readonly ItemDeEstoque[] | null;
  /** `null` em obra, no predio vago e no tipo que nao pede trabalhador. */
  readonly ocupante: OcupanteDoPainel | null;
  /**
   * O TIPO pede trabalhador. Existe para separar "vago" (true, `ocupante`
   * null) de "nao se aplica" (false) — sao coisas diferentes, e o painel
   * escreve textos diferentes. Um campo so juntaria as duas causas.
   */
  readonly pedeTrabalhador: boolean;
  /** `null` em obra: obra nao guarda mercadoria (contrato da F07). */
  readonly estoque: {
    readonly entrada: readonly ItemDeEstoque[];
    readonly saida: readonly ItemDeEstoque[];
  } | null;
  /** `producao !== null`. E o que decide se o botao pausar aparece: a sim aceita
   *  pausar qualquer predio completo, e quem esconde o botao e a tela (F16c). */
  readonly temProducao: boolean;
  readonly pausado: boolean;
}

/**
 * Uma gaveta virando linhas do painel. A ordem vem de `economia.mercadorias`,
 * NUNCA de `Object.keys` — a ordem de iteracao de chave nao numerica nao e
 * garantia da linguagem (contrato da F05a), e o dado ja traz uma ordem.
 * Mercadoria zerada nao vira linha: gaveta vazia tem rotulo proprio na tela.
 */
function gaveta(
  quantidades: Readonly<Record<string, number>>, dados: GameData,
): readonly ItemDeEstoque[] {
  const linhas: ItemDeEstoque[] = [];
  for (const mercadoria of dados.economia.mercadorias) {
    const quantidade = quantidades[mercadoria] ?? 0;
    if (quantidade > 0) linhas.push({ mercadoria, quantidade });
  }
  return linhas;
}

/**
 * F16b — o painel de um predio qualquer. `null` quando o id nao esta no estado,
 * e e assim que o painel se fecha sozinho no MESMO tick em que o predio e
 * demolido: nao ha evento para a tela ouvir, nem copia de estado para ficar
 * velha. Mesmo mecanismo de `painelDaEscola` (F13b).
 *
 * A escola continua sendo desenhada por `painelDaEscola`: este seletor nao sabe
 * o que e uma fila de treino, e o painel compoe os dois.
 */
export function painelDoPredio(
  state: GameState, predioId: string, dados: GameData = gameData,
): PainelDoPredio | null {
  const predio = state.predios.porId[predioId];
  if (predio === undefined) return null;
  const def = dados.predios.find((b) => b.id === predio.tipo);
  if (def === undefined) return null;

  const comum = {
    predio: predioId,
    tipo: predio.tipo,
    hp: predio.hp,
    hpTotal: def.hp,
    progresso: predio.hp / def.hp,
    pedeTrabalhador: trabalhadorDoTipo(predio.tipo, dados) !== null,
  };

  if (predio.estado === 'obra') {
    return {
      ...comum,
      estado: 'obra',
      faltam: gaveta(predio.obra.faltam, dados),
      ocupante: null,
      estoque: null,
      temProducao: false,
      pausado: false,
    };
  }

  const unidade = predio.ocupante === null ? undefined : state.unidades.porId[predio.ocupante];
  return {
    ...comum,
    estado: 'completo',
    faltam: null,
    ocupante: unidade === undefined ? null : { unidade: unidade.id, tipo: unidade.tipo },
    estoque: {
      entrada: gaveta(predio.estoque.entrada, dados),
      saida: gaveta(predio.estoque.saida, dados),
    },
    temProducao: predio.producao !== null,
    pausado: predio.pausado,
  };
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
