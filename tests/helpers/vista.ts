/**
 * F-COMBATE-ALVO-NA-VISTA — dar ao jogador a vista de um alvo PELO CAMINHO DO JOGO: um cabra do
 * jogador parado perto dele, dentro da `visao` e sem encostar (encostado, o contato vira luta).
 * Nunca desligando a regra. Quem usa e o teste que da ordem a alvo que nasceu longe da vila.
 */
import { gameData } from '../../src/sim/data';
import { condicaoCheiaDoTipo } from '../../src/sim/condicao';
import { tileAndavel } from '../../src/sim/pathfinding';
import { LADO_DO_JOGADOR } from '../../src/sim/state';
import type { GameState } from '../../src/sim/state';

const OLHEIRO = 'militia';

/** O estado com um cabra do jogador (`id`) a 3..6 tiles de `perto`, num tile andavel e livre. */
export function comOlheiro(s: GameState, perto: { readonly gx: number; readonly gy: number }, id = 'olheiro'): GameState {
  const visao = gameData.visao.porTipoDeUnidade[OLHEIRO] ?? 0;
  const ocupado = new Set(s.unidades.ordem.map((u) => `${s.unidades.porId[u]?.gx},${s.unidades.porId[u]?.gy}`));
  for (let r = 3; r <= Math.min(6, visao - 1); r++) {
    for (let d = -r; d <= r; d++) {
      for (const [dx, dy] of [[d, r], [d, -r], [r, d], [-r, d]] as const) {
        const t = { gx: perto.gx + dx, gy: perto.gy + dy };
        if (dx * dx + dy * dy > visao * visao || ocupado.has(`${t.gx},${t.gy}`) || !tileAndavel(s, t, 'livre', gameData)) continue;
        const u = { id, lado: LADO_DO_JOGADOR, tipo: OLHEIRO, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(OLHEIRO) };
        return { ...s, unidades: { porId: { ...s.unidades.porId, [id]: u }, ordem: [...s.unidades.ordem, id] } };
      }
    }
  }
  throw new Error(`fixture: sem tile para o olheiro perto de ${perto.gx},${perto.gy}`);
}
