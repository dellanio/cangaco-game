import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';

function fail(message) {
  throw new Error(`pianco-art-pipeline: ${message}`);
}

const specPath = process.argv[2];
if (!specPath) fail('uso: node process-water-shores.mjs <layout.json>');
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
if (typeof spec.source !== 'string' || typeof spec.outputDir !== 'string') {
  fail('layout precisa de source e outputDir');
}

const source = resolve(spec.source);
const outputDir = resolve(spec.outputDir);
const preview = resolve(spec.preview ?? 'screenshots/water-shore-preview.png');
const size = spec.size ?? 64;
const shoreWidth = spec.shoreWidth ?? 11;
const feather = spec.feather ?? 3;
const sourceCrop = spec.sourceCrop ?? null;
const sourceUrl = `data:image/png;base64,${readFileSync(source).toString('base64')}`;
const backgroundUrl = typeof spec.previewBackground === 'string'
  ? `data:image/png;base64,${readFileSync(resolve(spec.previewBackground)).toString('base64')}`
  : null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  const result = await page.evaluate(async ({
    materialUrl, backgroundUrl: bgUrl, tileSize, width, softness, crop,
  }) => {
    const load = async (url) => {
      const image = new globalThis.Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const material = await load(materialUrl);
    const background = bgUrl ? await load(bgUrl) : null;
    const [cropX, cropY, cropWidth, cropHeight] = crop ?? [
      0, 0, material.naturalWidth, material.naturalHeight,
    ];
    const materialCanvas = globalThis.document.createElement('canvas');
    materialCanvas.width = cropWidth;
    materialCanvas.height = cropHeight;
    const materialContext = materialCanvas.getContext('2d', { willReadFrequently: true });
    if (!materialContext) throw new Error('canvas 2d indisponivel');
    materialContext.drawImage(
      material, cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight,
    );
    const materialPixels = materialContext.getImageData(0, 0, cropWidth, cropHeight).data;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const hash = (x, y, seed) => {
      let value = Math.imul(x + seed * 17, 374761393) ^ Math.imul(y - seed * 29, 668265263);
      value = Math.imul(value ^ (value >>> 13), 1274126177);
      return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
    };
    const sampleMaterial = (x, y, mask) => {
      const offsetX = Math.floor(hash(mask, 11, 3) * Math.max(1, cropWidth - tileSize));
      const offsetY = Math.floor(hash(mask, 23, 7) * Math.max(1, cropHeight - tileSize));
      const sx = clamp(offsetX + x, 0, cropWidth - 1);
      const sy = clamp(offsetY + y, 0, cropHeight - 1);
      const offset = (sy * cropWidth + sx) * 4;
      return [materialPixels[offset], materialPixels[offset + 1], materialPixels[offset + 2]];
    };
    const render = (mask) => {
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = tileSize;
      canvas.height = tileSize;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas 2d indisponivel');
      const pixels = context.createImageData(tileSize, tileSize);
      if (mask === 0) {
        context.putImageData(pixels, 0, 0);
        return canvas;
      }

      for (let y = 0; y < tileSize; y += 1) {
        for (let x = 0; x < tileSize; x += 1) {
          const distances = [];
          if (mask & 1) distances.push(y);
          if (mask & 2) distances.push(tileSize - 1 - x);
          if (mask & 4) distances.push(tileSize - 1 - y);
          if (mask & 8) distances.push(x);
          const edgeDistance = Math.min(...distances);
          const noise = (hash(x >> 1, y >> 1, mask + 41) - 0.5) * 5;
          const boundary = width + noise;
          const alpha = clamp((boundary - edgeDistance) / softness, 0, 1);
          if (alpha <= 0) continue;

          const [baseRed, baseGreen, baseBlue] = sampleMaterial(x, y, mask);
          const wet = clamp((edgeDistance - (boundary - 4)) / 4, 0, 1);
          const foam = clamp(1 - Math.abs(boundary - edgeDistance - 1) / 1.5, 0, 1);
          const shade = 1 - wet * 0.22;
          const pale = foam * 0.24;
          const offset = (y * tileSize + x) * 4;
          pixels.data[offset] = Math.round(baseRed * shade * (1 - pale) + 232 * pale);
          pixels.data[offset + 1] = Math.round(baseGreen * shade * (1 - pale) + 220 * pale);
          pixels.data[offset + 2] = Math.round(baseBlue * shade * (1 - pale) + 176 * pale);
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
    sheetContext.imageSmoothingEnabled = false;
    for (let mask = 0; mask < 16; mask += 1) {
      const tile = render(mask);
      tiles.push(tile.toDataURL('image/png').split(',')[1]);
      const x = (mask % 4) * tileSize;
      const y = Math.floor(mask / 4) * tileSize;
      if (background) sheetContext.drawImage(background, x, y, tileSize, tileSize);
      sheetContext.drawImage(tile, x, y);
    }
    return {
      tiles,
      preview: sheet.toDataURL('image/png').split(',')[1],
    };
  }, {
    materialUrl: sourceUrl,
    backgroundUrl,
    tileSize: size,
    width: shoreWidth,
    softness: feather,
    crop: sourceCrop,
  });

  mkdirSync(outputDir, { recursive: true });
  for (let mask = 0; mask < result.tiles.length; mask += 1) {
    writeFileSync(
      resolve(outputDir, `water-shore-m${mask}.png`),
      Buffer.from(result.tiles[mask], 'base64'),
    );
  }
  mkdirSync(dirname(preview), { recursive: true });
  writeFileSync(preview, Buffer.from(result.preview, 'base64'));
  process.stdout.write(`water-shore: 16 bordas em ${size}x${size}; preview ${preview}\n`);
} finally {
  await browser.close();
}
