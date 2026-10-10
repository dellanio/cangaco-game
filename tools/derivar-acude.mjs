import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

// Apenas recorte, registro e composição das imagens nativas; nenhum desenho novo.
const source = resolve(process.argv[2]);
const target = resolve(process.argv[3] ?? source);
mkdirSync(target, { recursive: true });
const config = JSON.parse(readFileSync(new URL('../data/acude-arte.json', import.meta.url), 'utf8'));
const states = config.estados;
const images = Object.fromEntries(states.map(s => [s, decodePng(readFileSync(join(source, `${s}-original.png`)))]));
const full = images.cheio;
let x0 = full.width, y0 = full.height, x1 = -1, y1 = -1;
for (let y = 0; y < full.height; y++) for (let x = 0; x < full.width; x++) {
  if (full.data[(y * full.width + x) * 4 + 3] > 0) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
}
const width = x1 - x0 + 1, height = y1 - y0 + 1;
const manifest = [];
for (const state of states) {
  let image = images[state];
  if (image.width !== full.width || image.height !== full.height) {
    let ax = image.width, ay = image.height, bx = -1, by = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] > 0) {
        ax = Math.min(ax, x); ay = Math.min(ay, y); bx = Math.max(bx, x); by = Math.max(by, y);
      }
    }
    const aligned = join(target, `${state}-alinhado.png`);
    const filter = `crop=${bx - ax + 1}:${by - ay + 1}:${ax}:${ay},scale=${width}:${height}:flags=lanczos,pad=${full.width}:${full.height}:${x0}:${y0}:color=black@0,format=rgba`;
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', join(source, `${state}-original.png`), '-vf', filter, '-frames:v', '1', aligned], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'ffmpeg falhou no registro');
    image = decodePng(readFileSync(aligned));
  }
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = ((y + y0) * full.width + x + x0) * 4, j = (y * width + x) * 4;
    const water = full.data[i + 2] > full.data[i] && full.data[i + 1] > full.data[i];
    const [sx0, sy0, sx1, sy1] = config.sangradouro;
    const spillway = (x + x0) / full.width >= sx0 && (x + x0) / full.width <= sx1 && (y + y0) / full.height >= sy0 && (y + y0) / full.height <= sy1;
    const rgb = state === 'madeira' || water || spillway ? image.data : full.data;
    data[j] = rgb[i]; data[j + 1] = rgb[i + 1]; data[j + 2] = rgb[i + 2]; data[j + 3] = full.data[i + 3];
  }
  const registered = join(target, `${state}-registrado.png`);
  writeFileSync(registered, encodePng({ width, height, data }));
  for (const { sufixo: suffix, canvas: [canvasWidth, canvasHeight], larguraDoConteudo: contentWidth, margemInferior: padding } of config.derivados) {
    const contentHeight = Math.round(height * contentWidth / width);
    const output = join(target, `${state}-${suffix}.png`);
    const filter = `scale=${contentWidth}:${contentHeight}:flags=lanczos,pad=${canvasWidth}:${canvasHeight}:(ow-iw)/2:oh-ih-${padding}:color=black@0,format=rgba`;
    const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', registered, '-vf', filter, '-frames:v', '1', output], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || 'ffmpeg falhou');
    const png = decodePng(readFileSync(output));
    let foot = -1;
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) if (png.data[(y * png.width + x) * 4 + 3] > 0) foot = y;
    const shift = png.height - padding - 1 - foot;
    if (shift !== 0) {
      const aligned = Buffer.alloc(png.data.length);
      for (let y = 0; y < png.height; y++) {
        if (y + shift < 0 || y + shift >= png.height) continue;
        Buffer.from(png.data).copy(aligned, (y + shift) * png.width * 4, y * png.width * 4, (y + 1) * png.width * 4);
      }
      png.data = aligned;
    }
    const original = Buffer.from(png.data);
    for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (original[i + 3] !== 0) continue;
      const neighbors = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) neighbors.push([x + dx, y + dy]);
      let best = -1, alpha = 0;
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= png.width || ny >= png.height) continue;
        const n = (ny * png.width + nx) * 4;
        if (original[n + 3] > alpha) { alpha = original[n + 3]; best = n; }
      }
      if (best >= 0) {
        png.data[i] = original[best]; png.data[i + 1] = original[best + 1]; png.data[i + 2] = original[best + 2];
      }
    }
    writeFileSync(output, encodePng(png));
    manifest.push({ state, suffix, path: output, sha256: createHash('sha256').update(readFileSync(output)).digest('hex') });
  }
}
writeFileSync(join(target, 'derivacao.json'), JSON.stringify({ source, crop: [x0, y0, width, height], method: 'RGB nativo no interior; exterior e alfa canônicos do cheio; Lanczos e padding comum', files: manifest }, null, 2));
console.log(JSON.stringify(manifest));
