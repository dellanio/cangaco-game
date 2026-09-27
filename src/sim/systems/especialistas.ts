/**
 * F14 — a FSM do especialista (GDD §6.2), um passo por tick, na ordem de
 * `unidades.ordem`.
 *
 *   ocioso -> indo_ocupar -> trabalhando  <->  esperando_insumo
 *                                  ^
 *                                  +------->  saida_cheia
 *
 * F-T3 — predio que tem `colheita` no dado ganha um desvio pelo CAMPO:
 *
 *   trabalhando -> indo_colher -> colhendo -> voltando -> trabalhando
 *
 * Nele o relogio do ciclo anda em `colhendo`, no tile, e nao em `trabalhando`:
 * o mesmo `receita.ticksDoCiclo`, so em outro lugar. A viagem e tempo A MAIS,
 * e o que ela custa em vazao esta medido no BALANCE_LOG. Predio sem `colheita`
 * (padaria, moinho) nunca entra no desvio — a diferenca vem do DADO.
 *
 * O GDD chama o primeiro estado de `sem_predio`; aqui ele e `ocioso`, o mesmo de
 * toda unidade recem-nascida (`systems/escolas.ts`) e o que
 * `ficarOcioso`/`ocioso` produzem. Mesmo significado, um nome so (Nota do item
 * F14 no BUILD_PLAN). Os outros dois estados do GDD (`esperando_insumo`,
 * `saida_cheia`) sao de PRODUCAO e nasceram na F15a: os tres compartilham UM
 * handler, e o rotulo e recalculado do predio a cada tick — nao existe estado
 * da FSM que discorde do estoque de verdade.
 *
 * MOVIMENTO: modo `'livre'`, como o laborer — o especialista nao carrega nada e
 * nao depende de estrada para chegar.
 *
 * A POSSE mora no PREDIO (`PredioCompleto.ocupante`), nunca na unidade:
 * `trabalhando` e verdade enquanto o predio ainda aponta para ela. Predio
 * demolido (F16) e ocupante morto (F20) desfazem a posse pelos dois lados —
 * `sanearOcupacao` do lado do predio, `passoProduzindo` do lado da unidade.
 *
 * Quem SEGURA a tarefa e revalidado por `sanearTarefas`, como nas outras FSMs:
 * nenhum ramo aqui precisa lembrar de liberar por conta do destino.
 */
import type {
  GameEvent, GameState, Plantio, PredioCompleto, TarefaColher, TarefaOcupar, Unidade,
} from '../state';
import { ehTarefaDeColheita } from '../state';
import type { ColheitaDeRecurso, GameData, ReceitaDePredio, ReposicaoDeRecurso } from '../data/types';
import { gameData } from '../data';
import {
  caminhoAteAproximacaoDoTile, caminhoAtePredioCompleto, criarTarefaDeColheita, liberar, reclamar,
  reclamarMelhorOcupacao, removerTarefa, tarefaDeColheitaDoPredio,
} from '../jobs';
import { tileAlcancavelParaColheita } from '../aproximacao';
import { ehPredioOcupavel, predioAceita, predioDoOcupante, tiposQueOcupam } from '../ocupacao';
import { chaveDeTile, tileDeChave } from '../estradas';
import {
  cabeNaSaida, consumirInsumos, escolhaDepoisDoDeposito, receitaDoTipo, saidasDoCiclo, semRecursoAoAlcance,
  temInsumo, unidadesPorCiclo,
} from '../producao';
import {
  colherDoTile, melhorTileDeColheita, proximoTrabalhoDoRodizio, semearNoTile, tilesReservadosParaColheita,
} from '../recursos';
import { passoAndavel } from '../pathfinding';
import { ehEstadoDeFome } from '../condicao';
import { andar, chegou, comPredio, comUnidade, dadosDaFsm, ficarOcioso, noTile } from '../units/movimento';
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
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
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

/** Devolve o MESMO estado quando o rotulo nao muda: um tick de producao normal
 *  nao realoca a unidade. Molde de `sanearOcupacao`. */
function comFsm(state: GameState, u: Unidade, fsm: string): Passo {
  return u.fsm === fsm ? semEventos(state) : semEventos(comUnidade(state, { ...u, fsm, fsmData: {} }));
}

/**
 * O deposito do ciclo pronto: o UNICO ponto que mexe na gaveta `saida` e o UNICO
 * que COLHE. Nao cabendo, o ciclo fica pronto e espera — `progresso` nao volta a
 * zero, entao nada do que ja foi trabalhado se perde, e nada e colhido do mapa
 * por um ciclo que ainda nao entregou.
 */
