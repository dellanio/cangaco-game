'use strict';

// Scale and recognition gate: both initial 3x3 two-storey buildings must be
// visible together, with no world label needed to tell warehouse from residence.

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const game = await estado();
  const buildings = Object.values(game.prediosDoEstado);
  afirmar(buildings.some((b) => b.tipo === 'storehouse' && b.estado === 'completo'), 'o Armazem inicial deve estar completo');
  afirmar(buildings.some((b) => b.tipo === 'schoolhouse' && b.estado === 'completo'), 'a Casa do Coronel inicial deve estar completa');
  await page.mouse.move(100, 150);
  await page.waitForTimeout(250);
  await capturar('armazem-coronel-sem-legenda');
}

module.exports = { roteiro };
