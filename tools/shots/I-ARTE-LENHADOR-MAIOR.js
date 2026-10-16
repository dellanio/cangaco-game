'use strict';
// I-ARTE-LENHADOR-MAIOR — a cabana do lenhador +30% (escalaDeExibicao 1,3), com um obreiro parado na frente da porta
// para a comparacao de proporcao. A fixture e a vila pronta do operador; o obreiro ocioso u7 e posto ao pe da cabana.
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const manifesto = require('../../assets/manifest.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const salvo = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  const e = salvo.estado;
  const cabana = e.predios.porId['woodcutters-1'];
  const obreiro = e.unidades.porId.u7;
  afirmar(cabana && obreiro && obreiro.fsm === 'ocioso', 'a fixture tem a cabana e o obreiro ocioso');
  e.unidades.porId.u7 = { ...obreiro, gx: cabana.gx + 1, gy: cabana.gy + 2 };
  await page.evaluate((s) => window.localStorage.setItem('cangaco:partida', s), JSON.stringify(salvo));
  await page.keyboard.press('h');
  await page.click('#ajuda [data-acao="carregar"]');
  await page.keyboard.press('Escape');
  const canvas = await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let n = 0; n < 10 && (await estado()).camera.zoom !== 2; n++) {
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(200);
  }
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((cabana.gx + 1.5) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((cabana.gy + 1) * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(300);
  const fator = manifesto.assets.find((a) => a.id === 'woodcutters' && a.tipo === 'predio').escalaDeExibicao;
  // pedido do operador (2026-10-16): o lenhador 10% menor que o +30% (1,3 x 0,9 = 1,17), e ainda maior que o original
  afirmar(fator === 1.17, `o lenhador com o fator 1,17: ${fator}`);
  afirmar(typeof (await estado()).spritesDePredio['woodcutters-1'] === 'string', 'a cabana desenhada com PNG');
  await capturar('lenhador-e-obreiro');
}

module.exports = { roteiro };
