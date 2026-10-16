'use strict';
// I-TELA-LENHA-NO-DEQUE-DO-LENHADOR (aceite 3) — a cabana do lenhador com 3 toras na saida: a pilha no deque da arte,
// maior e girada com as tabuas. Fixture: a vila pronta do operador, carregada pela porta de save do jogador.
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TORAS = 3;

async function roteiro({ page, capturar, estado, afirmar }) {
  const salvo = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  const cabana = salvo.estado.predios.porId['woodcutters-1'];
  cabana.estoque.saida = { tree_trunk: TORAS };
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
  const pilhas = (await estado()).pilhasDesenhadas['woodcutters-1'] ?? [];
  afirmar(pilhas.length === 1 && pilhas[0].mercadoria === 'tree_trunk' && pilhas[0].n === TORAS, `a lenha da cabana desenhada: ${JSON.stringify(pilhas)}`);
  await capturar('lenha-no-deque');
}

module.exports = { roteiro };
