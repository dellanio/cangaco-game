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
 * tile seguinte. A perna carregada so pisa em estrada (regra no literal, nao no dado); as outras
 * (indo buscar, devolvendo) andam por qualquer tile livre.
 *
 * QUEM LIBERA O QUE: o `sanearTarefas` (roda antes, no mesmo tick) ja cancela a tarefa
 * quando a origem, o destino ou a unidade somem; o serf so tem que REAGIR a uma tarefa que
 * sumiu debaixo dele. O que so o serf sabe — o caminho dele cortado, a perna livre
 * bloqueada — ele libera aqui, por `liberar`. Toda tarefa reclamada tem caminho de volta.
 */
import type {
  GameEvent, GameState, Predio, PredioCompleto, PredioEmObra, Tarefa, TarefaComidaParaTropa, TarefaDeTransporte, TarefaDoSerf,
  Unidade,
} from '../state';
import {
  ehTarefaDeComidaParaTropa, ehTarefaDePedraParaCanteiro, ehTarefaDoSerf, gavetaDeOrigem, MERCADORIA_DE_OURO,
} from '../state';
import { ID_DO_ARMAZEM } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import { chaveDeTile, comPedraNoTile, ehEstrada, ehPlanejada, isConnected } from '../estradas';
// F20b: `armazemMaisProximo` era daqui e subiu para `deposito.ts` ao ganhar o
// segundo consumidor (a morte por fome devolve a carga pelo mesmo criterio).
import { armazemMaisProximo } from '../deposito';
import { condicaoCheiaDoTipo, ehEstadoDeFome } from '../condicao';
import {
  alvosDeEntrega, liberar, marcarCarregando, modoDoTipo, planoDaTarefa, reclamarMelhor,
  removerTarefa, TIPO_QUE_CARREGA,
} from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import { buscarCaminho, passoAndavel } from '../pathfinding';
import { custoDeUnidadesNaRota } from '../colisao';
import { ehEscolaCompleta } from '../escola';
import { demandaNoDestino } from '../reservas';
import { andar, chegou, comUnidade, dadosDaFsm, ficarOcioso, noTile, ocioso, passoDeLado } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';
import { comPassoComecadoTerminado } from '../colisao';

type Passo = ResultadoDeSistema;

const semEventos = (state: GameState): Passo => ({ state, events: [] });

function comPredio(state: GameState, predio: Predio): GameState {
  return { ...state, predios: { ...state.predios, porId: { ...state.predios.porId, [predio.id]: predio } } };
}

/** A tarefa de TRANSPORTE do serf, se ela existe, esta no estado esperado e e mesmo
 *  dele. So serf reclama transporte (`elegivelParaTarefa`, F11b/F13) — o filtro de
 *  tipo aqui e so para o compilador estreitar o tipo, o serf nunca segura uma tarefa
 *  'construir' em runtime. */
function tarefaDoSerf(state: GameState, u: Unidade, estado: Tarefa['estado']): TarefaDoSerf | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  // F18g: `ehTarefaDoSerf` — a pedra do canteiro e carga dele como qualquer outra.
  return t !== undefined && ehTarefaDoSerf(t) && t.estado === estado && t.reclamadaPor === u.id ? t : null;
}

/** Libera a tarefa (que sai de `reclamada` ou `carregando`) e devolve os eventos. */
function liberarTarefa(state: GameState, tarefaId: string, motivo: MotivoDeLiberacao): { state: GameState; events: readonly GameEvent[] } {
  return liberar(state, tarefaId, motivo);
}

// --- devolvendo: o armazem completo mais proximo ---

/** Entra em `devolvendo` com a carga que tem. Sem armazem alcancavel, espera onde esta. */
function comecarADevolver(state: GameState, u: Unidade, carga: string, dados: GameData): GameState {
  const alvo = armazemMaisProximo(state, noTile(u), u.lado, dados);
  const fsmData = alvo === null
    ? dadosDaFsm({ carga })
    : dadosDaFsm({ carga, armazem: alvo.id, caminho: alvo.caminho, progresso: 0 });
  return comUnidade(state, { ...u, fsm: 'devolvendo', fsmData });
}

