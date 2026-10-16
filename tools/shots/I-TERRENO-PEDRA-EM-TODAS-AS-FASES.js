'use strict';
// I-TERRENO-PEDRA-EM-TODAS-AS-FASES (aceite 6) — a abertura das fases 1 e 2, onde antes nao se via pedra
// nenhuma: o lajedo da vila aparece na primeira tela, com a camera onde a fase a poe.
const { URL } = require('node:url');

const TIMEOUT_PRONTO_MS = 15_000;
const terrain = require('../../data/terrain.json');

/** A fase e o centro do lajedo da vila no gerador (tools/gerar-fases.mjs). */
const FASES = [['fase-01-pianco', 14, 30], ['fase-02-patos', 12, 38]];

async function roteiro({ page, capturar }) {
  const esperarFrame = () => page.evaluate(() => new Promise((ok) => window.requestAnimationFrame(() => window.requestAnimationFrame(ok))));
  const px = terrain.tile_px;
  for (const [fase, gx, gy] of FASES) {
    const url = new URL(page.url());
    url.search = `?pausado&campanha=${fase}`;
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS });
    await esperarFrame();
    await capturar(fase);
    // a camera no lajedo da vila: a nevoa e a do inicio (pausado, nada andou)
    const tela = await page.evaluate(() => ({ l: window.innerWidth, a: window.innerHeight }));
    await page.evaluate((s) => window.__cangaco.fixarCamera(s), { scrollX: gx * px - tela.l / 2, scrollY: gy * px - tela.a / 2 });
    await esperarFrame();
    await capturar(`${fase}-lajedo`);
  }
}

module.exports = { roteiro };
