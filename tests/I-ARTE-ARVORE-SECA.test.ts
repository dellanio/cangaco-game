/**
 * I-ARTE-ARVORE-SECA — o estado `umbuzeiro` de `tree` (a arvore pequena que destoava) vira uma arvore
 * seca da caatinga, no porte do juazeiro (pedido do operador, 2026-10-05).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import type { Manifesto } from '../src/render/manifesto';
import { caixaOpaca, lerPng } from './helpers/png';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const tree = manifesto.assets.find((a) => a.id === 'tree' && a.tipo === 'vegetacao')!;
const caixa = (arq: string) => { const i = lerPng(`assets/${arq}`); return { ...caixaOpaca(i, { x: 0, y: 0, w: i.largura, h: i.altura })!, w: i.largura, h: i.altura }; };

describe('I-ARTE-ARVORE-SECA', () => {
  it('o umbuzeiro aponta para a arte nova, com master 2x registrado', () => {
    expect(tree.estados['umbuzeiro']).toBe('sprites/vegetation/arvore-seca-double-frame.png');
    expect(existsSync('assets/base/vegetation-sertao/arvore-seca-master-2x.png')).toBe(true);
  });

  it('a silhueta tem a altura do juazeiro (ate 10% de diferenca), o pe na mesma linha, e o quadro nao muda', () => {
    const seca = caixa(tree.estados['umbuzeiro']!);
    const juazeiro = caixa(tree.estados['presente']!);
    expect([seca.w, seca.h]).toEqual(tree.tamanho);
    expect(Math.abs((seca.y1 - seca.y0) / (juazeiro.y1 - juazeiro.y0) - 1)).toBeLessThan(0.1);
    expect(seca.y1).toBe(juazeiro.y1);
  });

  it('os outros estados e o anchor ficam', () => {
    expect(Object.keys(tree.estados)).toEqual(['presente', 'umbuzeiro', 'mandacaru', 'facheiro', 'xique-xique', 'macambira']);
    expect(tree.anchor).toEqual([0.5, 1]);
  });
});
