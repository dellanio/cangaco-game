/**
 * G-ARTE-MORTE-DAS-UNIDADES — toda unidade com atlas tem `morrer` (12 quadros, 5 direcoes, sem laco), e o
 * corpo esmaece: o ultimo quadro tem menos alfa que o primeiro. O alfa e somado a partir dos pixels do
 * atlas (decodificador PNG minimo, RGBA 8 bits, que e o que o gerador grava), sem varrer texto.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import type { Manifesto } from '../src/render/manifesto';

const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Manifesto;
const DIRECOES = ['n', 'ne', 'l', 'se', 's'];

interface Imagem { largura: number; altura: number; rgba: Uint8Array }

function lerPng(caminho: string): Imagem {
  const b = readFileSync(caminho);
  let pos = 8; let largura = 0; let altura = 0; let tipoCor = 0; let prof = 0; const idat: Buffer[] = [];
  while (pos < b.length) {
    const tam = b.readUInt32BE(pos); const tipo = b.toString('ascii', pos + 4, pos + 8); const dado = b.subarray(pos + 8, pos + 8 + tam);
    if (tipo === 'IHDR') { largura = dado.readUInt32BE(0); altura = dado.readUInt32BE(4); prof = dado[8]!; tipoCor = dado[9]!; }
    if (tipo === 'IDAT') idat.push(dado);
    pos += 12 + tam;
  }
  if (prof !== 8 || tipoCor !== 6) throw new Error(`${caminho}: so RGBA 8 bits (prof ${prof}, cor ${tipoCor})`);
  const cru = inflateSync(Buffer.concat(idat)); const linha = largura * 4; const rgba = new Uint8Array(linha * altura);
  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (linha + 1)]!; const ini = y * (linha + 1) + 1;
    for (let x = 0; x < linha; x++) {
      const v = cru[ini + x]!; const a = x >= 4 ? rgba[y * linha + x - 4]! : 0; const c = y > 0 ? rgba[(y - 1) * linha + x]! : 0;
      const ac = x >= 4 && y > 0 ? rgba[(y - 1) * linha + x - 4]! : 0;
      const p = a + c - ac; const pa = Math.abs(p - a); const pb = Math.abs(p - c); const pc = Math.abs(p - ac);
      const pred = filtro === 0 ? 0 : filtro === 1 ? a : filtro === 2 ? c : filtro === 3 ? (a + c) >> 1
        : pa <= pb && pa <= pc ? a : pb <= pc ? c : ac;
      rgba[y * linha + x] = (v + pred) & 255;
    }
  }
  return { largura, altura, rgba };
}

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
