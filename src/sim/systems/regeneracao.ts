/**
 * F28c — a regeneracao de HP: `combate.regeneracao.hp` a cada `ticksIntervalo`,
 * INCLUSIVE em luta (KaM: 1 HP a cada 100 ticks, `KM_Units.pas:2306-2314`). Nao olha a
 * FSM: quem esta golpeando tambem sara.
 *
 * O relogio e o GLOBAL (`tick % intervalo`), e nao um por unidade como no KaM: nao
 * nasce campo novo so para defasar a cura entre soldados (PARA REVISAO). Toca so em
 * quem tem HP abaixo do cheio — o militar sem o campo ja esta cheio e passa intocado,
 * e o civil nao tem HP.
 */
import type { GameState, Unidade } from '../state';
import type { GameData } from '../data/types';
import { hpMaximoDoTipo } from '../vida';

export function sistemaDaRegeneracao(state: GameState, tick: number, dados: GameData): GameState {
  const { hp: ganho, ticksIntervalo } = dados.combate.regeneracao;
  if (ticksIntervalo <= 0 || tick % ticksIntervalo !== 0) return state;
  let porId: Record<string, Unidade> | null = null;
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u === undefined || u.hp === undefined || u.hp <= 0) continue;
    const maximo = hpMaximoDoTipo(u.tipo, dados);
    if (maximo === null || u.hp >= maximo) continue;
    porId ??= { ...state.unidades.porId };
    porId[id] = { ...u, hp: Math.min(maximo, u.hp + ganho) };
  }
  return porId === null ? state : { ...state, unidades: { ...state.unidades, porId } };
}
