/**
 * A FSM do serf (GDD §6.2), um passo por tick, para cada serf em `unidades.ordem`.
 *
 *   ocioso -> indo_buscar -> carregando -> indo_entregar -> entregando -> ocioso
 *
 * e `devolvendo` como saida de erro: leva a carga ao armazem completo mais proximo e la a
 * deposita. Nenhum estado alem destes seis (o GDD proibe): `devolvendo` so existe COM carga
 * — falha antes da coleta nao tem o que devolver, a tarefa e liberada e o serf volta a
 * `ocioso`.
 *
 * O CICLO EM DUAS FASES (a nota da F09):
 *  - COLETA (estado `carregando`): a reserva da origem e consumida — `estoque.saida[m] - 1`
 *    — e vira carga em `fsmData.carga`; a tarefa passa a `carregando` e mantem so a reserva
 *    do destino. E aqui que o material SAI do armazem (a entrega que a F07 esperava).
 *  - ENTREGA (estado `entregando`): a vaga do destino e consumida — `faltam[m] - 1` — e a
 *    tarefa sai do quadro.
 * `carregando` e `entregando` duram UM tick cada: nao ha tempo de manuseio no dado.
 *
 * MOVIMENTO: `fsmData.caminho` (tiles a andar, sem o atual) e `fsmData.progresso` (ticks no
 * passo em curso). O passo custa `custoDoPasso` (dado); ao completa-lo o serf passa ao
 * tile seguinte. A perna carregada so pisa em estrada (`obrigatoriaParaEntrega`); as outras
 * (indo buscar, devolvendo) andam por qualquer tile livre.
 *
 * QUEM LIBERA O QUE: o `sanearTarefas` (roda antes, no mesmo tick) ja cancela a tarefa
 * quando a origem, o destino ou a unidade somem; o serf so tem que REAGIR a uma tarefa que
 * sumiu debaixo dele. O que so o serf sabe — o caminho dele cortado, a perna livre
 * bloqueada — ele libera aqui, por `liberar`. Toda tarefa reclamada tem caminho de volta.
 */
import type {
  GameEvent, GameState, Predio, PredioCompleto, PredioEmObra, Tarefa, TarefaDeTransporte, Unidade,
} from '../state';
import { ehTarefaDeTransporte, gavetaDeOrigem, MERCADORIA_DE_OURO } from '../state';
import { ID_DO_ARMAZEM } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { armazensCompletos, ehEstrada, isConnected, tilesDaPorta } from '../estradas';
import type { TileDeGrid } from '../estradas';
import { liberar, marcarCarregando, planoDaTarefa, portasDeEstrada, reclamarMelhor, removerTarefa, TIPO_QUE_CARREGA } from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import { buscarCaminho, tileAndavel } from '../pathfinding';
import { ehEscolaCompleta } from '../escola';
import { demandaNoDestino } from '../reservas';
import { andar, chegou, comUnidade, dadosDaFsm, ficarOcioso, noTile, ocioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

type Passo = ResultadoDeSistema;

const semEventos = (state: GameState): Passo => ({ state, events: [] });

function comPredio(state: GameState, predio: Predio): GameState {
  return { ...state, predios: { ...state.predios, porId: { ...state.predios.porId, [predio.id]: predio } } };
}

/** A tarefa de TRANSPORTE do serf, se ela existe, esta no estado esperado e e mesmo
 *  dele. So serf reclama transporte (`elegivelParaTarefa`, F11b/F13) — o filtro de
 *  tipo aqui e so para o compilador estreitar o tipo, o serf nunca segura uma tarefa
 *  'construir' em runtime. */
function tarefaDoSerf(state: GameState, u: Unidade, estado: Tarefa['estado']): TarefaDeTransporte | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  return t !== undefined && ehTarefaDeTransporte(t) && t.estado === estado && t.reclamadaPor === u.id ? t : null;
}

/** Libera a tarefa (que sai de `reclamada` ou `carregando`) e devolve os eventos. */
function liberarTarefa(state: GameState, tarefaId: string, motivo: MotivoDeLiberacao): { state: GameState; events: readonly GameEvent[] } {
  return liberar(state, tarefaId, motivo);
}

// --- devolvendo: o armazem completo mais proximo ---

/** O armazem completo de menor custo A* (livre) a partir de `de`; empate: o primeiro em `predios.ordem`. */
function armazemMaisProximo(state: GameState, de: TileDeGrid, dados: GameData): { id: string; caminho: readonly TileDeGrid[] } | null {
  let melhor: { id: string; caminho: readonly TileDeGrid[]; custo: number } | null = null;
  for (const armazem of armazensCompletos(state)) {
    const rota = buscarCaminho(state, de, tilesDaPorta(armazem, dados), 'livre', dados);
    if (rota !== null && (melhor === null || rota.custo < melhor.custo)) melhor = { id: armazem.id, caminho: rota.tiles, custo: rota.custo };
  }
  return melhor === null ? null : { id: melhor.id, caminho: melhor.caminho };
}

