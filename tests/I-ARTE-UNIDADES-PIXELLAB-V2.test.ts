// I-ARTE-UNIDADES-PIXELLAB-V2 (aceites 1 e 2) — obreiro, lenhador, cabra e lavrador no padrao do serf novo: o parado com
// 4 quadros em laco, o andar 8 e o morrer 12 nas 5 direcoes, as outras animacoes de antes com as mesmas contagens,
// quadros 64x96, e o pe do parado de frente no mesmo lugar do atlas de antes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import manifesto from '../assets/manifest.json';

interface Quadro { frame: { x: number; y: number; w: number; h: number } }
interface Atlas { frames: Record<string, Quadro> }
type Animacoes = Record<string, { quadros: number; laco?: boolean }>;
const UNIDADES = ['laborer', 'woodcutter', 'militia', 'farmer'];
const DIRECOES = ['n', 'ne', 'l', 'se', 's'];
const unidades = manifesto.assets as unknown as { id: string; tipo: string; animacoes: Animacoes }[];

function ler(pasta: string, id: string) {
  return {
    atlas: JSON.parse(readFileSync(`${pasta}/${id}.json`, 'utf8')) as Atlas,
    imagem: decodePng(readFileSync(`${pasta}/${id}.png`)),
  };
}

function linhaDoPe(atlas: Atlas, imagem: { width: number; data: Uint8Array }, chave: string): number {
  const q = atlas.frames[chave]!;
  for (let y = q.frame.h - 1; y >= 0; y--) for (let x = 0; x < q.frame.w; x++) {
    if (imagem.data[((q.frame.y + y) * imagem.width + q.frame.x + x) * 4 + 3]! > 40) return y;
  }
  return -1;
}

function contagens(atlas: Atlas): Record<string, number> {
  const c: Record<string, number> = {};
  for (const k of Object.keys(atlas.frames)) if (k.split('/')[2] === 's') c[k.split('/')[1]!] = (c[k.split('/')[1]!] ?? 0) + 1;
  return c;
}

describe('I-ARTE-UNIDADES-PIXELLAB-V2', () => {
  for (const id of UNIDADES) {
    const agora = ler(`assets/sprites/units/${id}`, id);
    const antes = ler(`assets/base/units/${id}-pixellab-v2/antes`, id);
    const animacoes = unidades.find((a) => a.id === id && a.tipo === 'unidade')!.animacoes;

    it(`${id}: parado 4 em laco, andar 8, morrer 12, e as outras como antes`, () => {
      expect(animacoes['parado']).toMatchObject({ quadros: 4, laco: true });
      expect(animacoes['andar']).toMatchObject({ quadros: 8 });
      expect(animacoes['morrer']).toMatchObject({ quadros: 12, laco: false });
      const deAntes = contagens(antes.atlas);
      for (const [anim, n] of Object.entries(contagens(agora.atlas))) {
        if (!['parado', 'andar', 'morrer'].includes(anim)) expect(n, anim).toBe(deAntes[anim]);
      }
      expect(Object.keys(contagens(agora.atlas)).sort()).toEqual(Object.keys(deAntes).sort());
      for (const [anim, a] of Object.entries(animacoes)) for (const dir of DIRECOES) for (let i = 0; i < a.quadros; i++) {
        const q = agora.atlas.frames[`${id}/${anim}/${dir}/${String(i).padStart(4, '0')}`];
        expect(q, `${anim}/${dir}/${i}`).toBeDefined();
        expect([q!.frame.w, q!.frame.h]).toEqual([64, 96]);
      }
    });

    it(`${id}: o pe do parado de frente no mesmo lugar de antes`, () => {
      const chave = `${id}/parado/s/0000`;
      expect(Math.abs(linhaDoPe(agora.atlas, agora.imagem, chave) - linhaDoPe(antes.atlas, antes.imagem, chave))).toBeLessThanOrEqual(2);
    });
  }
});
