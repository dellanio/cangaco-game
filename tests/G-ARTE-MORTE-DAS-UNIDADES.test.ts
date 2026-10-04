/**
 * G-ARTE-MORTE-DAS-UNIDADES — toda unidade com atlas tem `morrer` (12 quadros, 5 direcoes, sem laco), e o
 * corpo esmaece: o ultimo quadro tem menos alfa que o primeiro. O alfa e somado a partir dos pixels do
 * atlas (decodificador PNG minimo, RGBA 8 bits, que e o que o gerador grava), sem varrer texto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { lerPng, type Imagem } from './helpers/png';
import type { Manifesto } from '../src/render/manifesto';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const DIRECOES = ['n', 'ne', 'l', 'se', 's'];

function alfaDoQuadro(img: Imagem, q: { x: number; y: number; w: number; h: number }): number {
  let soma = 0;
  for (let y = q.y; y < q.y + q.h; y++) for (let x = q.x; x < q.x + q.w; x++) soma += img.rgba[(y * img.largura + x) * 4 + 3]!;
  return soma;
}

const comAtlas = manifesto.assets.filter((a) => a.tipo === 'unidade' && 'atlas' in a && a.atlas) as
  { id: string; atlas: string; animacoes?: Record<string, { quadros: number; laco: boolean }> }[];

describe('G-ARTE-MORTE-DAS-UNIDADES', () => {
  it('ha unidades com atlas (a lista nao esta vazia)', () => {
    expect(comAtlas.length).toBeGreaterThanOrEqual(23);
  });

  it.each(comAtlas.map((a) => [a.id, a] as const))('%s: morrer com 12 quadros, sem laco, nas 5 direcoes, e o corpo esmaece', (_id, a) => {
    const morrer = a.animacoes?.['morrer'];
    expect(morrer).toEqual(expect.objectContaining({ quadros: 12, laco: false }));
    const json = JSON.parse(readFileSync(`assets/${a.atlas}`, 'utf8')) as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>; meta: { image: string } };
    const img = lerPng(`assets/${a.atlas.slice(0, a.atlas.lastIndexOf('/') + 1)}${json.meta.image}`);
    for (const d of DIRECOES) {
      const quadros = Array.from({ length: 12 }, (_, q) => json.frames[`${a.id}/morrer/${d}/${String(q).padStart(4, '0')}`]);
      expect(quadros.every(Boolean), `${a.id} ${d}: 12 quadros no atlas`).toBe(true);
      const primeiro = alfaDoQuadro(img, quadros[0]!.frame); const ultimo = alfaDoQuadro(img, quadros[11]!.frame);
      expect(primeiro).toBeGreaterThan(0);
      expect(ultimo, `${a.id} ${d}: o ultimo quadro tem menos alfa que o primeiro`).toBeLessThan(primeiro);
    }
  });

  it('o decodificador acusa: um quadro esmaecido tem menos alfa que o seu original (prova de que mede)', () => {
    const serf = comAtlas.find((a) => a.id === 'serf')!;
    const json = JSON.parse(readFileSync(`assets/${serf.atlas}`, 'utf8')) as { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
    const img = lerPng('assets/sprites/units/serf/serf.png');
    const q7 = alfaDoQuadro(img, json.frames['serf/morrer/s/0007']!.frame);
    const q8 = alfaDoQuadro(img, json.frames['serf/morrer/s/0008']!.frame);
    expect(q8 / q7).toBeGreaterThan(0.7); expect(q8 / q7).toBeLessThan(0.8);
  });
});
