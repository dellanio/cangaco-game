import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import manifesto from '../assets/manifest.json';
import config from '../data/piloto-conjunto.json';
import terreno from '../data/terrain.json';
import { escalaDoSprite } from '../src/render/escala-predio';
import type { EntradaDeAsset } from '../src/render/manifesto';
import { gravarEvidencia } from './helpers/evidence';
const require = createRequire(import.meta.url);
interface Png { width: number; height: number; data: Uint8Array }
interface Atlas { frames: Record<string, { frame: { x: number; y: number; w: number; h: number }; sourceSize: { w: number; h: number }; trimmed: boolean; rotated: boolean }>; meta: { image: string } }
const { decodePng } = require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as { decodePng: (b: Uint8Array) => Png };
function hash(path: string): string { return createHash('sha256').update(readFileSync(`assets/${path}`)).digest('hex'); }
describe('I-ARTE-PILOTO-DE-CONJUNTO', () => {
  it('mede os arquivos reais e o recorte do atlas consumido, preservando registro', () => {
    const elementos = config.elementos.map(e => {
      const entrada = manifesto.assets.find(a => a.id === e.id)!;
      expect(entrada.anchor).toEqual([0.5, 1]);
      const estados = entrada.estados as Readonly<Record<string, string>>;
      let arquivo = estados[e.estado]!, recorte: { x: number; y: number; w: number; h: number } | null = null;
      let atlasHash: string | null = null;
      if ('quadro' in e && e.quadro !== undefined) {
        const atlasPath = 'atlas' in entrada && typeof entrada.atlas === 'string' ? entrada.atlas : undefined;
        if (atlasPath === undefined) throw new Error(`${e.id}: atlas ausente`);
        const atlas = JSON.parse(readFileSync(`assets/${atlasPath}`, 'utf8')) as Atlas;
        const frame = atlas.frames[e.quadro]!;
        expect(frame).toBeDefined(); expect(frame.rotated).toBe(false); expect(frame.trimmed).toBe(false);
        expect([frame.sourceSize.w, frame.sourceSize.h]).toEqual(entrada.tamanho);
        recorte = frame.frame; arquivo = `${atlasPath.slice(0, atlasPath.lastIndexOf('/') + 1)}${atlas.meta.image}`;
        atlasHash = hash(atlasPath);
      }
      const p = decodePng(readFileSync(`assets/${arquivo}`));
      const r = recorte ?? { x: 0, y: 0, w: p.width, h: p.height };
      expect([r.w, r.h]).toEqual(entrada.tamanho);
      expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(p.width); expect(r.y + r.h).toBeLessThanOrEqual(p.height);
      let pe = -1;
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (p.data[((r.y + y) * p.width + r.x + x) * 4 + 3]! > 0) pe = y;
      expect(pe).toBeGreaterThanOrEqual(0); expect(pe).toBeLessThan(r.h);
      const escala = entrada.tipo === 'predio' ? escalaDoSprite(entrada as unknown as EntradaDeAsset, manifesto.regraDeAltura, terreno.tile_px, entrada.footprint[0]! * terreno.tile_px, manifesto.regraDeLargura) : 1;
      return { ...e, arquivo, recorte: r, tamanho: entrada.tamanho, anchor: entrada.anchor, pe, escala, sha256: hash(arquivo), atlasHash };
    });
    const solos = config.terrenos.map(id => {
      const e = manifesto.assets.find(a => a.id === id)!;
      const arquivo = (e.estados as Readonly<Record<string, string>>)['padrao']!;
      const p = decodePng(readFileSync(`assets/${arquivo}`)); expect([p.width, p.height]).toEqual(e.tamanho);
      return { id, arquivo, sha256: hash(arquivo) };
    });
    gravarEvidencia('I-ARTE-PILOTO-DE-CONJUNTO', { elementos, solos, zooms: config.zooms, fatoresRGB: config.fatoresRGB });
  });
});
