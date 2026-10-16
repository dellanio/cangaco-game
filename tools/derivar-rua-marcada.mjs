// I-TELA-RUA-MARCADA-CORDEL — o tile de rua marcada como o lote do predio: quatro estacas e o cordel, so que cinza,
// tudo dentro dos 64x64 do tile; o chao aparece por baixo. Os estagios seguintes (pedras, obra-1, obra-2) passam a
// assentar sobre essa marcacao. Fontes: as pecas do canteiro (sprites/ui/canteiro), as pedras separadas do tile antigo
// sobre o cinza (base/road/rua-em-obra/cinza-2026-10-16) e os estagios sem fundo do Codex (obra-N-sem-cinza.png).
import { readFileSync, writeFileSync } from 'node:fs';
import console from 'node:console';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const LADO = 64;
/** A linha do cordel: o retangulo dentro do tile; o topo desce para a estaca de cima caber inteira. */
const CORDEL = { x0: 5, x1: 58, y0: 15, y1: 58 };
/** A estaca do canteiro (24x40) reduzida por 3, com a base no canto do cordel. */
const REDUCAO_DA_ESTACA = 3;
/** O cinza do cordel: luminancia do cordel original, clareada para ler sobre a terra. */
const CINZA = { ganho: 0.7, base: 70 };
/** Diferenca de cor (soma dos canais) que separa a pedra do cinza no tile antigo. */
const LIMIAR_DA_PEDRA = 24;
/** O granulado do cinza e neutro; a pedra e bege: a croma (max - min dos canais) separa os dois. */
const CROMA_DA_PEDRA = 14;

const ler = (f) => decodePng(readFileSync(f));
const novo = () => ({ width: LADO, height: LADO, data: new Uint8Array(LADO * LADO * 4) });
function sobrepor(dst, x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= LADO || y >= LADO || a === 0) return;
  const i = (y * LADO + x) * 4, fa = a / 255, da = dst.data[i + 3] / 255, oa = fa + da * (1 - fa);
  for (const [k, v] of [[0, r], [1, g], [2, b]]) dst.data[i + k] = Math.round((v * fa + dst.data[i + k] * da * (1 - fa)) / oa);
  dst.data[i + 3] = Math.round(oa * 255);
}
function colar(dst, src) {
  for (let i = 0; i < LADO * LADO; i++) {
    const j = i * 4;
    sobrepor(dst, i % LADO, Math.floor(i / LADO), src.data[j], src.data[j + 1], src.data[j + 2], src.data[j + 3]);
  }
}

function marcado() {
  const img = novo();
  const h = ler('assets/sprites/ui/canteiro/cordel-h.png');
  const v = ler('assets/sprites/ui/canteiro/cordel-v.png');
  const cinza = (d, i) => {
    const l = Math.min(255, Math.round((0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) * CINZA.ganho + CINZA.base));
    return [l, l, Math.min(255, l + 4)];
  };
  const meioH = Math.floor(h.height / 2), meioV = Math.floor(v.width / 2);
  for (const y of [CORDEL.y0, CORDEL.y1]) for (let x = CORDEL.x0; x <= CORDEL.x1; x++) for (let k = 0; k < h.height; k++) {
    const i = (k * h.width + (x % h.width)) * 4;
    sobrepor(img, x, y + k - meioH, ...cinza(h.data, i), h.data[i + 3]);
  }
  for (const x of [CORDEL.x0, CORDEL.x1]) for (let y = CORDEL.y0; y <= CORDEL.y1; y++) for (let k = 0; k < v.width; k++) {
    const i = ((y % v.height) * v.width + k) * 4;
    sobrepor(img, x + k - meioV, y, ...cinza(v.data, i), v.data[i + 3]);
  }
  const e = ler('assets/sprites/ui/canteiro/estaca.png'), r = REDUCAO_DA_ESTACA;
  const ew = Math.floor(e.width / r), eh = Math.floor(e.height / r);
  for (const [cx, cy] of [[CORDEL.x0, CORDEL.y0], [CORDEL.x1, CORDEL.y0], [CORDEL.x0, CORDEL.y1], [CORDEL.x1, CORDEL.y1]]) {
    for (let y = 0; y < eh; y++) for (let x = 0; x < ew; x++) {
      let s = [0, 0, 0, 0];
      for (let dy = 0; dy < r; dy++) for (let dx = 0; dx < r; dx++) {
        const i = ((y * r + dy) * e.width + x * r + dx) * 4, a = e.data[i + 3];
        s = [s[0] + e.data[i] * a, s[1] + e.data[i + 1] * a, s[2] + e.data[i + 2] * a, s[3] + a];
      }
      if (s[3] === 0) continue;
      sobrepor(img, cx - Math.floor(ew / 2) + x, cy - eh + 1 + y + 2, s[0] / s[3], s[1] / s[3], s[2] / s[3], Math.round(s[3] / (r * r)));
    }
  }
  return img;
}

