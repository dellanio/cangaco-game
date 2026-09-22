/**
 * Montagem de cenarios do JobBoard, so para teste. Constroi o estado DIRETO (sem
 * passar por `step`), de proposito: os testes de claim/release precisam de um numero
 * exato de tarefas, e o gerador (que roda no `step`) criaria as suas.
 */
import { createInitialState } from '../../src/sim/state';
import type {
  GameState, PredioCompleto, PredioEmObra, Tarefa, TarefaConstruir, TarefaMaterialParaObra, Unidade,
} from '../../src/sim/state';
import { chaveDeTile } from '../../src/sim/estradas';
import type { TileDeGrid } from '../../src/sim/estradas';
import { alvoDeNivelamento } from '../../src/sim/obra';

export const inicial = createInitialState(1);

export const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });

export const linhaH = (x0: number, x1: number, y: number): TileDeGrid[] =>
  Array.from({ length: x1 - x0 + 1 }, (_, i) => tile(x0 + i, y));

export const linhaV = (x: number, y0: number, y1: number): TileDeGrid[] =>
  Array.from({ length: y1 - y0 + 1 }, (_, i) => tile(x, y0 + i));

export function estradasDe(tiles: readonly TileDeGrid[]): GameState['estradas'] {
  return Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const]));
}

/** Acrescenta tiles de estrada (sem custo, sem validar: e montagem de teste). */
export function comEstradas(estado: GameState, tiles: readonly TileDeGrid[]): GameState {
  return { ...estado, estradas: { ...estado.estradas, ...estradasDe(tiles) } };
}

export function armazemDoCenario(estado: GameState): PredioCompleto {
  const p = estado.predios.ordem.map((id) => estado.predios.porId[id]).find((x) => x?.tipo === 'storehouse');
  if (!p || p.estado !== 'completo') throw new Error('fixture: cenario sem armazem');
  return p;
}

/**
 * Acrescenta uma obra em (gx, gy), sem validar. `tipo` define o footprint e a
 * porta. `nivelamento` default = JA NIVELADA (`alvoDeNivelamento(tipo)`): o
 * universo implicito de F09/F10 (escritas antes da F11c) e uma obra que ja
 * aceita material — os testes da F11c passam `nivelamento: 0` explicitamente
 * quando querem o laborer nivelando do zero.
 */
export function comObra(
  estado: GameState,
  id: string,
  opcoes: {
    readonly gx: number; readonly gy: number; readonly tipo?: string;
    readonly faltam: Record<string, number>; readonly nivelamento?: number;
  },
): GameState {
  const tipo = opcoes.tipo ?? 'quarry';
  const obra: PredioEmObra = {
    id, tipo, gx: opcoes.gx, gy: opcoes.gy, estado: 'obra', hp: 0,
    obra: { faltam: opcoes.faltam, nivelamento: opcoes.nivelamento ?? alvoDeNivelamento(tipo) },
  };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: obra }, ordem: [...estado.predios.ordem, id] },
  };
}

/** Troca a pedra da gaveta `saida` de um predio completo. */
export function comPedraNaSaida(estado: GameState, id: string, pedra: number): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = { ...p, estoque: { ...p.estoque, saida: { ...p.estoque.saida, stone: pedra } } };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

export function serfsDoCenario(estado: GameState): string[] {
  return estado.unidades.ordem.filter((id) => estado.unidades.porId[id]?.tipo === 'serf');
}

export function laborersDoCenario(estado: GameState): string[] {
  return estado.unidades.ordem.filter((id) => estado.unidades.porId[id]?.tipo === 'laborer');
}

export function tarefaDe(parcial: Partial<TarefaMaterialParaObra> & { readonly numero: number }): TarefaMaterialParaObra {
  return {
    id: `t${parcial.numero}`,
    tipo: 'material-para-obra',
    mercadoria: 'stone',
    origem: armazemDoCenario(inicial).id,
    destino: 'obra-a',
    estado: 'aberta',
    reclamadaPor: null,
    ...parcial,
  };
}

/** F11b — a irma de `tarefaDe` para tarefas de construir: sem
 *  mercadoria/origem, sem estado `'carregando'`. */
export function tarefaConstruirDe(parcial: Partial<TarefaConstruir> & { readonly numero: number }): TarefaConstruir {
  return {
    id: `t${parcial.numero}`,
    tipo: 'construir',
    destino: 'obra-a',
    estado: 'aberta',
    reclamadaPor: null,
    ...parcial,
  };
}

/** F11b: `proximoId` sobe para passar do maior `numero` dado, nunca desce. Sem isto, um
 *  `gerarTarefas` chamado depois (agora sempre cria 'construir' tambem) podia reusar um
 *  `numero` que a fixture ja escolheu a mao — dois `t<numero>` diferentes colidindo no
 *  mesmo id, um sobrescrevendo o outro em `porId` e duplicado em `ordem`. */
