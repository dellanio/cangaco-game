/**
 * I-COMBATE-BENCAO e I-COMBATE-CONVERTER — os poderes do padre (pesquisa em
 * docs/pesquisas/2026-10-05-igreja-e-padre.md). Os numeros sao de `combat.json` `padre`, ja em ticks.
 *
 * - A BENCAO e passiva: o militar a ate `raioDaBencao` (euclidiano) de um padre do MESMO lado tem a
 *   defesa multiplicada por `1 + resistencia` no calculo do acerto contra ele. Nao acumula.
 * - A CONVERSAO e ordem (`ConvertUnit`): o padre anda ate ficar a `alcance` do militar inimigo e reza.
 *   A cada `ticksDoIntervalo` conta um intervalo; do `intervaloMinimo` em diante sorteia
 *   `chancePorIntervalo` pelo RNG da sim, e o `intervaloGarantido` converte sempre (como o monge do
 *   AoE2). Convertido, o alvo passa ao lado do padre, `ocioso`, fora das posicoes da IA, e a comida que
 *   vinha para ele cai. O padre fica em recarga (`Unidade.conversaoProntaEm`).
 */
import type { Command } from '../commands';
import type { GameData } from '../data/types';
import type { GameEvent, GameState, Unidade } from '../state';
import { classeDaUnidade } from '../condicao';
import { distanciaEmTiles, encostadas } from '../combate';
import { nextFloat } from '../rng';
import { alvosDeAproximacao } from '../aproximacao';
import { buscarCaminho, passoAndavel } from '../pathfinding';
import { andar, comUnidade, noTile } from '../units/movimento';
import { liberar } from '../jobs';
import { ehTarefaDeComidaParaTropa } from '../state';
import type { ResultadoDeSistema } from './jobs';

export const ID_DO_PADRE = 'priest';
export const FSM_INDO_CONVERTER = 'indo_converter';
export const FSM_CONVERTENDO = 'convertendo';

export type ConvertUnit = Extract<Command, { readonly type: 'ConvertUnit' }>;

/** O militar esta abencoado: ha um padre vivo do mesmo lado a ate o raio da bencao. */
export function abencoado(state: GameState, u: Unidade, dados: GameData): boolean {
  if (classeDaUnidade(u.tipo, dados) !== 'militar') return false;
  const raio = dados.combate.padre.raioDaBencao_tiles;
  for (const id of state.unidades.ordem) {
    const p = state.unidades.porId[id];
    if (p === undefined || p.tipo !== ID_DO_PADRE || p.lado !== u.lado) continue;
    if (distanciaEmTiles(p, u) <= raio) return true;
  }
  return false;
}

/** O multiplicador da defesa do alvo no acerto: `1 + resistencia` se abencoado, senao 1. */
export function multiplicadorDaDefesa(state: GameState, alvo: Unidade, dados: GameData): number {
  return abencoado(state, alvo, dados) ? 1 + dados.combate.padre.resistencia : 1;
}

export type MotivoDeRecusaDeConversao =
  | 'padre-inexistente' | 'nao-e-padre' | 'alvo-inexistente' | 'alvo-do-proprio-lado' | 'alvo-nao-militar' | 'em-recarga';

export function motivoDaRecusaDeConversao(state: GameState, comando: ConvertUnit, dados: GameData): MotivoDeRecusaDeConversao | null {
  const padre = state.unidades.porId[comando.padre];
  if (padre === undefined) return 'padre-inexistente';
  if (padre.tipo !== ID_DO_PADRE) return 'nao-e-padre';
  const alvo = state.unidades.porId[comando.alvo];
  if (alvo === undefined) return 'alvo-inexistente';
  if (alvo.lado === padre.lado) return 'alvo-do-proprio-lado';
  if (classeDaUnidade(alvo.tipo, dados) !== 'militar' || alvo.tipo === ID_DO_PADRE) return 'alvo-nao-militar';
  // o comando vale para o tick `state.tick + 1` (o `step` grava o tick novo no fim)
  if ((padre.conversaoProntaEm ?? 0) > state.tick + 1) return 'em-recarga';
  return null;
}

export function aplicarConvertUnit(state: GameState, comando: ConvertUnit, dados: GameData): ResultadoDeSistema {
  const motivo = motivoDaRecusaDeConversao(state, comando, dados);
  if (motivo !== null) {
    return { state, events: [{ type: 'command-rejected', command: 'ConvertUnit', padre: comando.padre, alvo: comando.alvo, motivo }] };
  }
  const padre = state.unidades.porId[comando.padre]!;
  const { retomarMarcha: _r, ...sem } = padre;
  void _r;
  return { state: comUnidade(state, { ...sem, fsm: FSM_INDO_CONVERTER, fsmData: { alvoUnidade: comando.alvo } }), events: [] };
}

const ocioso = (u: Unidade): Unidade => ({ ...u, fsm: 'ocioso', fsmData: {} });
const noAlcance = (p: Unidade, alvo: Unidade, dados: GameData): boolean => distanciaEmTiles(p, alvo) <= dados.combate.padre.alcance_tiles;

