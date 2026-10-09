import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';
import { Buffer } from 'node:buffer';

const [raiz, saida] = process.argv.slice(2);
if (!saida) throw new Error('Uso: raiz-dos-pngs saida');
const ids = ['coal', 'iron_ore', 'gold_ore', 'fish'];
const uri = path => `data:image/png;base64,${readFileSync(path).toString('base64')}`;
const manifesto = JSON.parse(readFileSync('assets/manifest.json', 'utf8'));
const terrenos = Object.fromEntries(['grama', 'areia', 'rocha'].map(id => [id, uri(`assets/${manifesto.assets.find(a => a.id === id && a.tipo === 'terreno').estados.padrao}`)]));
const sprites = ids.flatMap(id => (id === 'fish' ? ['presente'] : ['presente', 'reduzido', 'remanescente']).map(estado => ({ id, estado, uri: uri(`${raiz}/${id}/${estado}.png`) })));
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const arquivos = await page.evaluate(async ({ sprites, terrenos }) => {
    const carregar = async src => { const i = new globalThis.Image(); i.src = src; await i.decode(); return i; };
    const images = await Promise.all(sprites.map(s => carregar(s.uri)));
    const solos = await Promise.all(Object.values(terrenos).map(carregar));
    const arquivos = {};
    for (const zoom of [0.5, 1, 2]) {
      const w = Math.ceil(80 * zoom), h = Math.ceil(100 * zoom);
      const canvas = globalThis.document.createElement('canvas'); canvas.width = w * 10; canvas.height = h * 6;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      for (let t = 0; t < 3; t++) for (let tint = 0; tint < 2; tint++) for (let i = 0; i < 10; i++) {
        const x = i * w, y = (t * 2 + tint) * h;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
        for (let gy = 0; gy < h; gy += 64 * zoom) for (let gx = 0; gx < w; gx += 64 * zoom) ctx.drawImage(solos[t], x + gx, y + gy, 64 * zoom, 64 * zoom);
        ctx.drawImage(images[i], x + (w - 64 * zoom) / 2, y + h - 64 * zoom, 64 * zoom, 64 * zoom);
        if (tint) { const pixels = ctx.getImageData(x, y, w, h); for (let j = 0; j < pixels.data.length; j += 4) for (let k = 0; k < 3; k++) pixels.data[j + k] = Math.round(pixels.data[j + k] * 0.8); ctx.putImageData(pixels, x, y); }
        ctx.fillStyle = '#fff'; ctx.font = `${Math.max(8, 8 * zoom)}px sans-serif`; ctx.fillText(`${sprites[i].id}/${sprites[i].estado}`, x + 2, y + 12 * zoom, w - 4); ctx.restore();
      }
      arquivos[zoom] = canvas.toDataURL('image/png').split(',')[1];
    }
    return arquivos;
  }, { sprites, terrenos });
  mkdirSync(saida, { recursive: true });
  for (const [zoom, png] of Object.entries(arquivos)) writeFileSync(`${saida}/fontes-zoom-${zoom}.png`, Buffer.from(png, 'base64'));
  console.log(saida);
} finally { await browser.close(); }
