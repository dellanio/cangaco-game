'use strict';

const manifesto = require('../../assets/manifest.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const inicio = (await estado()).tick;
  await page.keyboard.press('p');
  const aba = page.locator('#menu-build .subaba[data-grupo="materia"]');
  const caixa = await aba.boundingBox();
  afirmar(caixa !== null, 'subaba Mato e Pedra presente');
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  const imagem = page.locator('#menu-build [data-predio="sawmill"] img.retrato');
  await imagem.scrollIntoViewIfNeeded();
  await imagem.evaluate((img) => img.decode());
  const retrato = await imagem.evaluate((img) => ({
    src: img.currentSrc, largura: img.naturalWidth, altura: img.naturalHeight, completo: img.complete,
  }));
  const icone = manifesto.icones.predios.sawmill;
  afirmar(retrato.src.endsWith(icone.arquivo), `serraria usa icone atual: ${JSON.stringify(retrato)}`);
  afirmar(retrato.completo && retrato.largura === icone.tamanho[0] && retrato.altura === icone.tamanho[1],
    'icone carregado nas dimensoes declaradas');
  await page.waitForFunction((tick) => window.__cangaco.tick > tick, inicio);
  const primeiroAvanco = (await estado()).tick;
  // Diagnostico de uma partida real sem extensoes: o laco continua apos interagir com o menu.
  await page.waitForTimeout(2000);
  const fim = (await estado()).tick;
  afirmar(fim > primeiroAvanco, `relogio continua: ${primeiroAvanco} -> ${fim}`);
  await page.keyboard.press('p');
  await capturar('serraria-no-menu');
  console.log(JSON.stringify({ inicio, primeiroAvanco, fim, retrato }));
}

module.exports = { roteiro };
