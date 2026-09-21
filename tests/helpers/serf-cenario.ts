/**
 * Montagem e conducao de cenarios do serf (F10), so para teste.
 */
import { step } from '../../src/sim/tick';
import type { Command } from '../../src/sim/commands';
import type { GameEvent, GameState, PredioCompleto, PredioEmObra } from '../../src/sim/state';
import {
  armazemDoCenario, comArmazemCompleto, comEstradas, comObra, comPedraNaSaida, comTarefas, comUnidadeEm, inicial, linhaH,
  linhaV, semAUnidade, serfsDoCenario, tarefaDe, tile,
} from './jobs-cenario';

export const armazemDoJogo = armazemDoCenario(inicial);
export const serfDoJogo = ((): string => {
  const id = serfsDoCenario(inicial)[0];
  if (id === undefined) throw new Error('fixture: o cenario deveria ter serfs');
  return id;
})();

/** So o primeiro serf: os outros saem do estado. */
export const soUmSerf = (estado: GameState): GameState =>
  serfsDoCenario(estado).filter((id) => id !== serfDoJogo).reduce((e, id) => semAUnidade(e, id), estado);

/**
 * Uma rua longa do armazem (porta em (29,33)) ate uma obra a leste, 18 passos de estrada:
 * o serf fica bastante tempo em viagem, e da para agir no meio dela. Um serf, 10 de pedra
 * no armazem, a obra pede `faltam` (1 de pedra por padrao).
 */
export function cenarioLongo(faltam: Record<string, number> = { stone: 1 }): GameState {
  return soUmSerf(comEstradas(
    comObra(comPedraNaSaida(inicial, armazemDoJogo.id, 10), 'obra-a', { gx: 44, gy: 34, faltam }),
    [...linhaV(29, 33, 36), ...linhaH(29, 46, 36)],
  ));
}

export const fsmDe = (estado: GameState, id: string = serfDoJogo): string => estado.unidades.porId[id]?.fsm ?? 'sumiu';

export const saidaDe = (estado: GameState, predioId: string, m = 'stone'): number => {
  const p = estado.predios.porId[predioId] as PredioCompleto | undefined;
  return p?.estoque.saida[m] ?? Number.NaN;
};

export const faltamDe = (estado: GameState, obraId: string, m = 'stone'): number => {
  const p = estado.predios.porId[obraId] as PredioEmObra | undefined;
  return p?.obra.faltam[m] ?? Number.NaN;
};

export const quieto = (e: GameState): boolean =>
  e.tick > 2 && e.jobs.tarefas.ordem.length === 0 && serfsDoCenario(e).every((id) => fsmDe(e, id) === 'ocioso');

/** Anda ate a condicao valer; falha alto se ela nunca vale. */
export function ate(inicio: GameState, cond: (e: GameState) => boolean, descricao: string, maximo = 800): GameState {
  let atual = inicio;
  for (let i = 0; i < maximo; i++) {
    if (cond(atual)) return atual;
    atual = step(atual, []);
  }
  throw new Error(`ate: a condicao '${descricao}' nunca valeu em ${maximo} ticks (ultimo estado: tick ${atual.tick}, serf ${fsmDe(atual)})`);
}

/** Roda ate `parar` (ou `maximo`), devolvendo o estado final e todos os eventos do caminho. */
export function rodarAte(
  inicio: GameState, parar: (e: GameState) => boolean, comandos: readonly Command[] = [], maximo = 800,
): { estado: GameState; eventos: GameEvent[]; ticks: number } {
  const eventos: GameEvent[] = [];
  let atual = inicio;
  let i = 0;
  for (; i < maximo && !(parar(atual) && i > 0); i++) {
    atual = step(atual, i === 0 ? comandos : []);
    eventos.push(...atual.events);
  }
  return { estado: atual, eventos, ticks: i };
}

export const liberacoes = (eventos: readonly GameEvent[]): Extract<GameEvent, { type: 'task-released' }>[] =>
  eventos.filter((e): e is Extract<GameEvent, { type: 'task-released' }> => e.type === 'task-released');

const serfNoCenario = (i: number): string => {
  const id = serfsDoCenario(inicial)[i];
  if (id === undefined) throw new Error(`fixture: o cenario deveria ter o serf ${i}`);
  return id;
};
/** Os dois serfs do cenario do muro: X do lado do armazem 'a', Y do outro lado do muro. */
export const SERF_DO_LADO_DE_A = serfNoCenario(0);
export const SERF_DO_LADO_DE_B = serfNoCenario(1);

/**
 * O caso adversarial da perna do serf. Um MURO de obras (y=16..17, x=8..40) separa o serf Y
 * (20,20) do armazem 'a' (porta em (20,13)); o armazem 'b' (porta em (20,33)) esta a 13
 * linhas de Y, sem muro no meio. A reta ate 'a' (7) e menor que ate 'b' (13); a pe, o muro
 * inverte. As pernas de ENTREGA sao iguais por simetria (38 passos cada), entao so a perna
 * unidade -> origem desempata. O serf X (20,11), do lado de 'a' do muro, e o contraponto.
 */
export function cenarioDoMuro(): GameState {
  let estado = comArmazemCompleto(inicial, 'a', { gx: 18, gy: 10, stone: 5 });
  estado = comArmazemCompleto(estado, 'b', { gx: 18, gy: 30, stone: 5 });
  for (let i = 0; i < 11; i++) estado = comObra(estado, `muro${i}`, { gx: 8 + 3 * i, gy: 16, faltam: {} });
  estado = comObra(estado, 'dest', { gx: 44, gy: 21, faltam: { stone: 2 } });
  estado = comEstradas(estado, [
    ...linhaH(20, 47, 13), ...linhaV(47, 13, 23), // de 'a' ate a porta da obra
    ...linhaH(20, 47, 33), ...linhaV(47, 23, 33), // de 'b' ate a porta da obra
    tile(46, 23), tile(45, 23), tile(44, 23),
  ]);
  estado = comUnidadeEm(estado, SERF_DO_LADO_DE_B, 20, 20);
  estado = comUnidadeEm(estado, SERF_DO_LADO_DE_A, 20, 11);
  return comTarefas(estado, [
    tarefaDe({ numero: 1, origem: 'a', destino: 'dest' }),
    tarefaDe({ numero: 2, origem: 'b', destino: 'dest' }),
  ]);
}