function depositar(
  state: GameState, u: Unidade, predio: PredioCompleto, receita: ReceitaDePredio,
  colheita: TarefaColher | null, dados: GameData,
): Passo {
  if (!cabeNaSaida(predio, receita)) return comFsm(state, u, 'saida_cheia');
  const saida: Record<string, number> = { ...predio.estoque.saida };
  const events: GameEvent[] = [];
  // ordem de `economia.mercadorias`, nunca `Object.keys` da receita: a ordem dos
  // eventos e do estoque tem que ser a mesma em qualquer maquina (contrato da F05a)
  //
  // F24a — a oficina de arma entrega UMA das saidas por ciclo, a da vez na cota.
  const produzido = saidasDoCiclo(predio, receita, dados);
  for (const mercadoria of dados.economia.mercadorias) {
    const q = produzido[mercadoria];
    if (q === undefined) continue;
    saida[mercadoria] = (saida[mercadoria] ?? 0) + q;
    events.push({ type: 'goods-produced', predio: predio.id, mercadoria, quantidade: q });
  }
  const escolha = escolhaDepoisDoDeposito(predio, receita, dados);
  // F-T2a — a colheita: o que saiu da gaveta saiu do MAPA. Acontece aqui, no
  // deposito, e nao no avanco do relogio, para que o tile so perca o que virou
  // mercadoria de verdade.
  //
  // F-T2c — DE QUAL tile ja nao se decide aqui: o tile e o que a tarefa do
  // JobBoard reservou, e ela sai do quadro no MESMO tick em que o recurso entra
  // na gaveta. Nao existe instante com a mercadoria feita e o tile ainda
  // reservado — e o mesmo contrato da tarefa de ocupar, que some quando o
  // especialista chega.
  //
  // F-CAMPO-a — o `cursor` do rodizio atravessa o deposito: perde-lo aqui faria
  // toda colheita recomecar do primeiro tile, que e o BUG-O de novo.
  const cursor = predio.producao?.cursor;
  const depositado: PredioCompleto = {
    ...predio, estoque: { ...predio.estoque, saida },
    producao: {
      progresso: 0, plantio: null,
      ...(escolha === undefined ? {} : { escolha }),
      ...(cursor === undefined ? {} : { cursor }),
    },
  };
  const comColheita: GameState = colheita === null ? state : {
    ...state,
    recursos: colherDoTile(state, chaveDeTile(colheita.origemTile), unidadesPorCiclo(receita), dados),
  };
  const semATarefa = colheita === null ? comColheita : removerTarefa(comColheita, colheita.id);
  // o evento sai UMA vez, no ciclo que esgotou: quem ja estava esgotado nao
  // chega ate aqui (o ramo de `semRecursoAoAlcance` em `produzir` corta antes)
  if (semRecursoAoAlcance(comColheita, depositado, receita, dados)) {
    events.push({ type: 'vein-exhausted', predio: predio.id, tipo: predio.tipo });
  }
  return {
    state: comUnidade(comPredio(semATarefa, depositado), { ...u, fsm: 'trabalhando', fsmData: {} }),
    events,
  };
}

/**
 * F-T2c — a tarefa de colheita DESTE ciclo, reclamada por esta unidade, ou
 * `null` se nao da para ter uma agora. Sem ela o relogio nao anda: o tile de
 * onde o ciclo sai e reserva do quadro, nao escolha do sistema de producao.
 *
 * Cria e reclama no MESMO tick, e nao pelo `gerarTarefas` do fim do passo, por
 * duas razoes. A tarefa so tem um pretendente possivel — o ocupante daquele
 * predio — entao nada ganha ficando aberta um tick inteiro. E o `gerarTarefas`
 * roda DEPOIS dos especialistas: gerar la atrasaria em um tick o primeiro ciclo
 * de toda pedreira do jogo, que e exatamente o que a F15a e a F16c medem.
 *
 * A criacao nao e um atalho em volta do quadro: o tile escolhido ja desconta os
 * reservados, e o `reclamar` refaz a conferencia por conta propria. Se o claim
 * falhar, o estado com a tarefa criada e DESCARTADO inteiro — o `release` deste
 * ramo e nao devolver nada ao chamador.
 */
function garantirColheita(
  state: GameState, u: Unidade, predio: PredioCompleto, colheita: ColheitaDeRecurso,
  quantidade: number, dados: GameData,
  // F-CAMPO-a — o tile que o rodizio ja escolheu; `null` e a escolha de sempre.
  tileEscolhido: string | null = null,
): { readonly state: GameState; readonly tarefa: TarefaColher } | null {
  const existente = tarefaDeColheitaDoPredio(state, predio.id);
  if (existente !== null && existente.estado === 'reclamada') {
    return existente.reclamadaPor === u.id ? { state, tarefa: existente } : null;
  }
  let base = state;
  let id: string;
  if (existente !== null) {
    id = existente.id; // reaberta por `liberar`: o tile continua sendo deste predio
  } else {
    // F-T3 — o predicado de POSICAO, o MESMO que o claim usa: tile debaixo de
    // predio ou sem aproximacao andavel nao entra na escolha. Se so o claim
    // recusasse, a tarefa nasceria e morreria a cada tick e o predio esperaria o
    // que nunca chega.
    const chaveDoTile = tileEscolhido ?? melhorTileDeColheita(
      state, predio, colheita, quantidade, tilesReservadosParaColheita(state), dados,
      (k) => tileAlcancavelParaColheita(state, k, dados),
    );
    if (chaveDoTile === null) return null; // nenhum tile livre ao alcance neste tick
    const criada = criarTarefaDeColheita(state, {
      destino: predio.id, origemTile: tileDeChave(chaveDoTile),
      recurso: colheita.recurso, quantidade,
    });
    base = criada.state;
    id = criada.id;
  }
  const r = reclamar(base, id, u.id, dados);
  if (!r.ok) return null;
  const reclamada = r.state.jobs.tarefas.porId[id];
  if (reclamada === undefined || !ehTarefaDeColheita(reclamada)) return null;
  return { state: r.state, tarefa: reclamada };
}

