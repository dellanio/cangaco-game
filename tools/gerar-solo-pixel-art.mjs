#!/usr/bin/env node
// I-ARTE-SOLO-PIXEL-ART (pedido do operador, 2026-10-05: "regere a vegetacao padrao como um solo do
// cangaco nordestino em pixel art"). O chao padrao do mapa (`grama` no manifesto): quatro variantes
// 64x64 que o render sorteia por tile.
//
// Cada variante nasce em 32x32 e e ampliada 2x por vizinho mais proximo. O CHAO DE BASE e o mesmo nas
// quatro: manchas de terra em ruido periodico de 32 (frequencias inteiras) com dither ordenado, entao
// ele emenda em si mesmo e as variantes se encostam em qualquer combinacao no mapa. O que muda de uma
// para outra sao os detalhes, sempre a 3 px ou mais da borda: pedrinhas, rachaduras de terra seca e
// tufos de capim seco. Sem relogio nem acaso: rodar de novo da os mesmos bytes.
//
// Uso: node tools/gerar-solo-pixel-art.mjs     (grava em assets/sprites/terrain/solo-pixel/)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SAIDA = join(RAIZ, 'assets', 'sprites', 'terrain', 'solo-pixel');
export const LADO = 32;
export const ESCALA = 2;
export const VARIANTES = ['padrao', 'v1', 'v2', 'v3'];
/** A margem, em pixels de 32, que os detalhes deixam livre: as bordas sao so o chao de base. */
export const MARGEM = 3;

/** A terra do sertao (os ocres medidos no solo de hoje), a sombra das rachaduras, a pedra e o capim seco. */
export const PALETA = [
  [178, 122, 78], // 0 terra funda
  [196, 142, 94], // 1 terra
  [212, 158, 106], // 2 terra clara
  [228, 176, 122], // 3 terra queimada de sol
  [128, 84, 54], // 4 rachadura / sombra
  [170, 160, 140], // 5 pedra
  [214, 206, 182], // 6 luz da pedra
  [168, 150, 72], // 7 capim seco
  [206, 186, 96], // 8 ponta do capim
];

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** As manchas do chao: frequencias inteiras no periodo (emenda), fracas, para nao formar faixa. */
const MANCHAS = [
  { fx: 1, fy: 0, a: 0.22, f: 0.3 },
  { fx: 0, fy: 1, a: 0.22, f: 1.7 },
  { fx: 2, fy: 3, a: 0.14, f: 4.1 },
  { fx: 3, fy: -2, a: 0.12, f: 2.2 },
];

/** Um numero de 0 a 1 por pixel e semente (hash inteiro, sem acaso): o grao da terra. */
function grao(x, y, semente) {
  let h = Math.imul(x + 31 * semente, 374761393) ^ Math.imul(y + 17 * semente, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** O peso do miolo: 0 na borda (o chao de base, igual nas quatro), 1 a partir de MARGEM + 2 px. */
function pesoDoMiolo(x, y) {
  const d = Math.min(x, y, LADO - 1 - x, LADO - 1 - y);
  return Math.max(0, Math.min(1, (d - 1) / (MARGEM + 1)));
}

/** As manchas proprias do miolo de cada variante (somem na borda). */
const MIOLO = {
  padrao: [{ cx: 12, cy: 18, r: 7, a: -0.35 }, { cx: 22, cy: 9, r: 6, a: 0.3 }],
  v1: [{ cx: 20, cy: 20, r: 8, a: 0.32 }, { cx: 9, cy: 10, r: 5, a: -0.3 }],
  v2: [{ cx: 15, cy: 14, r: 9, a: -0.25 }, { cx: 25, cy: 25, r: 4, a: 0.3 }],
  v3: [{ cx: 10, cy: 21, r: 6, a: 0.35 }, { cx: 21, cy: 12, r: 7, a: -0.3 }],
};

/** O chao no pixel (x, y) da variante: 0..3. Na borda e so a base, igual nas quatro. */
function chao(x, y, nome, semente) {
  let h = 0;
  for (const m of MANCHAS) h += m.a * Math.sin((2 * Math.PI * (m.fx * x + m.fy * y)) / LADO + m.f);
  // o grao periodico da base (a semente 0 e a mesma nas quatro variantes)
  h += (grao(x, y, 0) - 0.5) * 0.35;
  const peso = pesoDoMiolo(x, y);
  if (peso > 0) {
    for (const c of MIOLO[nome]) {
      const d2 = (x - c.cx) ** 2 + (y - c.cy) ** 2;
      h += peso * c.a * Math.exp(-d2 / (c.r * c.r));
    }
    h += peso * (grao(x, y, semente) - 0.5) * 0.25;
  }
  const t = (h / 0.9 + 1) / 2;
  const limiar = (BAYER4[y % 4][x % 4] + 0.5) / 16;
  return Math.max(0, Math.min(3, Math.floor(t * 3 + limiar - 0.1)));
}

/** Os detalhes de cada variante, em coordenadas de 32: [x, y, indice da paleta]. */
const PEDRA = (x, y) => [[x, y, 5], [x + 1, y, 6], [x, y + 1, 4], [x + 1, y + 1, 5]];
const PEDRINHA = (x, y) => [[x, y, 6], [x, y + 1, 4]];
const RACHA = (x, y, passos) => passos.map(([dx, dy]) => [x + dx, y + dy, 4]);
const TUFO = (x, y) => [[x, y + 2, 7], [x - 1, y + 1, 7], [x + 1, y + 1, 7], [x, y + 1, 7], [x - 1, y, 8], [x + 1, y, 8], [x, y - 1, 8]];

const DETALHES = {
  padrao: [...PEDRINHA(8, 9), ...TUFO(22, 20), ...PEDRINHA(25, 7), ...PEDRINHA(11, 25)],
  v1: [...PEDRA(18, 10), ...PEDRINHA(7, 22), ...RACHA(9, 6, [[0, 0], [1, 1], [2, 1], [3, 2], [3, 3], [4, 4]]), ...PEDRINHA(26, 26)],
  v2: [...TUFO(9, 12), ...TUFO(23, 24), ...PEDRINHA(20, 6), ...PEDRINHA(6, 26)],
  v3: [...RACHA(17, 18, [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [2, 2], [2, 3]]), ...PEDRA(7, 7), ...PEDRINHA(25, 12), ...TUFO(10, 25)],
};

/** A variante em indices da paleta, 32x32. */
function indices(nome) {
  const m = [];
  for (let y = 0; y < LADO; y++) {
    const linha = [];
    for (let x = 0; x < LADO; x++) linha.push(chao(x, y, nome, VARIANTES.indexOf(nome) + 1));
    m.push(linha);
  }
  for (const [x, y, cor] of DETALHES[nome]) {
    if (x < MARGEM || y < MARGEM || x >= LADO - MARGEM || y >= LADO - MARGEM) {
      throw new Error(`solo-pixel: detalhe de ${nome} em (${x},${y}) cai na margem`);
    }
    m[y][x] = cor;
  }
  return m;
}

/** Uma variante 64x64 RGBA. */
export function variante(nome) {
  const lado = LADO * ESCALA;
  const data = new Uint8Array(lado * lado * 4);
  const m = indices(nome);
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
  return VARIANTES.map((nome) => ({ nome, png: encodePng(variante(nome)) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(SAIDA, { recursive: true });
  for (const { nome, png } of gerar()) {
    writeFileSync(join(SAIDA, `solo-${nome}.png`), png);
    console.log(`solo-pixel: ${nome} escrito`);
  }
}
