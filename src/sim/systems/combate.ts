/**
 * F28a — a luta corpo a corpo entre unidades.
 *
 * - `AttackUnit` e ordem direta (CLAUDE.md §1): a tropa persegue (`indo_lutar`) e golpeia
 *   (`lutando`). Nao passa pelo JobBoard.
 * - CONTATO: o militar corpo a corpo `ocioso` encostado num militar de outro lado luta
 *   sem ordem — o "carregam ao contato" do GDD §6.1. So contra UNIDADE: contra predio a
 *   regra continua sendo so por ordem (F-CERCO-a2).
 * - O golpe sai a cada `ticksCadenciaDeAtaque` e e SORTEADO no RNG semeado do estado
 *   (`state.rng`): acerta com a chance da formula (`sim/combate.ts`) e tira 1 HP. HP zero
 *   tira a unidade do estado (`unit-killed`); o atacante volta a `ocioso`.
 */
import type { Command } from '../commands';
import type { GameEvent, GameState, MotivoDeRecusaDeLuta, Projetil, Unidade } from '../state';
import type { GameData } from '../data/types';
import type { TileDeGrid } from '../estradas';
import { classeDaUnidade } from '../condicao';
import {
  cadenciaDoTiro, chanceDeAcerto, direcaoEntre, distanciaEmTiles, ehADistancia, encostadas, noAlcance, noArco, projetilDe,
} from '../combate';
import { hpDaUnidade, hpMaximoDoTipo } from '../vida';
import { nextFloat } from '../rng';
import { comProjetil, vooEmTicks } from '../projeteis';
import { alvosDeAproximacao } from '../aproximacao';
import { buscarCaminho, passoAndavel } from '../pathfinding';
import { andar, comUnidade, noTile, ocioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type AttackUnit = Extract<Command, { readonly type: 'AttackUnit' }>;

export const FSM_INDO_LUTAR = 'indo_lutar';
export const FSM_LUTANDO = 'lutando';
/** F28d — o atirador com alvo no arco e no alcance. */
export const FSM_ATIRANDO = 'atirando';

/** Quem luta corpo a corpo: militar do dado que nao atira a distancia. */
function lutaCorpoACorpo(u: Unidade, dados: GameData): boolean {
  return classeDaUnidade(u.tipo, dados) === 'militar' && !ehADistancia(u.tipo, dados);
}

/** A unidade virada para onde acabou de andar (ou igual, se nao andou). Exportado: a
 *  marcha e o cerco viram a unidade pelo mesmo criterio. */
export function viradaPeloPasso(antes: TileDeGrid, depois: Unidade): Unidade {
  const direcao = direcaoEntre(antes, depois);
  return direcao === null || direcao === depois.direcao ? depois : { ...depois, direcao };
}

export function motivoDaRecusaDeLuta(
  state: GameState, comando: AttackUnit, dados: GameData,
): { readonly motivo: MotivoDeRecusaDeLuta; readonly unidade: string | null } | null {
  if (comando.unidades.length === 0) return { motivo: 'sem-unidades', unidade: null };
  const alvo = state.unidades.porId[comando.alvo];
  if (alvo === undefined) return { motivo: 'alvo-inexistente', unidade: null };
  if (hpMaximoDoTipo(alvo.tipo, dados) === null) return { motivo: 'alvo-sem-hp', unidade: null };
  for (const id of comando.unidades) {
    const u = state.unidades.porId[id];
    if (u === undefined) return { motivo: 'unidade-inexistente', unidade: id };
    if (classeDaUnidade(u.tipo, dados) !== 'militar') return { motivo: 'unidade-nao-militar', unidade: id };
    if (ehADistancia(u.tipo, dados)) return { motivo: 'unidade-a-distancia', unidade: id };
    if (u.lado === alvo.lado) return { motivo: 'alvo-do-proprio-lado', unidade: id };
  }
  return null;
}

export function aplicarAttackUnit(state: GameState, comando: AttackUnit, dados: GameData): ResultadoDeSistema {
  const recusa = motivoDaRecusaDeLuta(state, comando, dados);
  if (recusa !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'AttackUnit', alvo: comando.alvo, unidade: recusa.unidade, motivo: recusa.motivo }],
    };
  }
  let atual = state;
  for (const id of new Set(comando.unidades)) {
    const u = atual.unidades.porId[id];
    if (u !== undefined) atual = comUnidade(atual, { ...u, fsm: FSM_INDO_LUTAR, fsmData: { alvoUnidade: comando.alvo } });
  }
  return { state: atual, events: [] };
}

function lutarCom(u: Unidade, alvo: Unidade, dados: GameData): Unidade {
  return {
    ...u, fsm: FSM_LUTANDO, direcao: direcaoEntre(u, alvo) ?? u.direcao,
    fsmData: { alvoUnidade: alvo.id, recarga: dados.combate.ticksCadenciaDeAtaque },
  } as Unidade;
}

