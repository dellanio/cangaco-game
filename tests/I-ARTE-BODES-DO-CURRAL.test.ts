/**
 * I-ARTE-BODES-DO-CURRAL — o animal do Curral (`swine_farm`, id neutro `pigs`) e o bode, nas tres
 * idades (pedido do operador, 2026-10-05).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { EntradaDeCamada, Manifesto } from '../src/render/manifesto';
import { violacoesDaCamadaViva } from '../src/render/manifesto-camadas';
import { contextoDasCamadas } from '../src/render/predios';
import { caixaOpaca, lerPng } from './helpers/png';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const bode = manifesto.assets.find((a) => a.tipo === 'animal' && a.id === 'pigs') as EntradaDeCamada | undefined;

describe('I-ARTE-BODES-DO-CURRAL', () => {
  it('a entrada animal pigs tem os 12 quadros e passa no validador das camadas vivas', () => {
    expect(bode).toBeDefined();
    expect(violacoesDaCamadaViva(bode!, contextoDasCamadas)).toEqual([]);
    expect(Object.keys(bode!.estados)).toHaveLength(12);
  });

  it('cada quadro tem o tamanho da entrada, gente dentro, e o bode cresce com a idade', () => {
    const altura: Record<string, number> = {};
    for (const [estado, arq] of Object.entries(bode!.estados)) {
      const img = lerPng(`assets/${arq}`);
      expect([img.largura, img.altura], arq).toEqual(bode!.tamanho);
      const c = caixaOpaca(img, { x: 0, y: 0, w: img.largura, h: img.altura });
      expect(c, arq).not.toBeNull();
      expect(c!.y1, `${arq}: o pe na borda de baixo`).toBe(img.altura - 1);
      const idade = estado.split('_')[0]!;
      altura[idade] = Math.max(altura[idade] ?? 0, c!.y1 - c!.y0 + 1);
    }
    expect(altura['idade1']).toBeLessThan(altura['idade2']!);
    expect(altura['idade2']).toBeLessThan(altura['idade3']!);
  });
});
