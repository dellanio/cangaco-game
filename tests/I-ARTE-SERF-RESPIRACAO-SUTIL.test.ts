// I-ARTE-SERF-RESPIRACAO-SUTIL (aceites 1 e 2) — o parado do serf respira de leve: 4 quadros em laco a 1,5 fps nas
// 5 direcoes, as outras animacoes quadro a quadro iguais as de antes; entre os quadros do parado o topo varia no maximo
// 1 px e da cintura para baixo nada muda; o quadro 0 tem o topo da imagem em pe da direcao, com o pe na mesma linha.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import manifesto from '../assets/manifest.json';

interface Quadro { frame: { x: number; y: number; w: number; h: number } }
interface Atlas { frames: Record<string, Quadro> }
interface Imagem { width: number; height: number; data: Uint8Array }
type Animacoes = Record<string, { quadros: number; fps?: number; laco?: boolean }>;
const DIRECOES: Record<string, string> = { n: 'north', ne: 'north-east', l: 'east', se: 'south-east', s: 'south' };
const unidades = manifesto.assets as unknown as { id: string; tipo: string; animacoes: Animacoes }[];

function ler(pasta: string): { atlas: Atlas; imagem: Imagem } {
  return {
    atlas: JSON.parse(readFileSync(`${pasta}/serf.json`, 'utf8')) as Atlas,
    imagem: decodePng(readFileSync(`${pasta}/serf.png`)),
  };
}
const agora = ler('assets/sprites/units/serf');
const antes = ler('assets/base/units/serf-respiracao-sutil/antes');

function linhas({ atlas, imagem }: { atlas: Atlas; imagem: Imagem }, chave: string): number[][] {
  const q = atlas.frames[chave]!.frame;
  const saida: number[][] = [];
  for (let y = 0; y < q.h; y++) saida.push([...imagem.data.subarray(((q.y + y) * imagem.width + q.x) * 4, ((q.y + y) * imagem.width + q.x + q.w) * 4)]);
  return saida;
}

function topoEPe(img: { width: number; height: number; data: Uint8Array }): [number, number] {
  let topo = -1, pe = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3]! > 40) { if (topo < 0) topo = y; pe = y; break; }
  }
  return [topo, pe];
}

function quadroComoImagem(fonte: { atlas: Atlas; imagem: Imagem }, chave: string): Imagem {
  const ls = linhas(fonte, chave);
  return { width: ls[0]!.length / 4, height: ls.length, data: Uint8Array.from(ls.flat()) };
}

describe('I-ARTE-SERF-RESPIRACAO-SUTIL', () => {
  it('o parado tem 4 quadros em laco a 1,5 fps, e o resto do atlas e o de antes, quadro a quadro', () => {
    const animacoes = unidades.find((a) => a.id === 'serf' && a.tipo === 'unidade')!.animacoes;
    expect(animacoes['parado']).toEqual({ quadros: 4, fps: 1.5, laco: true });
    expect(Object.keys(agora.atlas.frames).sort()).toEqual(Object.keys(antes.atlas.frames).sort());
    for (const chave of Object.keys(antes.atlas.frames)) {
      if (chave.split('/')[1] !== 'parado') expect(linhas(agora, chave), chave).toEqual(linhas(antes, chave));
    }
  });

  for (const [dir, nome] of Object.entries(DIRECOES)) {
    it(`${dir}: o folego mexe so o tronco, no maximo 1 px, e o quadro 0 e o serf em pe`, () => {
      const quadros = [0, 1, 2, 3].map((i) => quadroComoImagem(agora, `serf/parado/${dir}/000${i}`));
      const [topo0, pe0] = topoEPe(quadros[0]!);
      const rotacao = decodePng(readFileSync(`assets/base/units/serf-pixellab-v2/rotacoes/${nome}.png`));
      const [topoRot, peRot] = topoEPe(rotacao);
      // a altura da figura e a da imagem em pe, e o pe fica na linha de antes
      expect(pe0 - topo0).toBe(peRot - topoRot);
      expect(pe0).toBe(topoEPe(quadroComoImagem(antes, `serf/parado/${dir}/0000`))[1]);
      const meio = topo0 + Math.round((pe0 - topo0) / 2);
      let mudou = false;
      for (const q of quadros) {
        expect(Math.abs(topoEPe(q)[0] - topo0)).toBeLessThanOrEqual(1);
        const linhasDoQuadro = Array.from({ length: q.height }, (_, y) => [...q.data.subarray(y * q.width * 4, (y + 1) * q.width * 4)]);
        const linhasDoZero = Array.from({ length: q.height }, (_, y) => [...quadros[0]!.data.subarray(y * q.width * 4, (y + 1) * q.width * 4)]);
        expect(linhasDoQuadro.slice(meio)).toEqual(linhasDoZero.slice(meio));
        if (topoEPe(q)[0] !== topo0) mudou = true;
      }
      expect(mudou, 'algum quadro respira').toBe(true);
    });
  }
});
