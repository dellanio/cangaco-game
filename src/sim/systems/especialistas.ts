/**
 * F14 — a FSM do especialista (GDD §6.2), um passo por tick, na ordem de
 * `unidades.ordem`.
 *
 *   ocioso -> indo_ocupar -> trabalhando  <->  esperando_insumo
 *                                  ^
 *                                  +------->  saida_cheia
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
import type { GameEvent, GameState, PredioCompleto, TarefaOcupar, Unidade } from '../state';
import type { GameData, ReceitaDePredio } from '../data/types';
import { gameData } from '../data';
import { caminhoAtePredioCompleto, liberar, reclamarMelhorOcupacao, removerTarefa } from '../jobs';
import { ehPredioOcupavel, predioAceita, predioDoOcupante, tiposQueOcupam } from '../ocupacao';
import { predioLigadoAoArmazem } from '../estradas';
import {
  cabeNaSaida, consumirInsumos, receitaDoTipo, temInsumo, unidadesPorCiclo, veioEsgotado,
} from '../producao';
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

/** Devolve o MESMO estado quando o rotulo nao muda: um tick de producao normal
 *  nao realoca a unidade. Molde de `sanearOcupacao`. */
function comFsm(state: GameState, u: Unidade, fsm: string): Passo {
  return u.fsm === fsm ? semEventos(state) : semEventos(comUnidade(state, { ...u, fsm, fsmData: {} }));
}

/**
 * O deposito do ciclo pronto: o UNICO ponto que mexe na gaveta `saida` e no
 * veio. Nao cabendo, o ciclo fica pronto e espera — `progresso` nao volta a
 * zero, entao nada do que ja foi trabalhado se perde.
 */
function depositar(
  state: GameState, u: Unidade, predio: PredioCompleto, receita: ReceitaDePredio, dados: GameData,
): Passo {
  if (!cabeNaSaida(predio, receita)) return comFsm(state, u, 'saida_cheia');
  const saida: Record<string, number> = { ...predio.estoque.saida };
  const events: GameEvent[] = [];
  // ordem de `economia.mercadorias`, nunca `Object.keys` da receita: a ordem dos
  // eventos e do estoque tem que ser a mesma em qualquer maquina (contrato da F05a)
  for (const mercadoria of dados.economia.mercadorias) {
    const q = receita.sai[mercadoria];
    if (q === undefined) continue;
    saida[mercadoria] = (saida[mercadoria] ?? 0) + q;
    events.push({ type: 'goods-produced', predio: predio.id, mercadoria, quantidade: q });
  }
  const veioAntes = predio.producao?.veio ?? null;
  const veio = veioAntes === null ? null : veioAntes - unidadesPorCiclo(receita);
  const depositado: PredioCompleto = {
    ...predio, estoque: { ...predio.estoque, saida }, producao: { progresso: 0, veio },
  };
  // o evento sai UMA vez, no ciclo que esgotou: quem ja estava esgotado nao
  // chega ate aqui (o ramo de `veioEsgotado` em `produzir` corta antes)
  if (veio !== null && veioEsgotado({ progresso: 0, veio }, receita)) {
    events.push({ type: 'vein-exhausted', predio: predio.id, tipo: predio.tipo });
  }
  return {
    state: comUnidade(comPredio(state, depositado), { ...u, fsm: 'trabalhando', fsmData: {} }),
    events,
  };
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
function produzir(state: GameState, u: Unidade, predio: PredioCompleto, dados: GameData): Passo {
  // F16c — a PRIMEIRA pergunta, antes da receita e antes da estrada: e o fato
  // mais especifico sobre este predio e e acao deliberada do jogador. Congela o
  // relogio e nada mais: `progresso` nao zera, o insumo ja consumido continua
  // consumido, a gaveta `saida` segue escoando e o ocupante fica — por isso o
  // rotulo e `trabalhando`, e nao um estado novo (`docs/planos/F16c-pausar.md`).
  if (predio.pausado) return comFsm(state, u, 'trabalhando');
  const receita = receitaDoTipo(predio.tipo, dados);
  const prod = predio.producao;
  // predio ocupavel sem receita nao existe no dado de hoje; se existir, ocupa e nao produz
  if (receita === null || prod === null) return comFsm(state, u, 'trabalhando');
  // GDD §5.1: a estrada e requisito de FUNCIONAMENTO. Predio que nao ESCOA e
  // `saida_cheia` (GDD §6.2, "a logistica e o gargalo") — sem estrada o
  // escoamento e impossivel, o caso extremo do mesmo fenomeno. Ver D6.
  if (!predioLigadoAoArmazem(state, predio, dados)) return comFsm(state, u, 'saida_cheia');
  // ciclo PRONTO de um tick anterior: so falta caber
  if (prod.progresso >= receita.ticksDoCiclo) return depositar(state, u, predio, receita, dados);
  // o veio e o insumo que nao vem mais (D2) — a F22 distingue os dois pelo `veio === 0`
  if (veioEsgotado(prod, receita)) return comFsm(state, u, 'esperando_insumo');
  // inicio de ciclo: cobra os insumos, como a escola cobra o ouro ao INICIAR o treino (F13a)
  let atual = predio;
  if (prod.progresso === 0) {
    if (!temInsumo(predio, receita)) return comFsm(state, u, 'esperando_insumo');
    atual = consumirInsumos(predio, receita);
  }
  const avancado: PredioCompleto = {
    ...atual, producao: { progresso: prod.progresso + 1, veio: prod.veio },
  };
  const comRelogio = comPredio(state, avancado);
  return prod.progresso + 1 < receita.ticksDoCiclo
    ? comFsm(comRelogio, u, 'trabalhando')
    : depositar(comRelogio, u, avancado, receita, dados);
}

/** A posse mora no predio: sumiu, deixou de ser ocupavel ou passou a apontar
 *  para outro, este especialista volta a procurar. Senao, produz. */
function passoProduzindo(state: GameState, u: Unidade, dados: GameData): Passo {
  const predio = predioDoOcupante(state, u.id);
  return predio === null ? ficarOcioso(state, u) : produzir(state, u, predio, dados);
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
