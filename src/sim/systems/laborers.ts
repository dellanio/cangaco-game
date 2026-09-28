/**
 * A FSM do laborer (GDD §6.3), um passo por tick, para cada laborer em `unidades.ordem`.
 *
 *   ocioso -> indo_a_obra -> nivelando -> esperando_material -> martelando -> ocioso
 *
 * Nenhum estado alem destes cinco (o GDD proibe). `esperando_material` e estado real e
 * visivel: o laborer fica parado na obra enquanto ha material a caminho — e, desde a
 * F18g, parado no TILE do canteiro enquanto a pedra dele vem na mao de um serf.
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
import type {
  GameEvent, GameState, PredioEmObra, TarefaArar, TarefaAssentarEstrada, TarefaConstruir, TarefaDeLaborer,
  TarefaReparar, Unidade,
} from '../state';
import {
  completarObra, ehTarefaDeAradura, ehTarefaDeAssentamento, ehTarefaDeLaborer, ehTarefaDeReparo, ehTarefaDeTile,
} from '../state';
import { comOTileAssentado, pedraNoTile, tileDeEstradaTrabalhavel } from '../estradas';
import { comOTileArado } from '../campos';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import {
  caminhoDoLaborer, cancelarConstrucoesDe, liberar, reclamarMelhorDoLaborer, removerTarefa, TIPO_QUE_CONSTROI,
} from '../jobs';
import type { MotivoDeLiberacao } from '../jobs';
import { alvoDeNivelamento, hpTotalDoTipo, obraNivelada, obraTrabalhavel, tetoDeHp } from '../obra';
import { passoAndavel } from '../pathfinding';
import { andar, chegou, comPredio, comUnidade, dadosDaFsm, ficarOcioso, noTile, ocioso } from '../units/movimento';
import { ehEstadoDeFome } from '../condicao';
import type { ResultadoDeSistema } from './jobs';

type Passo = ResultadoDeSistema;

const semEventos = (state: GameState): Passo => ({ state, events: [] });

/** A tarefa do laborer, se ela existe, esta `'reclamada'` e e mesmo dele. So laborer
 *  reclama `'construir'` e `'assentar-estrada'` (`elegivelParaTarefa`, F11b/F18d-1b) — o
 *  filtro de tipo aqui e so para o compilador estreitar; ele nunca segura carga. */
function tarefaDoLaborer(state: GameState, u: Unidade): TarefaDeLaborer | null {
  const id = u.fsmData.tarefa;
  const t = id === undefined ? undefined : state.jobs.tarefas.porId[id];
  return t !== undefined && ehTarefaDeLaborer(t) && t.estado === 'reclamada' && t.reclamadaPor === u.id ? t : null;
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
  const r = reclamarMelhorDoLaborer(state, u.id, dados);
  if (!r.ok) return semEventos(state);
  const bruta = r.state.jobs.tarefas.porId[r.tarefa];
  const tarefa = bruta !== undefined && ehTarefaDeLaborer(bruta) ? bruta : undefined;
  const caminho = tarefa === undefined ? null : caminhoDoLaborer(r.state, tarefa, u.id, dados);
  if (tarefa === undefined || caminho === null) {
    // o claim ja exigiu o caminho; se ele sumiu, devolve a reserva em vez de segurar a tarefa
    const l = liberarTarefa(r.state, r.tarefa, 'pedido-da-unidade');
    return { state: l.state, events: l.events };
  }
  return semEventos(comUnidade(r.state, {
    ...u, fsm: 'indo_a_obra', fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }),
  }));
}

/** Um passo rumo ao destino da tarefa, replanejando se plantaram predio na frente.
 *  `null` = o laborer nao chega mais la, e quem chama libera. */
function avancar(
  state: GameState, u: Unidade, tarefa: TarefaDeLaborer, dados: GameData,
): { readonly u: Unidade; readonly chegou: boolean } | null {
  let atual = u;
  const proximo = (u.fsmData.caminho ?? [])[0];
  if (proximo !== undefined && !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    // um predio foi plantado no caminho: replaneja a partir de onde esta
    const caminho = caminhoDoLaborer(state, tarefa, u.id, dados);
    if (caminho === null) return null;
    atual = { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, caminho: caminho.tiles, progresso: 0 }) };
  }
  const andou = andar(state, atual, dados);
  return { u: andou, chegou: chegou(andou) };
}

