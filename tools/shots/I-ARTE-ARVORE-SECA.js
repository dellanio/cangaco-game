'use strict';
// I-ARTE-ARVORE-SECA: a arvore seca (o estado `umbuzeiro` de `tree`) numa mata do mapa, ao lado dos
// juazeiros e cactos. A camera vai ao bloco de arvores mais denso a ate 14 tiles do armazem inicial:
// longe dele e nevoa.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const arvores = mapa.recursos.tree;
  let melhor = null;
  for (const [x, y] of arvores) {
    if (Math.abs(x - 30) + Math.abs(y - 31) > 14) continue;
    const n = arvores.filter(([a, b]) => Math.abs(a - x) <= 5 && Math.abs(b - y) <= 3).length;
    if (melhor === null || n > melhor.n) melhor = { n, x, y };
  }
  afirmar(melhor !== null && melhor.n >= 4, `o mapa deveria ter uma mata: ${JSON.stringify(melhor)}`);
  const canvas = await retanguloDoCanvas(page);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((melhor.x + 0.5) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((melhor.y + 0.5) * terreno.tile_px - canvas.height / 2),
  });
  await page.keyboard.press('p');
  await page.waitForTimeout(400);
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
  await capturar('mata');
}
module.exports = { roteiro };
