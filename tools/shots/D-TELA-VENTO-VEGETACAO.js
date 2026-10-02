'use strict';

const { retanguloDoCanvas } = require('./_canvas');
const mapa = require('../../data/maps/sertao-128.json');
const terreno = require('../../data/terrain.json');

function vistaMaisCheia() {
  let melhor = { x: 0, y: 0, n: 0 };
  for (let y = 0; y < mapa.altura - 11; y += 1) for (let x = 0; x < mapa.largura - 20; x += 1) {
    const n = mapa.recursos.tree.filter(([gx, gy]) => gx >= x && gx < x + 20 && gy >= y && gy < y + 11).length;
    if (n > melhor.n) melhor = { x, y, n };
  }
  return melhor;
}

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const mato = vistaMaisCheia();
  afirmar(mato.n > 0, 'o mapa precisa ter arvores para a captura');
  await page.evaluate((scroll) => window.__cangaco.fixarCamera(scroll), {
    scrollX: Math.round((mato.x + 10) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((mato.y + 5.5) * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(200);
  const antes = await estado();
  afirmar(antes.pausado, 'o roteiro inicia pausado');
  afirmar(antes.vegetacaoBalancando === antes.vegetacaoRenderizada - antes.rochasRenderizadas,
    `arvores ${antes.vegetacaoBalancando}, vegetacao ${antes.vegetacaoRenderizada}, rochas ${antes.rochasRenderizadas}`);
  afirmar(antes.vegetacaoBalancando > 0, 'deve haver arvores balancando');
  await capturar('tick-T');
  const regiao = { x: canvas.left, y: canvas.top, width: canvas.width, height: canvas.height };
  const imagemT = await page.screenshot({ clip: regiao });
  await page.evaluate(() => window.__cangaco.avancar(5));
  await page.waitForTimeout(200);
  const depois = await estado();
  afirmar(depois.tick === antes.tick + 5, 'a ponte precisa avancar cinco ticks');
  await capturar('tick-T-mais-5');
  const imagemDepois = await page.screenshot({ clip: regiao });
  afirmar(!imagemT.equals(imagemDepois), 'a regiao das arvores precisa mudar em T+5');
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('p');
  afirmar((await estado()).pausado, 'o passo despausado terminou pausado');
  console.log(`vento: ${antes.vegetacaoBalancando} sprites no quadro; vista ${mato.x},${mato.y} com ${mato.n} arvores`);
}

module.exports = { roteiro };
