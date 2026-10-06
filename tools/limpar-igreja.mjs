import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

const root = new URL('../', import.meta.url);
const read = (name) => decodePng(readFileSync(new URL(`assets/base/church/${name}.png`, root)));
const complete = read('completo-original');
const wood = read('madeira-original');
if (complete.width !== wood.width || complete.height !== wood.height) {
  throw new Error('Os originais precisam compartilhar o mesmo canvas.');
}
// Uma transformação comum, nunca recortes ou escalas independentes por estado.
let left = complete.width, right = -1, top = complete.height, bottom = -1;
for (const image of [complete, wood]) {
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (image.data[(y * image.width + x) * 4 + 3] < 128) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
}
if (right < left) throw new Error('Originais vazios.');
const scale = Math.min(189 / (right - left + 1), 192 / (bottom - top + 1));
const offsetX = (192 - (right - left + 1) * scale) / 2;
const offsetY = 192 - (bottom - top + 1) * scale;

function derive(image, construction) {
  const data = Buffer.alloc(192 * 192 * 4);
  for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
    const sx0 = left + (x - offsetX) / scale, sx1 = sx0 + 1 / scale;
    const sy0 = top + (y - offsetY) / scale, sy1 = sy0 + 1 / scale;
    let alpha = 0, red = 0, green = 0, blue = 0;
    for (let sy = Math.max(0, Math.floor(sy0)); sy < Math.min(image.height, Math.ceil(sy1)); sy++) {
      for (let sx = Math.max(0, Math.floor(sx0)); sx < Math.min(image.width, Math.ceil(sx1)); sx++) {
        const weight = Math.max(0, Math.min(sx1, sx + 1) - Math.max(sx0, sx))
          * Math.max(0, Math.min(sy1, sy + 1) - Math.max(sy0, sy));
        const i = (sy * image.width + sx) * 4;
        // Adro inferior idêntico; madeira contida no alfa da construção pronta.
        const source = construction && sy >= 1190 ? complete : image;
        const a = (construction ? Math.min(source.data[i + 3], complete.data[i + 3]) : source.data[i + 3]) / 255;
        alpha += weight * a;
        red += weight * a * source.data[i];
        green += weight * a * source.data[i + 1];
        blue += weight * a * source.data[i + 2];
      }
    }
    const a = Math.round(alpha * scale * scale * 255);
    if (a < 16) continue; // Remove apenas franjas quase transparentes; RGB externo fica zero.
    const i = (y * 192 + x) * 4;
    data[i] = Math.round(red / alpha); data[i + 1] = Math.round(green / alpha);
    data[i + 2] = Math.round(blue / alpha); data[i + 3] = a;
  }
  return { width: 192, height: 192, data };
}

mkdirSync(new URL('assets/sprites/church/', root), { recursive: true });
for (const [state, image, construction] of [['completo', complete, false], ['madeira', wood, true]]) {
  const result = derive(image, construction);
  writeFileSync(new URL(`assets/sprites/church/${state}.png`, root), encodePng(result));
  let zero = 0;
  for (let i = 3; i < result.data.length; i += 4) if (result.data[i] === 0) zero++;
  console.log(`${state}: 192x192 RGBA; ${zero} pixels alfa 0; base y=191; anchor [0.5,1]`);
}
console.log(JSON.stringify({ originais: [complete.width, complete.height], left, right, top, bottom, scale, offsetX, offsetY }));
process.exitCode = 0;
