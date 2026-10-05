import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import process from 'node:process';
import console from 'node:console';
import { encodePng, decodePng } from './png-rgba.mjs';

// Material original procedural. Semente fixa; sem relógio, rede ou Math.random.
const SEED = 20261005;
const OUT = resolve('assets/base/road-tiles/candidata-pedra-2026-10-05');
const SIZE = 128;
let state = SEED;
const random = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (x, y, salt = 0) => {
  let n = Math.imul(x + SEED, 374761393) ^ Math.imul(y + salt, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const mod = (n, period) => ((n % period) + period) % period;
// Voronoi periódico com centros irregulares: pedras cruzam as bordas do tile.
const palette = [[164, 157, 139], [181, 170, 148], [151, 148, 137],
  [192, 181, 157], [172, 167, 151], [158, 153, 140]];
const stones = [];
for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
  stones.push({ x: (x + 0.15 + random() * 0.7) * 16,
    y: (y + 0.15 + random() * 0.7) * 16,
    color: palette[Math.floor(random() * palette.length)], variation: random() * 8 - 4 });
}
function material(x, y) {
  x = mod(x, SIZE); y = mod(y, SIZE);
  let first = Infinity, second = Infinity, stone;
  for (const s of stones) {
    const dx = Math.min(Math.abs(x - s.x), SIZE - Math.abs(x - s.x));
    const dy = Math.min(Math.abs(y - s.y), SIZE - Math.abs(y - s.y));
    const d = Math.hypot(dx, dy);
    if (d < first) { second = first; first = d; stone = s; }
    else if (d < second) second = d;
  }
  const gap = second - first;
  const grain = (hash(x, y) - 0.5) * 9;
  // Juntas de terra e oclusão local, sem direção de iluminação ou bevel.
  const joint = [112, 101, 83];
  const mix = Math.max(0, Math.min(1, (gap - 0.7) / 1.4));
  const pore = hash(x, y, 31) > 0.976 ? -13 : 0;
  return [...joint.map((v, c) => Math.round(v * (1 - mix) +
    (stone.color[c] + stone.variation + pore) * mix + grain)), 255];
}
function image(width, height, pixel) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    data.set(pixel(x, y), (y * width + x) * 4);
  return { width, height, data };
}
const save = (name, img) => writeFileSync(join(OUT, name), encodePng(img));
mkdirSync(OUT, { recursive: true });
save('road-material-source.png', image(SIZE, SIZE, material));
save('material-3x3.png', image(SIZE * 3, SIZE * 3, material));
const layout = JSON.parse(readFileSync('assets/base/road-tiles/layout.json', 'utf8'));
const relative = 'assets/base/road-tiles/candidata-pedra-2026-10-05';
Object.assign(layout, { source: `${relative}/road-material-source.png`,
  outputDir: `${relative}/sprites`, preview: `${relative}/preview-mascaras.png` });
writeFileSync(join(OUT, 'layout.json'), JSON.stringify(layout, null, 2) + '\n');
const pipeline = spawnSync(process.execPath,
  ['skills/pianco-sprite-tools/scripts/process-road-tiles.mjs', join(OUT, 'layout.json')],
  { stdio: 'inherit' });
if (pipeline.status !== 0) throw new Error('Pipeline de estrada falhou');
const tiles = Array.from({ length: 16 }, (_, m) => decodePng(readFileSync(join(OUT, `sprites/road-m${m}.png`))));
const diagonal = decodePng(readFileSync(join(OUT, 'sprites/road-diagonal.png')));
if ([...tiles, diagonal].some(t => t.width !== 64 || t.height !== 64))
  throw new Error('Derivado fora de 64x64');
const grass = decodePng(readFileSync('assets/sprites/terrain/grama.png'));
// Seis painéis 5x5, em ordem: horizontal, vertical, curva, T, cruz e diagonal.
const paths = [
  [[0,2],[1,2],[2,2],[3,2],[4,2]],
  [[2,0],[2,1],[2,2],[2,3],[2,4]],
  [[0,2],[1,2],[2,2],[2,3],[2,4]],
  [[0,2],[1,2],[2,2],[3,2],[4,2],[2,3],[2,4]],
  [[0,2],[1,2],[2,2],[3,2],[4,2],[2,0],[2,1],[2,3],[2,4]],
  [[0,0],[1,1],[2,2],[3,3],[4,4]],
];
const sheet = image(960, 640, (x, y) => {
  const gx = Math.floor(mod(x,64) / 64 * grass.width);
  const gy = Math.floor(mod(y,64) / 64 * grass.height);
  return grass.data.slice((gy * grass.width + gx) * 4, (gy * grass.width + gx) * 4 + 4);
});
function draw(img, ox, oy) {
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const src = (y * img.width + x) * 4, dst = ((oy+y)*sheet.width+ox+x)*4;
    const a = img.data[src+3] / 255;
    for (let c=0;c<3;c++) sheet.data[dst+c] = Math.round(img.data[src+c]*a + sheet.data[dst+c]*(1-a));
    sheet.data[dst+3] = 255;
  }
}
const masks = [];
paths.forEach((path, p) => {
  const ox = p % 3 * 320, oy = Math.floor(p/3) * 320;
  const occupied = new Set(path.map(([x,y])=>`${x},${y}`));
  masks.push(path.map(([x,y]) => {
    let mask=0;
    for (const [dx,dy,bit] of [[0,-1,1],[1,0,2],[0,1,4],[-1,0,8]])
      if (occupied.has(`${x+dx},${y+dy}`)) mask |= bit;
    draw(tiles[mask], ox+x*64, oy+y*64);
    return { x,y,mask };
  }));
  // Ponte centrada no canto compartilhado, como src/render/estradas.ts.
  if (p === 5) for (let n=1;n<5;n++) draw(diagonal, ox+n*64-32, oy+n*64-32);
});
save('ruas-contato.png', sheet);
save('ruas-contato-tint-08.png', { ...sheet, data: sheet.data.map((v,i)=>i%4===3?v:Math.round(v*0.8)) });
let periodic = true;
for(let n=0;n<SIZE;n++) for(const [x,y] of [[0,n],[n,0]])
  if (material(x,y).join() !== material(x+SIZE,y).join() ||
      material(x,y).join() !== material(x,y+SIZE).join()) periodic=false;
if (!periodic) throw new Error('Material não periódico');
const report = { seed: SEED, sourceSize: [SIZE,SIZE], roadWidth: layout.roadWidth,
  periodicity: periodic, images64x64: tiles.length+1, masks,
  sourceSHA256: createHash('sha256').update(readFileSync(join(OUT,'road-material-source.png'))).digest('hex'),
  limitation: 'Pipeline vigente recorta offsets diferentes por máscara; periodicidade da fonte não garante continuidade das pedras entre derivados.',
  approval: 'Candidata; aguarda operador. Não integrada.' };
writeFileSync(join(OUT,'conferencia.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ seed: SEED, periodic, images64x64: 17, sourceSHA256: report.sourceSHA256 }));
