/**
 * G-ARTE-SERF-CARGA-PARADA — o serf carrega com as maos paradas no centro do corpo: acima da cintura
 * (64% da altura do corpo, a partir do topo), os 8 quadros da `carregando` de cada direcao sao iguais
 * pixel a pixel. Abaixo, as pernas andam. A medida e de pixel, nao de olho.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { caixaOpaca, lerPng, type Imagem } from './helpers/png';

type Atlas = { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
const lerAtlas = (t: string) => ({ atlas: JSON.parse(readFileSync(`assets/sprites/units/${t}/${t}.json`, 'utf8')) as Atlas, img: lerPng(`assets/sprites/units/${t}/${t}.png`) });
const serf = lerAtlas('serf');
const atlas = serf.atlas; const img = serf.img;
const CORTE = 0.64;

function linhaIgual(im: Imagem, a: { x: number; y: number; w: number }, b: { x: number; y: number }, y: number): boolean {
  for (let x = 0; x < a.w; x++) for (let c = 0; c < 4; c++) {
    if (im.rgba[((a.y + y) * im.largura + a.x + x) * 4 + c] !== im.rgba[((b.y + y) * im.largura + b.x + x) * 4 + c]) return false;
  }
  return true;
}

describe('G-ARTE-SERF-CARGA-PARADA', () => {
  it.each(['n', 'ne', 'l', 'se', 's'])('roceiro (G-TELA-ROCEIRO-NO-CAMPO) %s: acima da cintura, os 8 quadros sao iguais', (d) => {
    const { atlas: a, img: im } = lerAtlas('farmer');
    const q = Array.from({ length: 8 }, (_, i) => a.frames[`farmer/carregando/${d}/${String(i).padStart(4, '0')}`]!.frame);
    const caixa = caixaOpaca(im, q[0]!)!;
    const corte = caixa.y0 + Math.floor((caixa.y1 + 1 - caixa.y0) * CORTE);
    for (let i = 1; i < 8; i++) for (let y = 0; y < corte; y++) expect(linhaIgual(im, q[0]!, q[i]!, y), `${d} quadro ${i} linha ${y}`).toBe(true);
  });

  it.each(['n', 'ne', 'l', 'se', 's'])('%s: acima da cintura, os 8 quadros sao iguais; abaixo, as pernas mudam', (d) => {
    const q = Array.from({ length: 8 }, (_, i) => atlas.frames[`serf/carregando/${d}/${String(i).padStart(4, '0')}`]!.frame);
    const caixa = caixaOpaca(img, q[0]!)!;
    const corte = caixa.y0 + Math.floor((caixa.y1 + 1 - caixa.y0) * CORTE);
    for (let i = 1; i < 8; i++) for (let y = 0; y < corte; y++) expect(linhaIgual(img, q[0]!, q[i]!, y), `${d} quadro ${i} linha ${y}`).toBe(true);
    let pernasMudam = false;
    for (let i = 1; i < 8 && !pernasMudam; i++) for (let y = corte; y < q[0]!.h && !pernasMudam; y++) if (!linhaIgual(img, q[0]!, q[i]!, y)) pernasMudam = true;
    expect(pernasMudam, `${d}: as pernas precisam andar`).toBe(true);
  });

  it('o teste acusa: no `andar` (bracos soltos) o tronco muda entre os quadros', () => {
    const q = Array.from({ length: 8 }, (_, i) => atlas.frames[`serf/andar/l/${String(i).padStart(4, '0')}`]!.frame);
    let mudou = false;
    for (let i = 1; i < 8 && !mudou; i++) for (let y = 0; y < 56 && !mudou; y++) if (!linhaIgual(img, q[0]!, q[i]!, y)) mudou = true;
    expect(mudou).toBe(true);
  });
});
