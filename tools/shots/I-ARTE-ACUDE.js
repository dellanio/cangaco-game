'use strict';
const { abrirGavetas } = require('./_partida');
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
    await abrirGavetas(page, 'carregar');
    await page.waitForTimeout(150);
    const carregar = await page.locator('#gavetas button[data-acao="carregar"][data-gaveta="1"]').boundingBox();
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

  // BUG-ACUDE-COM-AGUA-NA-OBRA (2026-10-16): a obra no meio da pedra sobe seca. Conta os pixels de agua (o detector do
  // dado) no recorte da obra, na tela, com o zoom 1; o cheio, no mesmo recorte, tem agua (o detector acusa)
  const { decodePng } = await import('../../skills/pianco-sprite-tools/scripts/png-rgba.mjs');
  const aguaNaTela = async (nomeDoSave) => {
    const save = readFileSync(`test-output/${nomeDoSave}.save.txt`, 'utf8');
    await page.evaluate(v => window.localStorage.setItem('cangaco:partida', v), save);
    await abrirGavetas(page, 'carregar');
    await page.waitForTimeout(150);
    const carregar = await page.locator('#gavetas button[data-acao="carregar"][data-gaveta="1"]').boundingBox();
    await page.keyboard.press('p');
    await page.mouse.move(carregar.x + carregar.width / 2, carregar.y + carregar.height / 2);
    await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up(); await page.click('#abas [data-aba="construir"]');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
    if (!(await estado()).pausado) await page.keyboard.press('p');
    for (let i = 0; i < 10 && (await estado()).camera.zoom !== 1; i++) {
      await page.mouse.wheel(0, (await estado()).camera.zoom > 1 ? 200 : -200);
      await page.waitForTimeout(100);
    }
    const s = await estado();
    const p = s.prediosDoEstado['acude-arte'];
    await page.evaluate(c => window.__cangaco.fixarCamera(c), {
      scrollX: (p.gx + 2) * terreno.tile_px - canvas.width / 2,
      scrollY: (p.gy + 1.5) * terreno.tile_px - canvas.height / 2,
    });
    await page.mouse.move(20, 20);
    await page.waitForTimeout(250);
    const lado = 4 * terreno.tile_px;
    const recorte = await page.screenshot({ clip: { x: canvas.left + canvas.width / 2 - lado / 2, y: canvas.top + canvas.height / 2 - lado / 2, width: lado, height: lado } });
    const png = decodePng(recorte);
    let n = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 2] - png.data[i] >= config.detectorDeAgua.azulMenosVermelhoMinimo
        && png.data[i + 1] - png.data[i] >= config.detectorDeAgua.verdeMenosVermelhoMinimo) n++;
    }
    return { n, sprite: s.spritesDePredio['acude-arte'], estado: p.estado };
  };
  const naObra = await aguaNaTela('I-ARTE-ACUDE-obra-na-pedra');
  await capturar('obra-na-pedra');
  const cheio = await aguaNaTela('I-ARTE-ACUDE-cheio');
  console.log(`BUG-ACUDE-COM-AGUA-NA-OBRA: agua na obra ${naObra.n} px (${naObra.sprite}, ${naObra.estado}); no cheio ${cheio.n} px`);
  afirmar(naObra.estado === 'obra', `a obra deveria estar em obra: ${naObra.estado}`);
  afirmar(cheio.n > 500, `o detector deveria achar agua no acude cheio: ${cheio.n}`);
  afirmar(naObra.n < cheio.n / 50, `a obra nao deveria mostrar agua: ${naObra.n} px contra ${cheio.n} no cheio`);
}
module.exports = { roteiro };
