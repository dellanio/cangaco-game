/**
 * As reservas do JobBoard, DERIVADAS das tarefas `reclamada` (ver `Tarefa` em
 * state.ts). Nao ha contador: a reserva existe enquanto a tarefa esta reclamada e
 * deixa de existir com ela — por isso "release restaura exatamente o estado
 * anterior" e estrutural, e a reserva sobrevive ao save/load de graca.
 *
 * Este modulo so depende de tipos do estado (nao de `estradas`): o debito de pedra
 * da estrada (F08) precisa do `disponivel`, e `jobs.ts` precisa de `estradas` —
 * separar aqui evita o ciclo.
 *
 * Custo: cada consulta e O(nº de tarefas). Nao medido; ver o cenario de carga em
 * `test-output/F09.json` e a nota da F10 no BUILD_PLAN. Se pedir indice, e otimizacao
 * (por predio e mercadoria), nao mudanca de contrato.
 */
import type { GameState } from './state';

/** Unidades de `mercadoria` reservadas na ORIGEM `predioId`: so tarefas `reclamada` — a
 *  `carregando` ja consumiu a reserva da origem na coleta (F10). */
export function reservadoNaOrigem(state: GameState, predioId: string, mercadoria: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.estado === 'reclamada' && t.origem === predioId && t.mercadoria === mercadoria) soma += 1;
  }
  return soma;
}

/** Vagas de `mercadoria` reservadas no DESTINO `predioId`: tarefas reclamadas E
 *  carregando (F10). Entre a coleta e a entrega a tarefa mantem so esta reserva. */
export function reservadoNoDestino(state: GameState, predioId: string, mercadoria: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.estado !== 'aberta' && t.destino === predioId && t.mercadoria === mercadoria) soma += 1;
  }
  return soma;
}

/** O que um serf ainda pode reservar na origem: `saida - reservado`. So a gaveta
 *  `saida` (e de la que o serf retira, decisao da F05a) e so de armazem completo. */
export function disponivelNaOrigem(state: GameState, predioId: string, mercadoria: string): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  return (predio.estoque.saida[mercadoria] ?? 0) - reservadoNaOrigem(state, predioId, mercadoria);
}

/** A vaga que ainda pode ser reservada no destino: `faltam - reservado`. So obra. */
export function vagaNoDestino(state: GameState, predioId: string, mercadoria: string): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'obra') return 0;
  return (predio.obra.faltam[mercadoria] ?? 0) - reservadoNoDestino(state, predioId, mercadoria);
}
