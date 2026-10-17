// I-ARTE-SERF-RESPIRACAO-SUTIL — o parado que respira de leve, sem geracao: os 4 quadros saem da imagem em pe da direcao
// (as rotacoes do personagem do PixelLab), com o pe na linha do atlas de hoje. Quadros 0 e 3 a imagem como esta; 1 e 2
// com tudo acima da cintura subindo 1 px (a linha da cintura se repete; quadril e pernas nao mexem).
// Uso: node tools/respiracao-sutil.mjs <tipo> <pasta-das-rotacoes> [cintura]
// cintura: a fracao da altura da figura, a partir do topo da cabeca, onde o tronco para de subir (padrao 0,5).
// Reescreve so os quadros <tipo>/parado/* do atlas em assets/sprites/units/<tipo>/ e o parado.png.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const DIRECOES = { n: 'north', ne: 'north-east', l: 'east', se: 'south-east', s: 'south' };
const [tipo, pasta, cinturaTexto = '0.5'] = process.argv.slice(2);
const cintura = Number(cinturaTexto);
const destino = `assets/sprites/units/${tipo}`;
const atlas = JSON.parse(readFileSync(join(destino, `${tipo}.json`), 'utf8'));
const imagem = decodePng(readFileSync(join(destino, `${tipo}.png`)));

function linhasComAlfa(img) {
  let topo = -1, pe = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] > 40) { if (topo < 0) topo = y; pe = y; break; }
  }
  return { topo, pe };
}

/** a rotacao no quadro L x A, centrada em x, com o pe na linha `linhaDoPe` */
function noQuadro(rot, L, A, linhaDoPe) {
  const out = { width: L, height: A, data: new Uint8Array(L * A * 4) };
  const dy = linhaDoPe - linhasComAlfa(rot).pe, dx = Math.round((L - rot.width) / 2);
  for (let y = 0; y < rot.height; y++) for (let x = 0; x < rot.width; x++) {
    const ty = y + dy, tx = x + dx;
    if (ty < 0 || ty >= A || tx < 0 || tx >= L) continue;
    const i = (y * rot.width + x) * 4;
    out.data.set(rot.data.subarray(i, i + 4), (ty * L + tx) * 4);
  }
  return out;
}

/** o fôlego: as linhas acima de `corte` sobem 1 px; a linha `corte - 1` fica e, com isso, se repete */
function inspirar(img, corte) {
  const out = { width: img.width, height: img.height, data: Uint8Array.from(img.data) };
  const linha = img.width * 4;
  for (let y = 0; y < corte - 1; y++) out.data.set(img.data.subarray((y + 1) * linha, (y + 2) * linha), y * linha);
  return out;
}

for (const [dir, nome] of Object.entries(DIRECOES)) {
  const q0 = atlas.frames[`${tipo}/parado/${dir}/0000`].frame;
  const recorte = { width: q0.w, height: q0.h, data: new Uint8Array(q0.w * q0.h * 4) };
  for (let r = 0; r < q0.h; r++) recorte.data.set(imagem.data.subarray(((q0.y + r) * imagem.width + q0.x) * 4, ((q0.y + r) * imagem.width + q0.x + q0.w) * 4), r * q0.w * 4);
  const base = noQuadro(decodePng(readFileSync(join(pasta, `${nome}.png`))), q0.w, q0.h, linhasComAlfa(recorte).pe);
  const { topo, pe } = linhasComAlfa(base);
  const corte = topo + Math.round((pe - topo) * cintura);
  const cheio = inspirar(base, corte);
  [base, cheio, cheio, base].forEach((img, i) => {
    const { x, y, w, h } = atlas.frames[`${tipo}/parado/${dir}/${String(i).padStart(4, '0')}`].frame;
    for (let r = 0; r < h; r++) imagem.data.set(img.data.subarray(r * w * 4, (r + 1) * w * 4), ((y + r) * imagem.width + x) * 4);
  });
  if (dir === 's') writeFileSync(join(destino, 'parado.png'), encodePng(base));
  console.log(`${tipo} ${dir}: topo ${topo}, pe ${pe}, cintura na linha ${corte}`);
}
writeFileSync(join(destino, `${tipo}.png`), encodePng(imagem));
