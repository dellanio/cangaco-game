/**
 * I-TELA-LENHADOR-CORTA-E-DERRUBA (aceite 1) — o estado da arvore na tela pela quantidade e pelos troncos a caminho de
 * casa, o ponto do lenhador junto ao tronco e a entrada no quadro do golpe. So tela.
 */
import { describe, expect, it } from 'vitest';
import { arvoreNaTela, entrouNoGolpe, pertoDoTronco } from '../src/render/corte-da-arvore';
import dados from '../data/gesto-do-trabalho.json';
import recursos from '../data/resources.json';

const RENDIMENTO = recursos.tipos.tree.rendimentoPorTile;

describe('a arvore na tela', () => {
  it.each([
    // quantidade, a caminho, esperado
    [4, 0, { tipo: 'em-pe' }],
    [4, 1, { tipo: 'caida', troncos: 3 }],
    [3, 0, { tipo: 'caida', troncos: 3 }],
    [3, 1, { tipo: 'caida', troncos: 2 }],
    [2, 0, { tipo: 'caida', troncos: 2 }],
    [1, 0, { tipo: 'caida', troncos: 1 }],
    [1, 1, { tipo: 'toco' }],
    [0, 0, { tipo: 'toco' }],
  ])('quantidade %i, %i a caminho', (q, aCaminho, esperado) => {
    expect(RENDIMENTO).toBe(4);
    expect(arvoreNaTela(q, RENDIMENTO, aCaminho)).toEqual(esperado);
  });
  it('a arvore so cai quando o primeiro tronco sai dela, e nunca volta a ficar em pe', () => {
    expect(arvoreNaTela(RENDIMENTO, RENDIMENTO, 0).tipo).toBe('em-pe');
    for (let q = RENDIMENTO - 1; q > 0; q--) expect(arvoreNaTela(q, RENDIMENTO, 0).tipo).not.toBe('em-pe');
  });
});

describe('o lenhador junto ao tronco', () => {
  const d = dados.lenhador.distanciaDoTroncoTiles;
  it.each([[[4, 5], [5, 5]], [[6, 5], [5, 5]], [[5, 4], [5, 5]], [[5, 6], [5, 5]], [[4, 4], [5, 5]]])(
    'vindo de %j para a arvore %j, fica a %s tile do pe dela', (u, a) => {
      const [ux, uy] = u as [number, number]; const [ax, ay] = a as [number, number];
      const { dx, dy } = pertoDoTronco({ gx: ux, gy: uy }, { gx: ax, gy: ay }, d);
      const ponto = { x: ux + 0.5 + dx, y: uy + 0.5 + dy };
      expect(Math.hypot(ponto.x - (ax + 0.5), ponto.y - (ay + 1))).toBeCloseTo(d, 6);
    });
  it('ja perto, nao anda', () => {
    expect(pertoDoTronco({ gx: 5, gy: 5 }, { gx: 5, gy: 5 }, 0.6)).toEqual({ dx: 0, dy: 0 });
  });
});

describe('o golpe', () => {
  const golpes = dados.lenhador.quadrosDoGolpe;
  it('entra uma vez em cada quadro do golpe, e nao repete no mesmo quadro', () => {
    const quadros = [0, 1, 2, 3, 3, 3, 4, 5, 6, 7, 7, 0, 1, 2, 3];
    let anterior: number | null = null; let golpesVistos = 0;
    for (const q of quadros) { if (entrouNoGolpe(anterior, q, golpes)) golpesVistos++; anterior = q; }
    expect(golpesVistos).toBe(3);
  });
});
