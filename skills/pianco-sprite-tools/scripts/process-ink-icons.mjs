import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';

function fail(message) {
  throw new Error(`pianco-sprite-tools: ${message}`);
}

const specPath = process.argv[2];
if (!specPath) fail('uso: node process-ink-icons.mjs <layout.json>');

const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
if (!Array.isArray(spec.icons) || spec.icons.length === 0) {
  fail('layout precisa de icons');
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  for (const icon of spec.icons) {
    if (typeof icon.source !== 'string' || typeof icon.output !== 'string') {
      fail('cada icone precisa de source e output');
    }
    if (!Array.isArray(icon.size) || icon.size.length !== 2) {
      fail(`${icon.id ?? icon.source}: size invalido`);
    }

    const source = resolve(icon.source);
    const output = resolve(icon.output);
    const dataUrl = `data:image/png;base64,${readFileSync(source).toString('base64')}`;
    const pngBase64 = await page.evaluate(async ({ dataUrl: url, icon: entry }) => {
    const image = new globalThis.Image();
      image.src = url;
      await image.decode();

    const sourceCanvas = globalThis.document.createElement('canvas');
      sourceCanvas.width = image.naturalWidth;
      sourceCanvas.height = image.naturalHeight;
      const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) throw new Error('canvas 2d indisponivel');
      sourceContext.drawImage(image, 0, 0);

      const [outWidth, outHeight] = entry.size;
    const outputCanvas = globalThis.document.createElement('canvas');
      outputCanvas.width = outWidth;
      outputCanvas.height = outHeight;
      const outputContext = outputCanvas.getContext('2d');
      if (!outputContext) throw new Error('canvas 2d indisponivel');
      outputContext.imageSmoothingEnabled = true;
      outputContext.imageSmoothingQuality = 'high';

      if (entry.mode === 'rgba') {
        outputContext.drawImage(image, 0, 0, outWidth, outHeight);
        return outputCanvas.toDataURL('image/png').split(',')[1];
      }

      const pixels = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      const threshold = entry.threshold ?? 182;
      const softness = entry.softness ?? 76;
      const ink = entry.ink ?? [31, 20, 13];
      let left = sourceCanvas.width;
      let top = sourceCanvas.height;
      let right = -1;
      let bottom = -1;

      for (let y = 0; y < sourceCanvas.height; y += 1) {
        for (let x = 0; x < sourceCanvas.width; x += 1) {
          const offset = (y * sourceCanvas.width + x) * 4;
          const luminance = pixels.data[offset] * 0.2126
            + pixels.data[offset + 1] * 0.7152
            + pixels.data[offset + 2] * 0.0722;
          const alpha = Math.max(0, Math.min(255, ((threshold - luminance) / softness) * 255));
          pixels.data[offset] = ink[0];
          pixels.data[offset + 1] = ink[1];
          pixels.data[offset + 2] = ink[2];
          pixels.data[offset + 3] = alpha;
          if (alpha > 18) {
            left = Math.min(left, x);
            top = Math.min(top, y);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
          }
        }
      }

      if (right < left || bottom < top) throw new Error(`${entry.id}: nenhum traco encontrado`);
      sourceContext.putImageData(pixels, 0, 0);

      const sourceWidth = right - left + 1;
      const sourceHeight = bottom - top + 1;
      const padding = entry.padding ?? 0.08;
      const availableWidth = outWidth * (1 - padding * 2);
      const availableHeight = outHeight * (1 - padding * 2);
      const scale = Math.min(availableWidth / sourceWidth, availableHeight / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      outputContext.drawImage(
        sourceCanvas,
        left,
        top,
        sourceWidth,
        sourceHeight,
        (outWidth - drawWidth) / 2,
        (outHeight - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      return outputCanvas.toDataURL('image/png').split(',')[1];
    }, { dataUrl, icon });

    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, Buffer.from(pngBase64, 'base64'));
    process.stdout.write(`${icon.id ?? icon.output}: ${icon.size.join('x')} OK\n`);
  }
} finally {
  await browser.close();
}
