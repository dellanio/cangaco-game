import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import { fileURLToPath, URL } from 'node:url';
import { decodePng, encodePng } from '../skills/pianco-sprite-tools/scripts/png-rgba.mjs';
import { Buffer } from 'node:buffer';

// Coordenadas medidas nos originais 1254x1254; centro geométrico do canvas: (96,96).
const assets = [
  { name: 'relogio-mostrador', cx: 627, cy: 625, scale: 92 / 595, radius: 92 },
  { name: 'relogio-ponteiro', cx: 627, cy: 669, scale: 0.15 },
];
const root = new URL('../', import.meta.url);
const size = 192;

function derive(source, spec) {
  if (source.width !== 1254 || source.height !== 1254) {
    throw new Error(`${spec.name}: original deve ser 1254x1254`);
  }
  const data = Buffer.alloc(size * size * 4);
  // Integração por área com RGB premultiplicado: preserva bordas sem halo preto.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const left = spec.cx + (x - size / 2) / spec.scale;
      const top = spec.cy + (y - size / 2) / spec.scale;
      const right = left + 1 / spec.scale;
      const bottom = top + 1 / spec.scale;
      let alpha = 0;
      const rgb = [0, 0, 0];
      for (let sy = Math.floor(top); sy < Math.ceil(bottom); sy++) {
        for (let sx = Math.floor(left); sx < Math.ceil(right); sx++) {
          if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) continue;
          const weight = (Math.min(right, sx + 1) - Math.max(left, sx))
            * (Math.min(bottom, sy + 1) - Math.max(top, sy));
          const index = (sy * source.width + sx) * 4;
          const a = source.data[index + 3] / 255;
          alpha += weight * a;
          for (let c = 0; c < 3; c++) rgb[c] += source.data[index + c] * weight * a;
        }
      }
      const index = (y * size + x) * 4;
      let coverage = 1;
      if (spec.radius) {
        // Máscara circular com antialias interno; exterior estritamente transparente.
        const distance = Math.hypot(x + 0.5 - 96, y + 0.5 - 96);
        coverage = Math.max(0, Math.min(1, spec.radius - distance));
      }
      const a = Math.round(alpha * spec.scale * spec.scale * 255 * coverage);
      if (a < 4) continue; // Remove resíduos de alfa quase invisíveis; RGB fica zero também.
      for (let c = 0; c < 3; c++) data[index + c] = Math.round(rgb[c] / alpha);
      data[index + 3] = a;
    }
  }
  return { width: size, height: size, data };
}

try {
  for (const spec of assets) {
    const original = new URL(`assets/base/ui-clima/codex/${spec.name}-original.png`, root);
    const output = new URL(`assets/sprites/ui/clima/${spec.name}.png`, root);
    const source = decodePng(readFileSync(original));
    const result = derive(source, spec);
    writeFileSync(output, encodePng(result));
    console.log(`${fileURLToPath(original)}: ${source.width}x${source.height}`);
    console.log(`${fileURLToPath(output)}: ${size}x${size}, PNG RGBA, centro/pivo (96,96)`);
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
