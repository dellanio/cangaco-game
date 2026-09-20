/**
 * Os dois sistemas do JobBoard que rodam TODO tick, depois dos comandos e nesta ordem:
 * `sanearTarefas` (revalida o que ja existe) e `gerarTarefas` (cria o que falta).
 *
 * `sanearTarefas` e o que garante o `release` em todo ramo de falha (CLAUDE.md §5:
 * "se `release` nao for chamado em algum ramo de erro, e bug"): em vez de sete `if`
 * espalhados que alguem precisa lembrar de chamar, toda tarefa reclamada e revalidada
 * contra o estado a cada tick, e o que deixou de valer passa por `liberar`. O ramo
 * "pedido da unidade" (a FSM do serf desiste) e o unico que nao e detectavel daqui:
 * quem o chama e a F10.
 *
 * Ordem fixa: tarefas por `numero` (o excedente sai do maior para o menor). Mesma
 * entrada, mesmo estado.
 */
import type { GameEvent, GameState, Predio, PredioCompleto, PredioEmObra, Tarefa } from '../state';
import { ID_DO_ARMAZEM } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { armazensCompletos, distanciaEntrePredios } from '../estradas';
import { criarTarefa, distanciaDaTarefa, liberar, TIPO_QUE_CARREGA } from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import { disponivelNaOrigem, reservadoNaOrigem, reservadoNoDestino } from '../reservas';

export interface ResultadoDeSistema {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

function tarefasPorNumero(state: GameState): Tarefa[] {
  return state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is Tarefa => t !== undefined)
    .sort((a, b) => a.numero - b.numero);
}

const ehArmazemCompleto = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DO_ARMAZEM;

const ehObra = (p: Predio | undefined): p is PredioEmObra => p !== undefined && p.estado === 'obra';

/** O motivo pelo qual uma tarefa reclamada, sozinha, deixou de valer; `null` se vale. */
function motivoIndividual(state: GameState, t: Tarefa, dados: GameData): MotivoDeLiberacao | null {
  const unidade = t.reclamadaPor === null ? undefined : state.unidades.porId[t.reclamadaPor];
  if (!unidade || unidade.tipo !== TIPO_QUE_CARREGA) return 'unidade-removida';
  const origem = state.predios.porId[t.origem];
  if (!ehArmazemCompleto(origem)) return 'origem-sumiu';
  const destino = state.predios.porId[t.destino];
  if (!destino) return 'destino-sumiu';
  if (!ehObra(destino)) return 'destino-completo';
  if (distanciaEntrePredios(state, origem, destino, dados) === null) return 'caminho-cortado';
  return null;
}

/** Tira uma tarefa ABERTA do quadro. Nao ha o que liberar (uma aberta nao reserva nada),
 *  entao nao emite `task-released`. */
function cancelarAberta(state: GameState, tarefaId: string): GameState {
  const porId = { ...state.jobs.tarefas.porId };
  delete porId[tarefaId];
  return { ...state, jobs: { tarefas: { porId, ordem: state.jobs.tarefas.ordem.filter((id) => id !== tarefaId) } } };
}

/** Uma aberta vale enquanto a origem e um armazem com algo livre, o destino e obra e ha
 *  caminho. Se a origem esvaziou, cancela: o gerador refaz a tarefa com outra origem. */
function abertaVale(state: GameState, t: Tarefa, dados: GameData): boolean {
  if (!ehArmazemCompleto(state.predios.porId[t.origem])) return false;
  if (!ehObra(state.predios.porId[t.destino])) return false;
  if (disponivelNaOrigem(state, t.origem, t.mercadoria) < 1) return false;
  return distanciaDaTarefa(state, t, dados) !== null;
}