// --- os estados ---

/**
 * I-MOVIMENTO-FILA-DE-CIVIS — o ocioso com passo de lado (`sistemaDoEmpurrao`) pega tarefa como
 * sempre, se o passo ainda nao comecou; sem tarefa, ou com o passo comecado, anda o passo (o tile
 * dele muda so no fim, nunca por teletransporte) e volta a ocioso limpo ao chegar.
 */
function passoOcioso(state: GameState, u: Unidade, dados: GameData): Passo {
  if ((u.fsmData.caminho ?? []).length === 0) return passoOciosoQuePega(state, u, dados);
  // com a troca marcada (`largada`), o outro ja entra no tile dele neste tick: anda, nao pega tarefa
  if ((u.fsmData.progresso ?? 0) === 0 && u.fsmData.largada !== true) {
    const r = passoOciosoQuePega(state, u, dados);
    if (r.state.unidades.porId[u.id]?.fsm !== 'ocioso') return r;
  }
  return semEventos(comUnidade(state, passoDeLado(state, u, dados)));
}

function passoOciosoQuePega(state: GameState, u: Unidade, dados: GameData): Passo {
  const r = reclamarMelhor(state, u.id, dados);
  if (!r.ok) return semEventos(state);
  // reclamarMelhor (F11b: filtrado por elegivelParaTarefa) so devolve tarefa de
  // transporte para um serf; o filtro aqui e so para o compilador estreitar o tipo.
  const bruta = r.state.jobs.tarefas.porId[r.tarefa];
  const tarefa = bruta !== undefined && ehTarefaDoSerf(bruta) ? bruta : undefined;
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
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
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
  const modo = modoDoTipo(tarefa.tipo, dados);
  // D-MOVIMENTO-01h — a perna carregada e PLANEJADA aqui: com a colisao ligada, ela ve os outros
  // civis como custo, e a rua cheia perde para a paralela
  const rota = buscarCaminho(state, noTile(u), alvosDeEntrega(state, tarefa, modo, dados), modo, dados, custoDeUnidadesNaRota(state, u.id, modo, dados));
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
  const modo = modoDoTipo(tarefa.tipo, dados);
  const portas = alvosDeEntrega(state, tarefa, modo, dados);
  // Em `'estrada'`, a rede pode ter sido cortada LONGE daqui e a rota inteira morre
  // junto; o componente responde isso barato, e por isso a pergunta e por tick.
  // Em `'livre'` (F18d-1a) nao ha rede a perder: o que corta uma rota a pe e um
  // predio novo em cima dela, e isso o proximo tile ja denuncia, logo abaixo.
  if (modo === 'estrada') {
    const ligado = ehEstrada(state.estradas, agora) && portas.some((p) => isConnected(state, agora, p));
    if (!ligado) {
      const l = liberarTarefa(state, tarefa.id, 'caminho-cortado');
      return { state: comecarADevolver(l.state, u, carga, dados), events: l.events };
    }
  }

  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, modo, dados)) {
    // o proximo tile da rota deixou de servir (estrada demolida, ou predio plantado
    // em cima): replaneja no mesmo modo, e desiste se nao houver outro caminho
    const rota = buscarCaminho(state, agora, portas, modo, dados, custoDeUnidadesNaRota(state, u.id, modo, dados));
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

/** F15b — a entrega na gaveta `entrada` de um predio completo: o insumo, de onde
 *  `producao.ts` o cobra no inicio do ciclo, e (F20a) a comida da Bodega, de onde
 *  o civil vai comer. O gesto e um so, e por isso a funcao tambem. `null` se o
 *  destino deixou de ser predio completo — quem confere que ele ainda PEDE e
 *  `demandaNoDestino`, no `switch` abaixo. */
/** D-PRODUCAO-01b — quem divide o insumo escasso guarda o tick da entrega: e a vez dele
 *  na proxima disputa (`ordenarTarefasDoSerf`). Os outros tipos nao ganham o campo. */
function comVezDoEscasso(predio: PredioCompleto, mercadoria: string, tick: number, dados: GameData): PredioCompleto {
  if (!dados.entrega.divisaoDoEscasso.tipos.includes(predio.tipo)) return predio;
  return { ...predio, ultimaEntrega: { ...predio.ultimaEntrega, [mercadoria]: tick } };
}

function entregarNaEntrada(state: GameState, tarefa: TarefaDeTransporte): PredioCompleto | null {
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
    case 'comida-para-inn':
    case 'arma-para-quartel':
      return demandaNoDestino(state, tarefa, dados) >= 1 ? entregarNaEntrada(state, tarefa) : null;
    case 'insumo-producao-parada':
    case 'insumo-producao-baixa': {
      const recebeu = demandaNoDestino(state, tarefa, dados) >= 1 ? entregarNaEntrada(state, tarefa) : null;
      return recebeu === null ? null : comVezDoEscasso(recebeu, tarefa.mercadoria, state.tick, dados);
    }
    case 'saida-cheia-para-armazem':
    case 'excedente-para-armazem':
      return depositarNoArmazem(state, tarefa.destino, tarefa.mercadoria);
  }
}