/** Entra em `devolvendo` com a carga que tem. Sem armazem alcancavel, espera onde esta. */
function comecarADevolver(state: GameState, u: Unidade, carga: string, dados: GameData): GameState {
  const alvo = armazemMaisProximo(state, noTile(u), dados);
  const fsmData = alvo === null
    ? dadosDaFsm({ carga })
    : dadosDaFsm({ carga, armazem: alvo.id, caminho: alvo.caminho, progresso: 0 });
  return comUnidade(state, { ...u, fsm: 'devolvendo', fsmData });
}

// --- os estados ---

function passoOcioso(state: GameState, u: Unidade, dados: GameData): Passo {
  const r = reclamarMelhor(state, u.id, dados);
  if (!r.ok) return semEventos(state);
  // reclamarMelhor (F11b: filtrado por elegivelParaTarefa) so devolve tarefa de
  // transporte para um serf; o filtro aqui e so para o compilador estreitar o tipo.
  const bruta = r.state.jobs.tarefas.porId[r.tarefa];
  const tarefa = bruta !== undefined && ehTarefaDeTransporte(bruta) ? bruta : undefined;
  const plano = tarefa === undefined ? null : planoDaTarefa(r.state, tarefa, u.id, dados);
  if (tarefa === undefined || plano === null) {
    // o claim ja exigiu um plano; se ele sumiu, devolve a reserva em vez de segurar a tarefa
    const l = liberarTarefa(r.state, r.tarefa, 'pedido-da-unidade');
    return { state: l.state, events: l.events };
  }
  return semEventos(comUnidade(r.state, {
    ...u, fsm: 'indo_buscar', fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: plano.ateAOrigem.tiles, progresso: 0 }),
  }));
}

function passoIndoBuscar(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoSerf(state, u, 'reclamada');
  if (tarefa === null) return ficarOcioso(state, u); // o quadro a cancelou (origem, destino, caminho...)

  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !tileAndavel(state, proximo, 'livre', dados)) {
    // um predio foi plantado no caminho: replaneja a partir de onde esta
    const plano = planoDaTarefa(state, tarefa, u.id, dados);
    if (plano === null) {
      const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade'); // so a UNIDADE nao chega: reabre
      return ficarOcioso(l.state, u, l.events);
    }
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: plano.ateAOrigem.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  return semEventos(comUnidade(state, chegou(andou) ? { ...andou, fsm: 'carregando' } : andou));
}

function passoCarregando(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoSerf(state, u, 'reclamada');
  if (tarefa === null) return ficarOcioso(state, u);

  // F15b — de qual gaveta o serf tira vem do TIPO da tarefa, nao mais de
  // "sempre a saida": no nivel 7 a carga esta presa na gaveta `entrada`.
  const gaveta = gavetaDeOrigem(tarefa.tipo);
  const origem = state.predios.porId[tarefa.origem];
  if (origem === undefined || origem.estado !== 'completo' || (origem.estoque[gaveta][tarefa.mercadoria] ?? 0) < 1) {
    const l = liberarTarefa(state, tarefa.id, 'origem-sem-recurso');
    return ficarOcioso(l.state, u, l.events);
  }
  // o caminho de volta para a entrega tem que existir ANTES de o material sair do armazem
  const rota = buscarCaminho(state, noTile(u), portasDeEstrada(state, tarefa.destino, dados), 'estrada', dados);
  if (rota === null) {
    const l = liberarTarefa(state, tarefa.id, 'caminho-cortado');
    return ficarOcioso(l.state, u, l.events);
  }

  const semUma: PredioCompleto = {
    ...origem,
    estoque: {
      ...origem.estoque,
      [gaveta]: { ...origem.estoque[gaveta], [tarefa.mercadoria]: (origem.estoque[gaveta][tarefa.mercadoria] ?? 0) - 1 },
    },
  };
  const carregada = marcarCarregando(comPredio(state, semUma), tarefa.id);
  return semEventos(comUnidade(carregada, {
    ...u, fsm: 'indo_entregar',
    fsmData: dadosDaFsm({ tarefa: tarefa.id, carga: tarefa.mercadoria, caminho: rota.tiles, progresso: 0 }),
  }));
}

