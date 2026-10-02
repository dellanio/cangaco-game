import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

it('D-ARTE-02 (atlas de depuração): 90 quadros de 64×96 e bytes reproduzíveis', () => {
  const atlas = JSON.parse(readFileSync('assets/depuracao/serf/serf.json', 'utf8'));
  expect(Object.keys(atlas.frames)).toHaveLength(90);
  for (const [animacao, quadros] of [['parado', 4], ['andar', 8], ['morrer', 6]] as const) {
    for (const direcao of ['n', 'ne', 'l', 'se', 's']) for (let q = 0; q < quadros; q++) {
      const frame = atlas.frames[`serf/${animacao}/${direcao}/${String(q).padStart(4, '0')}`];
      expect(frame.sourceSize).toEqual({ w: 64, h: 96 });
      expect(frame.spriteSourceSize.y + frame.spriteSourceSize.h).toBe(96);
    }
  }
  const temporario = mkdtempSync(join(tmpdir(), 'serf-depuracao-'));
  try {
    const hashes: string[][] = [];
    for (let corrida = 0; corrida < 2; corrida++) {
      execFileSync(process.execPath, ['tools/gerar-sprites-depuracao.js', temporario]);
      hashes.push(['serf/serf.png', 'serf/serf.json', 'manifesto.json'].map((rel) => {
        const bytes = readFileSync(join(temporario, rel));
        expect(bytes).toEqual(readFileSync(`assets/depuracao/${rel}`));
        return createHash('sha256').update(bytes).digest('hex');
      }));
    }
    expect(hashes[0]).toEqual(hashes[1]);
  } finally { rmSync(temporario, { recursive: true }); }
});