/**
 * F18 — O ROÇADO NAO COLHE O QUE NAO PLANTOU.
 *
 * A fazenda tem a mesma forma da pedreira — colhe um recurso de tile ao alcance
 * — com uma diferenca: o recurso dela nao esta no chao esperando. Terra arada
 * nasce em pousio (`quantidadeInicial: 0`), e quem a enche e o proprio roceiro.
 *
 * F-CAMPO-a — o ciclo do tile tem DUAS visitas e um intervalo no meio:
 *
 *   trabalhando -> indo_semear -> semeando -> voltando -> trabalhando
 *
 *   - semear: o roceiro vai ao tile, semeia `ticksDeSemear` e volta (o `voltando`
 *     da colheita, sem tarefa na mao);
 *   - crescer: `ticksDeCrescer`, NO TILE, sem ninguem la (`semeadoEm`; maduro e
 *     derivado, `tileMaduro`, e nada avanca por tick);
 *   - colher: o ciclo da F-T3, intocado, sobre o tile ja maduro.
 * Ate a F-CAMPO o plantio corria DENTRO do predio e cobria semear e crescer num
 * relogio so, com o roceiro preso a ele: doze tiles rendiam o mesmo que um (BUG-O).
 */
function reposicaoDe(colheita: ColheitaDeRecurso, dados: GameData): ReposicaoDeRecurso | null {
  return dados.recursos.tipos[colheita.recurso]?.reposicao ?? null;
}

/**
 * Comeca um plantio no tile que o rodizio escolheu, ou `null` se nao da agora.
 * Cobra o custo de `entrada` no mesmo tick em que reserva o tile, como o ciclo de
 * producao cobra o insumo ao iniciar (F15a) e a escola cobra o ouro ao iniciar o
 * treino (F13a): quem nao pode pagar nao segura o tile.
 *
 * O custo e do DADO (`resources.json: tipos.<t>.reposicao.custo`) e hoje esta
 * vazio para o milho — a semente sai do proprio roçado. O caminho existe porque
 * o replantio da arvore, que ja esta na fila, cobra tora; `tests/F18-rocado.test.ts`
 * o exercita com um custo INJETADO, nao com o dado real.
 */
function iniciarPlantio(
  predio: PredioCompleto, receita: ReceitaDePredio, chaveDoTile: string, dados: GameData,
): { readonly predio: PredioCompleto; readonly plantio: Plantio } | null {
  const { colheita } = receita;
  const prod = predio.producao;
  if (colheita === null || prod === null) return null;
  const reposicao = reposicaoDe(colheita, dados);
  if (reposicao === null) return null; // tipo que nao se repoe (a rocha): nada a plantar
  const entrada: Record<string, number> = { ...predio.estoque.entrada };
  for (const [mercadoria, q] of Object.entries(reposicao.custo)) {
    if ((entrada[mercadoria] ?? 0) < q) return null; // sem o que plantar: `esperando_insumo`
    entrada[mercadoria] = (entrada[mercadoria] as number) - q;
  }
  const plantio: Plantio = { tile: tileDeChave(chaveDoTile), progresso: 0 };
  return {
    predio: {
      ...predio,
      estoque: { ...predio.estoque, entrada },
      producao: { ...prod, plantio, cursor: chaveDoTile },
    },
    plantio,
  };
}

/**
 * Sai do predio para o tile do plantio. Sem caminho, o plantio cai (a reserva e
 * do predio, e solta-la e apaga-lo) e o proximo tick escolhe de novo — o
 * `elegivel` do rodizio ja recusa o tile ilhado, entao isto so cobre o tile que
 * se fechou depois de escolhido.
 *
 * E tambem por aqui que continua o plantio que o predio ja segura: o de um
 * ocupante que saiu para comer (a fome vaga o predio e deixa o `plantio`) e o de
 * um save de antes da F-CAMPO, com o plantio correndo dentro do predio.
 */
function sairParaSemear(
  state: GameState, u: Unidade, predio: PredioCompleto, plantio: Plantio, dados: GameData,
): Passo {
  const caminho = caminhoAteAproximacaoDoTile(state, plantio.tile, u.id, dados);
  if (caminho === null) {
    const semPlantio: PredioCompleto = {
      ...predio, producao: predio.producao === null ? null : { ...predio.producao, plantio: null },
    };
    return comFsm(comPredio(state, semPlantio), u, 'esperando_insumo');
  }
  return semEventos(comUnidade(comPredio(state, predio), {
    ...u, fsm: 'indo_semear', fsmData: dadosDaFsm({ caminho: caminho.tiles, progresso: 0 }),
  }));
}

/** Os degraus do campo (`situacaoEmCampo`), com o PLANTIO no lugar da tarefa:
 *  tenho predio, ele esta pausado (congela, F16c), ele ainda tem plantio. */
type SituacaoDoPlantio =
  | { readonly tipo: 'ok'; readonly predio: PredioCompleto; readonly plantio: Plantio }
  | { readonly tipo: 'congelado' }
  | { readonly tipo: 'sem-plantio'; readonly predio: PredioCompleto }
  | { readonly tipo: 'perdeu-o-predio' };

function situacaoDoPlantio(state: GameState, u: Unidade): SituacaoDoPlantio {
  const predio = predioDoOcupante(state, u.id);
  if (predio === null) return { tipo: 'perdeu-o-predio' };
  if (predio.pausado) return { tipo: 'congelado' };
  const plantio = predio.producao?.plantio ?? null;
  if (plantio === null) return { tipo: 'sem-plantio', predio };
  return { tipo: 'ok', predio, plantio };
}

