/**
 * F20b — o sistema da FOME (GDD §2 e §11.3), um passo por tick, na ordem de
 * `unidades.ordem`:
 *
 *   dreno (todo civil)  ->  morte a 0  ->  FSM da fome  ->  saida para comer
 *
 *   ocioso / trabalhando  --(condicao <= civilVaiComer)-->  indo_comer -> comendo -> ocioso
 *
 * O DRENO é um tick de `condicao` por tick de simulação — não é número de
 * balanceamento, é a definição de `duracaoCondicaoCheia_min_base`: a condição cheia
 * dura aquele tempo, então gastar um tick por tick é o que faz a duração ser a
 * duração. Quanto cada comida devolve e onde estão os limiares vem de
 * `condition.json`, já em ticks (`sim/condicao.ts`).
 *
 * MOVIMENTO: modo `'livre'`, como o especialista — quem vai comer não carrega nada.
 *
 * QUEM SAI PARA COMER: só unidade que não segura tarefa e não tem carga na mão. É um
 * predicado derivado, não uma lista de estados de FSM de outras famílias: serf a
 * caminho da obra e laborer martelando seguram tarefa, serf em `devolvendo` tem carga,
 * e nenhum deles é interrompido — termina, fica ocioso, e então sai para comer. A
 * única tarefa que se solta é a de COLHEITA, porque quem a segura está parado dentro
 * do prédio (mesmo gesto de `passoProduzindo`, `systems/especialistas.ts`).
 *
 * A MORTE é o estreante de "a unidade sumiu", o espelho de "o prédio sumiu":
 *  - a tarefa reclamada é liberada AQUI, no mesmo tick (CLAUDE.md §5);
 *  - a carga na mão volta ao armazém por `devolverMercadorias`, o caminho da
 *    demolição — conservação de bens é invariante do projeto;
 *  - o prédio que ela ocupava é zerado por `sanearOcupacao`, que já existe desde a
 *    F14 e roda mais adiante NESTE tick (`sistemaDosEspecialistas`). Um segundo
 *    caminho para o mesmo estado seria o defeito, não a garantia.
 */
import type { GameEvent, GameState, PredioCompleto, TarefaComer, Unidade } from '../state';
import { ehTarefaDeColheita, ehTarefaDeComidaParaTropa } from '../state';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import {
  condicaoCheiaDoTipo, drenaNoTick, FSM_COMENDO, FSM_INDO_COMER,
  morreuDeFome, precisaComer, restauracaoDaUnidade,
} from '../condicao';
import { comidasConhecidas, ehBodegaCompleta } from '../bodega';
import { armazemMaisProximo, devolverMercadorias } from '../deposito';
import {
  caminhoAtePredioCompleto, liberar, reclamarMelhorComer, removerTarefa, tarefaReclamadaPor,
} from '../jobs';
import { predioDoOcupante } from '../ocupacao';
import { passoAndavel } from '../pathfinding';
import { andar, chegou, comPredio, comUnidade, dadosDaFsm, ficarOcioso, noTile } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

type Passo = ResultadoDeSistema;

const semEventos = (state: GameState): Passo => ({ state, events: [] });

/** Quanto de `condicao` um tick consome. Ver o cabeçalho: é a definição da duração. */
const DRENO_POR_TICK = 1;

/** A tarefa de comer DESTA unidade, se existe, está `'reclamada'` e é mesmo dela. */
function tarefaDeComerDe(state: GameState, u: Unidade): TarefaComer | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  return t !== undefined && t.tipo === 'comer' && t.estado === 'reclamada' && t.reclamadaPor === u.id ? t : null;
}

// --- a refeição ---

/**
 * A refeição, pura: consome da gaveta `entrada` da Bodega, na ordem do dado, **cada
 * tipo de comida no máximo uma vez**, até a condição encher. `null` quando não havia
 * nada para comer.
 *
 * "Um tipo, uma vez" é a leitura conservadora do item da fila e a única que o dado
 * sustenta: o máximo de um tipo só é 0,60 (`sausages`) e `loaves + sausages` dá
 * exatamente 1,00 — a regra das duas comidas diferentes do GDD sai daí sem nenhum
 * número novo. Cada porção já vem em TICKS do carregamento
 * (`ticksRestauradosPorComida`), então não há fração multiplicada em tempo de execução.
 */