function passoIndoAObra(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoLaborer(state, u);
  if (tarefa === null) return ficarOcioso(state, u); // o quadro a cancelou (destino sumiu/completou)
  if (ehTarefaDeTile(tarefa)) return passoIndoAoTile(state, u, tarefa, dados);
  if (ehTarefaDeReparo(tarefa)) return passoIndoReparar(state, u, tarefa, dados);
  const obra = obraDaTarefa(state, tarefa);
  if (obra === null) return ficarOcioso(state, u); // outro laborer completou a obra neste tick

  const passo = avancar(state, u, tarefa, dados);
  if (passo === null) {
    const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade'); // so a UNIDADE nao chega: reabre
    return ficarOcioso(l.state, u, l.events);
  }
  if (!passo.chegou) return semEventos(comUnidade(state, passo.u));
  return semEventos(comUnidade(state, reavaliar(obra, passo.u, tarefa, dados)));
}

/**
 * F18d-1b — a viagem ate o tile do canteiro, de estrada ou (F18h) de campo: a
 * viagem e a MESMA, e por isso a pergunta aqui e de forma (`ehTarefaDeTile`) e nao
 * de tipo. O que difere e o que se faz ao chegar, e isso e `passoMartelando`. O tile que deixou de ser planejado nao e
 * tratado aqui: `sanearTarefas` roda ANTES dos laborers no tick e cancela a tarefa
 * (`'destino-sumiu'`), e o laborer cai no `tarefaDoLaborer === null` acima — o mesmo
 * caminho de volta que a obra demolida no meio da viagem ja usava.
 *
 * Chegou: a aradura vai a `martelando` direto (nao ha material). O assentamento
 * (F18g) REAVALIA como a obra reavalia: pedra no tile -> `martelando`; pedra a
 * caminho -> `esperando_material` no tile; nada -> larga (`pedido-da-unidade`,
 * reabre) — e o claim so o deixa voltar quando houver pedra ou tarefa de pedra.
 */
function passoIndoAoTile(
  state: GameState, u: Unidade, tarefa: TarefaAssentarEstrada | TarefaArar, dados: GameData,
): Passo {
  const passo = avancar(state, u, tarefa, dados);
  if (passo === null) {
    const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade'); // so a UNIDADE nao chega: reabre
    return ficarOcioso(l.state, u, l.events);
  }
  if (!passo.chegou) return semEventos(comUnidade(state, passo.u));
  if (ehTarefaDeAssentamento(tarefa)) return reavaliarNoTile(state, passo.u, tarefa, dados);
  return semEventos(comUnidade(state, {
    ...passo.u, fsm: 'martelando', fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso: 0 }),
  }));
}

/**
 * F18g — o que o laborer faz NO tile do canteiro, a partir do estado atual: o
 * espelho de `reavaliar` (obra). Diferente dela, este PODE liberar — e so no ramo
 * "nem pedra, nem pedra a caminho", que e a mesma condicao de
 * `passoEsperandoMaterial` para a obra sem tarefa de material. E seguro liberar
 * aqui porque a tarefa de pedra nasce em `gerarTarefas`, no fim do tick anterior:
 * "nao existe tarefa de pedra" ja e informacao verdadeira quando a FSM anda.
 */
function reavaliarNoTile(
  state: GameState, u: Unidade, tarefa: TarefaAssentarEstrada, dados: GameData,
): Passo {
  if (pedraNoTile(state, tarefa.destinoTile) >= dados.terreno.estrada.custoStonePorTile) {
    return semEventos(comUnidade(state, {
      ...u, fsm: 'martelando', fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso: 0 }),
    }));
  }
  if (tileDeEstradaTrabalhavel(state, tarefa.destinoTile, dados)) {
    return semEventos(comUnidade(state, { ...u, fsm: 'esperando_material', fsmData: dadosDaFsm({ tarefa: tarefa.id }) }));
  }
  const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade');
  return ficarOcioso(l.state, u, l.events);
}

