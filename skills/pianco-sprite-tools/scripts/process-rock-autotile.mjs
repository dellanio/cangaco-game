import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import process from 'node:process';

function fail(message) {
  throw new Error(`pianco-sprite-tools: ${message}`);
}

const specPath = process.argv[2];
if (!specPath) fail('uso: node process-rock-autotile.mjs <layout.json>');
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
if (typeof spec.source !== 'string' || typeof spec.outputDir !== 'string') {
  fail('layout precisa de source e outputDir');
}

const sourceUrl = `data:image/png;base64,${readFileSync(resolve(spec.source)).toString('base64')}`;
const backgroundUrl = typeof spec.previewBackground === 'string'
  ? `data:image/png;base64,${readFileSync(resolve(spec.previewBackground)).toString('base64')}`
  : null;
const outputDir = resolve(spec.outputDir);
const preview = resolve(spec.preview ?? 'screenshots/rock-autotile-preview.png');
const width = spec.size?.[0] ?? 128;
const height = spec.size?.[1] ?? 160;
const sourceCrop = spec.sourceCrop ?? null;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  const result = await page.evaluate(async ({ sourceUrl: spriteUrl, bgUrl, outWidth, outHeight, crop }) => {
    const load = async (url) => {
      const image = new globalThis.Image();
      image.src = url;
      await image.decode();
      return image;
    };
    const sprite = await load(spriteUrl);
    const background = bgUrl ? await load(bgUrl) : null;
    const [cropX, cropY, cropWidth, cropHeight] = crop ?? [
      0, 0, sprite.naturalWidth, sprite.naturalHeight,
    ];
    const cleaned = globalThis.document.createElement('canvas');
    cleaned.width = cropWidth;
    cleaned.height = cropHeight;
    const cleanedContext = cleaned.getContext('2d', { willReadFrequently: true });
    if (!cleanedContext) throw new Error('canvas 2d indisponivel');
    cleanedContext.drawImage(
      sprite, cropX, cropY, cropWidth, cropHeight,
      0, 0, cropWidth, cropHeight,
    );
    const cleanedPixels = cleanedContext.getImageData(0, 0, cropWidth, cropHeight);
    for (let offset = 3; offset < cleanedPixels.data.length; offset += 4) {
      const alpha = cleanedPixels.data[offset];
      cleanedPixels.data[offset] = alpha <= 24
        ? 0
        : Math.round(((alpha - 24) / (255 - 24)) * 255);
    }
    cleanedContext.putImageData(cleanedPixels, 0, 0);
    const bitCount = (mask) => [1, 2, 4, 8].filter((bit) => (mask & bit) !== 0).length;
    const render = (mask) => {
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas 2d indisponivel');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';

      const connections = bitCount(mask);
      const scale = [0.82, 0.91, 1.01, 1.10, 1.18][connections];
      const towardX = ((mask & 2) ? 1 : 0) - ((mask & 8) ? 1 : 0);
      const towardY = ((mask & 4) ? 1 : 0) - ((mask & 1) ? 1 : 0);
      const drawWidth = cropWidth * scale;
      const drawHeight = cropHeight * scale;
      const centerX = outWidth / 2 + towardX * 7;
      const bottom = outHeight - 3 + towardY * 3;
      context.drawImage(
        cleaned, 0, 0, cropWidth, cropHeight,
        centerX - drawWidth / 2, bottom - drawHeight, drawWidth, drawHeight,
      );
      return canvas;
    };

    const tiles = [];
    const cellWidth = outWidth;
    const cellHeight = outHeight;
    const sheet = globalThis.document.createElement('canvas');
    sheet.width = cellWidth * 4;
    sheet.height = cellHeight * 4;
    const sheetContext = sheet.getContext('2d');
    if (!sheetContext) throw new Error('canvas 2d indisponivel');
    for (let mask = 0; mask < 16; mask += 1) {
      const tile = render(mask);
      tiles.push(tile.toDataURL('image/png').split(',')[1]);
      const x = (mask % 4) * cellWidth;
      const y = Math.floor(mask / 4) * cellHeight;
      if (background) {
        for (let by = 0; by < cellHeight; by += 64) {
          for (let bx = 0; bx < cellWidth; bx += 64) sheetContext.drawImage(background, x + bx, y + by, 64, 64);
        }
      }
      sheetContext.drawImage(tile, x, y);
    }
    return { tiles, preview: sheet.toDataURL('image/png').split(',')[1] };
  }, {
    sourceUrl, bgUrl: backgroundUrl, outWidth: width, outHeight: height, crop: sourceCrop,
  });

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(resolve(outputDir, 'rock.png'), Buffer.from(result.tiles[0], 'base64'));
  for (let mask = 0; mask < result.tiles.length; mask += 1) {
    writeFileSync(resolve(outputDir, `rock-m${mask}.png`), Buffer.from(result.tiles[mask], 'base64'));
  }
  mkdirSync(dirname(preview), { recursive: true });
  writeFileSync(preview, Buffer.from(result.preview, 'base64'));
  process.stdout.write(`rock-autotile: presente + 16 mascaras em ${width}x${height}; preview ${preview}\n`);
} finally {
  await browser.close();
}