/** O primeiro militar de OUTRO lado encostado, em `unidades.ordem`. */
function inimigoEncostado(state: GameState, u: Unidade, dados: GameData): Unidade | null {
  for (const id of state.unidades.ordem) {
    const outro = state.unidades.porId[id];
    if (outro === undefined || outro.lado === u.lado) continue;
    if (hpMaximoDoTipo(outro.tipo, dados) === null) continue;
    if (encostadas(u, outro)) return outro;
  }
  return null;
}

function passoIndoLutar(state: GameState, u: Unidade, alvo: Unidade, dados: GameData): GameState {
  if (encostadas(u, alvo)) return comUnidade(state, lutarCom(u, alvo, dados));
  let atual = u;
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0];
  const alvoAndou = u.fsmData.alvoTile === undefined || u.fsmData.alvoTile.gx !== alvo.gx || u.fsmData.alvoTile.gy !== alvo.gy;
  if (proximo === undefined || alvoAndou || !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    const vizinhos = alvosDeAproximacao(state, alvo, dados).filter((t) => encostadas(t, alvo));
    const rota = buscarCaminho(state, noTile(u), vizinhos, 'livre', dados);
    if (rota === null) return comUnidade(state, ocioso(u));
    atual = { ...u, fsmData: { alvoUnidade: alvo.id, alvoTile: { gx: alvo.gx, gy: alvo.gy }, caminho: rota.tiles, progresso: 0 } };
    if (rota.tiles.length === 0) return comUnidade(state, lutarCom(atual, alvo, dados));
  }
  const andou = viradaPeloPasso(noTile(atual), andar(state, atual, dados));
  return comUnidade(state, encostadas(andou, alvo) ? lutarCom(andou, alvo, dados) : andou);
}

function passoLutando(
  state: GameState, u: Unidade, alvo: Unidade, dados: GameData,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  if (!encostadas(u, alvo)) {
    return { state: comUnidade(state, { ...u, fsm: FSM_INDO_LUTAR, fsmData: { alvoUnidade: alvo.id } }), events: [] };
  }
  const virado = { ...u, direcao: direcaoEntre(u, alvo) ?? u.direcao } as Unidade;
  const recarga = (u.fsmData.recarga ?? dados.combate.ticksCadenciaDeAtaque) - 1;
  if (recarga > 0) {
    return { state: comUnidade(state, { ...virado, fsmData: { alvoUnidade: alvo.id, recarga } }), events: [] };
  }
  const sorteio = nextFloat(state.rng);
  const acertou = sorteio.value < chanceDeAcerto(virado, alvo, dados);
  const hpAntes = hpDaUnidade(alvo, dados) ?? 0;
  const hp = acertou ? hpAntes - 1 : hpAntes;
  const golpe: GameEvent = { type: 'unit-struck', atacante: u.id, alvo: alvo.id, acertou, hp };
  const comSorteio: GameState = { ...state, rng: sorteio.rng };
  const atacante = { ...virado, fsmData: { alvoUnidade: alvo.id, recarga: dados.combate.ticksCadenciaDeAtaque } };
  if (hp > 0) {
    const s = acertou ? comUnidade(comSorteio, { ...alvo, hp }) : comSorteio;
    return { state: comUnidade(s, atacante), events: [golpe] };
  }
  const porId = { ...comSorteio.unidades.porId };
  delete porId[alvo.id];
  const semOAlvo: GameState = { ...comSorteio, unidades: { porId, ordem: comSorteio.unidades.ordem.filter((i) => i !== alvo.id) } };
  return {
    state: comUnidade(semOAlvo, ocioso(virado)),
    events: [golpe, { type: 'unit-killed', unidade: alvo.id, tipo: alvo.tipo, lado: alvo.lado, por: u.id }],
  };
}

/** F28d — quem atira: militar ou mercenario do dado com `aDistancia`. */
function atira(u: Unidade, dados: GameData): boolean {
  return hpMaximoDoTipo(u.tipo, dados) !== null && ehADistancia(u.tipo, dados);
}

/**
 * F28d — o alvo do atirador: a unidade de OUTRO lado com HP, no alcance (4 a 11) e no
 * arco (90 graus em volta de para onde ele olha), a mais perto; no empate, a primeira em
 * `unidades.ordem`. O atirador NAO se vira sozinho: "posicionar e virar, nao mandar
 * atacar" (combat.json) — quem o vira e o passo da marcha.
 */
function alvoDoAtirador(state: GameState, u: Unidade, dados: GameData): Unidade | null {
  let melhor: { alvo: Unidade; d: number } | null = null;
  for (const id of state.unidades.ordem) {
    const outro = state.unidades.porId[id];
    if (outro === undefined || outro.lado === u.lado || hpMaximoDoTipo(outro.tipo, dados) === null) continue;
    if (!noAlcance(u, outro, dados) || !noArco(u, outro, dados)) continue;
    const d = distanciaEmTiles(u, outro);
    if (melhor === null || d < melhor.d) melhor = { alvo: outro, d };
  }
  return melhor === null ? null : melhor.alvo;
}

