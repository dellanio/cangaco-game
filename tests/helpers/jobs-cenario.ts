/**
 * Montagem de cenarios do JobBoard, so para teste. Constroi o estado DIRETO (sem
 * passar por `step`), de proposito: os testes de claim/release precisam de um numero
 * exato de tarefas, e o gerador (que roda no `step`) criaria as suas.
 */
import { createInitialState } from '../../src/sim/state';
import type { GameState, PredioCompleto, PredioEmObra, Tarefa } from '../../src/sim/state';
import { chaveDeTile } from '../../src/sim/estradas';
import type { TileDeGrid } from '../../src/sim/estradas';

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

/** Acrescenta uma obra em (gx, gy), sem validar. `tipo` define o footprint e a porta. */
export function comObra(
  estado: GameState, id: string, opcoes: { readonly gx: number; readonly gy: number; readonly tipo?: string; readonly faltam: Record<string, number> },
): GameState {
  const obra: PredioEmObra = {
    id, tipo: opcoes.tipo ?? 'quarry', gx: opcoes.gx, gy: opcoes.gy, estado: 'obra', hp: 0,
    obra: { faltam: opcoes.faltam },
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

export function tarefaDe(parcial: Partial<Tarefa> & { readonly numero: number }): Tarefa {
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

export function comTarefas(estado: GameState, tarefas: readonly Tarefa[]): GameState {
  return {
    ...estado,
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