/**
 * F18g — a entrega no TILE do canteiro: a pedra sai da mao do serf e passa a
 * `pedraNoCanteiro[chave]`, de onde o laborer a consome ao assentar. `null` se o
 * tile saiu do canteiro (demolido, ou ja assentado por pedra de outro serf) —
 * o serf devolve ao armazem, como toda carga que o destino nao quer mais.
 * A VAGA nao se confere de novo aqui: `vagaNoTile` e negativa so quando o tile
 * deixou de pedir debaixo da reserva, e `sanearTarefas` ja cancelou por isso
 * antes da FSM andar neste tick.
 */
function entregarNoCanteiro(state: GameState, tarefa: TarefaDoSerf): GameState | null {
  if (!ehTarefaDePedraParaCanteiro(tarefa)) return null;
  if (!ehPlanejada(state.estradasPlanejadas, tarefa.destinoTile)) return null;
  return { ...state, pedraNoCanteiro: comPedraNoTile(state, tarefa.destinoTile, 1) };
}

/** Onde a carga desta tarefa e registrada como entregue, no evento: o id do
 *  predio, ou (F18g) a chave do tile do canteiro. */
function destinoNoEvento(tarefa: TarefaDeTransporte | TarefaPedra): string {
  return ehTarefaDePedraParaCanteiro(tarefa) ? chaveDeTile(tarefa.destinoTile) : tarefa.destino;
}

type TarefaPedra = Extract<TarefaDoSerf, { readonly tipo: 'pedra-para-canteiro' }>;

/**
 * C-COMIDA-01b (fome militar com o Feed) — a entrega a um militar, que ANDA (R8, KaM
 * `KM_UnitTaskDelivery.pas:490-496`). Sumiu: a tarefa cai e a carga volta ao armazem.
 * A mais de 1 tile (Chebyshev): recalcula ate onde ele esta AGORA e volta a
 * `indo_entregar`, sem liberar nada; sem caminho, devolve. Adjacente: a condicao enche,
 * o pedido acaba, a tarefa sai e a comida sai do mundo (`unit-fed`).
 *
 * A perseguicao nao tem teto (risco 11 do plano): com a tropa marchando, o serf corre
 * atras. O que se afirma e PROGRESSO: parada a tropa, a entrega acontece.
 */