/** Andando para o tile do plantio. */
function passoIndoSemear(state: GameState, u: Unidade, dados: GameData): Passo {
  const s = situacaoDoPlantio(state, u);
  if (s.tipo === 'perdeu-o-predio') return largarOPredioPerdido(state, u);
  if (s.tipo === 'congelado') return semEventos(state);
  if (s.tipo === 'sem-plantio') return voltarSemTarefa(state, u, s.predio, dados);
  const { predio, plantio } = s;

  const proximo = (u.fsmData.caminho ?? [])[0];
  let atual = u;
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    // o caminho morreu debaixo dele: repede UMA vez. Sem volta ao tile,
    // `voltarSemTarefa` zera o plantio, e a reserva sai junto.
    const caminho = caminhoAteAproximacaoDoTile(state, plantio.tile, u.id, dados);
    if (caminho === null) return voltarSemTarefa(state, u, predio, dados);
    atual = { ...u, fsmData: dadosDaFsm({ caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));
  return semEventos(comUnidade(state, { ...andou, fsm: 'semeando', fsmData: {} }));
}

/**
 * No tile, semeando: o relogio e `plantio.progresso`, ate `ticksDeSemear`. No
 * ultimo tick o tile vai ao rendimento cheio com `semeadoEm` (a quantidade entra
 * ja; quem a segura ate amadurecer e `tileMaduro`) e ele volta — `voltarSemTarefa`
 * zera o `plantio`, que e a reserva. A safra fica no CHAO: demolir a fazenda no
 * tick seguinte nao a desfaz.
 *
 * Sem evento: o consumidor dele seria o sprite do campo (F-CAMPO-b), que le
 * `state.recursos`, e evento sem consumidor nao nasce.
 */
function passoSemeando(state: GameState, u: Unidade, dados: GameData): Passo {
  const s = situacaoDoPlantio(state, u);
  if (s.tipo === 'perdeu-o-predio') return largarOPredioPerdido(state, u);
  if (s.tipo === 'congelado') return semEventos(state);
  if (s.tipo === 'sem-plantio') return voltarSemTarefa(state, u, s.predio, dados);
  const { predio, plantio } = s;
  const receita = receitaDoTipo(predio.tipo, dados);
  const reposicao = receita === null || receita.colheita === null ? null : reposicaoDe(receita.colheita, dados);
  if (reposicao === null || predio.producao === null) return voltarSemTarefa(state, u, predio, dados);

  const progresso = plantio.progresso + 1;
  if (progresso < reposicao.ticksDeSemear) {
    return semEventos(comPredio(state, {
      ...predio, producao: { ...predio.producao, plantio: { ...plantio, progresso } },
    }));
  }
  const semeado: GameState = { ...state, recursos: semearNoTile(state, chaveDeTile(plantio.tile), dados) };
  return voltarSemTarefa(semeado, u, predio, dados);
}

/**
 * Um tick de `trabalhando` no predio que REPOE o tile. Tres casos, nesta ordem:
 *   1. o predio ja segura um plantio: vai semear;
 *   2. ja existe tarefa de colheita deste predio (ciclo em curso, ou reaberta por
 *      `liberar`): devolve `null`, e o `produzir` segue o ciclo de sempre;
 *   3. senao, o RODIZIO escolhe tile e acao. Colher reclama a tarefa NO tile
 *      escolhido; semear reserva o plantio e sai. Os dois gravam o `cursor`.
 */
function escolherNoCampo(
  state: GameState, u: Unidade, predio: PredioCompleto, receita: ReceitaDePredio, dados: GameData,
):
  | { readonly passo: Passo }
  | { readonly colheita: { readonly state: GameState; readonly tarefa: TarefaColher }; readonly predio: PredioCompleto }
  | null {
  const prod = predio.producao;
  const colheita = receita.colheita;
  if (prod === null || colheita === null) return null;
  if (prod.plantio !== null) return { passo: sairParaSemear(state, u, predio, prod.plantio, dados) };
  if (tarefaDeColheitaDoPredio(state, predio.id) !== null) return null;
  const quantidade = unidadesPorCiclo(receita);
  const trabalho = proximoTrabalhoDoRodizio(
    state, predio, colheita, quantidade, tilesReservadosParaColheita(state), dados,
    (k) => tileAlcancavelParaColheita(state, k, dados),
  );
  if (trabalho === null) return { passo: comFsm(state, u, 'esperando_insumo') };
  if (trabalho.acao === 'semear') {
    const iniciado = iniciarPlantio(predio, receita, trabalho.tile, dados);
    if (iniciado === null) return { passo: comFsm(state, u, 'esperando_insumo') };
    return { passo: sairParaSemear(state, u, iniciado.predio, iniciado.plantio, dados) };
  }
  const r = garantirColheita(state, u, predio, colheita, quantidade, dados, trabalho.tile);
  if (r === null) return { passo: comFsm(state, u, 'esperando_insumo') };
  const comCursor: PredioCompleto = { ...predio, producao: { ...prod, cursor: trabalho.tile } };
  return { colheita: { state: comPredio(r.state, comCursor), tarefa: r.tarefa }, predio: comCursor };
}

/**
 * F15a — o ciclo de producao, um tick. Quem o avanca e o OCUPANTE: predio sem
 * ocupante nao produz (Nota da F14), e "um predio, um ocupante" (F14) torna
 * avanco duplo no mesmo tick irrepresentavel.
 *
 * O rotulo da FSM e RECALCULADO do predio a cada tick — nao existe
 * `esperando_insumo` gravado que discorde do estoque de verdade, pela mesma
 * razao que a posse mora so no predio.
 */
function produzir(state: GameState, u: Unidade, predioAntes: PredioCompleto, dados: GameData): Passo {
  let predio = predioAntes;
  // F16c — a PRIMEIRA pergunta, antes da receita e antes da estrada: e o fato
  // mais especifico sobre este predio e e acao deliberada do jogador. Congela o
  // relogio e nada mais: `progresso` nao zera, o insumo ja consumido continua
  // consumido, a gaveta `saida` segue escoando e o ocupante fica — por isso o
  // rotulo e `trabalhando`, e nao um estado novo (`docs/planos/F16c-pausar.md`).
  if (predio.pausado) return comFsm(state, u, 'trabalhando');
  const receita = receitaDoTipo(predio.tipo, dados);
  let prod = predio.producao;
  // predio ocupavel sem receita nao existe no dado de hoje; se existir, ocupa e nao produz
  if (receita === null || prod === null) return comFsm(state, u, 'trabalhando');
  // AQUI HAVIA UM PORTAO, e ele foi REVOGADO (decisao do operador, 2026-09-25):
  // `if (!predioLigadoAoArmazem(...)) return comFsm(state, u, 'saida_cheia')`, a
  // decisao D6 da F15a. A razao dele: "a estrada serve para ESCOAR, nao para
  // trabalhar — o lenhador corta arvore com machado, nao com carroca". Predio
  // desligado PRODUZ, e para quando a gaveta enche, pelo caminho normal de
  // `saida_cheia` (o teto de `production.estoqueInternoPorPredio`).
  //
  // O D6 nasceu errado, e o operador registrou isso: ele o escreveu na F16c
  // raciocinando sobre PAUSA e MODO, sem pensar em producao sem estrada. O texto
  // real da GDD §5.1 ("planta com porta ao sul; precisa de estrada ate a rede")
  // e regra de POSICIONAMENTO e nunca disse que a producao para.
  //
  // O jogador continua avisado: a causa `'sem-estrada'` de `CAUSAS_DE_ALERTA`
  // deriva direto de `!predioLigadoAoArmazem` (`sim/selectors.ts`), sem passar por
  // aqui — e por isso este arquivo deixou de importar a funcao: o portao era o
  // UNICO uso dela aqui.
  // F-T2c — o TILE deste ciclo, reclamado no quadro. Vem antes do relogio e antes
  // do deposito: sem tile reservado nao ha colheita, e um ciclo que nao pode
  // colher nao pode andar. Substitui o `semRecursoAoAlcance` que ficava aqui —
  // mapa esgotado tambem nao produz tarefa, entao o portao e o mesmo, com uma
  // razao a mais (o tile pode estar com a pedreira vizinha). O rotulo continua
  // `esperando_insumo`: para o jogador, os dois casos sao "falta materia-prima",
  // e o segundo se resolve sozinho no ciclo seguinte.
  //
  // F-CAMPO-a — o predio que REPOE o tile (roçado, canavial) escolhe pelo
  // RODIZIO: colher ou semear, e em que tile (`escolherNoCampo`). O plantio em
  // curso vem antes de tudo: o tile reservado nao volta a ser pousio de graca.
  let colheita: { readonly state: GameState; readonly tarefa: TarefaColher } | null = null;
  if (receita.colheita !== null && reposicaoDe(receita.colheita, dados) !== null) {
    const escolha = escolherNoCampo(state, u, predio, receita, dados);
    if (escolha !== null && 'passo' in escolha) return escolha.passo;
    if (escolha !== null) {
      colheita = escolha.colheita;
      predio = escolha.predio;
      prod = escolha.predio.producao ?? prod;
    }
  }
  if (receita.colheita !== null && colheita === null) {
    colheita = garantirColheita(state, u, predio, receita.colheita, unidadesPorCiclo(receita), dados);
    if (colheita === null) return comFsm(state, u, 'esperando_insumo');
  }
  const base = colheita === null ? state : colheita.state;
  const tarefa = colheita === null ? null : colheita.tarefa;
  // ciclo PRONTO de um tick anterior: so falta caber
  if (prod.progresso >= receita.ticksDoCiclo) return depositar(base, u, predio, receita, tarefa, dados);
  // F-T3 — AQUI o especialista SAI. Predio com `colheita` no dado nao produz mais
  // de dentro: o ciclo comeca com a viagem, o relogio anda no tile (`colhendo`) e o
  // deposito acontece na volta. Predio sem `colheita` (padaria, moinho) nao tem
  // tarefa e segue exatamente como antes — a diferenca nasce do DADO, nao de uma
  // lista de tipos em codigo.
  //
  // Sem caminho ate a aproximacao do tile, o claim ja teria recusado; este ramo
  // cobre o tile que se fechou DEPOIS de reclamado (obra plantada em cima do unico
  // acesso). `'caminho-cortado'` NAO reabre a tarefa: o proximo ciclo escolhe outro
  // tile, em vez de insistir no que ficou ilhado.
  //
  // O insumo e cobrado DEPOIS do caminho, e nao antes: cobrar e nao poder sair
  // queimaria materia-prima por um ciclo que nunca comecou.
  //
  // 2026-09-26 (operador) — `colheita.aDistancia` fica DENTRO: nao ha viagem, o
  // relogio anda no predio abaixo e o `depositar` consome o tile da tarefa, que
  // segue reclamada — o esgotamento, o alerta e a previa de alcance nao mudam.
  if (tarefa !== null && prod.progresso === 0 && receita.colheita?.aDistancia !== true) {
    const caminho = caminhoAteAproximacaoDoTile(base, tarefa.origemTile, u.id, dados);
    if (caminho === null) {
      const l = liberar(base, tarefa.id, 'caminho-cortado');
      return { state: comFsm(l.state, u, 'esperando_insumo').state, events: l.events };
    }
    if (!temInsumo(predio, receita)) return comFsm(base, u, 'esperando_insumo');
    const pago = comPredio(base, consumirInsumos(predio, receita));
    return semEventos(comUnidade(pago, {
      ...u,
      fsm: 'indo_colher',
      fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
    }));
  }
  // inicio de ciclo: cobra os insumos, como a escola cobra o ouro ao INICIAR o treino (F13a)
  let atual = predio;
  if (prod.progresso === 0) {
    if (!temInsumo(predio, receita)) return comFsm(base, u, 'esperando_insumo');
    atual = consumirInsumos(predio, receita);
  }
  const avancado: PredioCompleto = {
    ...atual, producao: { ...prod, progresso: prod.progresso + 1, plantio: null },
  };
  const comRelogio = comPredio(base, avancado);
  return prod.progresso + 1 < receita.ticksDoCiclo
    ? comFsm(comRelogio, u, 'trabalhando')
    : depositar(comRelogio, u, avancado, receita, tarefa, dados);
}

/**
 * A posse mora no predio: sumiu, deixou de ser ocupavel ou passou a apontar
 * para outro, este especialista volta a procurar. Senao, produz.
 *
 * F-T2c — perder o predio LARGA a tarefa de colheita no mesmo tick, e nao no
 * `sanearTarefas` do tick seguinte. Nao e otimizacao: `unidadeJaTemTarefa`
 * recusa claim de quem ja segura tarefa, entao o especialista que saisse daqui
 * ainda segurando o tile nunca mais reclamaria uma ocupacao — ficaria ocioso
 * para sempre com um tile reservado na mao. `'pedido-da-unidade'` REABRE: o
 * tile continua sendo do predio, para o proximo ocupante.
 */
function passoProduzindo(state: GameState, u: Unidade, dados: GameData): Passo {
  const predio = predioDoOcupante(state, u.id);
  if (predio !== null) return produzir(state, u, predio, dados);
  return largarOPredioPerdido(state, u);
}

/**
 * F-T3 — "eu ainda tenho predio?", e o que fazer quando nao. Era o prologo de
 * `passoProduzindo` (F-T2c), extraido sem mudar corpo ao ganhar os outros tres
 * consumidores: os estados EM CAMPO. Demolir o predio com o especialista no campo
 * cai todo aqui — tarefa liberada com `'pedido-da-unidade'` (o tile REABRE para o
 * proximo ocupante) e a unidade fica ociosa NO TILE em que estava.
 */
function largarOPredioPerdido(state: GameState, u: Unidade): Passo {
  const minha = colheitaSeguraPor(state, u.id);
  if (minha === null) return ficarOcioso(state, u);
  const l = liberar(state, minha.id, 'pedido-da-unidade');
  const ocioso = ficarOcioso(l.state, u);
  return { state: ocioso.state, events: [...l.events, ...ocioso.events] };
}

/** F-T2c — a tarefa de colheita que ESTA unidade segura, se ha. */
function colheitaSeguraPor(state: GameState, unidadeId: string): TarefaColher | null {
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t !== undefined && ehTarefaDeColheita(t) && t.reclamadaPor === unidadeId) return t;
  }
  return null;
}

