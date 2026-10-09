import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import manifesto from '../assets/manifest.json';

const require = createRequire(import.meta.url);
const { decodePng } = require('../skills/pianco-sprite-tools/scripts/png-rgba.mjs') as {
  decodePng: (b: Uint8Array) => { width: number; height: number; data: Uint8Array };
};
const { validateSpriteSpec } = require('../skills/pianco-sprite-tools/scripts/validate-sprites.mjs') as {
  validateSpriteSpec: (spec: unknown) => { success: boolean; errors: unknown[] };
};
const ids = ['coal', 'iron_ore', 'gold_ore', 'fish'];
describe('I-ARTE-FONTES-NATURAIS-LEGIVEIS', () => {
  it('dez PNGs passam no validador artistico original, sem tolerancias especiais', () => {
    const frames = ids.flatMap(id => (id === 'fish' ? ['presente'] : ['presente', 'reduzido', 'remanescente']).map(state => ({
      state: `${id}:${state}`, direction: 'front', index: 0,
      path: `assets/sprites/resources/${id}/${state}.png`, pivot: [0.5, 1],
    })));
    const report = validateSpriteSpec({ id: 'fontes-naturais', kind: 'resource', mode: 'trial', frameSize: [64, 64], masterSize: [128, 128], frames });
    expect(frames).toHaveLength(10); expect(report.errors).toEqual([]); expect(report.success).toBe(true);
  });
  it('manifesto preserva legado e registra bases nativas com hashes, prompts e dimensoes/pe comuns', () => {
    for (const id of ids) {
      const entrada = manifesto.assets.find(a => a.id === id && a.tipo === 'recurso')!;
      expect(entrada.anchor).toEqual([0.5, 1]); expect(entrada.tamanho).toEqual([64, 64]); expect(entrada.footprint).toEqual([1, 1]);
      const estados = entrada.estados as Record<string, string>;
      expect(estados.legado).toBe(`sprites/resources/${id}.png`);
      const meta = JSON.parse(readFileSync(`assets/base/${id}-natural/geracoes.json`, 'utf8')) as { selecionada: number; registros: { rodada: number; prompt: string; id: string; sha256: string }[] };
      expect(meta.registros).toHaveLength(id === 'fish' ? 1 : 2);
      for (const r of meta.registros) {
        expect(r.prompt.length).toBeGreaterThan(100); expect(r.id).toMatch(/^exec-/);
        expect(createHash('sha256').update(readFileSync(`assets/base/${id}-natural/atlas-${r.rodada}.png`)).digest('hex')).toBe(r.sha256);
      }
      const alturas: number[] = [];
      for (const estado of id === 'fish' ? ['presente'] : ['presente', 'reduzido', 'remanescente']) {
        expect(estados[estado]).toBe(`sprites/resources/${id}/${estado}.png`);
        const png = decodePng(readFileSync(`assets/${estados[estado]}`));
        expect([png.width, png.height]).toEqual([64, 64]);
        let top = 64, foot = -1;
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) if (png.data[(y * 64 + x) * 4 + 3]! > 0) { top = Math.min(top, y); foot = y; }
        expect(foot).toBe(62); alturas.push(foot - top + 1);
      }
      if (id !== 'fish') { expect(alturas[0]!).toBeGreaterThan(alturas[1]!); expect(alturas[1]!).toBeGreaterThan(alturas[2]!); }
    }
  });
});
