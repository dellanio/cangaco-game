/**
 * O JobBoard (CLAUDE.md §5): criacao, `reclamar` (claim), `liberar` (release) e a
 * reserva dupla — a unidade de recurso na origem e a vaga no destino. Tudo puro:
 * recebe o estado, devolve o estado novo.
 *
 * Quem usa: o `step()` (gerar e sanear tarefas, `systems/jobs.ts`) e, na F10, a FSM
 * do serf. Nada aqui e `Command`: o jogador nao manda serf (CLAUDE.md §1).
 *
 * A RESERVA nao e um campo: e derivada das tarefas `reclamada` (`reservas.ts`).
 * Por isso `reclamar` e atomico por construcao (uma unica atribuicao de estado, so
 * depois de todas as checagens) e `liberar` devolve as DUAS reservas de uma vez.
 */
import type { GameEvent, GameState, Tarefa, TipoDeTarefa } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { distanciaEntrePredios } from './estradas';
import { disponivelNaOrigem, vagaNoDestino } from './reservas';

/**
 * Por que uma tarefa reclamada foi liberada. Cada motivo devolve as DUAS reservas
 * (e a reserva e derivada da tarefa, entao nao ha como devolver so uma).
 *
 *  - reabrem a MESMA tarefa (falha so da unidade): `unidade-removida`,
 *    `pedido-da-unidade`;
 *  - CANCELAM a tarefa (origem, caminho ou destino ja nao valem; o gerador cria outra
 *    com a origem certa): `caminho-cortado`, `origem-sumiu`, `origem-sem-recurso`,
 *    `destino-sumiu`, `destino-completo`.
 */
export type MotivoDeLiberacao =
  | 'unidade-removida'
  | 'pedido-da-unidade'
  | 'caminho-cortado'
  | 'origem-sumiu'
  | 'origem-sem-recurso'
  | 'destino-sumiu'
  | 'destino-completo';

const MOTIVOS_QUE_REABREM: readonly MotivoDeLiberacao[] = ['unidade-removida', 'pedido-da-unidade'];

export type MotivoDeRecusaDoClaim =
  | 'tarefa-inexistente'
  | 'tarefa-ja-reclamada'
  | 'unidade-invalida'
  | 'unidade-ocupada'
  | 'origem-sem-recurso'
  | 'destino-sem-vaga'
  | 'sem-caminho';

export type ResultadoDoClaim =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDoClaim };

export type ResultadoDoClaimMelhor =
  | { readonly ok: true; readonly state: GameState; readonly tarefa: string }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDoClaim | 'sem-tarefa-aberta' };

/** So o serf carrega mercadoria. Id estrutural, como `ID_DO_ARMAZEM`. */
export const TIPO_QUE_CARREGA = 'serf';

/** O nivel do tipo na escada de `delivery.json`, lido pelo `id` — nunca um numero em
 *  `.ts`. Falha alto se o dado nao tem o id: assumir um nivel escondido seria pior. */
export function nivelDoTipo(tipo: TipoDeTarefa, dados: GameData = gameData): number {
  const linha = dados.entrega.prioridades.find((p) => p.id === tipo);
  if (linha === undefined) {
    throw new Error(`nivelDoTipo: '${tipo}' nao esta na escada de delivery.json (prioridades[].id)`);
  }
  return linha.nivel;
}

/** Cria uma tarefa ABERTA (nao reserva nada). O id e o numero vem do contador
 *  `proximoId`, compartilhado com predios e unidades. */
export function criarTarefa(
  state: GameState,
  campos: { readonly mercadoria: string; readonly origem: string; readonly destino: string; readonly tipo?: TipoDeTarefa },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const id = `t${numero}`;
  const tarefa: Tarefa = {
    id, numero, tipo: campos.tipo ?? 'material-para-obra', mercadoria: campos.mercadoria,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return {
    id,
    state: {
      ...state,
      proximoId: numero + 1,
      jobs: {
        tarefas: {
          porId: { ...state.jobs.tarefas.porId, [id]: tarefa },
          ordem: [...state.jobs.tarefas.ordem, id],
        },
      },
    },
  };
}

function unidadeJaTemTarefa(state: GameState, unidadeId: string): boolean {
  return state.jobs.tarefas.ordem.some((id) => {
    const t = state.jobs.tarefas.porId[id];
    return t !== undefined && t.estado !== 'aberta' && t.reclamadaPor === unidadeId;
  });
}

/** Distancia por estrada, pelas portas, do armazem de origem ate a obra de destino;
 *  `null` se algum dos dois nao existe ou nao ha caminho. */
export function distanciaDaTarefa(state: GameState, tarefa: Tarefa, dados: GameData = gameData): number | null {
  const origem = state.predios.porId[tarefa.origem];
  const destino = state.predios.porId[tarefa.destino];
  if (!origem || !destino) return null;
  return distanciaEntrePredios(state, origem, destino, dados);
}

/**
 * O claim: reserva, ao mesmo tempo, a unidade de recurso na origem e a vaga no
 * destino, ou nao reserva nada. ATOMICO: todas as checagens vem antes da unica
 * atribuicao de estado; uma recusa devolve so o motivo, e o estado do chamador nao foi
 * tocado.
 *
 * Ordem das checagens (fixada por teste): tarefa existe, esta aberta, unidade valida
 * (existe e e `serf`), unidade livre, origem com disponivel, destino com vaga, caminho.
 */
export function reclamar(
  state: GameState, tarefaId: string, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaim {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa) return { ok: false, motivo: 'tarefa-inexistente' };
  if (tarefa.estado !== 'aberta') return { ok: false, motivo: 'tarefa-ja-reclamada' };

  const unidade = state.unidades.porId[unidadeId];
  if (!unidade || unidade.tipo !== TIPO_QUE_CARREGA) return { ok: false, motivo: 'unidade-invalida' };
  if (unidadeJaTemTarefa(state, unidadeId)) return { ok: false, motivo: 'unidade-ocupada' };

  if (disponivelNaOrigem(state, tarefa.origem, tarefa.mercadoria) < 1) {
    return { ok: false, motivo: 'origem-sem-recurso' };
  }
  if (vagaNoDestino(state, tarefa.destino, tarefa.mercadoria) < 1) {
    return { ok: false, motivo: 'destino-sem-vaga' };
  }
  if (distanciaDaTarefa(state, tarefa, dados) === null) return { ok: false, motivo: 'sem-caminho' };

  const reclamada: Tarefa = { ...tarefa, estado: 'reclamada', reclamadaPor: unidadeId };
  return {
    ok: true,
    state: {
      ...state,
      jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: reclamada }, ordem: state.jobs.tarefas.ordem } },
    },
  };
}

