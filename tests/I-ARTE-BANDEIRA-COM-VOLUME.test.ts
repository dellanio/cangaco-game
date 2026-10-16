// I-ARTE-BANDEIRA-COM-VOLUME (pedido do operador, 2026-10-16) — o pano da bandeira com volume: o tom de cada faixa segue
// a inclinacao da onda, dentro de um teto e de um piso, e a faixa colada ao mastro fica na sombra dele.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { corComTom, panoDaBandeira, tonsDoPano, TONS_DO_PANO } from '../src/render/bandeira';
import vento from '../data/vento.json';

const dados = JSON.parse(readFileSync('data/bandeira.json', 'utf8'));
const config = { ...dados, larguraPx: 22.4, alturaPx: 14.08 };

describe('I-ARTE-BANDEIRA-COM-VOLUME', () => {
  it('um tom por faixa, dentro do piso e do teto; sem vento, so a sombra do mastro', () => {
    const plano = panoDaBandeira({ ...vento, forca: 0 }, config, 13, 0.5, 2, 7);
    const tons = tonsDoPano(plano, config.segmentos);
    expect(tons).toHaveLength(config.segmentos);
    expect(tons[0]).toBeCloseTo(TONS_DO_PANO.sombraDoMastro, 9);
    for (const t of tons.slice(1)) expect(t).toBeCloseTo(1, 9);
  });

  it('com vento, as faixas variam: a que desce para a ponta clareia e a que sobe escurece', () => {
    let variou = false;
    for (const tick of [0, 7, 19, 41, 88]) {
      const pano = panoDaBandeira(vento, config, tick, 0.3, 3, 4);
      const tons = tonsDoPano(pano, config.segmentos);
      for (let i = 1; i < config.segmentos; i += 1) {
        const desce = pano[i + 1]!.y - pano[i]!.y;
        expect(tons[i]!).toBeGreaterThanOrEqual(TONS_DO_PANO.minimo);
        expect(tons[i]!).toBeLessThanOrEqual(TONS_DO_PANO.maximo);
        if (desce > 0.01) expect(tons[i]!).toBeGreaterThan(1);
        if (desce < -0.01) expect(tons[i]!).toBeLessThan(1);
        if (Math.abs(desce) > 0.01) variou = true;
      }
    }
    expect(variou).toBe(true);
  });

  it('a cor com tom: 1 preserva, escurece por canal e satura em 255', () => {
    expect(corComTom(0xc0392b, 1)).toBe(0xc0392b);
    expect(corComTom(0x804020, 0.5)).toBe(0x402010);
    expect(corComTom(0xc0c0c0, 2)).toBe(0xffffff);
  });
});
