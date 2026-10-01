import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodePng } from './png-rgba.mjs';

const ZOOMS = [0.5, 1, 2];
const GROUNDS = ['grama', 'areia', 'rocha'];

function sample(image, x, y) {
  const x0 = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const x1 = Math.min(image.width - 1, x0 + 1), y1 = Math.min(image.height - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0)), fy = Math.max(0, Math.min(1, y - y0));
  const at = (xx, yy, c) => image.data[(yy * image.width + xx) * 4 + c];
  return [0, 1, 2, 3].map((c) =>
    at(x0, y0, c) * (1 - fx) * (1 - fy) + at(x1, y0, c) * fx * (1 - fy) +
    at(x0, y1, c) * (1 - fx) * fy + at(x1, y1, c) * fx * fy);
}

function blend(canvas, width, x, y, rgba) {
  const i = (y * width + x) * 4, a = rgba[3] / 255;
  for (let c = 0; c < 3; c++) canvas[i + c] = Math.round(rgba[c] * a + canvas[i + c] * (1 - a));
  canvas[i + 3] = 255;
}

export function renderContactSheets(frames, terrains, outputDir) {
  if (frames.length === 0) return [];
  for (const id of GROUNDS) if (!terrains[id]) throw new Error(`Terreno real ausente: ${id}`);
  mkdirSync(outputDir, { recursive: true });
  const files = [];
  for (const zoom of ZOOMS) {
    const maxW = Math.max(...frames.map((f) => f.image.width));
    const maxH = Math.max(...frames.map((f) => f.image.height));
    const panelW = Math.ceil(maxW * zoom) + 16;
    const panelH = Math.ceil(maxH * zoom) + 16;
    const perRow = 4;
    const width = perRow * GROUNDS.length * panelW;
    const height = Math.ceil(frames.length / perRow) * panelH;
    if (width * height > 55_000_000) throw new Error('Contact sheet excede 55 milhões de pixels; divida o lote');
    const canvas = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      canvas[i * 4] = 236; canvas[i * 4 + 1] = 226; canvas[i * 4 + 2] = 206; canvas[i * 4 + 3] = 255;
    }
    for (let f = 0; f < frames.length; f++) {
      const { image } = frames[f];
      const row = Math.floor(f / perRow), col = f % perRow;
      for (let g = 0; g < GROUNDS.length; g++) {
        const terrain = terrains[GROUNDS[g]];
        const left = (col * GROUNDS.length + g) * panelW;
        const top = row * panelH;
        for (let y = 0; y < panelH; y++) for (let x = 0; x < panelW; x++) {
          const tx = ((x - 8) / zoom % terrain.width + terrain.width) % terrain.width;
          const ty = ((y - 8) / zoom % terrain.height + terrain.height) % terrain.height;
          blend(canvas, width, left + x, top + y, sample(terrain, tx, ty));
        }
        const sw = Math.round(image.width * zoom), sh = Math.round(image.height * zoom);
        for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
          const sx = (x + 0.5) / zoom - 0.5, sy = (y + 0.5) / zoom - 0.5;
          blend(canvas, width, left + 8 + x, top + 8 + y, sample(image, sx, sy));
        }
      }
    }
    const path = join(outputDir, `contact-${zoom}.png`);
    writeFileSync(path, encodePng({ width, height, data: canvas }));
    files.push(path);
  }
  return files;
}
