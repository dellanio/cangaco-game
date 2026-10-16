// I-ARTE-SERF-PIXELLAB-V2 (aceites 1 e 2) — o atlas do serf novo tem as 4 animacoes nas 5 direcoes, com as contagens do
// manifesto, quadros 64x96 e o pe na mesma linha em todos; o parado tem 4 quadros em laco.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import manifesto from '../assets/manifest.json';

interface Quadro { frame: { x: number; y: number; w: number; h: number } }
const atlas = JSON.parse(readFileSync('assets/sprites/units/serf/serf.json', 'utf8')) as { frames: Record<string, Quadro> };
const imagem = decodePng(readFileSync('assets/sprites/units/serf/serf.png'));
const serf = (manifesto.assets as unknown as { id: string; tipo: string; animacoes: Record<string, { quadros: number; laco?: boolean }> }[])
  .find((a) => a.id === 'serf' && a.tipo === 'unidade')!;
const DIRECOES = ['n', 'ne', 'l', 'se', 's'];

function linhaDoPe(q: Quadro): number {
  for (let y = q.frame.h - 1; y >= 0; y--) for (let x = 0; x < q.frame.w; x++) {
    if (imagem.data[((q.frame.y + y) * imagem.width + q.frame.x + x) * 4 + 3]! > 40) return y;
  }
  return -1;
}

describe('I-ARTE-SERF-PIXELLAB-V2', () => {
  it('cada animacao do manifesto tem os quadros nas 5 direcoes, em 64x96', () => {
    expect(serf.animacoes['parado']).toMatchObject({ quadros: 4, laco: true });
    expect(serf.animacoes['morrer']).toMatchObject({ quadros: 12, laco: false });
    for (const [anim, a] of Object.entries(serf.animacoes)) for (const dir of DIRECOES) for (let i = 0; i < a.quadros; i++) {
      const q = atlas.frames[`serf/${anim}/${dir}/${String(i).padStart(4, '0')}`];
      expect(q, `${anim}/${dir}/${i}`).toBeDefined();
      expect([q!.frame.w, q!.frame.h]).toEqual([64, 96]);
    }
  });

  it('o pe fica na mesma linha no parado, no andar e no carregando', () => {
    const linhas = new Set<number>();
    for (const anim of ['parado', 'andar', 'carregando']) for (const dir of DIRECOES) {
      linhas.add(linhaDoPe(atlas.frames[`serf/${anim}/${dir}/0000`]!));
    }
    expect(Math.max(...linhas) - Math.min(...linhas)).toBeLessThanOrEqual(2);
  });
});
