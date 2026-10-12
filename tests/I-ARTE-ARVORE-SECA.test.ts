/**
 * I-ARTE-ARVORE-SECA — o estado `umbuzeiro` de `tree` (a arvore pequena que destoava) vira uma arvore
 * seca da caatinga, no porte do juazeiro (pedido do operador, 2026-10-05).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import type { Manifesto } from '../src/render/manifesto';
import { caixaOpaca, lerPng } from './helpers/png';
import { CRESCIMENTO_DA_ARVORE, afirmarContratoDaArvore } from './helpers/contrato-estados-arvore';

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
    const antigos: Readonly<Record<string, string>> = {
      presente: 'sprites/vegetation/tree-D-double.png',
      umbuzeiro: 'sprites/vegetation/arvore-seca-double-frame.png',
      mandacaru: 'sprites/vegetation/mandacaru-double-frame.png',
      facheiro: 'sprites/vegetation/facheiro-double-frame.png',
      'xique-xique': 'sprites/vegetation/xique-xique-double-frame.png',
      macambira: 'sprites/vegetation/macambira-double-frame.png',
    };
    for (const [estado, caminho] of Object.entries(antigos)) {
      expect(tree.estados[estado], estado).toBe(caminho);
    }
    for (const estado of Object.keys(tree.estados)) {
      if (Object.hasOwn(antigos, estado)) continue;
      if (Object.hasOwn(CRESCIMENTO_DA_ARVORE, estado)) {
        expect(tree.estados[estado], estado).toBe(CRESCIMENTO_DA_ARVORE[estado]);
        continue;
      }
      expect(estado === 'seca' || estado.startsWith('seca:'), estado).toBe(true);
      const inverno = estado === 'seca' ? 'presente' : estado.slice('seca:'.length);
      expect(Object.hasOwn(antigos, inverno), estado).toBe(true);
      expect(tree.estados[inverno], estado).toBe(antigos[inverno]);
    }
    expect(tree.anchor).toEqual([0.5, 1]);
    afirmarContratoDaArvore(tree);
  });
});
