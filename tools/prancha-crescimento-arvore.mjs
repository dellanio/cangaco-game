import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const [raiz, saida] = process.argv.slice(2);
mkdirSync(saida, { recursive: true });
const m = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
const ids = ['muda', 'crescendo_1', 'crescendo_2', 'adulta'];
const sprites = ids.map(id => decodePng(readFileSync(id === 'adulta'
  ? `assets/${m.assets.find(a => a.id === 'tree' && a.tipo === 'vegetacao').estados.presente}`
  : join(raiz, `tree-${id}-20261012.png`))));
const solos = ['grama', 'areia', 'rocha'].map(id => decodePng(readFileSync(
  `assets/${m.assets.find(a => a.id === id && a.tipo === 'terreno').estados.padrao}`)));
// Amostra bilinear com alfa pré-multiplicado: RGB invisível não cria franjas.
function amostra(p, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const rgba = [0, 0, 0, 0];
  for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
    const sx = Math.max(0, Math.min(p.width - 1, x0 + dx));
    const sy = Math.max(0, Math.min(p.height - 1, y0 + dy));
    const i = (sy * p.width + sx) * 4;
    const peso = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy);
    const alfa = p.data[i + 3] / 255;
    for (let k = 0; k < 3; k++) rgba[k] += p.data[i + k] * alfa * peso;
    rgba[3] += alfa * peso;
  }
  return rgba;
}
for (const zoom of [0.5, 1, 2]) {
  const w = Math.ceil(208 * zoom), h = Math.ceil(272 * zoom);
  const p = { width: w * 4, height: h * 6, data: Buffer.alloc(w * 4 * h * 6 * 4) };
  for (let solo = 0; solo < 3; solo++) for (let luz = 0; luz < 2; luz++) {
    for (let s = 0; s < sprites.length; s++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = x / zoom, gy = y / zoom;
      const chao = amostra(solos[solo], gx % solos[solo].width, gy % solos[solo].height);
      const sx = gx - 8, sy = gy - 8;
      const img = sprites[s];
      const tinta = sx >= 0 && sy >= 0 && sx < img.width && sy < img.height
        ? amostra(img, sx, sy) : [0, 0, 0, 0];
      const i = (((solo * 2 + luz) * h + y) * p.width + s * w + x) * 4;
      for (let k = 0; k < 3; k++) p.data[i + k] = Math.round((tinta[k] + chao[k] * (1 - tinta[3])) * (luz ? 0.8 : 1));
      p.data[i + 3] = 255;
    }
  }
  writeFileSync(join(saida, `arvore-crescimento-zoom-${zoom}.png`), encodePng(p));
}
writeFileSync(join(saida, 'legenda.json'), JSON.stringify({
  colunas: ids, linhas: ['grama normal', 'grama RGBx0.8', 'areia normal', 'areia RGBx0.8', 'rocha normal', 'rocha RGBx0.8'],
  amostragem: 'bilinear com alfa premultiplicado',
}, null, 2));
