import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';

function fail(message) {
  throw new Error(`pianco-sprite-tools: ${message}`);
}

const specPath = process.argv[2];
if (!specPath) fail('uso: node process-road-tiles.mjs <layout.json>');
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
if (typeof spec.source !== 'string' || typeof spec.outputDir !== 'string') {
  fail('layout precisa de source e outputDir');
}

const source = resolve(spec.source);
const outputDir = resolve(spec.outputDir);
const preview = resolve(spec.preview ?? 'screenshots/road-sprites-preview.png');
const size = spec.size ?? 64;
const roadWidth = spec.roadWidth ?? 34;
const dataUrl = `data:image/png;base64,${readFileSync(source).toString('base64')}`;
const backgroundPath = typeof spec.previewBackground === 'string'
  ? resolve(spec.previewBackground)
  : null;
const backgroundUrl = backgroundPath
  ? `data:image/png;base64,${readFileSync(backgroundPath).toString('base64')}`
  : null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  const result = await page.evaluate(async ({ sourceUrl, backgroundUrl: bgUrl, size: tileSize, roadWidth: width }) => {
    const load = async (url) => {
      const image = new globalThis.Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const material = await load(sourceUrl);
    const background = bgUrl ? await load(bgUrl) : null;
    const materialCanvas = globalThis.document.createElement('canvas');
    materialCanvas.width = material.naturalWidth;
    materialCanvas.height = material.naturalHeight;
    const materialContext = materialCanvas.getContext('2d', { willReadFrequently: true });
    if (!materialContext) throw new Error('canvas 2d indisponivel');
    materialContext.drawImage(material, 0, 0);
    const materialPixels = materialContext.getImageData(0, 0, materialCanvas.width, materialCanvas.height).data;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const hash = (x, y, seed) => {
      let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y - seed * 29, 668265263);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    };
    const distanceToSegment = (px, py, ax, ay, bx, by) => {
      const dx = bx - ax;
      const dy = by - ay;
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };
    const sampleMaterial = (x, y, seed) => {
      const crop = Math.floor(Math.min(materialCanvas.width, materialCanvas.height) * 0.48);
      const maxX = Math.max(1, materialCanvas.width - crop);
      const maxY = Math.max(1, materialCanvas.height - crop);
      const offsetX = Math.floor(hash(seed, 11, 3) * maxX);
      const offsetY = Math.floor(hash(seed, 23, 7) * maxY);
      const sx = clamp(Math.floor(offsetX + (x / tileSize) * crop), 0, materialCanvas.width - 1);
      const sy = clamp(Math.floor(offsetY + (y / tileSize) * crop), 0, materialCanvas.height - 1);
      const offset = (sy * materialCanvas.width + sx) * 4;
      return [materialPixels[offset], materialPixels[offset + 1], materialPixels[offset + 2]];
    };
    const render = (mask, diagonal = false) => {
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = tileSize;
      canvas.height = tileSize;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas 2d indisponivel');
      const pixels = context.createImageData(tileSize, tileSize);
      const center = tileSize / 2;
      const radius = width / 2;
      const segments = [[center, center, center, center]];
      if (mask & 1) segments.push([center, center, center, -2]);
      if (mask & 2) segments.push([center, center, tileSize + 2, center]);
      if (mask & 4) segments.push([center, center, center, tileSize + 2]);
      if (mask & 8) segments.push([center, center, -2, center]);

      for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
          const edgeDistance = Math.min(x, y, tileSize - 1 - x, tileSize - 1 - y);
          const noiseWeight = clamp(edgeDistance / 6, 0, 1);
          const noise = (hash(x >> 1, y >> 1, mask + 31) - 0.5) * 4 * noiseWeight;
          let distance;
          if (diagonal) {
            distance = (Math.abs(x + 0.5 - center) + Math.abs(y + 0.5 - center)) / Math.SQRT2;
          } else {
            distance = Math.min(...segments.map(([ax, ay, bx, by]) => distanceToSegment(x + 0.5, y + 0.5, ax, ay, bx, by)));
          }
          const boundary = diagonal ? radius * 1.08 + noise : radius + noise;
          const alpha = clamp((boundary - distance + 1.5) / 3, 0, 1);
          if (alpha <= 0) continue;
          const [red, green, blue] = sampleMaterial(x, y, diagonal ? 97 : mask);
          const rim = clamp((boundary - distance) / 4, 0.72, 1);
          const offset = (y * tileSize + x) * 4;
          pixels.data[offset] = Math.round(red * rim);
          pixels.data[offset + 1] = Math.round(green * rim);
          pixels.data[offset + 2] = Math.round(blue * rim);
          pixels.data[offset + 3] = Math.round(alpha * 255);
        }
      }
      context.putImageData(pixels, 0, 0);
      return canvas;
    };

    const tiles = [];
    for (let mask = 0; mask < 16; mask += 1) {
      tiles.push(render(mask).toDataURL('image/png').split(',')[1]);
    }
    const diagonal = render(0, true).toDataURL('image/png').split(',')[1];

    const sheet = globalThis.document.createElement('canvas');
    sheet.width = tileSize * 4;
    sheet.height = tileSize * 4;
    const sheetContext = sheet.getContext('2d');
    if (!sheetContext) throw new Error('canvas 2d indisponivel');
    sheetContext.imageSmoothingEnabled = false;
    for (let mask = 0; mask < 16; mask += 1) {
      const x = (mask % 4) * tileSize;
      const y = Math.floor(mask / 4) * tileSize;
      if (background) sheetContext.drawImage(background, x, y, tileSize, tileSize);
      sheetContext.drawImage(render(mask), x, y);
    }
    return { tiles, diagonal, preview: sheet.toDataURL('image/png').split(',')[1] };
  }, { sourceUrl: dataUrl, backgroundUrl, size, roadWidth });

  mkdirSync(outputDir, { recursive: true });
  for (let mask = 0; mask < result.tiles.length; mask += 1) {
    writeFileSync(resolve(outputDir, `road-m${mask}.png`), Buffer.from(result.tiles[mask], 'base64'));
  }
  writeFileSync(resolve(outputDir, 'road-diagonal.png'), Buffer.from(result.diagonal, 'base64'));
  mkdirSync(dirname(preview), { recursive: true });
  writeFileSync(preview, Buffer.from(result.preview, 'base64'));
  process.stdout.write(`road: 16 conexoes + diagonal em ${size}x${size}; preview ${preview}\n`);
} finally {
  await browser.close();
}
