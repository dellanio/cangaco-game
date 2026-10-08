import { describe, expect, it } from 'vitest';
import { degrauDaCaatinga, configDaCaatinga, vegetacaoSeca, texturaDaCaatinga } from '../src/render/caatinga';
import type { FaseDoClima } from '../src/sim/clima';
const fase = (id: string, decorrido: number): FaseDoClima => ({ id, indice: 0, decorrido, falta: 100 - decorrido });

describe('I-TELA-CAATINGA-PELA-ESTACAO', () => {
  it('inverno e desligado normais, seca inteira seca, transicoes em sentidos opostos', () => {
    expect(degrauDaCaatinga(null)).toBe(0);
    expect(degrauDaCaatinga(fase('inverno', 50))).toBe(0);
    expect(degrauDaCaatinga(fase('seca', 50))).toBe(configDaCaatinga.degraus);
    expect(degrauDaCaatinga(fase('transicaoSeca', 50))).toBe(configDaCaatinga.degraus / 2);
    expect(degrauDaCaatinga(fase('transicaoChuva', 50))).toBe(configDaCaatinga.degraus / 2);
  });
  it('ordem fixa por tile e monotona, metade da transicao seca aproximadamente metade do mapa', () => {
    let metade = 0;
    const violacoes: string[] = [];
    for (let gy = 0; gy < 128; gy++) for (let gx = 0; gx < 128; gx++) {
      let secou = false;
      if (vegetacaoSeca(gx, gy, 0)) violacoes.push(`inverno:${gx},${gy}`);
      for (let d = 0; d <= configDaCaatinga.degraus; d++) {
        const seca = vegetacaoSeca(gx, gy, d);
        if (seca !== vegetacaoSeca(gx, gy, d)) violacoes.push(`ordem:${gx},${gy},${d}`);
        if (secou && !seca) violacoes.push(`monotonia:${gx},${gy},${d}`);
        secou = seca;
      }
      if (!secou) violacoes.push(`seca:${gx},${gy}`);
      if (vegetacaoSeca(gx, gy, configDaCaatinga.degraus / 2)) metade++;
    }
    expect(violacoes).toEqual([]);
    expect(metade / (128 * 128)).toBeGreaterThan(0.48);
    expect(metade / (128 * 128)).toBeLessThan(0.52);
  });
  it('quantizacao nao muda entre dois ticks do mesmo degrau', () => {
    expect(degrauDaCaatinga({ ...fase('transicaoSeca', 0), decorrido: 500, falta: 500 })).toBe(32);
    expect(degrauDaCaatinga({ ...fase('transicaoSeca', 0), decorrido: 501, falta: 499 })).toBe(32);
  });
  it('escolhe o par correto e sem PNG sazonal conserva o normal', () => {
    const d = configDaCaatinga.degraus;
    for (const [normal, seca] of [['vegetacao:tree:presente', 'vegetacao:tree:seca'], ['vegetacao:tree:mandacaru', 'vegetacao:tree:seca:mandacaru']]) {
      expect(texturaDaCaatinga(normal!, 1, 2, d, k => k === seca)).toBe(seca);
      expect(texturaDaCaatinga(normal!, 1, 2, d, () => false)).toBe(normal);
      expect(texturaDaCaatinga(normal!, 1, 2, 0, () => true)).toBe(normal);
    }
  });
});
