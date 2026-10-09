import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';
import { bleedPng } from './png-bleed.mjs';
import { validateSpriteSpec } from '../skills/pianco-sprite-tools/scripts/validate-sprites.mjs';

const [id, fonte, destino] = process.argv.slice(2);
if (!destino) throw new Error('Uso: id atlas.png pasta-externa');
const estados = id === 'fish' ? ['presente'] : ['presente', 'reduzido', 'remanescente'];
const browser = await chromium.launch({ headless: true });
let resultado;
try {
  const page = await browser.newPage();
  resultado = await page.evaluate(async ({ src, estados }) => {
    const image = new globalThis.Image(); image.src = src; await image.decode();
    const celulas = estados.map((estado, i) => {
      const x0 = Math.floor(i * image.width / estados.length);
      const x1 = Math.floor((i + 1) * image.width / estados.length);
      const canvas = globalThis.document.createElement('canvas'); canvas.width = x1 - x0; canvas.height = image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, -x0, 0);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const j = (y * canvas.width + x) * 4 + 3;
        if (pixels.data[j] < 24) pixels.data[j] = 0;
        else { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
      }
      ctx.putImageData(pixels, 0, 0);
      if (right < 0) throw new Error('Celula vazia');
      return { estado, canvas, left, top, width: right - left + 1, height: bottom - top + 1 };
    });
    const escala = Math.min(...celulas.map(c => Math.min(60 / c.width, 60 / c.height)));
    return { escala, arquivos: celulas.map(c => {
      const canvas = globalThis.document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const width = Math.max(1, Math.round(c.width * escala)), height = Math.max(1, Math.round(c.height * escala));
      ctx.drawImage(c.canvas, c.left, c.top, c.width, c.height, Math.floor((64 - width) / 2), 63 - height, width, height);
      return { estado: c.estado, width, height, png: canvas.toDataURL('image/png').split(',')[1] };
    }) };
  }, { src: `data:image/png;base64,${readFileSync(fonte).toString('base64')}`, estados });
} finally { await browser.close(); }
mkdirSync(destino, { recursive: true });
for (const a of resultado.arquivos) writeFileSync(`${destino}/${a.estado}.png`, bleedPng(Buffer.from(a.png, 'base64')));
const frames = estados.map(state => ({ state, direction: 'front', index: 0, path: `${destino}/${state}.png`, pivot: [0.5, 1] }));
const report = validateSpriteSpec({ id, kind: 'resource', mode: 'trial', frameSize: [64, 64], masterSize: [128, 128], frames });
writeFileSync(`${destino}/medidas.json`, JSON.stringify({ escala: resultado.escala, estados: resultado.arquivos.map(({ png: _png, ...a }) => a), report }, null, 2));
console.log(JSON.stringify({ id, success: report.success, errors: report.errors, medidas: resultado.arquivos.map(({ png: _png, ...a }) => a) }));
