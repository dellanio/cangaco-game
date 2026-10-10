'use strict';
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const config = require('../../data/acude-arte.json');
const terreno = require('../../data/terrain.json');
const { URL } = require('node:url');

async function roteiro({ page, estado, afirmar, capturar }) {
  const url = new URL(page.url()); url.searchParams.set('semNevoa', '');
  await page.goto(url.toString()); await page.waitForFunction(() => window.__cangaco?.pronto);
  const canvas = await retanguloDoCanvas(page);
  for (const nivel of config.estados) {
    const save = readFileSync(`test-output/I-ARTE-ACUDE-${nivel}.save.txt`, 'utf8');
    await page.evaluate(v => window.localStorage.setItem('cangaco:partida', v), save);
    await page.keyboard.press('h');
    await page.waitForTimeout(150);
    const carregar = await page.locator('#ajuda [data-acao="carregar"][data-gaveta="1"]').boundingBox();
    afirmar(carregar !== null, 'botão carregar existe');
    // Um passo despausado e botão segurado: também exercita a ajuda com o jogo andando.
    await page.keyboard.press('p');
    await page.mouse.move(carregar.x + carregar.width / 2, carregar.y + carregar.height / 2);
    await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    let s = await estado();
    if (!s.pausado) await page.keyboard.press('p');
    s = await estado();
    const p = s.prediosDoEstado['acude-arte'];
    afirmar(p?.tipo === 'reservoir', 'cenário carregou o Açude');
    const sprite = s.spritesDePredio['acude-arte'];
    afirmar(sprite === `predio:reservoir:${nivel}`, `${nivel}: sprite real, sem placeholder: ${sprite}`);
    if (nivel !== 'madeira') afirmar(s.acudes['acude-arte'].estado === nivel, `${nivel}: nível lido pela cena`);
    for (const zoom of [0.5, 1, 2]) {
      await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
      for (let i = 0; i < 10 && (await estado()).camera.zoom !== zoom; i++) {
        await page.mouse.wheel(0, (await estado()).camera.zoom > zoom ? 200 : -200);
        await page.waitForTimeout(100);
      }
      s = await estado();
      afirmar(s.camera.zoom === zoom, `zoom ${zoom} alcançado`);
      await page.evaluate(c => window.__cangaco.fixarCamera(c), {
        scrollX: (p.gx + 2) * terreno.tile_px - canvas.width / 2,
        scrollY: (p.gy + 1.5) * terreno.tile_px - canvas.height / 2,
      });
      await page.mouse.move(20, 20);
      await page.waitForTimeout(200);
      await capturar(`${nivel}-zoom-${zoom}`);
    }
  }
}
module.exports = { roteiro };
