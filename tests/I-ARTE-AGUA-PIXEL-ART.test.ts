/**
 * I-ARTE-AGUA-PIXEL-ART — o miolo da agua em pixel art (pedido do operador, 2026-10-05). Mede os PNGs
 * que o manifesto aponta: emendam nas quatro bordas, paleta curta, blocos 2x2 (pixel art ampliado), e
 * o gerador os refaz byte a byte.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { gerar, PALETA, QUADROS } from '../tools/gerar-agua-pixel-art.mjs';

interface Entrada { id: string; estados: Record<string, string> }
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as { assets: Entrada[] };
const agua = manifesto.assets.find((e) => e.id === 'agua')!;

function ler(estado: string): { width: number; height: number; data: Uint8Array } {
  return decodePng(readFileSync(`assets/${agua.estados[estado]}`));
}
const px = (img: { width: number; data: Uint8Array }, x: number, y: number): string => {
  const i = (y * img.width + x) * 4;
  return `${img.data[i]},${img.data[i + 1]},${img.data[i + 2]},${img.data[i + 3]}`;
};

describe('I-ARTE-AGUA-PIXEL-ART', () => {
  it('as quatro variantes do manifesto sao os quadros novos, 64x64, opacos', () => {
    for (const estado of QUADROS) {
      expect(agua.estados[estado], estado).toBe(`sprites/terrain/agua-pixel/agua-${estado}.png`);
      const img = ler(estado);
      expect([img.width, img.height]).toEqual([64, 64]);
      for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(255);
    }
  });

  it('(1) emendam: o tile repetido continua igual a si mesmo atravessando a borda (bloco de 2 px)', () => {
    for (const estado of QUADROS) {
      const img = ler(estado);
      // o pixel art 2x: a coluna 0 e a 1 sao o mesmo pixel; o vizinho do outro lado da borda e a coluna 63,
      // que tem de repetir a 62 (o mesmo bloco) — e o padrao segue periodico em 64
      for (let y = 0; y < 64; y++) {
        expect(px(img, 63, y)).toBe(px(img, 62, y));
        expect(px(img, 0, y)).toBe(px(img, 1, y));
      }
      for (let x = 0; x < 64; x++) {
        expect(px(img, x, 63)).toBe(px(img, x, 62));
        expect(px(img, x, 0)).toBe(px(img, x, 1));
      }
    }
  });

  it('(2) paleta curta e blocos 2x2 iguais', () => {
    const permitidas = new Set(PALETA.map(([r, g, b]) => `${r},${g},${b},255`));
    for (const estado of QUADROS) {
      const img = ler(estado);
      const cores = new Set<string>();
      for (let y = 0; y < 64; y += 2) {
        for (let x = 0; x < 64; x += 2) {
          const c = px(img, x, y);
          cores.add(c);
          expect(px(img, x + 1, y)).toBe(c);
          expect(px(img, x, y + 1)).toBe(c);
          expect(px(img, x + 1, y + 1)).toBe(c);
        }
      }
      for (const c of cores) expect(permitidas.has(c), c).toBe(true);
      expect(cores.size).toBeLessThanOrEqual(PALETA.length);
    }
  });

  it('(2) os quatro quadros sao diferentes (a animacao anda)', () => {
    const bytes = QUADROS.map((e) => readFileSync(`assets/${agua.estados[e]}`).toString('base64'));
    expect(new Set(bytes).size).toBe(4);
  });

  it('(3) o gerador refaz os quatro arquivos byte a byte', () => {
    for (const { nome, png } of gerar()) {
      expect(Buffer.from(png).equals(readFileSync(`assets/sprites/terrain/agua-pixel/agua-${nome}.png`)), nome).toBe(true);
    }
  });
});
