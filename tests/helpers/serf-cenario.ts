/**
 * Montagem e conducao de cenarios do serf (F10), so para teste.
 */
import { step } from '../../src/sim/tick';
import type { Command } from '../../src/sim/commands';
import type { GameEvent, GameState, PredioCompleto, PredioEmObra } from '../../src/sim/state';
import {
  armazemDoCenario, comArmazemCompleto, comEstradas, comObra, comPedraNaSaida, comTarefas, comUnidadeEm, inicial, 
  semAUnidade, semLaborers, serfsDoCenario, tarefaDe, 
} from './jobs-cenario';
import { linhaHDe, linhaVDe, naVila, xy } from './ancoras';

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
 * no armazem, a obra pede `faltam` (1 de pedra por padrao). Sem laborers (F11c): o
 * universo destas suites e o serf sozinho, e `comObra` ja nasce nivelada por default.
 */
export function cenarioLongo(faltam: Record<string, number> = { stone: 1 }): GameState {
  return soUmSerf(semLaborers(comEstradas(
    comObra(comPedraNaSaida(inicial, armazemDoJogo.id, 10), 'obra-a', { ...naVila(15, 4), faltam }),
    [...linhaVDe(naVila, 0, 3, 6), ...linhaHDe(naVila, 0, 17, 6)],
  )));
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

// F11b: so tarefas de MATERIAL contam para "quieto" — 'construir' fica aberta ate o teto
// para sempre nesta feature (sem FSM de laborer ainda para reclama-la, F11c), entao exigir
// zero tarefas no total nunca ficaria quieto com uma obra no mapa.
export const quieto = (e: GameState): boolean =>
  e.tick > 2
  && e.jobs.tarefas.ordem.filter((id) => e.jobs.tarefas.porId[id]?.tipo === 'material-para-obra').length === 0
  && serfsDoCenario(e).every((id) => fsmDe(e, id) === 'ocioso');

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
 * inverte. As pernas de ENTREGA sao iguais por simetria, entao so a perna
 * unidade -> origem desempata. O serf X (20,11), do lado de 'a' do muro, e o contraponto.
 *
 * F18e: com a estrada ligando em 8 direcoes, a simetria passou a exigir 'quina-sul'.
 * As duas rotas cortam a quina do proprio L com uma diagonal e chegam ao mesmo cotovelo,
 * mas a de cima nao corta a ultima quina, porque o footprint de 'dest' (44..46, 21..22)
 * tapa (46,22). Sem um bloqueio espelhado ao sul, a rota de baixo cortaria essa quina,
 * ficaria 3 ticks mais barata, e o cenario deixaria de medir o que diz medir.
 */
export function cenarioDoMuro(): GameState {
  let estado = comArmazemCompleto(semLaborers(inicial), 'a', { ...naVila(-11, -20), stone: 5 });
  estado = comArmazemCompleto(estado, 'b', { ...naVila(-11, 0), stone: 5 });
  for (let i = 0; i < 11; i++) estado = comObra(estado, `muro${i}`, { ...naVila(-21 + 3 * i, -14), faltam: {} });
  estado = comObra(estado, 'dest', { ...naVila(15, -9), faltam: { stone: 2 } });
  estado = comObra(estado, 'quina-sul', { ...naVila(15, -6), faltam: {} }); // ver F18e, acima
  estado = comEstradas(estado, [
    ...linhaHDe(naVila, -9, 18, -17), ...linhaVDe(naVila, 18, -17, -7), // de 'a' ate a porta da obra
    ...linhaHDe(naVila, -9, 18, 3), ...linhaVDe(naVila, 18, -7, 3), // de 'b' ate a porta da obra
    naVila(17, -7), naVila(16, -7), naVila(15, -7),
  ]);
  estado = comUnidadeEm(estado, SERF_DO_LADO_DE_B, ...xy(naVila(-9, -10)));
  estado = comUnidadeEm(estado, SERF_DO_LADO_DE_A, ...xy(naVila(-9, -19)));
  return comTarefas(estado, [
    tarefaDe({ numero: 1, origem: 'a', destino: 'dest' }),
    tarefaDe({ numero: 2, origem: 'b', destino: 'dest' }),
  ]);
}
