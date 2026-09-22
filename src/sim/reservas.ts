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
import type { GameState, TarefaDeTransporte } from './state';
import { ehTarefaDeTransporte } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { ouroNecessario } from './escola';

/** Unidades de `mercadoria` reservadas na ORIGEM `predioId`: so tarefas `reclamada` — a
 *  `carregando` ja consumiu a reserva da origem na coleta (F10). Vale para todo tipo
 *  de transporte (F13: material e ouro saem do mesmo armazem e disputam o estoque). */
export function reservadoNaOrigem(state: GameState, predioId: string, mercadoria: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && ehTarefaDeTransporte(t) && t.estado === 'reclamada' && t.origem === predioId && t.mercadoria === mercadoria) soma += 1;
  }
  return soma;
}

/** Vagas de `mercadoria` reservadas no DESTINO `predioId`: tarefas reclamadas E
 *  carregando (F10). Entre a coleta e a entrega a tarefa mantem so esta reserva. */
export function reservadoNoDestino(state: GameState, predioId: string, mercadoria: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && ehTarefaDeTransporte(t) && t.estado !== 'aberta' && t.destino === predioId && t.mercadoria === mercadoria) soma += 1;
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

/**
 * F13 — quanto o destino de uma tarefa de transporte ainda PEDE, antes de descontar
 * reserva: obra -> `faltam[mercadoria]`; escola -> a demanda da fila de treino. O
 * ramo e escolhido pelo TIPO da tarefa (exaustivo), nao pelo estado do predio: uma
 * tarefa de material apontando para escola, ou de ouro para obra, pede zero — e o
 * que faz `sanearTarefas` cancelar a tarefa em vez de entregar no lugar errado.
 */
export function demandaNoDestino(
  state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData,
): number {
  if (tarefa.tipo === 'material-para-obra') {
    const predio = state.predios.porId[tarefa.destino];
    if (!predio || predio.estado !== 'obra') return 0;
    return predio.obra.faltam[tarefa.mercadoria] ?? 0;
  }
  return ouroNecessario(state, tarefa.destino, dados);
}

/**
 * A vaga que ainda pode ser reservada no destino de uma tarefa de transporte:
 * `demanda - reservado`. Pode ficar NEGATIVA quando a demanda encolhe debaixo de uma
 * reserva (item de fila cancelado com o serf a caminho) — e esse sinal que
 * `sanearTarefas` usa para desfazer o excesso.
 */
export function vagaDoDestino(
  state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData,
): number {
  return demandaNoDestino(state, tarefa, dados)
    - reservadoNoDestino(state, tarefa.destino, tarefa.mercadoria);
}

/** Vagas de CONSTRUCAO (F11b) reservadas na obra `predioId`: tarefas
 *  `'construir'` que nao estao abertas — so `'reclamada'` existe para esse
 *  tipo (sem `'carregando'`, o laborer nao carrega nada). */
export function laborersReservados(state: GameState, predioId: string): number {
  let soma = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t && t.tipo === 'construir' && t.estado !== 'aberta' && t.destino === predioId) soma += 1;
  }
  return soma;
}

/** A vaga de laborer ainda reservavel na obra: teto (dado) - reservado. So
 *  obra. O teto nunca encolhe em runtime (e constante do dado), diferente de
 *  `faltam` — por isso nao ha checagem de grupo equivalente em
 *  `sanearTarefas` para este tipo (ver o comentario la). */
export function vagaDeConstrucao(state: GameState, predioId: string, dados: GameData = gameData): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'obra') return 0;
  return dados.construcao.laborersMaximosPorObra - laborersReservados(state, predioId);
}
