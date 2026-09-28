/**
 * C2 — os projeteis no ar, um tick por vez (plano em
 * docs/planos/2026-09-28-C2-projetil-voa.md). Roda no COMECO do tick: o que foi lancado
 * neste tick so comeca a contar no seguinte, e chega exatamente `voo` ticks depois.
 *
 * Na chegada:
 * - flecha, virote e funda caem em `alvoTile` e atingem a primeira unidade com HP que
 *   estiver ALI (amigo inclusive). Quem andou para outro tile nao e atingido: "erra quem
 *   andou" (KM_Projectiles.pas:305-306). Havendo alguem, o sorteio e o de sempre, com a
 *   copia do atirador (`de`) — que vale mesmo se ele ja morreu;
 * - a pedra da torre cai no tile ATUAL de `alvoUnidade` (a F28b: "a pedra nunca erra") ou,
 *   se ele ja morreu, em `alvoTile`; mata a primeira unidade com HP que estiver ali.
 */
import type { GameEvent, GameState, Projetil, Unidade } from '../state';
import type { GameData } from '../data/types';
import { chanceDeAcerto } from '../combate';
import { hpDaUnidade } from '../vida';
import { nextFloat } from '../rng';
import { comHp, quemEstaNoPonto } from './combate';
import type { ResultadoDeSistema } from './jobs';

/** A copia do atirador como `Unidade`, so para a formula da chance. */
function atiradorDe(p: Projetil): Unidade {
  return { ...p.de, fsm: 'ocioso', fsmData: {}, condicao: 0 };
}

function chegada(state: GameState, p: Projetil, dados: GameData): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  if (p.alvoUnidade !== undefined) {
    const perseguido = state.unidades.porId[p.alvoUnidade];
    const tile = perseguido === undefined ? p.alvoTile : { gx: perseguido.gx, gy: perseguido.gy };
    const vitima = quemEstaNoPonto(state, tile, dados);
    if (vitima === null) return { state, events: [] };
    const hp = dados.combate.watchtower.mataEmUmGolpe ? 0 : (hpDaUnidade(vitima, dados) ?? 1) - 1;
    const depois = comHp(state, vitima, hp);
    return {
      state: depois,
      events: hp > 0 ? [] : [{ type: 'unit-killed', unidade: vitima.id, tipo: vitima.tipo, lado: vitima.lado, por: p.predio ?? p.de.id }],
    };
  }
  const vitima = quemEstaNoPonto(state, p.alvoTile, dados);
  if (vitima === null) return { state, events: [] }; // erra quem andou
  const sorteio = nextFloat(state.rng);
  const acertou = sorteio.value < chanceDeAcerto(atiradorDe(p), vitima, dados);
  const hpAntes = hpDaUnidade(vitima, dados) ?? 0;
  const hp = acertou ? hpAntes - 1 : hpAntes;
  const comRng = { ...state, rng: sorteio.rng };
  const golpe: GameEvent = { type: 'unit-struck', atacante: p.de.id, alvo: vitima.id, acertou, hp };
  if (!acertou) return { state: comRng, events: [golpe] };
  const morte: GameEvent[] = hp > 0 ? [] : [{ type: 'unit-killed', unidade: vitima.id, tipo: vitima.tipo, lado: vitima.lado, por: p.de.id }];
  return { state: comHp(comRng, vitima, hp), events: [golpe, ...morte] };
}

export function sistemaDosProjeteis(state: GameState, dados: GameData): ResultadoDeSistema {
  const noAr = state.projeteis;
  if (noAr === undefined || noAr.length === 0) return { state, events: [] };
  const seguem: Projetil[] = [];
  const chegam: Projetil[] = [];
  for (const p of noAr) {
    if (p.restantes > 1) seguem.push({ ...p, restantes: p.restantes - 1 });
    else chegam.push(p);
  }
  // o campo some quando nada mais voa: o estado sem combate volta a nao carrega-lo
  const { projeteis: _antes, ...semCampo } = state;
  void _antes;
  let atual: GameState = seguem.length === 0 ? semCampo : { ...semCampo, projeteis: seguem };
  const events: GameEvent[] = [];
  for (const p of chegam) {
    const r = chegada(atual, p, dados);
    atual = r.state;
    events.push(...r.events);
  }
  return { state: atual, events };
}
