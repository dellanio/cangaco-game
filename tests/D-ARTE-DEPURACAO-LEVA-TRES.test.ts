import { expect, it } from 'vitest';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import type { Manifesto, EntradaDeCamada } from '../src/render/manifesto';
import { violacoesDoAtlas } from '../src/render/atlas-de-unidade';
import { gravarEvidencia } from './helpers/evidence';

it('fixtures de militar e trabalho são reproduzíveis, completas, com pé constante; serf preservado', () => {
  const dir = mkdtempSync(join(tmpdir(), 'leva3-'));
  const hashes: Record<string,string>[] = [];
  try {
    for (let rodada = 0; rodada < 2; rodada++) {
      execFileSync(process.execPath, ['tools/gerar-sprites-depuracao.js', dir]);
      const m = JSON.parse(readFileSync(join(dir, 'manifesto.json'), 'utf8')) as Manifesto;
      const h: Record<string,string> = {};
      expect(m.assets.map((a) => a.id)).toEqual(['serf','militia','woodcutter','laborer']);
      for (const entrada of m.assets as EntradaDeCamada[]) {
        const rel = `${entrada.id}/${entrada.id}`;
        for (const ext of ['png','json']) {
          const bytes = readFileSync(join(dir, `${rel}.${ext}`));
          expect(bytes).toEqual(readFileSync(`assets/depuracao/${rel}.${ext}`));
          h[`${rel}.${ext}`] = createHash('sha256').update(bytes).digest('hex');
        }
        const atlas = JSON.parse(readFileSync(join(dir, `${rel}.json`), 'utf8'));
        expect(violacoesDoAtlas(entrada, atlas)).toEqual([]);
        expect(Object.keys(atlas.frames)).toHaveLength(entrada.id === 'serf' ? 90 : 120);
        for (const f of Object.values(atlas.frames) as {spriteSourceSize:{y:number;h:number}}[]) {
          expect(f.spriteSourceSize.y + f.spriteSourceSize.h).toBe(96);
        }
        const ausente = { ...atlas.frames }; delete ausente[Object.keys(ausente)[0]!];
        expect(violacoesDoAtlas(entrada, {frames:ausente}).some((e) => e.includes('quadro-ausente'))).toBe(true);
      }
      expect(h['serf/serf.png']).toBe('39c18a302b8750db4195319a8d6790a76ddae0f8c06fd75cb6301c3309019afa');
      expect(h['serf/serf.json']).toBe('b6e439d57028634f81775f862ae65acb2dc8bab0533a5b2302c55586f8f966ab');
      hashes.push(h);
    }
    expect(hashes[0]).toEqual(hashes[1]);
    gravarEvidencia('D-ARTE-DEPURACAO-LEVA-TRES', { hashes: hashes[0], frames: {serf:90,militia:120,woodcutter:120,laborer:120} });
  } finally { rmSync(dir, {recursive:true}); }
});
