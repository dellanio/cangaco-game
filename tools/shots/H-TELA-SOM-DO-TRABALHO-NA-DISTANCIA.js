'use strict';

// Roteiro da H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA — o laco de trabalho perto toca, longe para, aceite (c).
//
// Carrega pela ajuda (gaveta 1) o save que `tests/H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA.test.ts` grava:
// o primeiro tick da abertura com um laborer `martelando` numa obra. A camera vai, pela ponte, a tres
// lugares: em cima do laborer, a meio raio dele e alem do raio. O contador de sons
// (`__cangacoSom.contadores().trabalho.vozes`) mostra o laco `build-wood` tocando perto, com o volume
// pedido menor a meia distancia que no centro, e parado longe. Sem arquivo o laco conta do mesmo
// jeito (o contador e o que a tela pede, com e sem arquivo). Uma captura em cada lugar.

const { existsSync, readFileSync } = require('node:fs');
const terreno = require('../../data/terrain.json');
const som = require('../../data/som.json');
const { retanguloDoCanvas } = require('./_canvas');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts
const SAVE = 'test-output/H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA.save.txt';
const PARTIDA = 'test-output/H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA.partida.json';
const RAIO = som.distancia.raioTiles;
const ID = som.trabalho.construir;

async function roteiro(ctx) {
  const { page, capturar, afirmar, estado } = ctx;
  const esperarFrame = () => page.waitForTimeout(250);
  for (const a of [SAVE, PARTIDA]) afirmar(existsSync(a), `${a} nao existe: rode \`npm run test\` antes`);
  const plano = JSON.parse(readFileSync(PARTIDA, 'utf8'));
  const canvas = await retanguloDoCanvas(page);

  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(SAVE, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda button[data-acao="carregar"][data-gaveta="1"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  const s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  afirmar(s.pausado === true, 'o roteiro mede com o jogo pausado: o laborer fica martelando');

  /** Poe o centro da camera no tile (pela ponte: exato, sem tempo de parede) e le as vozes. */
  async function olharPara(gx, gy) {
    await page.evaluate(([x, y]) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }),
      [(gx + 0.5) * TILE_PX - canvas.width / 2, (gy + 0.5) * TILE_PX - canvas.height / 2]);
    await esperarFrame();
    return page.evaluate((id) => window.__cangacoSom.contadores().trabalho.vozes.filter((v) => v.id === id), ID);
  }

  const perto = await olharPara(plano.tile.gx, plano.tile.gy);
  afirmar(perto.length > 0, `com a camera no laborer, o laco '${ID}' deveria tocar; vozes: ${JSON.stringify(perto)}`);
  await capturar('perto');
  const meio = await olharPara(plano.tile.gx + Math.round(RAIO / 2), plano.tile.gy);
  afirmar(meio.length > 0, `a meio raio o laco '${ID}' ainda deveria tocar; vozes: ${JSON.stringify(meio)}`);
  const vPerto = Math.max(...perto.map((v) => v.volume));
  const vMeio = Math.max(...meio.map((v) => v.volume));
  afirmar(vMeio < vPerto && vMeio > 0, `a meio raio o volume deveria ser menor que no centro e maior que zero: ${vMeio} contra ${vPerto}`);
  await capturar('meio-raio');
  const longe = await olharPara(plano.tile.gx + RAIO + 6, plano.tile.gy);
  afirmar(longe.length === 0, `alem do raio o laco '${ID}' deveria parar; vozes: ${JSON.stringify(longe)}`);
  await capturar('longe');
  console.log(`H-TELA-SOM-DO-TRABALHO-NA-DISTANCIA: '${ID}' perto ${vPerto.toFixed(3)}, a meio raio ${vMeio.toFixed(3)}, alem do raio parado`);
}

module.exports = { roteiro };
