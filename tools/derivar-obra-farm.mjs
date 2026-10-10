import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import console from 'node:console';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
const source = resolve(process.argv[2]), output = resolve(process.argv[3]);
mkdirSync(output, { recursive: true });
const canonical = 'assets/sprites/farm/farm_completo-D-yellow-tall.png';
function bounds(p, minAlpha = 1) {
  let x0 = p.width, y0 = p.height, x1 = -1, y1 = -1;
  for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3] >= minAlpha) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) throw new Error('PNG vazio'); return { x0, y0, x1, y1 };
}
const p = decodePng(readFileSync(source)), ref = decodePng(readFileSync(canonical));
const from = bounds(p, 128), to = bounds(ref), files = [];
for (const k of [1, 2]) {
  const w = (to.x1 - to.x0 + 1) * k, h = (to.y1 - to.y0 + 1) * k;
  const path = join(output, k === 1 ? 'farm-madeira.png' : 'farm-madeira-master-2x.png');
  const filter = `crop=${from.x1 - from.x0 + 1}:${from.y1 - from.y0 + 1}:${from.x0}:${from.y0},scale=${w}:${h}:flags=lanczos,pad=${ref.width * k}:${ref.height * k}:${to.x0 * k}:${to.y0 * k}:color=black@0,format=rgba`;
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-vf', filter, '-frames:v', '1', path], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr);
  const img = decodePng(readFileSync(path));
  const shift = (to.y1 + 1) * k - 1 - bounds(img).y1;
  if (shift !== 0) {
    const aligned = Buffer.alloc(img.data.length);
    for (let y = 0; y < img.height; y++) if (y + shift >= 0 && y + shift < img.height) Buffer.from(img.data).copy(aligned, (y + shift) * img.width * 4, y * img.width * 4, (y + 1) * img.width * 4);
    img.data = aligned;
  }
  const original = Buffer.from(img.data);
  // RGB bleed somente nos pixels de alfa zero, sem mudar o desenho ou alfa.
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = (y * img.width + x) * 4; if (img.data[i + 3] !== 0) continue;
    let best = -1, alpha = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
      const j = (ny * img.width + nx) * 4; if (original[j + 3] > alpha) { alpha = original[j + 3]; best = j; }
    }
    if (best >= 0) for (let c = 0; c < 3; c++) img.data[i + c] = original[best + c];
  }
  writeFileSync(path, encodePng(img)); files.push({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex'), bounds: bounds(img) });
}
const record = { source, sourceHash: createHash('sha256').update(readFileSync(source)).digest('hex'), canonical, from, to, method: 'crop alfa; registro no envelope do completo; Lanczos; padding e RGB bleed', files };
writeFileSync(join(output, 'derivacao.json'), JSON.stringify(record, null, 2)); console.log(JSON.stringify(record));
