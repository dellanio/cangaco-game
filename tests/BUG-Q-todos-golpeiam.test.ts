/**
 * BUG-Q (so 2 soldados golpeiam o predio; o resto fica em `indo_atacar` para sempre).
 * Achado pelo avaliador na segunda leva (docs/avaliacoes/2026-09-29-segunda-leva.md, achado
 * 1), com bisect ate a C5 (colisao militar). A asserção que faltava — e que teria pegado o
 * defeito — e CONTAR quantos soldados do grupo chegam a golpear: o log do roteiro C-IA-03c
 * mostrava `{"indo_atacar":10,"atacando":2}` por mais de 2000 ticks, e nenhum teste olhava.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';

const IA = LADO_DO_JOGADOR + 1;

function cenario(n: number): { s: GameState; ids: string[] } {
  const s0 = createInitialState(1);
  const armazem = s0.predios.porId['p1'];
  if (armazem === undefined) throw new Error('armazem');
  const ids: string[] = [];
  const porId: Record<string, Unidade> = {};
  for (let i = 0; i < n; i++) {
    const id = `s${i}`;
    ids.push(id);
    porId[id] = { id, lado: LADO_DO_JOGADOR, tipo: 'militia', gx: armazem.gx - 2 + (i % 6), gy: armazem.gy + 8 + Math.floor(i / 6), fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') };
  }
  return {
    s: { ...s0, predios: { ...s0.predios, porId: { ...s0.predios.porId, p1: { ...armazem, lado: IA } } }, unidades: { porId, ordem: ids } },
    ids,
  };
}

describe('BUG-Q — o grupo inteiro chega a golpear o predio', () => {
  for (const n of [4, 12]) {
    it(`${n} soldados: nenhum fica em indo_atacar depois que o anel acomoda todos`, () => {
      const c = cenario(n);
      const ids = c.ids;
      let s = c.s;
      s = step(s, [{ type: 'AttackBuilding', unidades: ids, predio: 'p1' }], gameData);
      const golpearam = new Set<string>();
      for (let t = 0; t < 400 && s.predios.porId['p1'] !== undefined; t++) {
        s = step(s, [], gameData);
        for (const id of ids) if (s.unidades.porId[id]?.fsm === 'atacando') golpearam.add(id);
      }
      // o armazem 3x3 tem anel de 16 tiles: cabem os 12; todos chegam a golpear
      expect([...golpearam].sort()).toEqual([...ids].sort());
    });
  }
});
