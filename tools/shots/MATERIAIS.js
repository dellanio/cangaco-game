'use strict';

// Visual gate for the material/function/azimuth system. Names are deliberately
// absent from the world: quarry and woodcutter must read from their sprites.

const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const economy = require('../../data/economy.json');

const TILE_PX = 64;
const STEP = 50;
const LIMIT = 1600;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const waitFrame = () => page.waitForTimeout(180);
  const schoolhouse = economy.estadoInicial.predios.find((building) => building.id === 'schoolhouse');
  afirmar(schoolhouse !== undefined, 'a aldeia inicial precisa da Casa do Coronel');
  const placements = [
    { tipo: 'quarry', gx: schoolhouse.gx + 4, gy: schoolhouse.gy + 1 },
    { tipo: 'woodcutters', gx: schoolhouse.gx + 4, gy: schoolhouse.gy + 4 },
  ];
  const ids = [];

  for (const placement of placements) {
    const canvas = await retanguloDoCanvas(page);
    await page.click(`[data-predio="${placement.tipo}"]`);
    await waitFrame();
    const point = pontoDoTileNaTela(canvas, placement, (await estado()).camera, TILE_PX);
    await page.mouse.click(point.x, point.y);
    await page.evaluate(() => window.__cangaco.avancar(1));
    await page.keyboard.press('Escape');
    await waitFrame();
    const game = await estado();
    const planted = Object.entries(game.prediosDoEstado).find(
      ([, building]) => building.tipo === placement.tipo && building.gx === placement.gx && building.gy === placement.gy,
    );
    afirmar(planted !== undefined, `${placement.tipo} deveria ser plantado para o portao visual`);
    ids.push(planted[0]);
  }

  let elapsed = 0;
  let game = await estado();
  while (ids.some((id) => game.prediosDoEstado[id]?.estado !== 'completo') && elapsed < LIMIT) {
    await page.evaluate((ticks) => window.__cangaco.avancar(ticks), STEP);
    elapsed += STEP;
    await waitFrame();
    game = await estado();
  }
  for (const id of ids) {
    afirmar(game.prediosDoEstado[id]?.estado === 'completo', `${id} deveria completar em ${LIMIT} ticks`);
  }
  // Center the two candidates; both were planted east of the initial village.
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(240);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('Escape');
  await page.mouse.move(100, 150);
  await waitFrame();
  await capturar('pedreira-lenhador-sem-legenda');
}

module.exports = { roteiro };
