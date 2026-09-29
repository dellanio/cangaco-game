/**
 * D-TELA-02 — minimapa (plano em docs/planos/2026-09-29-D-TELA-02-minimapa.md). A
 * aritmetica e de `render/minimapa.ts`; o desenho e o clique vao no roteiro.
 */
import { describe, expect, it } from 'vitest';
import { enquadrar, pixelsDoTerreno, retanguloNoMinimapa, tileDoMinimapa, vistaEmTiles } from '../src/render/minimapa';
import { configDoMapa, terrenoDeRender } from '../src/render/mapa';
import { gravarEvidencia } from './helpers/evidence';

const { largura, altura, tilePx } = configDoMapa;

describe('D-TELA-02 — minimapa', () => {
  it('o mapa inteiro cabe na caixa, com a proporcao mantida e centrado', () => {
    const e = enquadrar(128, 128, { largura: 200, altura: 64 });
    expect(e.pxPorTile).toBe(0.5);
    expect(e.x0).toBe(68);
    expect(e.y0).toBe(0);
    const tudo = retanguloNoMinimapa({ x0: 0, y0: 0, x1: 128, y1: 128 }, e);
    expect(tudo).toEqual({ x: 68, y: 0, largura: 64, altura: 64 });
  });

  it('o clique inverte o retangulo e prende nas bordas', () => {
    const e = enquadrar(largura, altura, { largura: 180, altura: 70 });
    for (const t of [{ gx: 0, gy: 0 }, { gx: 67, gy: 67 }, { gx: largura - 1, gy: altura - 1 }]) {
      const r = retanguloNoMinimapa({ x0: t.gx, y0: t.gy, x1: t.gx + 1, y1: t.gy + 1 }, e);
      expect(tileDoMinimapa(r.x + r.largura / 2, r.y + r.altura / 2, e, largura, altura)).toEqual(t);
    }
    // a faixa que sobra do enquadro leva a borda
    expect(tileDoMinimapa(0, 35, e, largura, altura).gx).toBe(0);
    expect(tileDoMinimapa(179, 35, e, largura, altura).gx).toBe(largura - 1);
  });

  it('a vista da camera vira tiles', () => {
    expect(vistaEmTiles({ x: 10 * tilePx, y: 4 * tilePx, width: 20 * tilePx, height: 11 * tilePx }, tilePx))
      .toEqual({ x0: 10, y0: 4, x1: 30, y1: 15 });
  });

  it('cada tile do terreno ganha a cor do seu codigo', () => {
    const pixels = pixelsDoTerreno(terrenoDeRender);
    expect(pixels.length).toBe(largura * altura * 4);
    const hex = (i: number): string => `#${[0, 1, 2].map((k) => (pixels[i * 4 + k] as number).toString(16).padStart(2, '0')).join('')}`;
    const amostra = [0, 1234, largura * altura - 1];
    for (const i of amostra) {
      expect(hex(i)).toBe((terrenoDeRender.cores[terrenoDeRender.codigos[i] as number] as string).toLowerCase());
      expect(pixels[i * 4 + 3]).toBe(255);
    }
    const tipos = new Set(terrenoDeRender.codigos);
    gravarEvidencia('D-TELA-02', { largura, altura, tiposDeTerrenoNoMapa: tipos.size, cores: terrenoDeRender.cores });
  });
});
