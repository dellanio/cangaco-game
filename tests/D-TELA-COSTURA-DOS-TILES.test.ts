import { describe, expect, it } from 'vitest';
import { extrudarTira, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA } from '../src/render/extrusao-de-tira';

function tira(tilePx: number, cores: readonly (readonly number[])[]): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(tilePx * tilePx * cores.length * 4);
  for (let y = 0; y < tilePx; y += 1) for (let tile = 0; tile < cores.length; tile += 1) {
    for (let x = 0; x < tilePx; x += 1) pixels.set(cores[tile]!, (y * tilePx * cores.length + tile * tilePx + x) * 4);
  }
  return pixels;
}

describe('D-TELA-COSTURA-DOS-TILES (margem e extrusao da tira)', () => {
  const cores = [[255, 0, 0, 255], [0, 255, 0, 128], [0, 0, 255, 0]];
  it.each([1, 2, 4, 64].flatMap((tilePx) => [1, 2].map((extrusao) => ({ tilePx, extrusao }))))(
    'tres tiles de cores distintas, tile $tilePx e extrusao $extrusao', ({ tilePx, extrusao }) => {
      const entrada = tira(tilePx, cores);
      const copia = entrada.slice();
      const saida = extrudarTira(entrada, tilePx, cores.length, extrusao);
      expect(entrada).toEqual(copia);
      expect(saida.margem).toBe(extrusao);
      expect(saida.espacamento).toBe(2 * extrusao);
      // A mesma conta do Tileset.updateTileData do Phaser: exatamente uma linha e tres colunas.
      expect((saida.largura - 2 * saida.margem + saida.espacamento) / (tilePx + saida.espacamento)).toBe(3);
      expect((saida.altura - 2 * saida.margem + saida.espacamento) / (tilePx + saida.espacamento)).toBe(1);
      for (let tile = 0; tile < 3; tile += 1) {
        const inicio = saida.margem + tile * (tilePx + saida.espacamento);
        for (let y = 0; y < saida.altura; y += 1) {
          for (let x = inicio - extrusao; x < inicio + tilePx + extrusao; x += 1) {
            const p = (y * saida.largura + x) * 4;
            expect(Array.from(saida.pixels.subarray(p, p + 4))).toEqual(cores[tile]);
          }
        }
      }
    },
  );
  it.each([1, 2])('duplica bordas e cantos reais e preserva cada byte interno, extrusao %i', (extrusao) => {
    const tilePx = 3;
    const original = Uint8ClampedArray.from({ length: 3 * tilePx * tilePx * 4 }, (_, i) => (i * 17) % 256);
    const saida = extrudarTira(original, tilePx, 3, extrusao);
    for (let y = 0; y < saida.altura; y += 1) for (let x = 0; x < saida.largura; x += 1) {
      const tile = Math.floor(x / (tilePx + 2 * extrusao));
      const localX = x % (tilePx + 2 * extrusao) - extrusao;
      const sx = tile * tilePx + Math.max(0, Math.min(tilePx - 1, localX));
      const sy = Math.max(0, Math.min(tilePx - 1, y - extrusao));
      const de = (sy * tilePx * 3 + sx) * 4;
      const para = (y * saida.largura + x) * 4;
      expect(saida.pixels.subarray(para, para + 4)).toEqual(original.subarray(de, de + 4));
    }
  });
  it('usa a margem e o espacamento publicados para o render', () => {
    const saida = extrudarTira(tira(1, cores), 1, 3);
    expect(saida.margem).toBe(MARGEM_DA_TIRA);
    expect(saida.espacamento).toBe(ESPACAMENTO_DA_TIRA);
  });
  it.each([[0, 3, 2], [2, 0, 2], [2, 3, 0], [2.5, 3, 2], [2, 3, -1]])(
    'recusa dimensoes invalidas (%i, %i, %i)', (tilePx, quantidade, extrusao) => {
      expect(() => extrudarTira(new Uint8ClampedArray(), tilePx, quantidade, extrusao)).toThrow();
    },
  );
  it('recusa uma tira RGBA incompleta', () => {
    expect(() => extrudarTira(new Uint8ClampedArray(3), 1, 3)).toThrow(/RGBA/);
  });
});
