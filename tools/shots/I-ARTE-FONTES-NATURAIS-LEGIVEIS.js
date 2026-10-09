'use strict';
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
async function roteiro({ page, afirmar, capturar }) {
  execFileSync(process.execPath, ['tools/prancha-fontes-naturais.mjs', 'assets/sprites/resources', 'screenshots'], { cwd: process.cwd(), stdio: 'pipe' });
  for (const zoom of [0.5, 1, 2]) {
    const bytes = readFileSync(resolve(`screenshots/fontes-zoom-${zoom}.png`));
    await page.evaluate(async src => {
      globalThis.document.querySelector('#fontes-prova')?.remove();
      const imagem = new globalThis.Image(); imagem.id = 'fontes-prova'; imagem.src = src; await imagem.decode();
      imagem.style.cssText = 'position:absolute;z-index:9999;left:0;top:0'; globalThis.document.body.append(imagem);
    }, `data:image/png;base64,${bytes.toString('base64')}`);
    afirmar(await page.locator('#fontes-prova').evaluate(i => i.naturalWidth > 0), 'prancha com PNGs reais carregada');
    await capturar(`prancha-zoom-${zoom}`);
    await page.locator('#fontes-prova').screenshot({ path: `screenshots/I-ARTE-FONTES-NATURAIS-LEGIVEIS-prancha-${zoom}.png` });
  }
  await page.evaluate(() => globalThis.document.querySelector('#fontes-prova')?.remove());
}
module.exports = { roteiro };
