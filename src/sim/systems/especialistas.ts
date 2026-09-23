/**
 * F14 — a FSM do especialista (GDD §6.2), um passo por tick, na ordem de
 * `unidades.ordem`.
 *
 *   ocioso -> indo_ocupar -> trabalhando
 *
 * O GDD chama o primeiro estado de `sem_predio`; aqui ele e `ocioso`, o mesmo de
 * toda unidade recem-nascida (`systems/escolas.ts`) e o que
 * `ficarOcioso`/`ocioso` produzem. Mesmo significado, um nome so (Nota do item
 * F14 no BUILD_PLAN). Os outros dois estados do GDD (`esperando_insumo`,
 * `saida_cheia`) sao de PRODUCAO e nascem na F15.
 *
 * MOVIMENTO: modo `'livre'`, como o laborer — o especialista nao carrega nada e
 * nao depende de estrada para chegar.
 *
 * A POSSE mora no PREDIO (`PredioCompleto.ocupante`), nunca na unidade:
 * `trabalhando` e verdade enquanto o predio ainda aponta para ela. Predio
 * demolido (F16) e ocupante morto (F20) desfazem a posse pelos dois lados —
 * `sanearOcupacao` do lado do predio, `passoTrabalhando` do lado da unidade.
 *
 * Quem SEGURA a tarefa e revalidado por `sanearTarefas`, como nas outras FSMs:
 * nenhum ramo aqui precisa lembrar de liberar por conta do destino.
 */
import type { GameEvent, GameState, PredioCompleto, TarefaOcupar, Unidade } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { caminhoAtePredioCompleto, liberar, reclamarMelhorOcupacao, removerTarefa } from '../jobs';
import { ehPredioOcupavel, predioAceita, predioDoOcupante, tiposQueOcupam } from '../ocupacao';
import { tileAndavel } from '../pathfinding';
import { andar, chegou, comPredio, comUnidade, dadosDaFsm, ficarOcioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

type Passo = ResultadoDeSistema;

const semEventos = (state: GameState): Passo => ({ state, events: [] });

/** A tarefa de OCUPAR desta unidade, se existe, esta `'reclamada'` e e mesmo dela. */
function tarefaDoEspecialista(state: GameState, u: Unidade): TarefaOcupar | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  return t !== undefined && t.tipo === 'ocupar' && t.estado === 'reclamada' && t.reclamadaPor === u.id ? t : null;
}

/**
 * Desfaz a posse que deixou de valer, do lado do PREDIO: ocupante que nao existe
 * mais (morreu, F20) ou que nao e do tipo que o predio pede (save de outra
 * versao). Devolve o MESMO objeto quando nada muda — molde de `sanearFilas`
 * (systems/escolas.ts): um tick normal nao aloca estado novo por causa disto.
 */
export function sanearOcupacao(state: GameState, dados: GameData = gameData): GameState {
  let atual = state;
  for (const id of state.predios.ordem) {
    const predio = atual.predios.porId[id];
    if (predio === undefined || predio.estado !== 'completo' || predio.ocupante === null) continue;
    const ocupante = atual.unidades.porId[predio.ocupante];
    if (ocupante !== undefined && predioAceita(predio, ocupante.tipo, dados)) continue;
    atual = comPredio(atual, { ...predio, ocupante: null });
  }
  return atual;
}

// --- os estados ---

function passoOcioso(state: GameState, u: Unidade, dados: GameData): Passo {
  const r = reclamarMelhorOcupacao(state, u.id, dados);
  if (!r.ok) return semEventos(state);
  const bruta = r.state.jobs.tarefas.porId[r.tarefa];
  const tarefa = bruta?.tipo === 'ocupar' ? bruta : undefined;
  const caminho = tarefa === undefined ? null : caminhoAtePredioCompleto(r.state, tarefa.destino, u.id, dados);
  if (tarefa === undefined || caminho === null) {
    // o claim ja exigiu o caminho; se ele sumiu, devolve a reserva em vez de segurar a tarefa
    const l = liberar(r.state, r.tarefa, 'pedido-da-unidade');
    return { state: l.state, events: l.events };
  }
  return semEventos(comUnidade(r.state, {
    ...u, fsm: 'indo_ocupar', fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
  }));
}

function passoIndoOcupar(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoEspecialista(state, u);
  if (tarefa === null) return ficarOcioso(state, u); // o quadro a cancelou
  const predio = state.predios.porId[tarefa.destino];
  // outro especialista, mais cedo no MESMO tick, pode ter ocupado o predio: a
  // tarefa deste so e cancelada no tick seguinte, mas nao ha mais o que fazer aqui.
  if (!ehPredioOcupavel(predio, dados) || predio.ocupante !== null) return ficarOcioso(state, u);

  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !tileAndavel(state, proximo, 'livre', dados)) {
    // um predio foi plantado no caminho: replaneja a partir de onde esta
    const caminho = caminhoAtePredioCompleto(state, tarefa.destino, u.id, dados);
    if (caminho === null) {
      const l = liberar(state, tarefa.id, 'pedido-da-unidade'); // so a UNIDADE nao chega: reabre
      return ficarOcioso(l.state, u, l.events);
    }
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));

  // Chegou: a posse passa ao predio e a tarefa SAI do quadro no mesmo tick. Nao
  // existe instante com ocupante e reserva ao mesmo tempo.
  const ocupado: PredioCompleto = { ...predio, ocupante: u.id };
  const semATarefa = removerTarefa(comPredio(state, ocupado), tarefa.id);
  return {
    state: comUnidade(semATarefa, { ...andou, fsm: 'trabalhando', fsmData: {} }),
    events: [{ type: 'building-occupied', predio: ocupado.id, unidade: u.id, tipo: u.tipo }],
  };
}

function passoTrabalhando(state: GameState, u: Unidade): Passo {
  // A posse mora no predio: sumiu, deixou de ser ocupavel ou passou a apontar
  // para outro, este especialista volta a procurar. Nada alem disso na F14 —
  // PRODUZIR e F15, e e la que entram `esperando_insumo` e `saida_cheia`.
  return predioDoOcupante(state, u.id) === null ? ficarOcioso(state, u) : semEventos(state);
}

function passoDoEspecialista(state: GameState, u: Unidade, dados: GameData): Passo {
  switch (u.fsm) {
    case 'ocioso': return passoOcioso(state, u, dados);
    case 'indo_ocupar': return passoIndoOcupar(state, u, dados);
    case 'trabalhando': return passoTrabalhando(state, u);
    default:
      // `fsm` e uma string no estado (JSON): um valor fora do GDD §6.2 e save corrompido
      throw new Error(`sistemaDosEspecialistas: estado de FSM desconhecido '${u.fsm}' no especialista ${u.id}`);
  }
}

/** Um tick da FSM de cada especialista, na ordem de `unidades.ordem`.
 *  Determinista. Especialista e quem OCUPA algum predio segundo
 *  `buildings.json` — serf e laborer nao aparecem la, entao nao entram aqui e
 *  nao disputam tarefa com ninguem (mesma regra da F11b, agora vinda do dado). */
export function sistemaDosEspecialistas(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = sanearOcupacao(state, dados);
  const events: GameEvent[] = [];
  const ocupam = tiposQueOcupam(dados);
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || !ocupam.has(u.tipo)) continue;
    const r = passoDoEspecialista(atual, u, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