function passoIndoEntregar(state: GameState, u: Unidade, dados: GameData): Passo {
  const carga = u.fsmData.carga;
  if (carga === undefined) return ficarOcioso(state, u); // sem carga nao ha o que entregar (dado corrompido)
  const tarefa = tarefaDoSerf(state, u, 'carregando');
  if (tarefa === null) return semEventos(comecarADevolver(state, u, carga, dados)); // o quadro cancelou: devolve

  const agora = noTile(u);
  const portas = portasDeEstrada(state, tarefa.destino, dados);
  // estrada cortada: o tile onde esta deixou de ser estrada, ou nao liga mais a nenhuma porta da obra
  const ligado = ehEstrada(state.estradas, agora) && portas.some((p) => isConnected(state, agora, p));
  if (!ligado) {
    const l = liberarTarefa(state, tarefa.id, 'caminho-cortado');
    return { state: comecarADevolver(l.state, u, carga, dados), events: l.events };
  }

  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !ehEstrada(state.estradas, proximo)) {
    // ainda ha ligacao, mas o proximo tile da rota foi demolido: replaneja pela rede
    const rota = buscarCaminho(state, agora, portas, 'estrada', dados);
    if (rota === null) {
      const l = liberarTarefa(state, tarefa.id, 'caminho-cortado');
      return { state: comecarADevolver(l.state, u, carga, dados), events: l.events };
    }
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, carga, caminho: rota.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  return semEventos(comUnidade(state, chegou(andou) ? { ...andou, fsm: 'entregando' } : andou));
}

/** A entrega numa OBRA: `faltam[m] - 1`. `null` se o destino ja nao e obra ou nao
 *  pede mais essa mercadoria. A obra nao guarda mercadoria (CONTRATO, state.ts). */
function entregarMaterial(state: GameState, tarefa: TarefaDeTransporte): PredioEmObra | null {
  const destino = state.predios.porId[tarefa.destino];
  if (destino === undefined || destino.estado !== 'obra') return null;
  const faltam = destino.obra.faltam[tarefa.mercadoria] ?? 0;
  if (faltam < 1) return null;
  return { ...destino, obra: { ...destino.obra, faltam: { ...destino.obra.faltam, [tarefa.mercadoria]: faltam - 1 } } };
}

/** F13 — a entrega numa ESCOLA: o ouro entra na gaveta `entrada`, de onde o treino o
 *  cobra. `null` se o destino deixou de ser escola completa. */
function entregarOuro(state: GameState, tarefa: TarefaDeTransporte): PredioCompleto | null {
  const destino = state.predios.porId[tarefa.destino];
  if (!ehEscolaCompleta(destino)) return null;
  const tinha = destino.estoque.entrada[MERCADORIA_DE_OURO] ?? 0;
  return {
    ...destino,
    estoque: { ...destino.estoque, entrada: { ...destino.estoque.entrada, [MERCADORIA_DE_OURO]: tinha + 1 } },
  };
}

/** F15b — a entrega num PRODUTOR (niveis 4 e 5): o insumo entra na gaveta
 *  `entrada`, de onde `producao.ts` o cobra no inicio do ciclo. `null` se o
 *  destino deixou de ser predio completo. */
function entregarInsumo(state: GameState, tarefa: TarefaDeTransporte): PredioCompleto | null {
  const destino = state.predios.porId[tarefa.destino];
  if (destino === undefined || destino.estado !== 'completo') return null;
  const tinha = destino.estoque.entrada[tarefa.mercadoria] ?? 0;
  return {
    ...destino,
    estoque: { ...destino.estoque, entrada: { ...destino.estoque.entrada, [tarefa.mercadoria]: tinha + 1 } },
  };
}

/** F15b — o deposito num ARMAZEM: a mercadoria entra na gaveta `saida`, de onde
 *  os serfs retiram. E o MESMO gesto da devolucao de carga e da entrega dos
 *  niveis 6 e 7 — uma funcao so, para as duas nao divergirem. `null` se o predio
 *  deixou de ser armazem completo. */
function depositarNoArmazem(state: GameState, predioId: string, mercadoria: string): PredioCompleto | null {
  const destino = state.predios.porId[predioId];
  if (destino === undefined || destino.estado !== 'completo' || destino.tipo !== ID_DO_ARMAZEM) return null;
  return {
    ...destino,
    estoque: { ...destino.estoque, saida: { ...destino.estoque.saida, [mercadoria]: (destino.estoque.saida[mercadoria] ?? 0) + 1 } },
  };
}

/**
 * Onde a carga entra, por TIPO de tarefa — a irma de `gavetaDeOrigem` do outro
 * lado da viagem, e exaustiva como ela: um tipo novo sem lugar de entrega nao
 * compila. `null` quer dizer "o destino nao recebe", e o serf devolve ao
 * armazem em vez de largar a carga num predio que nao a quer.
 *
 * Os tipos que tem DEMANDA variavel (a fila da escola, a gaveta do produtor)
 * sao conferidos contra `demandaNoDestino` antes: a fila pode ter encolhido
 * enquanto o serf andava.
 */