export function comTarefas(estado: GameState, tarefas: readonly Tarefa[]): GameState {
  const maiorNumero = tarefas.reduce((m, t) => Math.max(m, t.numero), 0);
  return {
    ...estado,
    proximoId: Math.max(estado.proximoId, maiorNumero + 1),
    jobs: {
      tarefas: {
        porId: Object.fromEntries(tarefas.map((t) => [t.id, t])),
        ordem: tarefas.map((t) => t.id),
      },
    },
  };
}

/**
 * O cenario basico: o armazem do cenario inicial (30 de pedra na saida), uma obra
 * `obra-a` (quarry) em (26,34) e uma estrada de 5 tiles ligando a porta do armazem
 * (29,33) a porta da obra (28,36). Sem nenhuma tarefa.
 */
export function cenarioLigado(faltam: Record<string, number> = { stone: 2, timber: 3 }): GameState {
  const comObraA = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam });
  return comEstradas(comObraA, [tile(29, 33), tile(29, 34), tile(29, 35), tile(29, 36), tile(28, 36)]);
}

/** Um armazem completo a mais, com a pedra e a tabua dadas na saida. */
export function comArmazemCompleto(
  estado: GameState, id: string, opcoes: { readonly gx: number; readonly gy: number; readonly stone?: number; readonly timber?: number },
): GameState {
  const predio: PredioCompleto = {
    id, tipo: 'storehouse', gx: opcoes.gx, gy: opcoes.gy, estado: 'completo', hp: 0,
    capacidade: { entrada: null, saida: null },
    estoque: { entrada: {}, saida: { stone: opcoes.stone ?? 0, timber: opcoes.timber ?? 0 } },
  };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: predio }, ordem: [...estado.predios.ordem, id] },
  };
}

/** Troca a pedra E a tabua da saida de um predio completo. */
export function comEstoqueNaSaida(estado: GameState, id: string, estoque: { readonly stone: number; readonly timber: number }): GameState {
  const p = estado.predios.porId[id];
  if (!p || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao e predio completo`);
  const novo: PredioCompleto = { ...p, estoque: { ...p.estoque, saida: { ...p.estoque.saida, ...estoque } } };
  return { ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, [id]: novo } } };
}

/** Tira um predio do estado (demolir, no que importa aqui). */
export function semOPredio(estado: GameState, id: string): GameState {
  const porId = { ...estado.predios.porId };
  delete porId[id];
  return { ...estado, predios: { porId, ordem: estado.predios.ordem.filter((x) => x !== id) } };
}

/** Tira uma unidade do estado (a unidade morreu). */
export function semAUnidade(estado: GameState, id: string): GameState {
  const porId = { ...estado.unidades.porId };
  delete porId[id];
  return { ...estado, unidades: { porId, ordem: estado.unidades.ordem.filter((x) => x !== id) } };
}

/**
 * O caso adversarial da distancia euclidiana. O armazem tem a porta em y=33
 * (x 29..31). A obra PERTO fica logo abaixo dele, mas a unica estrada que chega a
 * porta dela da uma volta grande; a obra LONGE fica muito mais ao sul, mas tem uma
 * estrada quase reta. Em linha reta a PERTO ganha; pelo caminho a pe, a LONGE.
 */
export function cenarioDeVolta(): GameState {
  let estado = comObra(inicial, 'perto', { gx: 29, gy: 34, faltam: { stone: 1 } }); // porta y=36, x 29..31
  estado = comObra(estado, 'longe', { gx: 28, gy: 45, faltam: { stone: 1 } }); // porta y=47, x 28..30
  const voltaGrande = [
    ...linhaH(29, 40, 33), ...linhaV(40, 34, 36), ...linhaH(31, 39, 36), // porta (31,36) so por aqui
  ];
  const retaQuase = [tile(28, 33), tile(27, 33), ...linhaV(27, 34, 47), tile(28, 47)];
  return comEstradas(estado, [...voltaGrande, ...retaQuase]);
}

/** Poe uma unidade em (gx, gy), ociosa e sem `fsmData` (so o lugar muda). */
export function comUnidadeEm(estado: GameState, id: string, gx: number, gy: number): GameState {
  const u = estado.unidades.porId[id];
  if (!u) throw new Error(`fixture: unidade '${id}' nao existe`);
  return { ...estado, unidades: { ...estado.unidades, porId: { ...estado.unidades.porId, [id]: { ...u, gx, gy } } } };
}

/** F11b — acrescenta uma unidade nova (id `id`, tipo `tipo`), ociosa e sem
 *  `fsmData`. O cenario inicial so tem 2 laborers; testes de teto
 *  (`laborersMaximosPorObra`) precisam de mais do que isso. */
export function comUnidadeExtra(estado: GameState, id: string, tipo: string, gx: number, gy: number): GameState {
  const unidade: Unidade = { id, tipo, gx, gy, fsm: 'ocioso', fsmData: {} };
  return {
    ...estado,
    unidades: { porId: { ...estado.unidades.porId, [id]: unidade }, ordem: [...estado.unidades.ordem, id] },
  };
}
