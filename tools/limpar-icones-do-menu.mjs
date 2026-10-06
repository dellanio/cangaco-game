import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';

// Deriva somente os cinco originais; não gera arte e não altera os masters.
const root = new URL('../', import.meta.url);
const names = ['subaba-vila', 'subaba-comer', 'subaba-materia', 'subaba-guerra', 'ferramenta-rua'];
const size = 64, margin = 3;
mkdirSync(new URL('assets/sprites/ui/menu/', root), { recursive: true });

for (const name of names) {
  const src = decodePng(readFileSync(new URL(`assets/base/ui-menu/codex/${name}-original.png`, root)));
  const { width, height, data } = src;
  // Exige transparência real na geração: não interpreta branco/xadrez como alfa.
  if (![0, width - 1, (height - 1) * width, width * height - 1].every(i => data[i * 4 + 3] === 0))
    throw new Error(`${name}: original sem cantos transparentes`);
  // Componentes de oito vizinhos; elimina apenas ilhas com menos de 0,1%
  // da área da maior componente (poeira/pontos soltos da geração).
  const labels = new Int32Array(width * height);
  const counts = [0];
  let label = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] || data[i * 4 + 3] < 8) continue;
    label++;
    const queue = [i]; labels[i] = label;
    for (let p = 0; p < queue.length; p++) {
      const at = queue[p], x = at % width, y = Math.floor(at / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (!labels[next] && data[next * 4 + 3] >= 8) { labels[next] = label; queue.push(next); }
      }
    }
    counts[label] = queue.length;
  }
  const minimum = Math.max(...counts) * 0.001;
  let left = width, top = height, right = -1, bottom = -1;
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i] || counts[labels[i]] < minimum) { data[i * 4 + 3] = 0; continue; }
    const x = i % width, y = Math.floor(i / width);
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left) throw new Error(`${name}: figura vazia`);
  const cw = right - left + 1, ch = bottom - top + 1;
  const scale = (size - margin * 2) / Math.max(cw, ch);
  const dw = Math.round(cw * scale), dh = Math.round(ch * scale);
  const ox = Math.floor((size - dw) / 2), oy = Math.floor((size - dh) / 2);
  const out = new Uint8Array(size * size * 4);
  // Filtro de área exato, alfa premultiplicado: evita halos no derivado colorido.
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const x0 = left + x * cw / dw, x1 = left + (x + 1) * cw / dw;
    const y0 = top + y * ch / dh, y1 = top + (y + 1) * ch / dh;
    let alpha = 0; const rgb = [0, 0, 0];
    for (let sy = Math.floor(y0); sy < Math.ceil(y1); sy++)
      for (let sx = Math.floor(x0); sx < Math.ceil(x1); sx++) {
        const weight = (Math.min(x1, sx + 1) - Math.max(x0, sx)) * (Math.min(y1, sy + 1) - Math.max(y0, sy));
        const i = (sy * width + sx) * 4, a = data[i + 3] * weight;
        alpha += a;
        for (let c = 0; c < 3; c++) rgb[c] += data[i + c] * a;
      }
    const i = ((y + oy) * size + x + ox) * 4;
    out[i + 3] = Math.round(alpha / ((x1 - x0) * (y1 - y0)));
    if (!out[i + 3]) continue;
    const color = name === 'ferramenta-rua' ? rgb.map(v => Math.round(v / alpha)) : [58, 36, 22];
    out.set(color, i);
  }
  const dest = new URL(`assets/sprites/ui/menu/${name}.png`, root);
  writeFileSync(dest, encodePng({ width: size, height: size, data: out }));
  console.log(`${fileURLToPath(dest)}: ${size}x${size} RGBA; original ${width}x${height}; figura ${dw}x${dh}, margem mínima ${margin}px`);
}
