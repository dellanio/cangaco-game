// I-TELA-ANIMACAO-FORA-DE-SINCRONIA (aceites 1 e 2) — cada unidade no seu ponto do laco: a fase por id e estavel, cabe
// no intervalo e varia entre ids; com ela, duas unidades paradas no mesmo tick mostram quadros diferentes.
import { describe, expect, it } from 'vitest';
import { FASE_MAXIMA, faseDaUnidade, quadroPeloTempo } from '../src/render/animacao-de-unidade';

const PARADO = { quadros: 4, fps: 6, laco: true };

describe('I-TELA-ANIMACAO-FORA-DE-SINCRONIA', () => {
  it('a fase e deterministica, cabe no intervalo e varia entre ids', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `u${i + 1}`);
    for (const id of ids) {
      expect(faseDaUnidade(id)).toBe(faseDaUnidade(id));
      expect(faseDaUnidade(id)).toBeGreaterThanOrEqual(0);
      expect(faseDaUnidade(id)).toBeLessThan(FASE_MAXIMA);
    }
    expect(new Set(ids.map(faseDaUnidade)).size).toBeGreaterThan(20);
  });

  it('no mesmo tick, unidades diferentes mostram quadros diferentes do parado; sem fase, o mesmo', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `u${i + 1}`);
    const tick = 137;
    const comFase = ids.map((id) => quadroPeloTempo(tick + faseDaUnidade(id), 10, PARADO));
    const semFase = ids.map(() => quadroPeloTempo(tick, 10, PARADO));
    expect(new Set(semFase).size).toBe(1);
    expect(new Set(comFase).size).toBe(PARADO.quadros);
  });
});