function destinoQueRecebe(state: GameState, tarefa: TarefaDeTransporte, dados: GameData): Predio | null {
  switch (tarefa.tipo) {
    case 'material-para-obra':
      return entregarMaterial(state, tarefa);
    case 'ouro-para-escola':
      return demandaNoDestino(state, tarefa, dados) >= 1 ? entregarOuro(state, tarefa) : null;
    case 'insumo-producao-parada':
    case 'insumo-producao-baixa':
      return demandaNoDestino(state, tarefa, dados) >= 1 ? entregarInsumo(state, tarefa) : null;
    case 'saida-cheia-para-armazem':
    case 'excedente-para-armazem':
      return depositarNoArmazem(state, tarefa.destino, tarefa.mercadoria);
  }
}

function passoEntregando(state: GameState, u: Unidade, dados: GameData): Passo {
  const carga = u.fsmData.carga;
  if (carga === undefined) return ficarOcioso(state, u);
  const tarefa = tarefaDoSerf(state, u, 'carregando');
  if (tarefa === null) return semEventos(comecarADevolver(state, u, carga, dados));

  // O destino ainda PEDE, e onde ele recebe? Os dois vem do TIPO da tarefa.
  const recebida = destinoQueRecebe(state, tarefa, dados);
  if (recebida === null) {
    const l = liberarTarefa(state, tarefa.id, 'destino-completo');
    return { state: comecarADevolver(l.state, u, carga, dados), events: l.events };
  }

  const concluida = removerTarefa(comPredio(state, recebida), tarefa.id);
  return {
    state: comUnidade(concluida, ocioso(u)),
    events: [{ type: 'task-completed', tarefa: tarefa.id, destino: tarefa.destino, mercadoria: tarefa.mercadoria }],
  };
}

function passoDevolvendo(state: GameState, u: Unidade, dados: GameData): Passo {
  const carga = u.fsmData.carga;
  if (carga === undefined) return ficarOcioso(state, u);

  let atual = u;
  const alvo = u.fsmData.armazem === undefined ? undefined : state.predios.porId[u.fsmData.armazem];
  const alvoValido = alvo !== undefined && alvo.estado === 'completo' && alvo.tipo === ID_DO_ARMAZEM;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (!alvoValido || (proximo !== undefined && !tileAndavel(state, proximo, 'livre', dados))) {
    // o armazem sumiu, ou algo entrou no caminho: escolhe de novo a partir de onde esta
    const novo = armazemMaisProximo(state, noTile(u), dados);
    if (novo === null) return semEventos(comUnidade(state, { ...u, fsmData: dadosDaFsm({ carga }) })); // sem armazem: espera
    atual = { ...u, fsmData: dadosDaFsm({ carga, armazem: novo.id, caminho: novo.caminho, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  const destino = andou.fsmData.armazem === undefined ? undefined : state.predios.porId[andou.fsmData.armazem];
  if (!chegou(andou) || destino === undefined || destino.estado !== 'completo') return semEventos(comUnidade(state, andou));

  // chegou: deposita na `saida`, de onde os serfs retiram — o mesmo gesto dos
  // niveis 6 e 7 (`depositarNoArmazem`)
  const guardada = depositarNoArmazem(state, destino.id, carga);
  if (guardada === null) return semEventos(comUnidade(state, andou)); // deixou de ser armazem: segue segurando
  return {
    state: comUnidade(comPredio(state, guardada), ocioso(u)),
    events: [{ type: 'cargo-returned', unidade: u.id, armazem: destino.id, mercadoria: carga }],
  };
}

function passoDoSerf(state: GameState, u: Unidade, dados: GameData): Passo {
  switch (u.fsm) {
    case 'ocioso': return passoOcioso(state, u, dados);
    case 'indo_buscar': return passoIndoBuscar(state, u, dados);
    case 'carregando': return passoCarregando(state, u, dados);
    case 'indo_entregar': return passoIndoEntregar(state, u, dados);
    case 'entregando': return passoEntregando(state, u, dados);
    case 'devolvendo': return passoDevolvendo(state, u, dados);
    default:
      // `fsm` e uma string no estado (JSON): um valor fora do GDD §6.2 e save corrompido
      throw new Error(`sistemaDosSerfs: estado de FSM desconhecido '${u.fsm}' no serf ${u.id}`);
  }
}

/** Um tick da FSM de cada serf, na ordem de `unidades.ordem`. Determinista. */
export function sistemaDosSerfs(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || u.tipo !== TIPO_QUE_CARREGA) continue;
    const r = passoDoSerf(atual, u, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
