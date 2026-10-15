import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const saida = process.argv[2];
mkdirSync(saida, { recursive: true });
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
const dados = JSON.parse(readFileSync('data/corn-crescimento-arte.json', 'utf8'));
const visual = JSON.parse(readFileSync('data/culturas-visual.json', 'utf8'));
const corn = manifesto.assets.find(a => a.id === 'corn' && a.tipo === 'recurso');
const estados = ['semeado', 'muda', 'verde', 'pronto'];
const sprites = estados.map(e => decodePng(readFileSync(`assets/${corn.estados[e === 'pronto' ? 'presente' : e]}`)));
const solos = ['grama', 'areia', 'rocha'].map(id => decodePng(readFileSync(`assets/${manifesto.assets.find(a => a.id === id && a.tipo === 'terreno').estados.padrao}`)));
function amostra(p, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, rgba = [0, 0, 0, 0];
  for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const sx = Math.max(0, Math.min(p.width - 1, x0 + dx)), sy = Math.max(0, Math.min(p.height - 1, y0 + dy));
    const i = (sy * p.width + sx) * 4, peso = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy), alfa = p.data[i + 3] / 255;
    for (let k = 0; k < 3; k++) rgba[k] += p.data[i + k] * alfa * peso;
    rgba[3] += alfa * peso;
  }
  return rgba;
}
const cellW = corn.tamanho[0] * visual.escalaMadura.corn.altura;
const cellH = corn.tamanho[1] * visual.escalaMadura.corn.altura + dados.margemLateral * 2;
for (const zoom of dados.zooms) {
  const w = Math.ceil(cellW * zoom), h = Math.ceil(cellH * zoom);
  const p = { width: w * estados.length, height: h * solos.length * dados.tintas.length,
    data: Buffer.alloc(w * estados.length * h * solos.length * dados.tintas.length * 4) };
  for (let solo = 0; solo < solos.length; solo++) for (let luz = 0; luz < dados.tintas.length; luz++) {
    for (let s = 0; s < sprites.length; s++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x / zoom, gy = y / zoom;
      const chao = amostra(solos[solo], gx % solos[solo].width, gy % solos[solo].height);
      const img = sprites[s], escalaY = s === sprites.length - 1 ? visual.escalaMadura.corn.altura : 1;
      const sx = gx - (cellW - img.width) / 2;
      const sy = (gy - (cellH - dados.margemLateral - img.height * escalaY)) / escalaY;
      const tinta = sx >= 0 && sy >= 0 && sx < img.width && sy < img.height ? amostra(img, sx, sy) : [0, 0, 0, 0];
      const i = (((solo * dados.tintas.length + luz) * h + y) * p.width + s * w + x) * 4;
      for (let k = 0; k < 3; k++) p.data[i + k] = Math.round((tinta[k] + chao[k] * (1 - tinta[3])) * dados.tintas[luz]);
      p.data[i + 3] = 255;
    }
  }
  writeFileSync(join(saida, `milho-crescimento-zoom-${zoom}.png`), encodePng(p));
}
writeFileSync(join(saida, 'legenda.json'), JSON.stringify({ colunas: estados,
  linhas: ['grama normal', 'grama RGBx0.8', 'areia normal', 'areia RGBx0.8', 'rocha normal', 'rocha RGBx0.8'],
  madura: 'mesmo PNG anterior, com escala vertical1.5 do render', amostragem: 'bilinear com alfa premultiplicado' }, null, 2));
