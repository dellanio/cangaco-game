'use strict';
// I-TERRENO-FASE-8-MAPA-MAIOR (aceite 5) — a fase 8 abre num mundo de 192x192. A camera e levada pela ponte
// ao canto sudeste: travada na borda, a vista termina no fim do mapa, e o mapa medido em tiles e 192 (o
// sertao e as outras fases tem 128). A pagina abre com `?relevo`: o relevo e do sertao-128 e nao cobre este
// mundo, entao a camada nao nasce (o campo `relevo` nao existe na ponte) e nada vai ao console (o shot.js
// reprova qualquer erro de console).
const { URL } = require('node:url');
const terrain = require('../../data/terrain.json');
const { retanguloDoCanvas } = require('./_canvas');

const TIMEOUT_PRONTO_MS = 15_000;
const LADO_DA_FASE = 192;

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperarFrame = () => page.evaluate(() => new Promise((ok) => window.requestAnimationFrame(() => window.requestAnimationFrame(ok))));
  const url = new URL(page.url());
  url.search = '?pausado&relevo&campanha=fase-08-santa-rita';
  await page.goto(url.href);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS });
  await esperarFrame();

  const s0 = await estado();
  afirmar(s0.relevo === undefined, `o relevo do sertao-128 nao deveria nascer num mapa de ${LADO_DA_FASE}: ${JSON.stringify(s0.relevo)}`);
  console.log(`I-TERRENO-FASE-8-MAPA-MAIOR: na abertura, enfeites na vista ${s0.enfeitesNaVista}`);
  await capturar('abertura');

  // a camera alem do mundo: a cena a trava na borda sudeste
  await page.evaluate(() => window.__cangaco.fixarCamera({ scrollX: 1e7, scrollY: 1e7 }));
  await esperarFrame();
  const canvas = await retanguloDoCanvas(page);
  const { camera, terrenoVisivel } = await estado();
  const px = terrain.tile_px;
  const fimX = (camera.scrollX + canvas.width / camera.zoom) / px;
  const fimY = (camera.scrollY + canvas.height / camera.zoom) / px;
  console.log(`I-TERRENO-FASE-8-MAPA-MAIOR: a vista termina em ${fimX.toFixed(2)} x ${fimY.toFixed(2)} tiles; terreno na vista ${JSON.stringify(terrenoVisivel)}`);
  afirmar(Math.abs(fimX - LADO_DA_FASE) < 0.01 && Math.abs(fimY - LADO_DA_FASE) < 0.01,
    `a borda sudeste deveria ser o tile ${LADO_DA_FASE - 1},${LADO_DA_FASE - 1} (fim em ${LADO_DA_FASE}), veio ${fimX} x ${fimY}`);
  afirmar(fimX > terrain.mapaPadrao.largura, `o mundo da fase deveria passar do padrao (${terrain.mapaPadrao.largura})`);
  afirmar(Object.values(terrenoVisivel).reduce((a, n) => a + n, 0) > 0, 'a vista no canto deveria ter chao desenhado');
  await capturar('canto-sudeste');
}

module.exports = { roteiro };
