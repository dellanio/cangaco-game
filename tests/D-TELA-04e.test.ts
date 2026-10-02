import { expect, it } from 'vitest';
import { memoriaDeTexturas } from '../src/render/memoria-de-texturas';
import { readFileSync } from 'node:fs';

it('D-TELA-04e (memória de texturas): soma fontes carregadas, sem contar frames ou espelhos outra vez', () => {
  const base = [{ key: 'base', source: [{ width: 10, height: 20 }, { width: 3, height: 4 }] }];
  expect(memoriaDeTexturas([])).toBe(0);
  expect(memoriaDeTexturas(base)).toBe((200 + 12) * 4);
  const png = readFileSync('assets/depuracao/serf/serf.png');
  const atlas = { key: 'serf', source: [{ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }] };
  expect(memoriaDeTexturas([...base, atlas]) - memoriaDeTexturas(base)).toBe(512 * 1080 * 4);
});
