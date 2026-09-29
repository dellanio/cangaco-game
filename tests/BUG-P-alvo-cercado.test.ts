/**
 * BUG-P (o corpo a corpo trava indo atras de um alvo cercado): o alvo esta rodeado nos 8
 * tiles pelos colegas dele, nao ha tile livre encostado nele, e o atacante fica em
 * `indo_lutar` para sempre — com um inimigo ENCOSTADO nele, que ele nao ataca. Achado na
 * C-IA-03 (cenario de escaramuca): 1 cabra contra o bloco de 9 bodoqueiros, 10 000 ticks
 * parado. A C6 (revidar enquanto marcha) ja faz quem MARCHA revidar quem encosta (KaM
 * `CheckForEnemy`, KM_UnitWarrior.pas:664-702); faltava quem VAI LUTAR.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';

const IA = LADO_DO_JOGADOR + 1;
const u = (id: string, tipo: string, lado: number, gx: number, gy: number): Unidade =>
  ({ lado, id, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo), direcao: 6 } as Unidade);

describe('BUG-P — quem vai lutar revida o inimigo encostado', () => {
  it('o alvo cercado pelos colegas nao trava o atacante: ele luta com o que encosta, e o bloco cai', () => {
    const bloco: Unidade[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) bloco.push(u(`b${dx + 1}${dy + 1}`, 'bowman', IA, 60 + dx, 60 + dy));
    const s0 = createInitialState(1);
    const atacante = u('m', 'militia', LADO_DO_JOGADOR, 57, 60);
    let s: GameState = { ...s0, unidades: { porId: Object.fromEntries([atacante, ...bloco].map((x) => [x.id, x])), ordem: ['m', ...bloco.map((b) => b.id)] } };
    s = step(s, [{ type: 'AttackUnit', unidades: ['m'], alvo: 'b11' }], gameData);
    let lutou = -1;
    for (let t = 0; t < 400 && lutou < 0; t++) {
      s = step(s, [], gameData);
      if (s.unidades.porId['m']?.fsm === 'lutando') lutou = t;
    }
    expect(lutou, 'o atacante nunca chegou a lutar').toBeGreaterThanOrEqual(0);
    // e segue: com a ordem repetida sobre quem sobrou (o ocioso so revida o encostado, e a
    // regra de hoje), o bloco inteiro cai — o bodoqueiro nao luta encostado
    for (let t = 0; t < 3000 && bloco.some((b) => s.unidades.porId[b.id]); t++) {
      const vivo = bloco.find((b) => s.unidades.porId[b.id]);
      const ocioso = s.unidades.porId['m']?.fsm === 'ocioso';
      s = step(s, ocioso && vivo ? [{ type: 'AttackUnit', unidades: ['m'], alvo: vivo.id }] : [], gameData);
    }
    expect(bloco.filter((b) => s.unidades.porId[b.id]).map((b) => b.id)).toEqual([]);
  });
});