/**
 * F-T3 — O ESPECIALISTA EM CAMPO.
 *
 *   trabalhando -> indo_colher -> colhendo -> voltando -> trabalhando
 *
 * O predio e a tarefa moram onde sempre moraram: a posse em `predio.ocupante`, o
 * tile em `TarefaColher`. Nenhum campo novo no `GameState` — os tres estados usam
 * `fsmData.caminho`/`progresso`, os mesmos do serf e do laborer.
 *
 * Os tres estados comecam pelas MESMAS tres perguntas, nesta ordem, e a ordem e a
 * regra:
 *
 * 1. tenho predio? Nao: `largarOPredioPerdido` (demolido, ou ocupante trocado).
 * 2. o predio esta pausado? Entao CONGELA onde esta, sem olhar mais nada (F16c:
 *    pausa nao move ninguem). Vem antes da tarefa de proposito — `sanearTarefas`
 *    CANCELA a colheita do predio pausado (F16c, `motivoDoDestino`: segurar o tile
 *    por tempo indeterminado travaria a pedreira do vizinho de graca), e sem este
 *    degrau o pedreiro pausado no campo seria expulso do proprio predio no tick
 *    seguinte a pausa.
 * 3. tenho a tarefa? Nao: volta de maos vazias e o ciclo recomeca inteiro. E o
 *    preco da regra do degrau 2, e ele e pago em TICKS, nunca em mercadoria.
 */
