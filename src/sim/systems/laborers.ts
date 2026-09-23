/**
 * A FSM do laborer (GDD §6.3), um passo por tick, para cada laborer em `unidades.ordem`.
 *
 *   ocioso -> indo_a_obra -> nivelando -> esperando_material -> martelando -> ocioso
 *
 * Nenhum estado alem destes cinco (o GDD proibe). `esperando_material` e estado real e
 * visivel: o laborer fica parado na obra enquanto ha material a caminho.
 *
 * NIVELAMENTO e HP sao da OBRA, nao do laborer — varios laborers na mesma obra somam no
 * MESMO tick (a dobra sequencial de `sistemaDosLaborers`, como o `sistemaDosSerfs`).
 *
 * MOVIMENTO: modo `'livre'` (o laborer nao carrega nada, e precisa chegar a obra ANTES de
 * existir estrada — GDD §5.1: ele nivela primeiro). Reusa `sim/units/movimento.ts`.
 *
 * A REAVALIACAO (`reavaliar`, usada ao sair de `indo_a_obra`, `nivelando` e `martelando`)
 * NUNCA libera a tarefa — so decide entre nivelando/martelando/esperando_material. Ela roda
 * ANTES de `gerarTarefas` no mesmo tick (ver `tick.ts`): uma obra que acabou de nivelar
 * ainda nao tem tarefa de material (ela so nasce logo depois, em `gerarTarefas`); se a
 * reavaliacao checasse `obraTrabalhavel` aqui, toda obra que termina de nivelar geraria uma
 * liberacao espuria por laborer. SO `esperando_material` libera (por `'pedido-da-unidade'`,
 * que REABRE a tarefa — `jobs.ts:MOTIVOS_QUE_REABREM`) — e so no tick seguinte, quando
 * "sem tarefa de material" volta a ser informacao verdadeira.
 *
 * `reclamar` (jobs.ts) tambem recusa obra nao trabalhavel, do outro lado: sem os dois,
 * o laborer soltaria e reclamaria a mesma obra sem trabalho a cada tick.
 */
import type { GameEvent, GameState, PredioEmObra, TarefaConstruir, Unidade } from '../state';
import { completarObra } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import {
  caminhoAteAObra, cancelarConstrucoesDe, liberar, reclamarMelhorConstrucao, removerTarefa, TIPO_QUE_CONSTROI,
} from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import { alvoDeNivelamento, hpTotalDoTipo, obraNivelada, obraTrabalhavel, tetoDeHp } from '../obra';
import { tileAndavel } from '../pathfinding';
import { andar, chegou, comPredio, comUnidade, dadosDaFsm, ficarOcioso, ocioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

type Passo = ResultadoDeSistema;

const semEventos = (state: GameState): Passo => ({ state, events: [] });

/** A tarefa de CONSTRUIR do laborer, se ela existe, esta `'reclamada'` e e mesmo dele.
 *  So laborer reclama `'construir'` (`elegivelParaTarefa`, F11b) — o filtro de tipo aqui
 *  e so para o compilador estreitar; o laborer nunca segura `'material-para-obra'`. */
function tarefaDoLaborer(state: GameState, u: Unidade): TarefaConstruir | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  return t !== undefined && t.tipo === 'construir' && t.estado === 'reclamada' && t.reclamadaPor === u.id ? t : null;
}

/** A obra da tarefa, SE o destino ainda e obra. `null` quando outro laborer, mais cedo no
 *  MESMO tick, completou a obra: a tarefa deste continua `'reclamada'` (o `sanearTarefas`
 *  so a cancela no tick seguinte, `'destino-completo'`), mas nao ha mais o que fazer aqui. */
function obraDaTarefa(state: GameState, tarefa: TarefaConstruir): PredioEmObra | null {
  const p = state.predios.porId[tarefa.destino];
  return p !== undefined && p.estado === 'obra' ? p : null;
}

/** Libera a tarefa (que sai de `reclamada`) e devolve os eventos. */
function liberarTarefa(state: GameState, tarefaId: string, motivo: MotivoDeLiberacao): { state: GameState; events: readonly GameEvent[] } {
  return liberar(state, tarefaId, motivo);
}

