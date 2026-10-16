/**
 * I-TELA-CORDA-ENTRE-AS-ESTACAS (aceite 1) — as quatro cordas do canteiro ligam os nos das estacas vizinhas e cedem no
 * meio, para baixo, com a barriga crescendo com o vao e com teto.
 */
import { describe, expect, it } from 'vitest';
import { cordasDoLote } from '../src/render/corda-do-canteiro';

const FORMA = { alturaDoNo: 34, cedePorPx: 0.03, barrigaMaxima: 6 };

describe('as cordas do canteiro', () => {
  it.each([[3, 2], [4, 3]])('lote %ix%i: quatro cordas de no a no, nos quatro lados', (l, a) => {
    const [w, h] = [l * 64, a * 64];
    const cordas = cordasDoLote(w, h, FORMA);
    expect(cordas.map((c) => c.lado).sort()).toEqual(['baixo', 'cima', 'direita', 'esquerda']);
    const no = (x: number, y: number) => ({ x, y: y - FORMA.alturaDoNo });
    const porLado = Object.fromEntries(cordas.map((c) => [c.lado, c]));
    expect([porLado['cima']!.de, porLado['cima']!.ate]).toEqual([no(0, 0), no(w, 0)]);
    expect([porLado['baixo']!.de, porLado['baixo']!.ate]).toEqual([no(0, h), no(w, h)]);
    expect([porLado['esquerda']!.de, porLado['esquerda']!.ate]).toEqual([no(0, 0), no(0, h)]);
    expect([porLado['direita']!.de, porLado['direita']!.ate]).toEqual([no(w, 0), no(w, h)]);
    for (const c of cordas) expect(c.meio.y).toBeGreaterThan((c.de.y + c.ate.y) / 2);
  });
  it('a barriga cresce com o vao e para no teto', () => {
    const curta = cordasDoLote(64, 64, FORMA).find((c) => c.lado === 'cima')!.barriga;
    const media = cordasDoLote(128, 64, FORMA).find((c) => c.lado === 'cima')!.barriga;
    const longa = cordasDoLote(640, 64, FORMA).find((c) => c.lado === 'cima')!.barriga;
    expect(media).toBeGreaterThan(curta);
    expect(longa).toBe(FORMA.barrigaMaxima);
  });
});