function posseEmCampo(
  state: GameState, u: Unidade,
): { readonly predio: PredioCompleto; readonly tarefa: TarefaColher } | null {
  const predio = predioDoOcupante(state, u.id);
  if (predio === null) return null;
  const tarefa = colheitaSeguraPor(state, u.id);
  if (tarefa === null || tarefa.destino !== predio.id) return null;
  return { predio, tarefa };
}

/** Os tres degraus, na ordem. `'perdeu-o-predio'` e `'sem-tarefa'` sao os dois
 *  ramos de erro; `'congelado'` e a pausa. */
type SituacaoEmCampo =
  | { readonly tipo: 'ok'; readonly predio: PredioCompleto; readonly tarefa: TarefaColher }
  | { readonly tipo: 'congelado' }
  | { readonly tipo: 'sem-tarefa'; readonly predio: PredioCompleto }
  | { readonly tipo: 'perdeu-o-predio' };

/**
 * Pausa CONGELA: nenhum passo, nenhum relogio, nenhum evento (F16c). A unica
 * escrita e apagar de `fsmData` o ponteiro de uma tarefa que o quadro ja tirou
 * dele — e o que acontece no tick da pausa, porque `motivoDoDestino` cancela a
 * colheita do predio pausado. Ponteiro pendurado seria estado mentindo, e por isso
 * ele nao sobrevive nem congelado.
 */