/** Decide o proximo estado a partir da obra ATUAL — NUNCA libera (ver o comentario do
 *  topo do arquivo: a ordem no tick e o que torna isso seguro). */
function reavaliar(obra: PredioEmObra, u: Unidade, tarefa: TarefaConstruir, dados: GameData): Unidade {
  if (!obraNivelada(obra, dados)) return { ...u, fsm: 'nivelando', fsmData: dadosDaFsm({ tarefa: tarefa.id }) };
  if (obra.hp < tetoDeHp(obra, dados)) return { ...u, fsm: 'martelando', fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso: 0 }) };
  return { ...u, fsm: 'esperando_material', fsmData: dadosDaFsm({ tarefa: tarefa.id }) };
}

// --- os estados ---

function passoOcioso(state: GameState, u: Unidade, dados: GameData): Passo {
  const r = reclamarMelhorConstrucao(state, u.id, dados);
  if (!r.ok) return semEventos(state);
  const bruta = r.state.jobs.tarefas.porId[r.tarefa];
  const tarefa = bruta?.tipo === 'construir' ? bruta : undefined;
  const caminho = tarefa === undefined ? null : caminhoAteAObra(r.state, tarefa.destino, u.id, dados);
  if (tarefa === undefined || caminho === null) {
    // o claim ja exigiu o caminho; se ele sumiu, devolve a reserva em vez de segurar a tarefa
    const l = liberarTarefa(r.state, r.tarefa, 'pedido-da-unidade');
    return { state: l.state, events: l.events };
  }
  return semEventos(comUnidade(r.state, {
    ...u, fsm: 'indo_a_obra', fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
  }));
}

function passoIndoAObra(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoLaborer(state, u);
  if (tarefa === null) return ficarOcioso(state, u); // o quadro a cancelou (destino sumiu/completou)
  const obra = obraDaTarefa(state, tarefa);
  if (obra === null) return ficarOcioso(state, u); // outro laborer completou a obra neste tick

  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !tileAndavel(state, proximo, 'livre', dados)) {
    // um predio foi plantado no caminho: replaneja a partir de onde esta
    const caminho = caminhoAteAObra(state, tarefa.destino, u.id, dados);
    if (caminho === null) {
      const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade'); // so a UNIDADE nao chega: reabre
      return ficarOcioso(l.state, u, l.events);
    }
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));
  return semEventos(comUnidade(state, reavaliar(obra, andou, tarefa, dados)));
}

function passoNivelando(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoLaborer(state, u);
  if (tarefa === null) return ficarOcioso(state, u);
  const obra = obraDaTarefa(state, tarefa);
  if (obra === null) return ficarOcioso(state, u);

  const alvo = alvoDeNivelamento(obra.tipo, dados);
  const nivelamento = Math.min(obra.obra.nivelamento + 1, alvo);
  const nivelada: PredioEmObra = { ...obra, obra: { ...obra.obra, nivelamento } };
  const comONivelamento = comPredio(state, nivelada);
  if (nivelamento < alvo) return semEventos(comUnidade(comONivelamento, u));
  return semEventos(comUnidade(comONivelamento, reavaliar(nivelada, u, tarefa, dados)));
}

function passoEsperandoMaterial(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoLaborer(state, u);
  if (tarefa === null) return ficarOcioso(state, u);
  const obra = obraDaTarefa(state, tarefa);
  if (obra === null) return ficarOcioso(state, u);

  if (obra.hp < tetoDeHp(obra, dados)) {
    return semEventos(comUnidade(state, { ...u, fsm: 'martelando', fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso: 0 }) }));
  }
  if (!obraTrabalhavel(state, obra.id, dados)) {
    // SO este estado libera (ver o comentario do topo do arquivo): aqui "sem tarefa de
    // material" e informacao verdadeira, porque `gerarTarefas` ja rodou no tick anterior.
    const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade');
    return ficarOcioso(l.state, u, l.events);
  }
  return semEventos(state); // material a caminho: espera onde esta
}

