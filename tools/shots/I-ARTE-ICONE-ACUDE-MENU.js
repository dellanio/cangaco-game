'use strict';
// I-ARTE-ICONE-ACUDE-MENU (aceite 3) — a aba De Comer do menu de construir, com o botao do Acude. O Acude abre
// trancado (desbloqueia com a pedreira), e o icone aparece apagado, como o dos outros trancados. A captura do
// botao fica ao lado do icone anterior (o PNG antigo, que continua no disco) para a comparacao do operador.
const { readFileSync } = require('node:fs');
const manifesto = require('../../assets/manifest.json');

async function roteiro({ page, capturar, afirmar }) {
  await page.waitForTimeout(500);
  await page.click('[data-grupo="comida"]');
  await page.waitForTimeout(400);
  const botao = page.locator('[data-predio="reservoir"]');
  const caixa = await botao.boundingBox();
  afirmar(caixa !== null && caixa.width > 0 && caixa.height > 0, `o botao do Acude deveria estar na aba De Comer: ${JSON.stringify(caixa)}`);

  // o botao usa o PNG do manifesto (o estilo `background-image` ou um <img>): mede o que ele carrega de verdade
  const usado = await botao.evaluate((n) => {
    const todos = [n, ...n.querySelectorAll('*')];
    const urls = [];
    for (const e of todos) {
      const fundo = getComputedStyle(e).backgroundImage;
      if (fundo && fundo !== 'none') urls.push(fundo);
      if (e.tagName === 'IMG') urls.push(e.getAttribute('src') ?? '');
    }
    return urls;
  });
  const arquivoNovo = manifesto.icones.predios.reservoir.arquivo.split('/').pop();
  console.log(`I-ARTE-ICONE-ACUDE-MENU: o botao carrega ${JSON.stringify(usado)}; esperado ${arquivoNovo}`);
  afirmar(usado.some((u) => u.includes('icone-recorte-20261015')), `o botao do Acude deveria carregar o icone novo (${arquivoNovo}): ${JSON.stringify(usado)}`);
  afirmar(readFileSync('assets/sprites/reservoir/icone-atual.png').length > 0, 'o icone anterior deveria continuar no disco');
  await capturar('menu-de-comer');
}

module.exports = { roteiro };
