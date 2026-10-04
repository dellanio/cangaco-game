/**
 * G-ARTE-BANDEIRA-NO-TELHADO — todo predio tem `ancoras.bandeira`, e o ponto cai no telhado: a ate 3 px
 * de um pixel opaco do sprite `completo`. Antes, dez predios sem ancora punham a bandeira na posicao
 * padrao, solta no ar a esquerda da casa (prints do operador, 2026-10-04).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { alfa, lerPng } from './helpers/png';

interface Predio { id: string; tipo: string; estados: Record<string, string>; ancoras?: { bandeira?: [number, number] } }
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Predio[] };
const predios = manifesto.assets.filter((a) => a.tipo === 'predio');

function alfaDe(caminho: string): { w: number; h: number; a: (x: number, y: number) => number } {
  const img = lerPng(caminho);
  return { w: img.largura, h: img.altura, a: (x, y) => alfa(img, x, y) };
}

describe('G-ARTE-BANDEIRA-NO-TELHADO', () => {
  it.each(predios.map((p) => [p.id, p] as const))('%s: tem ancoras.bandeira, e o ponto cai no telhado', (_id, p) => {
    const ponto = p.ancoras?.bandeira;
    expect(ponto, `${p.id} sem ancoras.bandeira`).toBeDefined();
    const img = alfaDe(`assets/${p.estados['completo']}`);
    const x0 = Math.round(ponto![0] * img.w); const y0 = Math.round(ponto![1] * img.h);
    let perto = false;
    for (let dy = -3; dy <= 3 && !perto; dy++) for (let dx = -3; dx <= 3 && !perto; dx++) {
      const x = x0 + dx; const y = y0 + dy;
      if (x >= 0 && y >= 0 && x < img.w && y < img.h && img.a(x, y) > 128) perto = true;
    }
    expect(perto, `${p.id}: a bandeira em (${x0}, ${y0}) nao toca o sprite`).toBe(true);
  });

  it('o teste acusa: um ponto no ar, acima e a esquerda da casa, nao toca o sprite', () => {
    const img = alfaDe('assets/sprites/fishermans/' + (predios.find((p) => p.id === 'fishermans')!.estados['completo']!.split('/').pop()));
    let toca = false;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (img.a(5 + dx + 3, 40 + dy) > 128) toca = true;
    expect(toca).toBe(false);
  });
});
