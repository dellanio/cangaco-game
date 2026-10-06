#!/usr/bin/env node
// I-ARTE-AGUA-PIXEL-ART (pedido do operador, 2026-10-05: "mude o sprite da agua e suas animacoes para
// pixel art para eu ver como fica"). Gera o MIOLO da agua em pixel art: quatro quadros 64x64 que o
// render alterna como variantes (`data/agua.json`, `src/render/agua-viva.ts`).
//
// Cada quadro nasce em 32x32, com a paleta abaixo e dither ordenado, e e ampliado 2x por vizinho mais
// proximo (blocos 2x2 iguais). O campo de ondas e soma de senos de frequencia INTEIRA no periodo 32,
// entao o tile emenda nas quatro bordas. O corpo e o mesmo nos quatro quadros (tiles vizinhos em quadros
// diferentes casam na borda); as cristas mudam de estagio, e a troca de variante vira o cintilar. Sem relogio nem acaso:
// rodar de novo da os mesmos bytes.
//
// Uso: node tools/gerar-agua-pixel-art.mjs           (grava em assets/sprites/terrain/agua-pixel/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SAIDA = join(RAIZ, 'assets', 'sprites', 'terrain', 'agua-pixel');
export const LADO = 32;
export const ESCALA = 2;
export const QUADROS = ['padrao', 'v1', 'v2', 'v3'];

/** Do fundo para o brilho: os azuis da agua de hoje (medidos no PNG), mais a espuma. */
export const PALETA = [
  [6, 62, 89],
  [11, 76, 106],
  [21, 93, 125],
  [44, 121, 152],
  [96, 164, 186],
  [196, 228, 232],
];

/** O corpo: uma onda larga, de frequencia inteira no periodo (emenda). PARADO entre os quadros: o
 *  render poe tiles vizinhos em quadros diferentes (a fase por tile, `agua-viva.ts`), e um corpo
 *  andando nao casaria na borda entre eles (medido na primeira captura). Quem anima sao as cristas. */
const CORPO = [
  { fx: 1, fy: 1, a: 0.6 },
  { fx: 1, fy: -2, a: 0.4 },
];

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/**
 * As cristas: o brilho da agua em traco, como na pixel art classica. Cada uma tem a posicao (no
 * quadro de 32) e a fase; no quadro k ela esta no estagio (k + fase) mod 4: ponto, traco, arco,
 * desfazendo. Fases diferentes fazem a agua cintilar sem piscar inteira.
 */
const CRISTAS = [
  { x: 3, y: 4, fase: 0 }, { x: 19, y: 2, fase: 2 }, { x: 11, y: 11, fase: 1 },
  { x: 26, y: 13, fase: 3 }, { x: 5, y: 20, fase: 2 }, { x: 18, y: 22, fase: 0 },
  { x: 28, y: 27, fase: 1 }, { x: 10, y: 28, fase: 3 },
];

/** O desenho de cada estagio: [dx, dy, indice da paleta]. */
const ESTAGIOS = [
  [[0, 0, 4]],
  [[-1, 0, 4], [0, 0, 5], [1, 0, 4]],
  [[-1, 0, 5], [0, 0, 5], [1, 0, 5], [-2, 1, 4], [2, 1, 4]],
  [[-2, 1, 3], [2, 1, 3]],
];

/** O indice da paleta do corpo no pixel (x, y): 0..2, com dither. */
function corpo(x, y) {
  let h = 0;
  for (const o of CORPO) h += o.a * Math.sin((2 * Math.PI * (o.fx * x + o.fy * y)) / LADO);
  const t = (h / 1.0 + 1) / 2; // ~0..1
  const limiar = (BAYER4[y % 4][x % 4] + 0.5) / 16;
  return Math.max(0, Math.min(2, Math.floor(t * 2 + limiar)));
}

/** O quadro k em indices da paleta, 32x32. */
function indices(k) {
  const m = [];
  for (let y = 0; y < LADO; y++) {
    const linha = [];
    for (let x = 0; x < LADO; x++) linha.push(corpo(x, y) + 1);
    m.push(linha);
  }
  for (const c of CRISTAS) {
    for (const [dx, dy, cor] of ESTAGIOS[(k + c.fase) % 4]) {
      m[(c.y + dy + LADO) % LADO][(c.x + dx + LADO) % LADO] = cor;
    }
  }
  return m;
}

/** Um quadro 64x64 RGBA. */
export function quadro(k) {
  const lado = LADO * ESCALA;
  const data = new Uint8Array(lado * lado * 4);
  const m = indices(k);
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const [r, g, b] = PALETA[m[y][x]];
      for (let dy = 0; dy < ESCALA; dy++) {
        for (let dx = 0; dx < ESCALA; dx++) {
          const i = ((y * ESCALA + dy) * lado + (x * ESCALA + dx)) * 4;
          data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
        }
      }
    }
  }
  return { width: lado, height: lado, data };
}

export function gerar() {
  return QUADROS.map((nome, k) => ({ nome, png: encodePng(quadro(k)) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(SAIDA, { recursive: true });
  for (const { nome, png } of gerar()) {
    writeFileSync(join(SAIDA, `agua-${nome}.png`), png);
    console.log(`agua-pixel: ${nome} escrito`);
  }
}
