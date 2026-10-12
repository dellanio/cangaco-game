'use strict';
const menu = require('../../data/menu-build.json');
const manifesto = require('../../assets/manifest.json');
async function roteiro({ page, estado, afirmar, capturar }) {
  const inicio = (await estado()).tick;
  await page.keyboard.press('p');
  for (const grupo of menu.grupos.filter(g => ['comida', 'guerra'].includes(g.id))) {
    const aba = await page.locator(`#menu-build .subaba[data-grupo="${grupo.id}"]`).boundingBox();
    afirmar(aba !== null, `aba ${grupo.id}`);
    await page.mouse.move(aba.x + aba.width / 2, aba.y + aba.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    for (let i = 0; i < grupo.predios.length; i++) {
      const id = grupo.predios[i];
      const img = page.locator(`#menu-build [data-predio="${id}"] img.retrato`);
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(img => img.decode());
      const dados = await img.evaluate(img => ({ src: img.currentSrc, w: img.naturalWidth, h: img.naturalHeight }));
      afirmar(dados.src.endsWith(manifesto.icones.predios[id].arquivo), `${id}: fonte atual`);
      afirmar(dados.w === 72 && dados.h === 72, `${id}: 72x72`);
      if (i % 3 === 2 || i === grupo.predios.length - 1) await capturar(`${grupo.id}-${i + 1}`);
    }
  }
  await page.waitForFunction(t => window.__cangaco.tick > t, inicio);
  await page.keyboard.press('p');
}
module.exports = { roteiro };