function congelar(state: GameState, u: Unidade): Passo {
  const alvo = u.fsmData.tarefa;
  if (alvo === undefined) return semEventos(state);
  const minha = colheitaSeguraPor(state, u.id);
  if (minha !== null && minha.id === alvo) return semEventos(state);
  const { tarefa: _cancelada, ...semAPonteiro } = u.fsmData;
  return semEventos(comUnidade(state, { ...u, fsmData: semAPonteiro }));
}

function situacaoEmCampo(state: GameState, u: Unidade): SituacaoEmCampo {
  const predio = predioDoOcupante(state, u.id);
  if (predio === null) return { tipo: 'perdeu-o-predio' };
  if (predio.pausado) return { tipo: 'congelado' };
  const posse = posseEmCampo(state, u);
  if (posse === null) return { tipo: 'sem-tarefa', predio };
  return { tipo: 'ok', predio: posse.predio, tarefa: posse.tarefa };
}

/** Andando para o tile. Pausa CONGELA onde esta (F16c): pausa e "este predio
 *  para", e mandar o pedreiro para casa seria movimento que o jogador nao pediu. */
function passoIndoColher(state: GameState, u: Unidade, dados: GameData): Passo {
  const s = situacaoEmCampo(state, u);
  if (s.tipo === 'perdeu-o-predio') return largarOPredioPerdido(state, u);
  if (s.tipo === 'congelado') return congelar(state, u);
  if (s.tipo === 'sem-tarefa') return voltarSemTarefa(state, u, s.predio, dados);
  const { predio, tarefa } = s;

  const proximo = (u.fsmData.caminho ?? [])[0];
  let atual = u;
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    // o caminho morreu debaixo dele (obra plantada na frente): repede UMA vez.
    const caminho = caminhoAteAproximacaoDoTile(state, tarefa.origemTile, u.id, dados);
    if (caminho === null) return voltarSemColher(state, u, predio, tarefa, dados);
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));
  return semEventos(comUnidade(state, {
    ...andou, fsm: 'colhendo', fsmData: dadosDaFsm({ tarefa: tarefa.id }),
  }));
}

/** No tile: o relogio do CICLO anda aqui, e e o mesmo relogio de sempre
 *  (`predio.producao.progresso`, `receita.ticksDoCiclo`). Nenhum numero novo — o
 *  que mudou e QUANDO ele anda, nao quanto. */
function passoColhendo(state: GameState, u: Unidade, dados: GameData): Passo {
  const s = situacaoEmCampo(state, u);
  if (s.tipo === 'perdeu-o-predio') return largarOPredioPerdido(state, u);
  if (s.tipo === 'congelado') return congelar(state, u);
  if (s.tipo === 'sem-tarefa') return voltarSemTarefa(state, u, s.predio, dados);
  const { predio, tarefa } = s;

  const receita = receitaDoTipo(predio.tipo, dados);
  const prod = predio.producao;
  if (receita === null || prod === null) return voltarSemColher(state, u, predio, tarefa, dados);

  const progresso = prod.progresso + 1;
  const avancado: PredioCompleto = { ...predio, producao: { ...prod, progresso, plantio: null } };
  const comRelogio = comPredio(state, avancado);
  if (progresso < receita.ticksDoCiclo) return semEventos(comRelogio);
  return voltar(comRelogio, u, avancado, tarefa, dados);
}

/** Voltando. Com tarefa na mao, a chegada e o DEPOSITO — e e o `depositar` da
 *  F-T2c, intocado: gaveta, `colherDoTile`, tarefa fora do quadro e
 *  `vein-exhausted`, tudo no mesmo tick. Sem tarefa (o tile secou enquanto ele
 *  vinha), a chegada so zera o relogio: mercadoria sem tile seria pedra vinda do
 *  nada. */
