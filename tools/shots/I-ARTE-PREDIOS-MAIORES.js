'use strict';
// I-ARTE-PREDIOS-MAIORES: Casa de Carne, Casa do Gibao, Curtume (+20%) e Cocheira (+30%), de pe, ao
// lado do Moinho (referencia sem fator). O save vem de tests/I-ARTE-PREDIOS-MAIORES.test.ts.
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const save = readFileSync('test-output/I-ARTE-PREDIOS-MAIORES.save.txt', 'utf8');
  await page.evaluate((v) => window.localStorage.setItem('cangaco:partida', v), save);
  await page.keyboard.press('h'); await page.waitForTimeout(200);
  await page.click('#ajuda [data-acao="carregar"]'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  const s = await estado();
  const cc = s.prediosDoEstado.cc;
  afirmar(cc && cc.tipo === 'butchers', `a Casa de Carne do save deveria estar no estado: ${JSON.stringify(cc)}`);
  const canvas = await retanguloDoCanvas(page);
  for (const [dx, nome] of [[5, 'carne-gibao-curtume'], [18, 'cocheira-e-o-moinho']]) {
    await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
      scrollX: Math.round((cc.gx + dx) * terreno.tile_px - canvas.width / 2),
      scrollY: Math.round((cc.gy + 1) * terreno.tile_px - canvas.height / 2),
    });
    await page.waitForTimeout(300);
    await capturar(nome);
  }
}
module.exports = { roteiro };