function servirRefeicao(
  bodega: PredioCompleto, u: Unidade, dados: GameData,
): { readonly bodega: PredioCompleto; readonly condicao: number; readonly consumido: readonly string[] } | null {
  const cheia = condicaoCheiaDoTipo(u.tipo, dados);
  const restauracao = restauracaoDaUnidade(u, dados);
  const entrada = { ...bodega.estoque.entrada };
  const consumido: string[] = [];
  let condicao = u.condicao;
  for (const comida of comidasConhecidas(dados)) {
    if (condicao >= cheia) break;
    if ((entrada[comida] ?? 0) <= 0) continue;   // mesma medida de `comidasNaBodega`: quantidade, não chave
    entrada[comida] = (entrada[comida] ?? 0) - 1;
    condicao = Math.min(cheia, condicao + (restauracao[comida] ?? 0));
    consumido.push(comida);
  }
  if (consumido.length === 0) return null;
  return { bodega: { ...bodega, estoque: { ...bodega.estoque, entrada } }, condicao, consumido };
}

// --- a morte ---

function semAUnidade(state: GameState, id: string): GameState {
  const porId = { ...state.unidades.porId };
  delete porId[id];
  return { ...state, unidades: { porId, ordem: state.unidades.ordem.filter((outro) => outro !== id) } };
}

/**
 * A unidade chegou ao limiar de morte: sai de `unidades`, a tarefa que segurava é
 * liberada e a carga na mão volta ao armazém alcançável mais próximo — ou se perde,
 * quando não há nenhum, que é a mesma perda declarada da demolição (F16a).
 *
 * A quantidade devolvida é 1 porque `fsmData.carga` guarda UMA mercadoria: é a
 * cardinalidade do campo (F10), não um número de balanceamento.
 */
function morrer(state: GameState, u: Unidade, dados: GameData): Passo {
  const segurada = tarefaReclamadaPor(state, u.id);
  // 'unidade-removida' REABRE a reclamada (outro civil a pega) e CANCELA a
  // `carregando`, cuja reserva de origem já foi consumida na coleta — é o mesmo
  // motivo que `sanearTarefas` usaria no tick seguinte, aplicado agora.
  let solto = segurada === null ? { state, events: [] as readonly GameEvent[] } : liberar(state, segurada.id, 'unidade-removida');
  // C-COMIDA-01c (risco 2 do plano) — a morte por fome roda DEPOIS do saneamento: a
  // comida que vinha para este militar cai agora ('destino-sumiu'), e o serf que a
  // carrega devolve ao armazem no proprio passo (a tarefa sumiu debaixo dele).
  for (const id of solto.state.jobs.tarefas.ordem) {
    const t = solto.state.jobs.tarefas.porId[id];
    if (t === undefined || !ehTarefaDeComidaParaTropa(t) || t.destinoUnidade !== u.id) continue;
    const l = liberar(solto.state, t.id, 'destino-sumiu');
    solto = { state: l.state, events: [...solto.events, ...l.events] };
  }

  const carga = u.fsmData.carga ?? null;
  const armazem = carga === null ? null : armazemMaisProximo(solto.state, noTile(u), u.lado, dados)?.id ?? null;
  const predios = carga === null || armazem === null
    ? solto.state.predios
    : devolverMercadorias(solto.state.predios, { [carga]: 1 }, armazem);

  const sem = semAUnidade({ ...solto.state, predios }, u.id);
  return {
    state: sem,
    events: [...solto.events, { type: 'unit-starved', unidade: u.id, tipo: u.tipo, carga, armazem }],
  };
}

// --- os estados ---

/**
 * A saída para comer. ATÔMICA em cima da imutabilidade: solta a colheita e vaga o
 * prédio num estado CANDIDATO, e se o assento não der para reclamar devolve o estado
 * ORIGINAL — nada aconteceu neste tick, e o especialista continua produzindo em vez de
 * ficar parado à espera de uma Bodega que talvez não exista.
 *
 * O especialista com fome VAGA o prédio (`ocupante = null`) e reocupa depois pela
 * tarefa `ocupar` que existe desde a F14. "Ocupado, mas fora" é a perna da F-T3 e não
 * se antecipa aqui; o `progresso` do ciclo mora no PRÉDIO, então nada do que ele já
 * trabalhou se perde enquanto ele come.
 */