function passoVoltando(state: GameState, u: Unidade, dados: GameData): Passo {
  const predio = predioDoOcupante(state, u.id);
  if (predio === null) return largarOPredioPerdido(state, u);
  if (predio.pausado) return semEventos(state);

  const proximo = (u.fsmData.caminho ?? [])[0];
  let atual = u;
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    const caminho = caminhoAtePredioCompleto(state, predio.id, u.id, dados);
    if (caminho === null) return desfazerPosse(state, u, predio);
    atual = { ...u, fsmData: dadosDaFsm({ ...u.fsmData, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  if (!chegou(andou)) return semEventos(comUnidade(state, andou));

  const receita = receitaDoTipo(predio.tipo, dados);
  const tarefa = colheitaSeguraPor(state, u.id);
  if (receita === null) return ficarOcioso(state, andou);
  if (tarefa === null) {
    const zerado: PredioCompleto = { ...predio, producao: { ...predio.producao, progresso: 0, plantio: null } };
    return semEventos(comUnidade(comPredio(state, zerado), {
      ...andou, fsm: 'trabalhando', fsmData: {},
    }));
  }
  return depositar(state, andou, predio, receita, tarefa, dados);
}

/** Fim do ciclo no tile: pede o caminho de volta e sai andando COM a tarefa na
 *  mao — e a tarefa que faz a chegada virar deposito. Sem caminho de volta cai em
 *  `voltarSemColher`, e nao direto em `desfazerPosse`, por um motivo: aquele LIBERA
 *  a tarefa antes de descobrir que tambem nao ha volta, e e esse `liberar` que
 *  impede o tile de ficar reservado por uma unidade que nunca mais vai colher. */
function voltar(
  state: GameState, u: Unidade, predio: PredioCompleto, tarefa: TarefaColher, dados: GameData,
): Passo {
  const caminho = caminhoAtePredioCompleto(state, predio.id, u.id, dados);
  if (caminho === null) return voltarSemColher(state, u, predio, tarefa, dados);
  return semEventos(comUnidade(state, {
    ...u, fsm: 'voltando', fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
  }));
}

/** Volta de maos vazias: o ciclo perdeu o tile (secou, ou o caminho de ida
 *  morreu). Larga a tarefa REABRINDO (o tile continua sendo do predio) e zera o
 *  relogio — meio ciclo pago nao vira pedra. */
function voltarSemColher(
  state: GameState, u: Unidade, predio: PredioCompleto, tarefa: TarefaColher, dados: GameData,
): Passo {
  const l = liberar(state, tarefa.id, 'pedido-da-unidade');
  return voltarSemTarefa(l.state, u, predio, dados, l.events);
}

/**
 * Volta sem ter tarefa nenhuma para largar: o quadro ja a tirou dele. Acontece
 * quando o jogador PAUSA o predio com ele no campo (`motivoDoDestino` cancela a
 * colheita do predio pausado) e tambem quando o tile secou na mao de outro.
 * Zera o relogio: o meio ciclo trabalhado sobre um tile que nao e mais dele nao
 * pode virar mercadoria nem ficar guardado para o proximo tile.
 */
function voltarSemTarefa(
  state: GameState, u: Unidade, predio: PredioCompleto, dados: GameData,
  eventos: readonly GameEvent[] = [],
): Passo {
  const caminho = caminhoAtePredioCompleto(state, predio.id, u.id, dados);
  if (caminho === null) return desfazerPosse(state, u, predio, eventos);
  const zerado: PredioCompleto = { ...predio, producao: { ...predio.producao, progresso: 0, plantio: null } };
  return {
    state: comUnidade(comPredio(state, zerado), {
      ...u, fsm: 'voltando', fsmData: dadosDaFsm({ caminho: caminho.tiles, progresso: 0 }),
    }),
    events: eventos,
  };
}

/** Ele nao consegue mais voltar: a posse se desfaz dos DOIS lados. O predio fica
 *  vago (e ai o alerta `sem-trabalhador` acende com razao) e ele fica ocioso onde
 *  esta, livre para reclamar outra ocupacao — cujo claim confere caminho. */
function desfazerPosse(
  state: GameState, u: Unidade, predio: PredioCompleto, eventos: readonly GameEvent[] = [],
): Passo {
  const vago = comPredio(state, {
    ...predio,
    ocupante: null,
    // F-CAMPO-a — `cursor` e `plantio` ficam: sao do PREDIO, para o proximo ocupante
    producao: predio.producao === null ? null : { ...predio.producao, progresso: 0 },
  });
  return ficarOcioso(vago, u, eventos);
}

function passoDoEspecialista(state: GameState, u: Unidade, dados: GameData): Passo {
  switch (u.fsm) {
    case 'ocioso': return passoOcioso(state, u, dados);
    case 'indo_ocupar': return passoIndoOcupar(state, u, dados);
    // os tres estados de PRODUCAO caem no mesmo ramo: o rotulo e recalculado do
    // predio a cada tick, entao nao ha transicao a escrever entre eles
    case 'trabalhando':
    case 'esperando_insumo':
    case 'saida_cheia':
      return passoProduzindo(state, u, dados);
    // F-T3 — os tres estados EM CAMPO tem transicao PROPRIA: aqui nao ha rotulo
    // a recalcular do predio, e cada um deles comeca conferindo a posse.
    case 'indo_colher': return passoIndoColher(state, u, dados);
    case 'colhendo': return passoColhendo(state, u, dados);
    case 'voltando': return passoVoltando(state, u, dados);
    // F-CAMPO-a — o desvio de semear; a volta e o `voltando` de cima, sem tarefa.
    case 'indo_semear': return passoIndoSemear(state, u, dados);
    case 'semeando': return passoSemeando(state, u, dados);
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
    // F20b: quem esta comendo (ou a caminho da Bodega) tem o passo dado pelo
    // `sistemaDaFome`, e nao por esta FSM — o `default` do `switch` LANCA, entao
    // esquecer este pulo nao daria bug silencioso. `ehEstadoDeFome` e a lista unica.
    if (ehEstadoDeFome(u.fsm)) continue;
    const r = passoDoEspecialista(atual, u, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
