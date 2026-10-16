// I-TELA-RUA-MARCADA-CORDEL (aceite 1) — o tile de rua marcada e estacas e cordel cinza dentro do tile, com o chao
// aparecendo no miolo; os quatro estagios tem 64x64.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { gravarEvidencia } from './helpers/evidence';

const ESTAGIOS = ['marcado', 'pedras', 'obra-1', 'obra-2'] as const;
const ler = (estado: string) => decodePng(readFileSync(`assets/sprites/road/rua-em-obra-${estado}.png`));
/** O miolo do tile: dentro do retangulo do cordel, longe da linha. */
const MIOLO = { x0: 10, x1: 53, y0: 20, y1: 53 };

describe('I-TELA-RUA-MARCADA-CORDEL', () => {
  it('os quatro estagios tem 64x64', () => {
    for (const e of ESTAGIOS) {
      const img = ler(e);
      expect([img.width, img.height], e).toEqual([64, 64]);
    }
  });

  it('o marcado: o miolo transparente, e na borda so cordel cinza e estaca', () => {
    const img = ler('marcado');
    let opacosNoMiolo = 0, cordel = 0, colorido = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      const [r = 0, g = 0, b = 0, a = 0] = img.data.subarray(i, i + 4);
      if (a < 32) continue;
      if (x >= MIOLO.x0 && x <= MIOLO.x1 && y >= MIOLO.y0 && y <= MIOLO.y1) { opacosNoMiolo++; continue; }
      const croma = Math.max(r, g, b) - Math.min(r, g, b);
      if (croma <= 12) cordel++; else colorido++;
    }
    gravarEvidencia('I-TELA-RUA-MARCADA-CORDEL', { opacosNoMiolo, cordelCinza: cordel, estacas: colorido });
    expect(opacosNoMiolo).toBe(0);
    // o cordel cinza e a maior parte da marcacao; o que tem cor sao as quatro estacas, pequenas
    expect(cordel).toBeGreaterThan(colorido);
    expect(colorido).toBeGreaterThan(0);
  });

  it('os estagios seguintes assentam sobre a marcacao: o cordel do marcado continua neles', () => {
    const base = ler('marcado');
    for (const e of ESTAGIOS.slice(1)) {
      const img = ler(e);
      // o canto do cordel de baixo, a esquerda, fica fora da pedra e da obra
      const i = (58 * 64 + 20) * 4;
      expect(img.data[i + 3], e).toBe(base.data[i + 3]);
      expect(img.data[i + 3], e).toBeGreaterThan(0);
    }
  });
});
