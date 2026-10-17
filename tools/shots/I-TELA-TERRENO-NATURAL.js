'use strict';
// I-TELA-TERRENO-NATURAL (aceite 2) — na fase 1, as duas camadas da borda e as manchas de tom criadas; no sertao (jogo
// livre), nada; e a mesma area da fase 1 capturada (a de mais areia perto da vila). `?semNevoa` tira so a camada escura.
const { writeFileSync } = require('node:fs');
const { URL } = require('node:url');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const abrir = async (busca) => {
    const url = new URL(page.url());
    url.search = busca;
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
    await page.waitForTimeout(300);
  };
  await abrir('?pausado&semNevoa&livre');
  const noSertao = (await estado()).terrenoNatural;
  afirmar(noSertao && noSertao.ativo === false, `no sertao, nada: ${JSON.stringify(noSertao)}`);

  await abrir('?pausado&semNevoa&campanha=fase-01-pianco');
  const naFase = (await estado()).terrenoNatural;
  afirmar(naFase.ativo && naFase.amostrasDeAreia > 0 && naFase.amostrasDeGrama > 0 && naFase.tons > 0,
    `na fase 1, as camadas e os tons: ${JSON.stringify(naFase)}`);
  const canvas = await retanguloDoCanvas(page);
  for (const [nome, cx, cy, zoom] of [['fase-1-areia', 38, 95, 1], ['fase-1-perto', 38, 95, 2]]) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let n = 0; n < 10 && (await estado()).camera.zoom !== zoom; n++) { await page.mouse.wheel(0, (await estado()).camera.zoom < zoom ? -200 : 200); await page.waitForTimeout(200); }
    await page.evaluate((c) => window.__cangaco.fixarCamera(c), { scrollX: Math.round(cx * terreno.tile_px - canvas.width / 2), scrollY: Math.round(cy * terreno.tile_px - canvas.height / 2) });
    await page.waitForTimeout(300);
    await capturar(nome);
  }
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p'); await page.waitForTimeout(150);
  writeFileSync('test-output/I-TELA-TERRENO-NATURAL.json', JSON.stringify({ noSertao, naFase }, null, 2));
}

module.exports = { roteiro };
