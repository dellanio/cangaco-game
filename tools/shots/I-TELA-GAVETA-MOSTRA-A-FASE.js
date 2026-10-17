'use strict';
// I-TELA-GAVETA-MOSTRA-A-FASE (aceite 2) — a fase 1 guardada na gaveta 2, pelo bloco Partida da aba Opcoes; o popup de
// Carregar mostra "Fase 1 · Piancó" nessa gaveta. Uma captura do popup.
const { URL } = require('node:url');
const { abrirGavetas, salvarGaveta } = require('./_partida');

async function roteiro({ page, capturar, afirmar }) {
  const url = new URL(page.url());
  url.search = '?pausado&campanha=fase-01-pianco';
  await page.goto(url.href);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
  await page.waitForTimeout(300);
  // um passo despausado (§8): o painel e redesenhado entre o apertar e o soltar
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p');
  await salvarGaveta(page, 2);
  await abrirGavetas(page, 'carregar');
  const texto = await page.$eval('#gavetas .gaveta:nth-child(2) .texto', (e) => e.textContent);
  afirmar(texto !== null && texto.includes('Fase 1 · Piancó'), `a gaveta 2 deveria dizer a fase: ${texto}`);
  await capturar('popup-carregar');
  console.log(`I-TELA-GAVETA-MOSTRA-A-FASE — "${texto}"`);
}

module.exports = { roteiro };
