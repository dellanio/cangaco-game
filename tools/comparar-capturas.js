#!/usr/bin/env node
'use strict';
// node tools/comparar-capturas.js <a.png> <b.png> [...pares] — conta os pixels que diferem entre duas
// capturas e a caixa onde eles estao. Decodifica no Chromium do Playwright (sem dependencia nova de
// PNG). D-TELA-CHAO-DETERMINISTICO: e a medida de "onde a captura muda entre duas corridas".
// `Image` e `document` existem so dentro do `page.evaluate`, que roda no Chromium, e nao no Node
/* global Image, document */
const { chromium } = require('playwright');
const fs = require('fs');

async function principal() {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length % 2 !== 0) {
    console.error('uso: node tools/comparar-capturas.js <a.png> <b.png> [<a2.png> <b2.png> ...]');
    process.exit(2);
  }
  const navegador = await chromium.launch(process.env.CANGACO_CHROMIUM ? { executablePath: process.env.CANGACO_CHROMIUM } : {});
  const pagina = await navegador.newPage();
  const resultados = [];
  for (let i = 0; i < args.length; i += 2) {
    const [a, b] = [args[i], args[i + 1]].map((f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
    const r = await pagina.evaluate(async ([ua, ub]) => {
      const carregar = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; });
      const [ia, ib] = await Promise.all([carregar(ua), carregar(ub)]);
      if (ia.width !== ib.width || ia.height !== ib.height) return { tamanhoDiferente: true };
      const ler = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
      const da = ler(ia); const db = ler(ib);
      let n = 0; let x0 = Infinity; let y0 = Infinity; let x1 = -1; let y1 = -1;
      for (let p = 0; p < da.length; p += 4) {
        if (da[p] !== db[p] || da[p + 1] !== db[p + 1] || da[p + 2] !== db[p + 2]) {
          n += 1; const px = (p / 4) % ia.width; const py = Math.floor(p / 4 / ia.width);
          x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
        }
      }
      return { largura: ia.width, altura: ia.height, diferentes: n, caixa: n === 0 ? null : [x0, y0, x1, y1] };
    }, [a, b]);
    resultados.push({ a: args[i], b: args[i + 1], ...r });
  }
  await navegador.close();
  console.log(JSON.stringify(resultados, null, 1));
}
principal().catch((e) => { console.error(e); process.exit(1); });