function passoNivelando(state: GameState, u: Unidade, dados: GameData): Passo {
  const tarefa = tarefaDoLaborer(state, u);
  // tarefa de TILE nunca passa por aqui (nivelar e esperar material sao da OBRA); o
  // `if` e o que deixa isso dito, e nao suposto.
  if (tarefa === null || ehTarefaDeTile(tarefa) || ehTarefaDeReparo(tarefa)) return ficarOcioso(state, u);
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
  // F18g: o laborer espera a pedra NO TILE do canteiro, e a mesma reavaliacao da
  // chegada decide se ela chegou, se ainda vem ou se ninguem a traz mais.
  if (ehTarefaDeAssentamento(tarefa)) return reavaliarNoTile(state, u, tarefa, dados);
  // a aradura nunca passa por aqui (nao ha material a esperar); o `if` e o que
  // deixa isso dito, e nao suposto.
  // o reparo tambem nao espera material (nao gasta nenhum)
  if (ehTarefaDeTile(tarefa) || ehTarefaDeReparo(tarefa)) return ficarOcioso(state, u);
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
  if (ehTarefaDeAssentamento(tarefa)) return passoAssentando(state, u, tarefa, dados);
  if (ehTarefaDeAradura(tarefa)) return passoArando(state, u, tarefa, dados);
  if (ehTarefaDeReparo(tarefa)) return passoReparando(state, u, tarefa, dados);
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
 * F18d-1b — assentar e UM ciclo de martelada: o mesmo `construcao.ticksPorMartelada`
 * que a obra usa, e nao um numero novo (pergunta em aberto no PROGRESS; se o playtest
 * pedir tempo proprio para a estrada, o campo nasce em `terrain.json` e so esta linha
 * muda).
 *
 * No tick que fecha, a pedra sai do TILE (`pedraNoCanteiro`, F18g — ate entao saia do
 * armazem gravado na tarefa) e o tile passa do canteiro para a rede — os dois no
 * MESMO estado novo, nunca um sem o outro.
 */
function passoAssentando(
  state: GameState, u: Unidade, tarefa: TarefaAssentarEstrada, dados: GameData,
): Passo {
  const progresso = (u.fsmData.progresso ?? 0) + 1;
  if (progresso < dados.construcao.ticksPorMartelada) {
    return semEventos(comUnidade(state, { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso }) }));
  }
  const assentado = comOTileAssentado(state, tarefa.destinoTile, dados);
  if (assentado === null) {
    // a pedra sumiu do tile entre o comeco da martelada e agora (so um save
    // adulterado faz isso: a borracha tira o tile do canteiro junto, e o
    // saneamento ja teria cancelado a tarefa). Estrada de graca, nunca: a tarefa
    // REABRE e o claim so a devolve a alguem quando houver pedra de novo.
    const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade');
    return ficarOcioso(l.state, u, l.events);
  }
  return semEventos(comUnidade(removerTarefa(assentado, tarefa.id), ocioso(u)));
}

/**
 * F18h — arar e um ciclo so, e o tempo dele vem do DADO da cultura
 * (`resources.json: tipos.<t>.aradura.segundos_base`), nao de
 * `construcao.ticksPorMartelada`: arar um tile e mais do que assentar uma pedra, e a
 * medida e da roca e nao da obra. Por isso a aradura tem numero proprio desde o
 * primeiro dia, e o assentamento nao tem (ver a pergunta em aberto do PROGRESS).
 *
 * No tick que fecha, o tile passa do canteiro para a camada de recurso, em pousio.
 * Nao ha material a debitar hoje — o milho nao custa nada — e e por isso que o unico
 * `null` possivel aqui e "o tile ja nao esta no canteiro". Quando a cana cobrar, este
 * ramo ganha o debito e a leitura passa a ser a mesma do `comOTileAssentado`.
 */