/**
 * O release: tira a tarefa de `reclamada` (ou `carregando`), e com isso devolve o que
 * ela reservava (as DUAS pontas, ou so o destino). Numa `reclamada`, motivo de UNIDADE
 * reabre a mesma tarefa; motivo de origem, caminho ou destino a CANCELA (o gerador cria
 * outra, com a origem certa). Numa `carregando`, sempre cancela. Tarefa aberta ou
 * inexistente: no-op. Devolve os eventos para quem chama juntar aos do tick.
 */
export function liberar(
  state: GameState, tarefaId: string, motivo: MotivoDeLiberacao,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa || tarefa.estado === 'aberta') return { state, events: [] };

  // `carregando` (F10) SEMPRE cancela: a reserva da origem ja foi consumida na coleta, a
  // carga volta a um armazem que pode nao ser o de origem, e o gerador recria a tarefa
  // com a origem certa. Reabrir deixaria uma tarefa aberta cuja origem nao tem a unidade.
  if (tarefa.estado === 'reclamada' && MOTIVOS_QUE_REABREM.includes(motivo)) {
    const reaberta: Tarefa = { ...tarefa, estado: 'aberta', reclamadaPor: null };
    return {
      state: {
        ...state,
        jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: reaberta }, ordem: state.jobs.tarefas.ordem } },
      },
      events: [{ type: 'task-released', tarefa: tarefaId, motivo, resultado: 'reaberta' }],
    };
  }

  const porId = { ...state.jobs.tarefas.porId };
  delete porId[tarefaId];
  return {
    state: {
      ...state,
      jobs: { tarefas: { porId, ordem: state.jobs.tarefas.ordem.filter((id) => id !== tarefaId) } },
    },
    events: [{ type: 'task-released', tarefa: tarefaId, motivo, resultado: 'cancelada' }],
  };
}

/**
 * As tarefas ABERTAS na ordem de escolha: `(nivel, distancia por estrada, numero)`.
 * `numero` numerico, nao a string do id ('t10' < 't2'). Distancia `null` (sem caminho)
 * vai para o fim. A escada le o nivel do dado; so o nivel 3 tem produtor hoje.
 */
export function tarefasEmOrdem(state: GameState, dados: GameData = gameData): Tarefa[] {
  const abertas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is Tarefa => t !== undefined && t.estado === 'aberta');
  const chaves = new Map(abertas.map((t) => [t.id, {
    nivel: nivelDoTipo(t.tipo, dados),
    distancia: distanciaDaTarefa(state, t, dados) ?? Number.POSITIVE_INFINITY,
  }]));
  return [...abertas].sort((a, b) => {
    const ca = chaves.get(a.id);
    const cb = chaves.get(b.id);
    if (!ca || !cb) return 0;
    if (ca.nivel !== cb.nivel) return ca.nivel - cb.nivel;
    if (ca.distancia !== cb.distancia) return ca.distancia < cb.distancia ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** Reclama, para `unidadeId`, a melhor tarefa aberta QUE DER para reclamar (a melhor
 *  por ordem pode nao dar: sem estoque, sem vaga, sem caminho). */
export function reclamarMelhor(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasEmOrdem(state, dados);
  const primeira = candidatas[0];
  if (primeira === undefined) return { ok: false, motivo: 'sem-tarefa-aberta' };
  let primeiraRecusa: MotivoDeRecusaDoClaim | null = null;
  for (const tarefa of candidatas) {
    const r = reclamar(state, tarefa.id, unidadeId, dados);
    if (r.ok) return { ok: true, state: r.state, tarefa: tarefa.id };
    primeiraRecusa ??= r.motivo;
  }
  return { ok: false, motivo: primeiraRecusa ?? 'sem-tarefa-aberta' };
}
