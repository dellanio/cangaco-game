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
import type {
  GameEvent, GameState, Tarefa, TarefaConstruir, TarefaDeTransporte, TarefaMaterialParaObra,
  TarefaOcupar, TarefaOuroParaEscola, TipoDeTarefa,
} from './state';
import { ehTarefaDeTransporte, MERCADORIA_DE_OURO } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { componenteDe, distanciaEntrePredios, ehEstrada, tilesDaPorta } from './estradas';
import type { TileDeGrid } from './estradas';
import { obraTrabalhavel } from './obra';
import { buscarCaminho } from './pathfinding';
import type { Caminho } from './pathfinding';
import { disponivelNaOrigem, vagaDeConstrucao, vagaDeOcupacao, vagaDoDestino } from './reservas';
import { predioAceita } from './ocupacao';

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
  | 'sem-caminho'
  | 'destino-sem-trabalho';

export type ResultadoDoClaim =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDoClaim };

export type ResultadoDoClaimMelhor =
  | { readonly ok: true; readonly state: GameState; readonly tarefa: string }
  | { readonly ok: false; readonly motivo: MotivoDeRecusaDoClaim | 'sem-tarefa-aberta' };

/** So o serf carrega mercadoria. Id estrutural, como `ID_DO_ARMAZEM`. */
export const TIPO_QUE_CARREGA = 'serf';

/** So o laborer constroi. Id estrutural, como `TIPO_QUE_CARREGA`. */
export const TIPO_QUE_CONSTROI = 'laborer';

const UNIDADE_ELEGIVEL_POR_TIPO: Readonly<Record<TipoDeTarefa, string | null>> = {
  'material-para-obra': TIPO_QUE_CARREGA,
  // F13: ouro tambem e carga — mesmo serf, mesma FSM, mesmo claim.
  'ouro-para-escola': TIPO_QUE_CARREGA,
  construir: TIPO_QUE_CONSTROI,
  // F14: 'ocupar' nao tem UM tipo elegivel — quem pode ocupar depende do PREDIO
  // de destino. `null` aqui significa "esta pergunta nao se responde so com o
  // tipo da tarefa", e por isso `elegivelParaTarefa` NUNCA autoriza uma
  // ocupacao: quem responde e `podeReclamar`.
  ocupar: null,
};

/** Generaliza a checagem "a unidade e serf": cada tipo de tarefa tem UM tipo
 *  de unidade elegivel — serf e laborer nao disputam tarefa (decisao do
 *  operador, F11b). */
export function elegivelParaTarefa(tipoDaTarefa: TipoDeTarefa, tipoDaUnidade: string): boolean {
  return UNIDADE_ELEGIVEL_POR_TIPO[tipoDaTarefa] === tipoDaUnidade;
}

/**
 * F14 — a pergunta completa: esta unidade pode reclamar ESTA tarefa? Para tudo
 * que nao e `'ocupar'` e exatamente `elegivelParaTarefa` (o tipo basta). Para
 * `'ocupar'`, a resposta vem do DESTINO — o `trabalhador` que o tipo de predio
 * declara no dado.
 *
 * Toda checagem de elegibilidade passa por aqui: `reclamar`, `sanearTarefas` e
 * as invariantes de teste. `elegivelParaTarefa` continua publica porque a F11b
 * prende o par serf/laborer nela.
 */
export function podeReclamar(
  state: GameState, tarefa: Tarefa, tipoDaUnidade: string, dados: GameData = gameData,
): boolean {
  if (tarefa.tipo !== 'ocupar') return elegivelParaTarefa(tarefa.tipo, tipoDaUnidade);
  return predioAceita(state.predios.porId[tarefa.destino], tipoDaUnidade, dados);
}

/** O nivel do tipo na escada de `delivery.json`, lido pelo `id` — nunca um numero em
 *  `.ts`. Falha alto se o dado nao tem o id: assumir um nivel escondido seria pior. */
