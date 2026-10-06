'use strict';
// I-ARTE-AGUA-PIXEL-ART: o acude da vila com a agua em pixel art, em dois quadros da animacao
// (data/agua.json `periodo` ticks entre eles). Os dois tiles no centro devem estar em variantes
// diferentes de uma captura para a outra (a ponte publica a textura? nao: confere-se pelo relogio).
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const agua = require('../../data/agua.json');

const ACUDE = { gx: 33, gy: 25.5 };

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((ACUDE.gx + 0.5) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((ACUDE.gy + 0.5) * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(300);
  const t0 = (await estado()).tick;
  await capturar('acude-1');
  await page.evaluate((k) => window.__cangaco.avancar(k), agua.periodo);
  await page.waitForTimeout(300);
  const t1 = (await estado()).tick;
  afirmar(t1 - t0 === agua.periodo, `o relogio deveria ter andado um periodo da agua: ${t0} -> ${t1}`);
  await capturar('acude-2');
}
module.exports = { roteiro };