export function sanearTarefas(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  const liberarComMotivo = (id: string, motivo: MotivoDeLiberacao): void => {
    const r = liberar(atual, id, motivo);
    atual = r.state;
    events.push(...r.events);
  };

  // 1. cada reclamada, sozinha: unidade, origem, destino, caminho
  for (const t of tarefasPorNumero(state)) {
    if (t.estado !== 'reclamada') continue;
    const motivo = motivoIndividual(atual, t, dados);
    if (motivo !== null) liberarComMotivo(t.id, motivo);
  }

  // 2. reclamadas em grupo: o reservado nao pode passar do que a origem tem nem do que
  //    a obra ainda pede. Do maior numero para o menor, ate caber.
  for (const t of tarefasPorNumero(atual).reverse()) {
    if (t.estado !== 'reclamada') continue;
    const origem = atual.predios.porId[t.origem];
    const destino = atual.predios.porId[t.destino];
    if (ehArmazemCompleto(origem) && (origem.estoque.saida[t.mercadoria] ?? 0) < reservadoNaOrigem(atual, t.origem, t.mercadoria)) {
      liberarComMotivo(t.id, 'origem-sem-recurso');
    } else if (ehObra(destino) && (destino.obra.faltam[t.mercadoria] ?? 0) < reservadoNoDestino(atual, t.destino, t.mercadoria)) {
      liberarComMotivo(t.id, 'destino-completo');
    }
  }

  // 3. abertas que nao valem mais
  for (const t of tarefasPorNumero(atual)) {
    if (t.estado === 'aberta' && !abertaVale(atual, t, dados)) atual = cancelarAberta(atual, t.id);
  }

  // 4. abertas em excesso: nunca mais tarefas (abertas + reclamadas) do que a obra pede
  for (const t of tarefasPorNumero(atual).reverse()) {
    if (t.estado !== 'aberta') continue;
    const destino = atual.predios.porId[t.destino];
    const faltam = ehObra(destino) ? destino.obra.faltam[t.mercadoria] ?? 0 : 0;
    const existentes = tarefasPorNumero(atual).filter((o) => o.destino === t.destino && o.mercadoria === t.mercadoria).length;
    if (existentes > faltam) atual = cancelarAberta(atual, t.id);
  }

  return { state: atual, events };
}

/** O armazem completo de menor caminho por estrada ate `obra` que tem `mercadoria`
 *  livre; empate: o primeiro em `predios.ordem`. `null` se nenhum serve. */
function origemMaisPerto(state: GameState, obra: PredioEmObra, mercadoria: string, dados: GameData): string | null {
  let melhor: { id: string; distancia: number } | null = null;
  for (const armazem of armazensCompletos(state)) {
    if (disponivelNaOrigem(state, armazem.id, mercadoria) < 1) continue;
    const distancia = distanciaEntrePredios(state, armazem, obra, dados);
    if (distancia === null) continue;
    if (melhor === null || distancia < melhor.distancia) melhor = { id: armazem.id, distancia };
  }
  return melhor === null ? null : melhor.id;
}

/**
 * Cria as tarefas de nivel "material para obra": para cada obra e cada mercadoria de
 * `faltam` (na ordem de `economia.mercadorias`), tantas tarefas quantas faltam menos as
 * que ja existem. Sem armazem ligado e com estoque, nao cria: a obra espera, e a
 * tarefa surge quando a estrada e o estoque existirem.
 *
 * A condicao "obra ja nivelada" do GDD nao e avaliavel ainda (a `Obra` da F07 nao tem
 * campo de nivelamento; a F11 acrescenta o campo E o portao aqui).
 */
export function gerarTarefas(state: GameState, dados: GameData = gameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const obra = atual.predios.porId[id];
    if (!ehObra(obra)) continue;
    for (const mercadoria of dados.economia.mercadorias) {
      const faltam = obra.obra.faltam[mercadoria] ?? 0;
      const existentes = tarefasPorNumero(atual).filter((t) => t.destino === obra.id && t.mercadoria === mercadoria).length;
      if (faltam <= existentes) continue;
      const origem = origemMaisPerto(atual, obra, mercadoria, dados);
      if (origem === null) continue;
      for (let i = existentes; i < faltam; i++) {
        atual = criarTarefa(atual, { mercadoria, origem, destino: obra.id }).state;
      }
    }
  }
  return atual;
}