export function nivelDoTipo(tipo: TipoDeTarefa, dados: GameData = gameData): number {
  const linha = dados.entrega.prioridades.find((p) => p.id === tipo);
  if (linha === undefined) {
    throw new Error(`nivelDoTipo: '${tipo}' nao esta na escada de delivery.json (prioridades[].id)`);
  }
  return linha.nivel;
}

function inserirTarefa(state: GameState, tarefa: Tarefa): { readonly state: GameState; readonly id: string } {
  return {
    id: tarefa.id,
    state: {
      ...state,
      proximoId: tarefa.numero + 1,
      jobs: {
        tarefas: {
          porId: { ...state.jobs.tarefas.porId, [tarefa.id]: tarefa },
          ordem: [...state.jobs.tarefas.ordem, tarefa.id],
        },
      },
    },
  };
}

/** Cria uma tarefa de material ABERTA (nao reserva nada). O id e o numero vem
 *  do contador `proximoId`, compartilhado com predios e unidades. */
export function criarTarefa(
  state: GameState,
  campos: { readonly mercadoria: string; readonly origem: string; readonly destino: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaMaterialParaObra = {
    id: `t${numero}`, numero, tipo: 'material-para-obra', mercadoria: campos.mercadoria,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F13 — cria uma tarefa de OURO aberta, do armazem `origem` ate a escola
 *  `destino`. Irma de `criarTarefa`: so a mercadoria e o tipo (e com ele o nivel
 *  na escada) mudam. */
export function criarTarefaDeOuro(
  state: GameState,
  campos: { readonly origem: string; readonly destino: string },
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaOuroParaEscola = {
    id: `t${numero}`, numero, tipo: 'ouro-para-escola', mercadoria: MERCADORIA_DE_OURO,
    origem: campos.origem, destino: campos.destino, estado: 'aberta', reclamadaPor: null,
  };
  return inserirTarefa(state, tarefa);
}

/** F11b — cria uma vaga de construcao ABERTA na obra `destino`. Sem
 *  mercadoria/origem: o laborer nao carrega material. */
export function criarTarefaDeConstrucao(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaConstruir = { id: `t${numero}`, numero, tipo: 'construir', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

/** F14 — cria uma vaga de OCUPANTE aberta no predio completo `destino`. Irma de
 *  `criarTarefaDeConstrucao`. */
export function criarTarefaDeOcupacao(
  state: GameState, destino: string,
): { readonly state: GameState; readonly id: string } {
  const numero = state.proximoId;
  const tarefa: TarefaOcupar = { id: `t${numero}`, numero, tipo: 'ocupar', destino, estado: 'aberta', reclamadaPor: null };
  return inserirTarefa(state, tarefa);
}

function unidadeJaTemTarefa(state: GameState, unidadeId: string): boolean {
  return state.jobs.tarefas.ordem.some((id) => {
    const t = state.jobs.tarefas.porId[id];
    return t !== undefined && t.estado !== 'aberta' && t.reclamadaPor === unidadeId;
  });
}

/** Distancia por estrada, pelas portas, do armazem de origem ate a obra de destino, em
 *  PASSOS (BFS, 4 direcoes); `null` se algum dos dois nao existe ou nao ha caminho.
 *  E a pergunta de EXISTENCIA ("esta ligado?"), que nao depende de serf: e o que o
 *  gerador, o saneamento e o verificador usam. A ORDEM de escolha do serf usa o custo A*
 *  em ticks de `custoDaTarefa`, que parte da posicao dele. */
export function distanciaDaTarefa(state: GameState, tarefa: TarefaDeTransporte, dados: GameData = gameData): number | null {
  const origem = state.predios.porId[tarefa.origem];
  const destino = state.predios.porId[tarefa.destino];
  if (!origem || !destino) return null;
  return distanciaEntrePredios(state, origem, destino, dados);
}

/** As duas pernas da viagem de uma unidade para uma tarefa, em ticks (F10). */
export interface PlanoDaTarefa {
  /** A pe, por qualquer tile livre, da posicao do serf ate a porta de coleta do armazem. */
  readonly ateAOrigem: Caminho;
  /** Carregado, SO por estrada, da porta de coleta ate a porta da obra. */
  readonly deEntrega: Caminho;
  /** `ateAOrigem.custo + deEntrega.custo`. */
  readonly custo: number;
}

/** Os tiles de porta que sao estrada: so por eles a carga entra e sai da rede. */
export function portasDeEstrada(state: GameState, predioId: string, dados: GameData = gameData): TileDeGrid[] {
  const predio = state.predios.porId[predioId];
  return predio ? tilesDaPorta(predio, dados).filter((t) => ehEstrada(state.estradas, t)) : [];
}

/** As portas de COLETA: as do armazem que sao estrada E estao no mesmo componente de
 *  alguma porta de estrada da obra. Sem isto a perna carregada nao teria como existir. */
function portasDeColeta(state: GameState, tarefa: TarefaDeTransporte, dados: GameData): { coleta: TileDeGrid[]; entrega: TileDeGrid[] } {
  const entrega = portasDeEstrada(state, tarefa.destino, dados);
  const componentesDaEntrega = new Set(entrega.map((t) => componenteDe(state.estradas, t)));
  const coleta = portasDeEstrada(state, tarefa.origem, dados).filter((t) => componentesDaEntrega.has(componenteDe(state.estradas, t)));
  return { coleta, entrega };
}

/**
 * O plano de `unidadeId` para `tarefa`: a perna livre (A*, vizinhanca 8, custo de terreno,
 * a partir de ONDE O SERF ESTA) ate a porta de coleta mais barata, mais a perna de entrega
 * (A* so por estrada) dessa porta ate a da obra. `null` se algo nao existe, ou se alguma
 * das pernas nao tem caminho. Nunca euclidiana.
 *
 * A porta de coleta e a de menor perna livre (guloso: nao minimiza a soma das duas
 * pernas; empate: a primeira de `tilesDaPorta`, por `gx`).
 */
export function planoDaTarefa(
  state: GameState, tarefa: TarefaDeTransporte, unidadeId: string, dados: GameData = gameData,
): PlanoDaTarefa | null {
  const unidade = state.unidades.porId[unidadeId];
  if (!unidade) return null;
  const { coleta, entrega } = portasDeColeta(state, tarefa, dados);
  if (coleta.length === 0 || entrega.length === 0) return null;
  const ateAOrigem = buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, coleta, 'livre', dados);
  if (ateAOrigem === null) return null;
  const porta = ateAOrigem.tiles[ateAOrigem.tiles.length - 1] ?? { gx: unidade.gx, gy: unidade.gy };
  const deEntrega = buscarCaminho(state, porta, entrega, 'estrada', dados);
  if (deEntrega === null) return null;
  return { ateAOrigem, deEntrega, custo: ateAOrigem.custo + deEntrega.custo };
}

/** O caminho do laborer (a pe, `'livre'` — nao precisa de estrada) da posicao dele
 *  ate a obra `predioId`: qualquer tile da PORTA INTEIRA (`tilesDaPorta`, a borda sul
 *  toda, nao so a que e estrada — o laborer chega ANTES de existir estrada ou material,
 *  GDD §5.1: ele nivela primeiro). `null` se a obra nao existe ou nao ha caminho. */
export function caminhoAteAObra(
  state: GameState, predioId: string, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const predio = state.predios.porId[predioId];
  const unidade = state.unidades.porId[unidadeId];
  if (!predio || predio.estado !== 'obra' || !unidade) return null;
  return buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, tilesDaPorta(predio, dados), 'livre', dados);
}

/** F14 — o caminho a pe do especialista ate a porta do predio COMPLETO. Irmao de
 *  `caminhoAteAObra`: mesma vizinhanca `'livre'` e a porta inteira
 *  (`tilesDaPorta`), porque o especialista nao carrega nada e nao depende de
 *  estrada — a mesma regra do laborer. So o estado exigido do predio muda. */
export function caminhoAtePredioCompleto(
  state: GameState, predioId: string, unidadeId: string, dados: GameData = gameData,
): Caminho | null {
  const predio = state.predios.porId[predioId];
  const unidade = state.unidades.porId[unidadeId];
  if (!predio || predio.estado !== 'completo' || !unidade) return null;
  return buscarCaminho(state, { gx: unidade.gx, gy: unidade.gy }, tilesDaPorta(predio, dados), 'livre', dados);
}

/**
 * O custo, em ticks, que ordena as tarefas. Com `unidadeId`: o plano inteiro (as duas
 * pernas). Sem unidade (`null`): so a perna de entrega, da melhor porta de coleta —
 * unica coisa que existe sem um serf em campo. `null` se nao ha caminho.
 */
export function custoDaTarefa(
  state: GameState, tarefa: TarefaDeTransporte, unidadeId: string | null, dados: GameData = gameData,
): number | null {
  if (unidadeId !== null) return planoDaTarefa(state, tarefa, unidadeId, dados)?.custo ?? null;
  const { coleta, entrega } = portasDeColeta(state, tarefa, dados);
  let melhor: number | null = null;
  for (const porta of coleta) {
    const perna = buscarCaminho(state, porta, entrega, 'estrada', dados);
    if (perna !== null && (melhor === null || perna.custo < melhor)) melhor = perna.custo;
  }
  return melhor;
}

/**
 * O claim: reserva, ao mesmo tempo, a unidade de recurso na origem e a vaga no
 * destino, ou nao reserva nada. ATOMICO: todas as checagens vem antes da unica
 * atribuicao de estado; uma recusa devolve so o motivo, e o estado do chamador nao foi
 * tocado.
 *
 * Ordem das checagens (fixada por teste): tarefa existe, esta aberta, unidade valida
 * (existe e e `serf`), unidade livre, origem com disponivel, destino com vaga, caminho
 * (F10: o plano inteiro — a perna do serf ate a origem tambem tem que existir, senao um
 * serf preso reclamaria e soltaria a mesma tarefa a cada tick).
 */
export function reclamar(
  state: GameState, tarefaId: string, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaim {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa) return { ok: false, motivo: 'tarefa-inexistente' };
  if (tarefa.estado !== 'aberta') return { ok: false, motivo: 'tarefa-ja-reclamada' };

  const unidade = state.unidades.porId[unidadeId];
  if (!unidade || !podeReclamar(state, tarefa, unidade.tipo, dados)) return { ok: false, motivo: 'unidade-invalida' };
  if (unidadeJaTemTarefa(state, unidadeId)) return { ok: false, motivo: 'unidade-ocupada' };

  if (ehTarefaDeTransporte(tarefa)) {
    if (disponivelNaOrigem(state, tarefa.origem, tarefa.mercadoria) < 1) {
      return { ok: false, motivo: 'origem-sem-recurso' };
    }
    // A vaga depende do TIPO: `faltam` numa obra, a demanda da fila numa escola (F13).
    if (vagaDoDestino(state, tarefa, dados) < 1) {
      return { ok: false, motivo: 'destino-sem-vaga' };
    }
    if (custoDaTarefa(state, tarefa, unidadeId, dados) === null) return { ok: false, motivo: 'sem-caminho' };
  } else if (tarefa.tipo === 'ocupar') {
    // F14: UMA vaga por predio; o tipo certo de civil ja foi checado em
    // `podeReclamar`. Sem estrada exigida, como a de construir.
    if (vagaDeOcupacao(state, tarefa.destino, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    if (caminhoAtePredioCompleto(state, tarefa.destino, unidadeId, dados) === null) {
      return { ok: false, motivo: 'sem-caminho' };
    }
  } else {
    // 'construir': sem mercadoria/origem (o laborer nao carrega nada).
    if (vagaDeConstrucao(state, tarefa.destino, dados) < 1) return { ok: false, motivo: 'destino-sem-vaga' };
    // F11c: agora HA consumidor (sistemaDosLaborers), entao o claim checa caminho —
    // como o F10 fez para o serf. Modo 'livre': o laborer nao carrega nada e precisa
    // chegar ANTES de existir estrada (GDD §5.1: ele nivela primeiro).
    if (caminhoAteAObra(state, tarefa.destino, unidadeId, dados) === null) return { ok: false, motivo: 'sem-caminho' };
    // O portao vive AQUI, e nao so na ordenacao (`tarefasDeConstrucaoEmOrdem`), para
    // que o laborer nao reclame, largue e reclame a mesma obra sem trabalho a cada tick.
    if (!obraTrabalhavel(state, tarefa.destino, dados)) return { ok: false, motivo: 'destino-sem-trabalho' };
  }

  const reclamada: Tarefa = { ...tarefa, estado: 'reclamada', reclamadaPor: unidadeId };
  return {
    ok: true,
    state: {
      ...state,
      jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: reclamada }, ordem: state.jobs.tarefas.ordem } },
    },
  };
}

/** A coleta: a tarefa `reclamada` passa a `carregando` (a reserva da origem foi consumida
 *  pela saida do material do estoque, que quem chama faz no mesmo tick). So o quadro.
 *  So MATERIAL tem `'carregando'` (F11b: 'construir' nao carrega nada, nunca chega aqui). */
export function marcarCarregando(state: GameState, tarefaId: string): GameState {
  const tarefa = state.jobs.tarefas.porId[tarefaId];
  if (!tarefa || !ehTarefaDeTransporte(tarefa) || tarefa.estado !== 'reclamada') {
    throw new Error(`marcarCarregando: '${tarefaId}' nao esta reclamada (ou nao e tarefa de transporte)`);
  }
  const carregando: TarefaDeTransporte = { ...tarefa, estado: 'carregando' };
  return { ...state, jobs: { tarefas: { porId: { ...state.jobs.tarefas.porId, [tarefaId]: carregando }, ordem: state.jobs.tarefas.ordem } } };
}

/** A entrega concluiu a tarefa: ela sai do quadro. Nao emite evento (quem entrega o emite). */
export function removerTarefa(state: GameState, tarefaId: string): GameState {
  const porId = { ...state.jobs.tarefas.porId };
  delete porId[tarefaId];
  return { ...state, jobs: { tarefas: { porId, ordem: state.jobs.tarefas.ordem.filter((id) => id !== tarefaId) } } };
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
 * As tarefas de TRANSPORTE abertas na ordem de escolha: `(nivel, custo A* em
 * ticks, numero)`. `numero` numerico, nao a string do id ('t10' < 't2').
 * O nivel vem da escada de `delivery.json` pelo id do tipo (F13: ouro, nivel 2,
 * ganha de material, nivel 3) — nunca de um numero digitado aqui.
 * Com `unidadeId` o custo parte da posicao do serf (as duas pernas); sem, so
 * a perna de entrega. Custo `null` (sem caminho) vai para o fim.
 *
 * `'construir'` fica fora — nao esta na escada de `delivery.json` (decisao
 * do operador, F11b: serf e laborer nao disputam tarefa). Com `unidadeId`
 * filtra tambem por elegibilidade antes de ordenar (hoje isso so importa
 * para serf; a F11c decide como o laborer ordena as `'construir'`).
 */
export function tarefasEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaDeTransporte[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaDeTransporte => t !== undefined && ehTarefaDeTransporte(t) && t.estado === 'aberta')
    .filter((t) => unidade == null || elegivelParaTarefa(t.tipo, unidade.tipo));
  const chaves = new Map(candidatas.map((t) => [t.id, {
    nivel: nivelDoTipo(t.tipo, dados),
    custo: custoDaTarefa(state, t, unidadeId, dados) ?? Number.POSITIVE_INFINITY,
  }]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id);
    const cb = chaves.get(b.id);
    if (!ca || !cb) return 0;
    if (ca.nivel !== cb.nivel) return ca.nivel - cb.nivel;
    if (ca.custo !== cb.custo) return ca.custo < cb.custo ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** Reclama, para `unidadeId`, a melhor tarefa aberta QUE DER para reclamar (a melhor
 *  por ordem pode nao dar: sem estoque, sem vaga, sem caminho). */
export function reclamarMelhor(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasEmOrdem(state, unidadeId, dados);
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

/**
 * As `'construir'` abertas na ordem de escolha do laborer: `(custo do caminho A* a pe
 * ate a porta, numero)`. SEM nivel — `'construir'` nao esta na escada de
 * `delivery.json` (decisao do operador, F11b: serf e laborer nao disputam tarefa).
 *
 * PULA obra nao trabalhavel (`obraTrabalhavel`, obra.ts): nao adianta o laborer ir para
 * onde nao ha nada a fazer — e a mesma regra que `reclamar` aplica, aqui so para nao
 * nem oferecer a obra morta na ordenacao.
 */
export function tarefasDeConstrucaoEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaConstruir[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaConstruir => t !== undefined && t.tipo === 'construir' && t.estado === 'aberta')
    .filter((t) => unidade == null || elegivelParaTarefa(t.tipo, unidade.tipo))
    .filter((t) => obraTrabalhavel(state, t.destino, dados));
  const chaves = new Map(candidatas.map((t) => [
    t.id,
    unidadeId === null ? 0 : caminhoAteAObra(state, t.destino, unidadeId, dados)?.custo ?? Number.POSITIVE_INFINITY,
  ]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id) ?? Number.POSITIVE_INFINITY;
    const cb = chaves.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** Reclama, para o laborer `unidadeId`, a melhor `'construir'` aberta QUE DER para
 *  reclamar — irma de `reclamarMelhor`, que so serve `'material-para-obra'`. */
export function reclamarMelhorConstrucao(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasDeConstrucaoEmOrdem(state, unidadeId, dados);
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

/**
 * As `'ocupar'` abertas na ordem de escolha do especialista: `(custo do caminho
 * A* a pe ate a porta, numero)`. SEM nivel — `'ocupar'` nao esta na escada de
 * `delivery.json`, como `'construir'` nao esta. Filtra por `podeReclamar`: um
 * lenhador nunca ve a vaga da pedreira.
 */
export function tarefasDeOcupacaoEmOrdem(
  state: GameState, unidadeId: string | null = null, dados: GameData = gameData,
): TarefaOcupar[] {
  const unidade = unidadeId === null ? null : state.unidades.porId[unidadeId];
  const candidatas = state.jobs.tarefas.ordem
    .map((id) => state.jobs.tarefas.porId[id])
    .filter((t): t is TarefaOcupar => t !== undefined && t.tipo === 'ocupar' && t.estado === 'aberta')
    .filter((t) => unidade == null || podeReclamar(state, t, unidade.tipo, dados));
  const chaves = new Map(candidatas.map((t) => [
    t.id,
    unidadeId === null ? 0 : caminhoAtePredioCompleto(state, t.destino, unidadeId, dados)?.custo ?? Number.POSITIVE_INFINITY,
  ]));
  return [...candidatas].sort((a, b) => {
    const ca = chaves.get(a.id) ?? Number.POSITIVE_INFINITY;
    const cb = chaves.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return a.numero - b.numero;
  });
}

/** F14 — reclama, para o especialista `unidadeId`, a melhor `'ocupar'` aberta QUE
 *  DER para reclamar. Irma de `reclamarMelhorConstrucao`. */
export function reclamarMelhorOcupacao(
  state: GameState, unidadeId: string, dados: GameData = gameData,
): ResultadoDoClaimMelhor {
  const candidatas = tarefasDeOcupacaoEmOrdem(state, unidadeId, dados);
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
