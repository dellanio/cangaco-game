/**
 * I-ARTE-SOLO-PIXEL-ART — o chao padrao (`grama`) em pixel art (pedido do operador, 2026-10-05). Mede os
 * PNGs que o manifesto aponta: emendam com eles mesmos e ENTRE SI (o render sorteia a variante por
 * tile), paleta curta, blocos 2x2, e o gerador os refaz byte a byte.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { gerar, PALETA, VARIANTES } from '../tools/gerar-solo-pixel-art.mjs';

interface Entrada { id: string; estados: Record<string, string> }
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Entrada[] };
const grama = manifesto.assets.find((e) => e.id === 'grama')!;
const ler = (v: string) => decodePng(readFileSync(`assets/${grama.estados[v]}`));
const px = (img: { width: number; data: Uint8Array }, x: number, y: number): string => {
  const i = (y * img.width + x) * 4;
  return `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]},${img.data[i + 3]}`;
};

describe('I-ARTE-SOLO-PIXEL-ART', () => {
  it('as quatro variantes do manifesto sao as novas, 64x64, opacas', () => {
    for (const v of VARIANTES) {
      expect(grama.estados[v], v).toBe(`sprites/terrain/solo-pixel/solo-${v}.png`);
      const img = ler(v);
      expect([img.width, img.height]).toEqual([64, 64]);
      for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255);
    }
  });

  it('(1) as bordas sao iguais nas quatro (o chao de base): qualquer par se encosta sem costura', () => {
    const imgs = VARIANTES.map(ler);
    const borda = (img: ReturnType<typeof ler>) => {
      const b: string[] = [];
      for (let k = 0; k < 64; k++) for (const d of [0, 1, 2, 3, 60, 61, 62, 63]) b.push(px(img, d, k), px(img, k, d));
      return b.join('|');
    };
    const primeira = borda(imgs[0]!);
    for (const img of imgs.slice(1)) expect(borda(img)).toBe(primeira);
    // e as variantes diferem no miolo
    expect(new Set(VARIANTES.map((v) => readFileSync(`assets/${grama.estados[v]}`).toString('base64'))).size).toBe(4);
  });

  it('(2) paleta curta e blocos 2x2 iguais', () => {
    const permitidas = new Set(PALETA.map(([r, g, b]) => `${r},${g},${b},255`));
    for (const v of VARIANTES) {
      const img = ler(v);
      for (let y = 0; y < 64; y += 2) {
        for (let x = 0; x < 64; x += 2) {
          const c = px(img, x, y);
          expect(permitidas.has(c), `${v} ${x},${y} ${c}`).toBe(true);
          expect(px(img, x + 1, y)).toBe(c);
          expect(px(img, x, y + 1)).toBe(c);
          expect(px(img, x + 1, y + 1)).toBe(c);
        }
      }
    }
  });

  it('(3) o gerador refaz os quatro arquivos byte a byte', () => {
    for (const { nome, png } of gerar()) {
      expect(Buffer.from(png).equals(readFileSync(`assets/sprites/terrain/solo-pixel/solo-${nome}.png`)), nome).toBe(true);
    }
  });
});
