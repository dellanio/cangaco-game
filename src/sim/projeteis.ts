/**
 * C2 — o projetil que voa: quanto tempo ele leva e como entra no estado. O atirador e a
 * torre LANCAM por aqui; quem resolve a chegada e `systems/projeteis.ts`.
 */
import type { GameState, Projetil } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { distanciaEmTiles } from './combate';

/** O tipo de projetil da torre em `aDistancia.velocidade_tilesPorSegundo_base`. */
export const PROJETIL_DA_TORRE = 'pedraDaTorre';

/** Ticks de voo de `de` ate `para`: max(1, round(distancia x milesimos / 1000)). */
export function vooEmTicks(
  projetil: string, de: { readonly gx: number; readonly gy: number }, para: { readonly gx: number; readonly gy: number },
  dados: GameData = gameData,
): number {
  const m = dados.combate.milesimosDeTickPorTile[projetil];
  if (m === undefined) return 1;
  return Math.max(1, Math.round((distanciaEmTiles(de, para) * m) / 1000));
}

/** Poe `p` no ar, depois dos que ja voam. */
export function comProjetil(state: GameState, p: Projetil): GameState {
  return { ...state, projeteis: [...(state.projeteis ?? []), p] };
}