function entregarATropa(
  state: GameState, u: Unidade, carga: string, tarefa: TarefaComidaParaTropa, dados: GameData,
): Passo {
  const alvo = state.unidades.porId[tarefa.destinoUnidade];
  if (alvo === undefined) {
    const l = liberarTarefa(state, tarefa.id, 'destino-sumiu');
    return { state: comecarADevolver(l.state, u, carga, dados), events: l.events };
  }
  if (Math.max(Math.abs(alvo.gx - u.gx), Math.abs(alvo.gy - u.gy)) > 1) {
    const modo = modoDoTipo(tarefa.tipo, dados);
    const rota = buscarCaminho(state, noTile(u), [{ gx: alvo.gx, gy: alvo.gy }], modo, dados, custoDeUnidadesNaRota(state, u.id, modo, dados));
    if (rota === null) {
      const l = liberarTarefa(state, tarefa.id, 'caminho-cortado');
      return { state: comecarADevolver(l.state, u, carga, dados), events: l.events };
    }
    return semEventos(comUnidade(state, {
      ...u, fsm: 'indo_entregar', fsmData: dadosDaFsm({ tarefa: tarefa.id, carga, caminho: rota.tiles, progresso: 0 }),
    }));
  }
  const { pedidoDeComida: _pedido, ...semPedido } = alvo;
  const alimentado: Unidade = { ...semPedido, condicao: condicaoCheiaDoTipo(alvo.tipo, dados) };
  const concluida = removerTarefa(comUnidade(state, alimentado), tarefa.id);
  return {
    state: comUnidade(concluida, ocioso(u)),
    events: [{ type: 'unit-fed', unidade: alvo.id, serf: u.id, mercadoria: carga, tarefa: tarefa.id }],
  };
}

function passoEntregando(state: GameState, u: Unidade, dados: GameData): Passo {
  const carga = u.fsmData.carga;
  if (carga === undefined) return ficarOcioso(state, u);
  const tarefa = tarefaDoSerf(state, u, 'carregando');
  if (tarefa === null) return semEventos(comecarADevolver(state, u, carga, dados));
  if (ehTarefaDeComidaParaTropa(tarefa)) return entregarATropa(state, u, carga, tarefa, dados);

  // O destino ainda PEDE, e onde ele recebe? Os dois vem do TIPO da tarefa. Em
  // predio a resposta e o predio com a gaveta cheia; no canteiro (F18g) e o
  // estado com a pedra no tile.
  const entregue = ehTarefaDePedraParaCanteiro(tarefa)
    ? entregarNoCanteiro(state, tarefa)
    : comPredioOuNulo(state, destinoQueRecebe(state, tarefa, dados));
  if (entregue === null) {
    const l = liberarTarefa(state, tarefa.id, 'destino-completo');
    return { state: comecarADevolver(l.state, u, carga, dados), events: l.events };
  }

  const concluida = removerTarefa(entregue, tarefa.id);
  return {
    state: comUnidade(concluida, ocioso(u)),
    events: [{ type: 'task-completed', tarefa: tarefa.id, destino: destinoNoEvento(tarefa), mercadoria: tarefa.mercadoria }],
  };
}

function comPredioOuNulo(state: GameState, predio: Predio | null): GameState | null {
  return predio === null ? null : comPredio(state, predio);
}

function passoDevolvendo(state: GameState, u: Unidade, dados: GameData): Passo {
  const carga = u.fsmData.carga;
  if (carga === undefined) return ficarOcioso(state, u);

  let atual = u;
  const alvo = u.fsmData.armazem === undefined ? undefined : state.predios.porId[u.fsmData.armazem];
  const alvoValido = alvo !== undefined && alvo.estado === 'completo' && alvo.tipo === ID_DO_ARMAZEM && alvo.lado === u.lado;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (!alvoValido || (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados))) {
    // o armazem sumiu, ou algo entrou no caminho: escolhe de novo a partir de onde esta
    const novo = armazemMaisProximo(state, noTile(u), u.lado, dados);
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
    // F20b: quem esta comendo (ou a caminho da Bodega) tem o passo dado pelo
    // `sistemaDaFome`, e nao por esta FSM — o `default` do `switch` LANCA, entao
    // esquecer este pulo nao daria bug silencioso. `ehEstadoDeFome` e a lista unica.
    if (ehEstadoDeFome(u.fsm)) continue;
    const r = passoDoSerf(atual, u, dados);
    // I-MOVIMENTO-FILA-DE-CIVIS: o passo que a FSM largou no meio termina, antes da unidade seguinte
    atual = comPassoComecadoTerminado(r.state, u, dados);
    events.push(...r.events);
  }
  return { state: atual, events };
}