function passoArando(
  state: GameState, u: Unidade, tarefa: TarefaArar, dados: GameData,
): Passo {
  const aradura = dados.recursos.tipos[tarefa.recurso]?.aradura ?? null;
  if (aradura === null) {
    // cultura que sumiu do dado (save de outra versao): nao ha quanto tempo arar.
    const l = liberarTarefa(state, tarefa.id, 'destino-sumiu');
    return ficarOcioso(l.state, u, l.events);
  }
  const progresso = (u.fsmData.progresso ?? 0) + 1;
  if (progresso < aradura.ticks) {
    return semEventos(comUnidade(state, { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso }) }));
  }
  const arado = comOTileArado(state, tarefa.destinoTile, dados);
  if (arado === null) {
    // o tile saiu do canteiro entre o claim e agora. A tarefa CAI
    // (`'destino-sumiu'` nao reabre) e o laborer volta a ocioso no mesmo tick.
    const l = liberarTarefa(state, tarefa.id, 'destino-sumiu');
    return ficarOcioso(l.state, u, l.events);
  }
  return semEventos(comUnidade(removerTarefa(arado, tarefa.id), ocioso(u)));
}

/**
 * F-CERCO-b — a viagem ate a porta do predio a reparar. E a MESMA viagem da obra
 * (`avancar`, que replaneja por `caminhoDoLaborer`); ao chegar, martela direto: o
 * predio completo nao tem nivelamento nem material a esperar. Se o predio deixou de
 * pedir reparo no caminho, o saneamento do tick ja derrubou a tarefa e o laborer
 * nem chega aqui (`tarefaDoLaborer === null`).
 */
function passoIndoReparar(state: GameState, u: Unidade, tarefa: TarefaReparar, dados: GameData): Passo {
  const passo = avancar(state, u, tarefa, dados);
  if (passo === null) {
    const l = liberarTarefa(state, tarefa.id, 'pedido-da-unidade'); // so a UNIDADE nao chega: reabre
    return ficarOcioso(l.state, u, l.events);
  }
  if (!passo.chegou) return semEventos(comUnidade(state, passo.u));
  return semEventos(comUnidade(state, {
    ...passo.u, fsm: 'martelando', fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso: 0 }),
  }));
}

/**
 * F-CERCO-b — uma martelada de reparo: o MESMO ciclo e o MESMO ganho da obra
 * (`construcao.ticksPorMartelada`, `construcao.hpPorMartelada` — 5 HP, o numero do
 * KaM, `KM_UnitTaskBuild.pas:995-1001`). No teto do tipo a tarefa sai, as irmas saem
 * no MESMO tick (o molde do BUG-001) e o laborer volta a `ocioso`.
 */
function passoReparando(state: GameState, u: Unidade, tarefa: TarefaReparar, dados: GameData): Passo {
  const predio = state.predios.porId[tarefa.destino];
  // outro laborer, mais cedo neste tick, levou ao teto: a tarefa deste ja caiu com as irmas
  if (predio === undefined || predio.estado !== 'completo') return ficarOcioso(state, u);
  const progresso = (u.fsmData.progresso ?? 0) + 1;
  if (progresso < dados.construcao.ticksPorMartelada) {
    return semEventos(comUnidade(state, { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso }) }));
  }
  const hpTotal = hpTotalDoTipo(predio.tipo, dados);
  const hp = Math.min(predio.hp + dados.construcao.hpPorMartelada, hpTotal);
  const reparado = comPredio(state, { ...predio, hp });
  if (hp < hpTotal) {
    return semEventos(comUnidade(reparado, { ...u, fsmData: dadosDaFsm({ tarefa: tarefa.id, progresso: 0 }) }));
  }
  const semATarefa = removerTarefa(reparado, tarefa.id);
  const irmas = cancelarConstrucoesDe(semATarefa, predio.id, 'reparar');
  return { state: comUnidade(semOsOrfaos(irmas.state, u.id), ocioso(u)), events: irmas.events };
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
    // F20b: quem esta comendo (ou a caminho da Bodega) tem o passo dado pelo
    // `sistemaDaFome`, e nao por esta FSM — o `default` do `switch` LANCA, entao
    // esquecer este pulo nao daria bug silencioso. `ehEstadoDeFome` e a lista unica.
    if (ehEstadoDeFome(u.fsm)) continue;
    const r = passoDoLaborer(atual, u, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