/** O alvo convertido: o lado do padre, `ocioso`, sem marcha nem pedido de comida, fora da IA de antes. */
function converter(state: GameState, padre: Unidade, alvo: Unidade): { state: GameState; events: GameEvent[] } {
  const { retomarMarcha: _r, pedidoDeComida: _p, ...resto } = alvo;
  void _r; void _p;
  let atual = comUnidade(state, { ...resto, lado: padre.lado, fsm: 'ocioso', fsmData: {} });
  const events: GameEvent[] = [];
  // a comida que o outro lado mandava para ele cai (o serf devolve ao armazem, como na morte por fome)
  for (const id of atual.jobs.tarefas.ordem) {
    const t = atual.jobs.tarefas.porId[id];
    if (t === undefined || !ehTarefaDeComidaParaTropa(t) || t.destinoUnidade !== alvo.id) continue;
    const l = liberar(atual, t.id, 'destino-sumiu');
    atual = l.state;
    events.push(...l.events);
  }
  // sai das posicoes da IA do lado de antes
  if (atual.ia !== undefined) {
    const ia = Object.fromEntries(Object.entries(atual.ia).map(([lado, cerebro]) => [lado, {
      ...cerebro,
      posicoes: cerebro.posicoes.map((p) => (p.membros.includes(alvo.id) ? { ...p, membros: p.membros.filter((m) => m !== alvo.id) } : p)),
    }]));
    atual = { ...atual, ia };
  }
  events.push({ type: 'unit-converted', padre: padre.id, unidade: alvo.id, de: alvo.lado, para: padre.lado });
  return { state: atual, events };
}

function passoIndoConverter(state: GameState, u: Unidade, alvo: Unidade, dados: GameData): GameState {
  if (noAlcance(u, alvo, dados)) {
    return comUnidade(state, { ...u, fsm: FSM_CONVERTENDO, fsmData: { alvoUnidade: alvo.id, oracao: 0, intervaloDaOracao: 0 } });
  }
  let atual = u;
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0];
  const alvoAndou = u.fsmData.alvoTile === undefined || u.fsmData.alvoTile.gx !== alvo.gx || u.fsmData.alvoTile.gy !== alvo.gy;
  if (proximo === undefined || alvoAndou || !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    const vizinhos = alvosDeAproximacao(state, alvo, dados).filter((t) => encostadas(t, alvo));
    const rota = buscarCaminho(state, noTile(u), vizinhos, 'livre', dados);
    // sem caminho: desiste (o alvo cercado ou no meio do intransponivel), sem travar
    if (rota === null || rota.tiles.length === 0) return comUnidade(state, ocioso(u));
    atual = { ...u, fsmData: { alvoUnidade: alvo.id, alvoTile: { gx: alvo.gx, gy: alvo.gy }, caminho: rota.tiles, progresso: 0 } };
  }
  return comUnidade(state, andar(state, atual, dados));
}

/** Um tick dos padres, em `unidades.ordem`: quem vai converter anda; quem reza conta e sorteia. */
export function sistemaDoPadre(state: GameState, dados: GameData): ResultadoDeSistema {
  const c = dados.combate.padre;
  let atual = state;
  const events: GameEvent[] = [];
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || (u.fsm !== FSM_INDO_CONVERTER && u.fsm !== FSM_CONVERTENDO)) continue;
    const alvo = u.fsmData.alvoUnidade === undefined ? undefined : atual.unidades.porId[u.fsmData.alvoUnidade];
    if (alvo === undefined || alvo.lado === u.lado) {
      atual = comUnidade(atual, ocioso(u));
      continue;
    }
    if (u.fsm === FSM_INDO_CONVERTER) {
      atual = passoIndoConverter(atual, u, alvo, dados);
      continue;
    }
    // rezando: o alvo saiu do alcance, volta a ir atras dele
    if (!noAlcance(u, alvo, dados)) {
      atual = comUnidade(atual, { ...u, fsm: FSM_INDO_CONVERTER, fsmData: { alvoUnidade: alvo.id } });
      continue;
    }
    const oracao = (u.fsmData.oracao ?? 0) + 1;
    if (oracao < c.ticksDoIntervalo) {
      atual = comUnidade(atual, { ...u, fsmData: { ...u.fsmData, oracao } });
      continue;
    }
    const intervalo = (u.fsmData.intervaloDaOracao ?? 0) + 1;
    let converte = intervalo >= c.intervaloGarantido;
    if (!converte && intervalo >= c.intervaloMinimo) {
      const s = nextFloat(atual.rng);
      atual = { ...atual, rng: s.rng };
      converte = s.value < c.chancePorIntervalo;
    }
    if (!converte) {
      atual = comUnidade(atual, { ...u, fsmData: { ...u.fsmData, oracao: 0, intervaloDaOracao: intervalo } });
      continue;
    }
    const r = converter(atual, u, alvo);
    // o `step` grava o tick novo no fim: este passo e o tick `state.tick + 1`, e a recarga conta dele
    atual = comUnidade(r.state, { ...ocioso(u), conversaoProntaEm: state.tick + 1 + c.ticksDeRecarga });
    events.push(...r.events);
  }
  return { state: atual, events };
}
