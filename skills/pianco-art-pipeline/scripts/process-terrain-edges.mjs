import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';

function fail(message) {
  throw new Error(`pianco-art-pipeline: ${message}`);
}

const specPath = process.argv[2];
if (!specPath) fail('uso: node process-terrain-edges.mjs <layout.json>');
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
if (typeof spec.source !== 'string' || typeof spec.outputDir !== 'string' || typeof spec.prefix !== 'string') {
  fail('layout precisa de source, outputDir e prefix');
}

const source = resolve(spec.source);
const outputDir = resolve(spec.outputDir);
const preview = resolve(spec.preview ?? `screenshots/${spec.prefix}-preview.png`);
const size = spec.size ?? 64;
const edgeWidth = spec.edgeWidth ?? 12;
const feather = spec.feather ?? 4;
const sourceUrl = `data:image/png;base64,${readFileSync(source).toString('base64')}`;
const backgroundUrl = typeof spec.previewBackground === 'string'
  ? `data:image/png;base64,${readFileSync(resolve(spec.previewBackground)).toString('base64')}`
  : null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  const result = await page.evaluate(async ({ materialUrl, bgUrl, tileSize, width, softness }) => {
    const load = async (url) => {
      const image = new globalThis.Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const material = await load(materialUrl);
    const background = bgUrl ? await load(bgUrl) : null;
    const sourceCanvas = globalThis.document.createElement('canvas');
    sourceCanvas.width = material.naturalWidth;
    sourceCanvas.height = material.naturalHeight;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) throw new Error('canvas 2d indisponivel');
    sourceContext.drawImage(material, 0, 0);
    const sourcePixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const hash = (x, y, seed) => {
      let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y - seed * 29, 668265263);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    };
    const sample = (x, y, mask) => {
      const offsetX = Math.floor(hash(mask, 11, 3) * Math.max(1, sourceCanvas.width - tileSize));
      const offsetY = Math.floor(hash(mask, 23, 7) * Math.max(1, sourceCanvas.height - tileSize));
      const sx = clamp(offsetX + x, 0, sourceCanvas.width - 1);
      const sy = clamp(offsetY + y, 0, sourceCanvas.height - 1);
      const offset = (sy * sourceCanvas.width + sx) * 4;
      return [sourcePixels[offset], sourcePixels[offset + 1], sourcePixels[offset + 2]];
    };
    const render = (mask) => {
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = tileSize;
      canvas.height = tileSize;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas 2d indisponivel');
      const pixels = context.createImageData(tileSize, tileSize);
      if (mask === 0) return canvas;

      for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
          const distances = [];
          if (mask & 1) distances.push(y);
          if (mask & 2) distances.push(tileSize - 1 - x);
          if (mask & 4) distances.push(tileSize - 1 - y);
          if (mask & 8) distances.push(x);
          const distance = Math.min(...distances);
          const broadNoise = (hash(x >> 2, y >> 2, mask + 71) - 0.5) * 8;
          const fineNoise = (hash(x, y, mask + 113) - 0.5) * 2;
          const boundary = width + broadNoise + fineNoise;
          const alpha = clamp((boundary - distance) / softness, 0, 1);
          if (alpha <= 0) continue;
          const [red, green, blue] = sample(x, y, mask);
          const shade = 0.9 + clamp(distance / Math.max(1, boundary), 0, 1) * 0.1;
          const offset = (y * tileSize + x) * 4;
          pixels.data[offset] = Math.round(red * shade);
          pixels.data[offset + 1] = Math.round(green * shade);
          pixels.data[offset + 2] = Math.round(blue * shade);
          pixels.data[offset + 3] = Math.round(alpha * 255);
        }
      }
      context.putImageData(pixels, 0, 0);
      return canvas;
    };

    const tiles = [];
    const sheet = globalThis.document.createElement('canvas');
    sheet.width = tileSize * 4;
    sheet.height = tileSize * 4;
    const sheetContext = sheet.getContext('2d');
    if (!sheetContext) throw new Error('canvas 2d indisponivel');
    for (let mask = 0; mask < 16; mask += 1) {
      const tile = render(mask);
      tiles.push(tile.toDataURL('image/png').split(',')[1]);
      const x = (mask % 4) * tileSize;
      const y = Math.floor(mask / 4) * tileSize;
      if (background) sheetContext.drawImage(background, x, y, tileSize, tileSize);
      sheetContext.drawImage(tile, x, y);
    }
    return { tiles, preview: sheet.toDataURL('image/png').split(',')[1] };
  }, {
    materialUrl: sourceUrl,
    bgUrl: backgroundUrl,
    tileSize: size,
    width: edgeWidth,
    softness: feather,
  });

  mkdirSync(outputDir, { recursive: true });
  for (let mask = 0; mask < result.tiles.length; mask += 1) {
    writeFileSync(resolve(outputDir, `${spec.prefix}-m${mask}.png`), Buffer.from(result.tiles[mask], 'base64'));
  }
  mkdirSync(dirname(preview), { recursive: true });
  writeFileSync(preview, Buffer.from(result.preview, 'base64'));
  process.stdout.write(`${spec.prefix}: 16 bordas em ${size}x${size}; preview ${preview}\n`);
} finally {
  await browser.close();
}