/**
 * F28d — onde o projetil cai: no tile em que o alvo esta AGORA, e acerta a primeira
 * unidade com HP daquele tile em `unidades.ordem` — do proprio lado inclusive (fogo
 * amigo, decisao do operador; KM_Defaults.pas:397, KM_Projectiles.pas:320). Sem voo: o
 * projetil cai no tick do disparo (PARA REVISAO).
 */
export function quemEstaNoPonto(state: GameState, tile: TileDeGrid, dados: GameData): Unidade | null {
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u !== undefined && u.gx === tile.gx && u.gy === tile.gy && hpMaximoDoTipo(u.tipo, dados) !== null) return u;
  }
  return null;
}

/** Tira `vitima` do estado (HP zero) ou grava o HP novo. */
export function comHp(state: GameState, vitima: Unidade, hp: number): GameState {
  if (hp > 0) return comUnidade(state, { ...vitima, hp });
  const porId = { ...state.unidades.porId };
  delete porId[vitima.id];
  return { ...state, unidades: { porId, ordem: state.unidades.ordem.filter((i) => i !== vitima.id) } };
}

function passoAtirando(
  state: GameState, u: Unidade, dados: GameData,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const marcado = u.fsmData.alvoUnidade === undefined ? undefined : state.unidades.porId[u.fsmData.alvoUnidade];
  const valeOMarcado = marcado !== undefined && marcado.lado !== u.lado && noAlcance(u, marcado, dados) && noArco(u, marcado, dados);
  const alvo = valeOMarcado ? marcado : alvoDoAtirador(state, u, dados);
  if (alvo === null || alvo === undefined) return { state: comUnidade(state, ocioso(u)), events: [] };
  const recarga = (u.fsmData.recarga ?? dados.combate.ticksCadenciaDeAtaque) - 1;
  if (recarga > 0) {
    return { state: comUnidade(state, { ...u, fsmData: { alvoUnidade: alvo.id, recarga } }), events: [] };
  }
  // C2: o tiro LANCA um projetil no tile do alvo; o acerto (quem estiver la, e o sorteio)
  // e da chegada (`systems/projeteis.ts`). Aqui so a proxima recarga (C1) sai do RNG.
  const cadencia = cadenciaDoTiro(u.tipo, state.rng, dados);
  const recarregado = { ...u, fsmData: { alvoUnidade: alvo.id, recarga: cadencia.ticks } };
  const projetil = projetilDe(u.tipo, dados) ?? 'flecha';
  const alvoTile = { gx: alvo.gx, gy: alvo.gy };
  const voo = vooEmTicks(projetil, u, alvoTile, dados);
  const noAr: Projetil = {
    projetil,
    de: { id: u.id, tipo: u.tipo, lado: u.lado, gx: u.gx, gy: u.gy, ...(u.direcao === undefined ? {} : { direcao: u.direcao }) },
    origem: { gx: u.gx, gy: u.gy }, alvoTile, voo, restantes: voo,
  };
  const depois = comProjetil(comUnidade({ ...state, rng: cadencia.rng }, recarregado), noAr);
  return { state: depois, events: [{ type: 'projectile-fired', projetil, de: u.id, alvo: alvoTile, voo }] };
}

/** Um tick da luta, em `unidades.ordem`: primeiro o contato (quem esta `ocioso` e
 *  encostado em inimigo passa a lutar), depois cada unidade em luta anda ou golpeia. */
export function sistemaDoCombate(state: GameState, dados: GameData): ResultadoDeSistema {
  let atual = state;
  const events: GameEvent[] = [];
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || u.fsm !== 'ocioso') continue;
    if (lutaCorpoACorpo(u, dados)) {
      const inimigo = inimigoEncostado(atual, u, dados);
      if (inimigo !== null) atual = comUnidade(atual, lutarCom(u, inimigo, dados));
    } else if (atira(u, dados)) {
      // F28d: o atirador ocioso com alguem no arco e no alcance comeca a recarregar
      const alvo = alvoDoAtirador(atual, u, dados);
      if (alvo !== null) {
        // C1: a primeira mira ja e a do projetil (recarga + mira + sorteio)
        const cadencia = cadenciaDoTiro(u.tipo, atual.rng, dados);
        atual = comUnidade({ ...atual, rng: cadencia.rng }, {
          ...u, fsm: FSM_ATIRANDO, fsmData: { alvoUnidade: alvo.id, recarga: cadencia.ticks },
        });
      }
    }
  }
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u !== undefined && u.fsm === FSM_ATIRANDO) {
      const r = passoAtirando(atual, u, dados);
      atual = r.state;
      events.push(...r.events);
      continue;
    }
    if (u === undefined || (u.fsm !== FSM_INDO_LUTAR && u.fsm !== FSM_LUTANDO)) continue;
    const alvoId = u.fsmData.alvoUnidade;
    const alvo = alvoId === undefined ? undefined : atual.unidades.porId[alvoId];
    if (alvo === undefined || alvo.lado === u.lado) {
      atual = comUnidade(atual, ocioso(u));
      continue;
    }
    if (u.fsm === FSM_INDO_LUTAR) {
      atual = passoIndoLutar(atual, u, alvo, dados);
      continue;
    }
    const r = passoLutando(atual, u, alvo, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