function passoMartelando(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoLaborer(state, u);
  if (tarefa === null) return ficarOcioso(state, u);
  const obra = obraDaTarefa(state, tarefa);
  if (obra === null) return ficarOcioso(state, u);

  const progresso = (u.fsmData.progresso ?? 0) + 1;
  if (progresso < dados.construcao.ticksPorMartelada) {
    return semEventos(comUnidade(state, { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso }) }));
  }

  const hpTotal = hpTotalDoTipo(obra.tipo, dados);
  const hp = Math.min(obra.hp + dados.construcao.hpPorMartelada, hpTotal);
  const martelada: PredioEmObra = { ...obra, hp };
  if (hp >= hpTotal) {
    const completo = completarObra(martelada, dados);
    const semATarefa = removerTarefa(comPredio(state, completo), tarefa.id);
    // BUG-001: as tarefas IRMAS (dos outros laborers e as abertas do teto) saem no
    // MESMO tick. Antes elas sobreviviam ate `sanearTarefas` do tick seguinte, e
    // nesse intervalo o quadro apontava para um predio que ja nao era obra.
    const irmas = cancelarConstrucoesDe(semATarefa, completo.id);
    return {
      state: comUnidade(semOsOrfaos(irmas.state, u.id), ocioso(u)),
      events: [
        ...irmas.events,
        { type: 'building-completed', predio: completo.id, tipo: completo.tipo },
      ],
    };
  }
  const comAMartelada = comPredio(state, martelada);
  const proximo = martelada.hp >= tetoDeHp(martelada, dados)
    ? { ...u, fsm: 'esperando_material' as const, fsmData: dadosDaFsm({ tarefa: tarefa.id }) }
    : { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso: 0 }) };
  return semEventos(comUnidade(comAMartelada, proximo));
}

/**
 * BUG-001, a outra metade: cancelar a tarefa irma deixaria o laborer que a
 * segurava em `martelando` (ou `nivelando`) sem tarefa reclamada — violacao da
 * invariante da FSM, e ele so passaria pela propria FSM no tick SEGUINTE.
 *
 * Por que aqui e nao la: quando `sanearTarefas` cancela, ele roda ANTES dos
 * laborers no tick (ver tick.ts), e cada um se conserta sozinho no proprio
 * passo. A conclusao acontece NO MEIO do laco, entao quem ja passou precisa ser
 * devolvido a `ocioso` pelo concluinte. So e tocado quem esta segurando um id
 * que nao existe mais — nenhum laborer com tarefa viva muda de estado.
 */
function semOsOrfaos(state: GameState, concluinteId: string): GameState {
  let atual = state;
  for (const id of state.unidades.ordem) {
    const outro = atual.unidades.porId[id];
    if (outro === undefined || outro.tipo !== TIPO_QUE_CONSTROI || outro.id === concluinteId) continue;
    const daTarefa = outro.fsmData.tarefa;
    if (daTarefa === undefined || atual.jobs.tarefas.porId[daTarefa] !== undefined) continue;
    atual = comUnidade(atual, ocioso(outro));
  }
  return atual;
}

function passoDoLaborer(state: GameState, u: Unidade, dados: GameData): Passo {
  switch (u.fsm) {
    case 'ocioso': return passoOcioso(state, u, dados);
    case 'indo_a_obra': return passoIndoAObra(state, u, dados);
    case 'nivelando': return passoNivelando(state, u, dados);
    case 'esperando_material': return passoEsperandoMaterial(state, u, dados);
    case 'martelando': return passoMartelando(state, u, dados);
    default:
      // `fsm` e uma string no estado (JSON): um valor fora do GDD §6.3 e save corrompido
      throw new Error(`sistemaDosLaborers: estado de FSM desconhecido '${u.fsm}' no laborer ${u.id}`);
  }
}

/** Um tick da FSM de cada laborer, na ordem de `unidades.ordem`. Determinista. */
export function sistemaDosLaborers(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || u.tipo !== TIPO_QUE_CONSTROI) continue;
    const r = passoDoLaborer(atual, u, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