function pedrasSemCinza() {
  const antes = ler('assets/base/road/rua-em-obra/cinza-2026-10-16/marcado-cinza.png');
  const com = ler('assets/base/road/rua-em-obra/cinza-2026-10-16/pedras-sobre-cinza.png');
  // a diferenca pega tambem o granulado do cinza que veio junto das pedras; fica so o maior bloco ligado (o monte)
  const mascara = new Uint8Array(LADO * LADO);
  for (let p = 0; p < LADO * LADO; p++) {
    const i = p * 4;
    const d = Math.abs(com.data[i] - antes.data[i]) + Math.abs(com.data[i + 1] - antes.data[i + 1]) + Math.abs(com.data[i + 2] - antes.data[i + 2]);
    const c = Math.max(com.data[i], com.data[i + 1], com.data[i + 2]) - Math.min(com.data[i], com.data[i + 1], com.data[i + 2]);
    if (d > LIMIAR_DA_PEDRA && c > CROMA_DA_PEDRA) mascara[p] = 1;
  }
  // fecha o monte: um pixel cercado de pedra em 3 dos 4 lados e pedra (a face cinza da pedra e a sombra entre elas)
  for (let passo = 0; passo < 3; passo++) {
    const antesDoPasso = mascara.slice();
    for (let y = 1; y < LADO - 1; y++) for (let x = 1; x < LADO - 1; x++) {
      const p = y * LADO + x;
      if (antesDoPasso[p]) continue;
      const vizinhos = antesDoPasso[p - 1] + antesDoPasso[p + 1] + antesDoPasso[p - LADO] + antesDoPasso[p + LADO];
      if (vizinhos >= 3) mascara[p] = 1;
    }
  }
  const rotulo = new Int32Array(LADO * LADO).fill(-1);
  let maior = [];
  for (let p = 0; p < LADO * LADO; p++) {
    if (!mascara[p] || rotulo[p] >= 0) continue;
    const bloco = [p], fila = [p];
    rotulo[p] = p;
    while (fila.length > 0) {
      const q = fila.pop(), x = q % LADO, y = Math.floor(q / LADO);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        const n = ny * LADO + nx;
        if (nx < 0 || ny < 0 || nx >= LADO || ny >= LADO || !mascara[n] || rotulo[n] >= 0) continue;
        rotulo[n] = p; bloco.push(n); fila.push(n);
      }
    }
    if (bloco.length > maior.length) maior = bloco;
  }
  const img = novo();
  for (const p of maior) img.data.set([com.data[p * 4], com.data[p * 4 + 1], com.data[p * 4 + 2], 255], p * 4);
  return img;
}

/**
 * I-ARTE-RUA-DE-PEDRA-ANTIGA: os estagios de obra do Codex copiaram o calcado do road-m0 de barro pixel a pixel nas
 * partes ja assentadas. Onde o pixel e o do road-m0 antigo, entra o do road-m0 novo: a obra termina na rua de pedra.
 */
function comACalcadaNova(obra) {
  const antiga = ler('assets/base/road-tiles/barro-2026-09-26/road-m0.png');
  const nova = ler('assets/sprites/road/road-m0.png');
  const img = novo();
  img.data.set(obra.data);
  let trocados = 0;
  for (let i = 0; i < LADO * LADO * 4; i += 4) {
    if (obra.data[i + 3] === 0) continue;
    const igual = [0, 1, 2, 3].every((k) => obra.data[i + k] === antiga.data[i + k]);
    if (!igual) continue;
    img.data.set(nova.data.subarray(i, i + 4), i);
    trocados++;
  }
  console.log(`calcada nova: ${trocados} pixels`);
  return img;
}

const base = marcado();
const estagios = {
  marcado: base,
  pedras: pedrasSemCinza(),
  'obra-1': comACalcadaNova(ler('assets/base/road/rua-em-obra/obra-1-sem-cinza.png')),
  'obra-2': comACalcadaNova(ler('assets/base/road/rua-em-obra/obra-2-sem-cinza.png')),
};
for (const [estado, camada] of Object.entries(estagios)) {
  const img = novo();
  colar(img, base);
  if (estado !== 'marcado') colar(img, camada);
  writeFileSync(`assets/sprites/road/rua-em-obra-${estado}.png`, encodePng(img));
  console.log(`rua-em-obra-${estado}.png`);
}
