'use strict';
const terreno = require('../../data/terrain.json');
const { retanguloDoCanvas } = require('./_canvas');
async function roteiro({ page, estado, afirmar, capturar }) {
  const centro = terreno.geracao.lajedoDaVila, canvas = await retanguloDoCanvas(page);
  const antes = await estado();
  await page.evaluate(c => window.__cangaco.fixarCamera(c), {
    scrollX: (centro.gx + 0.5) * terreno.tile_px - canvas.width / (2 * antes.camera.zoom),
    scrollY: (centro.gy + 0.5) * terreno.tile_px - canvas.height / (2 * antes.camera.zoom),
  });
  await page.waitForTimeout(200);
  const s = await estado(), trechos = Object.entries(s.serra.trechos).filter(([k]) => {
    const [x, y] = k.split(',').map(Number);
    return (x - centro.gx) ** 2 + (y - centro.gy) ** 2 <= centro.raio ** 2;
  });
  afirmar(trechos.length === 13, 'os treze tiles novos estao desenhados');
  afirmar(trechos.every(([, t]) => t.volume === 15 && t.textura.startsWith('vegetacao:rock:v15:')), 'lajedo inteiro conserva volume e arte homologada');
  afirmar(s.serra.trechos['24,33'] === undefined, 'extremo sul antigo nao tem mais lajedo');
  await capturar('lajedo-tres-tiles-ao-norte');
}
module.exports = { roteiro };