function tentarSairParaComer(state: GameState, u: Unidade, dados: GameData): Passo {
  if (u.fsmData.carga !== undefined) return semEventos(state);   // ninguém come com carga na mão
  const segurada = tarefaReclamadaPor(state, u.id);
  if (segurada !== null && !ehTarefaDeColheita(segurada)) return semEventos(state);
  // 'pedido-da-unidade' REABRE: o tile continua sendo do prédio, para quando ele voltar.
  const solto = segurada === null
    ? { state, events: [] as readonly GameEvent[] }
    : liberar(state, segurada.id, 'pedido-da-unidade');
  const predio = predioDoOcupante(solto.state, u.id);
  const vago = predio === null ? solto.state : comPredio(solto.state, { ...predio, ocupante: null });

  const r = reclamarMelhorComer(vago, u.id, dados);
  if (!r.ok) return semEventos(state);
  const bruta = r.state.jobs.tarefas.porId[r.tarefa];
  const tarefa = bruta?.tipo === 'comer' ? bruta : undefined;
  const caminho = tarefa === undefined ? null : caminhoAtePredioCompleto(r.state, tarefa.destino, u.id, dados);
  // o claim já exigiu o caminho; se ele não está aqui, o estado candidato inteiro é
  // descartado — a reserva vai com ele, e não fica tarefa reclamada sem dono.
  if (tarefa === undefined || caminho === null) return semEventos(state);
  return {
    state: comUnidade(r.state, {
      ...u, fsm: FSM_INDO_COMER, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
    }),
    events: solto.events,
  };
}

function passoIndoComer(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDeComerDe(state, u);
  if (tarefa === null) return ficarOcioso(state, u);   // o quadro a cancelou
  const bodega = state.predios.porId[tarefa.destino];
  if (!ehBodegaCompleta(bodega)) return ficarOcioso(state, u);

  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    // um prédio foi plantado no caminho: replaneja de onde está
    const caminho = caminhoAtePredioCompleto(state, tarefa.destino, u.id, dados);
    if (caminho === null) {
      const l = liberar(state, tarefa.id, 'pedido-da-unidade');   // só a UNIDADE não chega: reabre
      return ficarOcioso(l.state, u, l.events);
    }
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));

  // Chegou: come no MESMO tick (o consumo é atômico com a chegada) e a tarefa sai do
  // quadro. Prateleira vazia — outro comensal levou a última broa enquanto ele andava —
  // não é espera: volta a ocioso e tenta de novo quando houver comida (D5 do plano).
  const semATarefa = removerTarefa(state, tarefa.id);
  const refeicao = servirRefeicao(bodega, andou, dados);
  if (refeicao === null) return ficarOcioso(semATarefa, andou);
  return semEventos(comUnidade(comPredio(semATarefa, refeicao.bodega), {
    ...andou, fsm: FSM_COMENDO, fsmData: {}, condicao: refeicao.condicao,
  }));
}

function passoDeFome(state: GameState, u: Unidade, dados: GameData): Passo {
  // C-COMIDA-01c — civil e militar drenam; a tropa da IA fica fora pelo ANDAIME (L8)
  if (!drenaNoTick(state, u, dados)) return semEventos(state);

  const drenado: Unidade = { ...u, condicao: Math.max(0, u.condicao - DRENO_POR_TICK) };
  const comDreno = comUnidade(state, drenado);
  if (morreuDeFome(drenado, dados)) return morrer(comDreno, drenado, dados);

  // `comendo` dura um tick: não existe duração de refeição em `data/`, e inventar um
  // número de balanceamento em `.ts` é proibido.
  if (drenado.fsm === FSM_COMENDO) return ficarOcioso(comDreno, drenado);
  if (drenado.fsm === FSM_INDO_COMER) return passoIndoComer(comDreno, drenado, dados);
  if (precisaComer(drenado, dados)) return tentarSairParaComer(comDreno, drenado, dados);
  return semEventos(comDreno);
}

/**
 * Um tick da fome para cada unidade, na ordem de `unidades.ordem`. Determinista.
 *
 * Roda depois de `sanearTarefas` e ANTES das três famílias: assim o civil que cruza o
 * limiar neste tick já sai para comer neste tick, e o que morre não é passado por uma
 * FSM de família que encontraria um estado de fome no `switch` (elas pulam
 * `ehEstadoDeFome`).
 */
export function sistemaDaFome(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined) continue;   // morreu neste mesmo tick por outro caminho
    const r = passoDeFome(atual, u, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
