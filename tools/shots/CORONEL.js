'use strict';

// Visual gate for the Blender-built Casa do Coronel. It deliberately puts a
// completed 3x2 woodcutter next to the initial 3x3 schoolhouse and keeps the
// village units in frame: isolated PNG scale is not the acceptance criterion.

const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const economy = require('../../data/economy.json');

const TILE_PX = 64;
const STEP = 50;
const LIMIT = 1400;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const waitFrame = () => page.waitForTimeout(200);
  const schoolhouse = economy.estadoInicial.predios.find((building) => building.id === 'schoolhouse');
  afirmar(schoolhouse !== undefined, 'a aldeia inicial precisa da Casa do Coronel');

  // Same door line as the initial schoolhouse, one tile to its right.
  const placement = { gx: schoolhouse.gx + 4, gy: schoolhouse.gy + 1 };
  const canvas = await retanguloDoCanvas(page);
  await page.click('[data-predio="woodcutters"]');
  await waitFrame();
  const point = pontoDoTileNaTela(canvas, placement, (await estado()).camera, TILE_PX);
  await page.mouse.click(point.x, point.y);
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.keyboard.press('Escape');
  await waitFrame();

  let game = await estado();
  const planted = Object.entries(game.prediosDoEstado).find(
    ([, building]) => building.tipo === 'woodcutters' && building.gx === placement.gx && building.gy === placement.gy,
  );
  afirmar(planted !== undefined, 'a Casa do Lenhador deveria ser plantada ao lado do Coronel');
  const [plantedId] = planted;

  let elapsed = 0;
  while (game.prediosDoEstado[plantedId]?.estado !== 'completo' && elapsed < LIMIT) {
    await page.evaluate((ticks) => window.__cangaco.avancar(ticks), STEP);
    elapsed += STEP;
    await waitFrame();
    game = await estado();
  }
  afirmar(
    game.prediosDoEstado[plantedId]?.estado === 'completo',
    `a Casa do Lenhador deveria completar em ${LIMIT} ticks; estado ${JSON.stringify(game.prediosDoEstado[plantedId])}`,
  );
  afirmar(game.unidadesRenderizadas.length > 0, 'a comparacao precisa manter unidades desenhadas no quadro');

  await capturar('coronel-lenhador-unidades');
}

module.exports = { roteiro };
