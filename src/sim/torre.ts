/**
 * F28b — a regra da TORRE DE PEDRA num lugar so: o que ela recebe, quantas pedras
 * guarda, ate onde atira e por que nao atira. O gerador de insumo, o sistema de tiro e
 * o painel perguntam AQUI.
 */
import type { GameState, Predio, PredioCompleto, Unidade } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { caixaDoPredio } from './footprint';
import { distanciaEmTiles } from './combate';

/** O id estrutural da torre, como `ID_DO_QUARTEL`. */
export const ID_DA_TORRE = 'watchtower';
/** A municao: o dado a chama `municao_stone_max`, e a mercadoria e a pedra. */
export const MUNICAO_DA_TORRE = 'stone';

export type PorQueATorreNaoAtira = 'sem-recruta' | 'sem-pedra';

export const ehTorreCompleta = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DA_TORRE;

export function pedrasNaTorre(torre: PredioCompleto): number {
  return torre.estoque.entrada[MUNICAO_DA_TORRE] ?? 0;
}

/** Por que a torre nao atira agora (`null` quando pode atirar). E o que o painel diz. */
export function porQueNaoAtira(torre: PredioCompleto): PorQueATorreNaoAtira | null {
  if (torre.ocupante === null) return 'sem-recruta';
  if (pedrasNaTorre(torre) < 1) return 'sem-pedra';
  return null;
}

/** A distancia euclidiana do tile mais perto do footprint ate `alvo`, em tiles. */
export function distanciaDaTorre(torre: Predio, alvo: { readonly gx: number; readonly gy: number }, dados: GameData = gameData): number {
  const c = caixaDoPredio(torre, dados);
  if (c === null) return Number.POSITIVE_INFINITY;
  const gx = Math.min(Math.max(alvo.gx, c.x0), c.x1 - 1);
  const gy = Math.min(Math.max(alvo.gy, c.y0), c.y1 - 1);
  return distanciaEmTiles({ gx, gy }, alvo);
}

/** O alvo: a unidade de OUTRO lado com HP ao alcance (`watchtower.alcance_tiles`), a mais
 *  perto; no empate, a de menor id (texto do aceite da F28b). */
export function alvoDaTorre(
  state: GameState, torre: PredioCompleto, temHp: (u: Unidade) => boolean, dados: GameData = gameData,
): Unidade | null {
  let melhor: { u: Unidade; d: number } | null = null;
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined || u.lado === torre.lado || !temHp(u)) continue;
    const d = distanciaDaTorre(torre, u, dados);
    if (d > dados.combate.watchtower.alcance_tiles) continue;
    if (melhor === null || d < melhor.d || (d === melhor.d && u.id < melhor.u.id)) melhor = { u, d };
  }
  return melhor === null ? null : melhor.u;
}
