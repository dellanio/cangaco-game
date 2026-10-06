'use strict';
// I-ARTE-SOLO-PIXEL-ART: o chao padrao em pixel art, na vila inicial (armazem e escola) e no campo em
// volta, com as quatro variantes sorteadas por tile.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

async function roteiro({ page, capturar }) {
  const canvas = await retanguloDoCanvas(page);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round(33 * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round(33 * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(400);
  await capturar('vila');
}
module.exports = { roteiro };
