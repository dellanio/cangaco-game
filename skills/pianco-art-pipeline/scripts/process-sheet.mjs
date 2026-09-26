import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

function fail(message) {
  throw new Error(`pianco-art-pipeline: ${message}`);
}

function dimensionOfPng(path) {
  const bytes = readFileSync(path);
  if (bytes.length < 24 || bytes.toString('ascii', 1, 4) !== 'PNG') fail(`${path} nao e PNG valido`);
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

const specPath = process.argv[2];
if (!specPath) fail('uso: node process-sheet.mjs <layout.json>');
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
if (typeof spec.source !== 'string' || !Array.isArray(spec.cells)) fail('layout precisa de source e cells');
const source = resolve(spec.source);
if (!existsSync(source)) fail(`fonte inexistente: ${source}`);

for (const cell of spec.cells) {
  if (!Array.isArray(cell.crop) || cell.crop.length !== 4) fail(`${cell.id}: crop invalido`);
  if (!Array.isArray(cell.size) || cell.size.length !== 2) fail(`${cell.id}: size invalido`);
  const [x, y, width, height] = cell.crop;
  const [outWidth, outHeight] = cell.size;
  const [contentWidth, contentHeight] = cell.contentSize ?? cell.size;
  const output = resolve(cell.output);
  mkdirSync(dirname(output), { recursive: true });
  const scale = cell.fit === 'contain'
    ? `scale=${contentWidth}:${contentHeight}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${outWidth}:${outHeight}:(ow-iw)/2:(oh-ih):color=0x00000000`
    : `scale=${outWidth}:${outHeight}:flags=lanczos`;
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', source,
    '-vf', `crop=${width}:${height}:${x}:${y},${scale}`, output,
  ], { stdio: 'inherit' });
  const actual = dimensionOfPng(output);
  if (actual[0] !== outWidth || actual[1] !== outHeight) {
    fail(`${cell.id}: esperado ${outWidth}x${outHeight}, encontrado ${actual.join('x')}`);
  }
  process.stdout.write(`${cell.id}: ${output} ${actual.join('x')} OK\n`);
}
