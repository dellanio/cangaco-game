'use strict';

// Roteiro da F04. So isto muda de feature para feature — tools/shot.js e o
// runner generico e nao sabe nada sobre grid, camera ou highlight.

const TILE_PX = 64;

// Tile escolhido por ficar dentro do viewport 1280x720 com a camera no
// scroll inicial (0,0): canto (640,448), centro (672,480).
const TILE_ALVO = { gx: 10, gy: 7 };
const PONTO_NO_TILE_ALVO = { x: TILE_ALVO.gx * TILE_PX + 32, y: TILE_ALVO.gy * TILE_PX + 32 };

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;

  // 1. o mapa desenhado
  await capturar('mapa');

  // 2. mouse sobre um tile conhecido -> tileSobMouse bate com a mesma regra
  //    de screenToGrid (Math.floor(px / tilePx)).
  await page.mouse.move(PONTO_NO_TILE_ALVO.x, PONTO_NO_TILE_ALVO.y);
  // o listener de pointermove roda a cada frame; da um tempo pro Phaser processar.
  await page.waitForTimeout(200);
  const estadoAposMover = await estado();
  afirmar(
    Boolean(estadoAposMover.tileSobMouse)
      && estadoAposMover.tileSobMouse.gx === TILE_ALVO.gx
      && estadoAposMover.tileSobMouse.gy === TILE_ALVO.gy,
    `tileSobMouse deveria ser (${TILE_ALVO.gx},${TILE_ALVO.gy}), veio ${JSON.stringify(estadoAposMover.tileSobMouse)}`,
  );
  await capturar('highlight');

  // 3. culling ligado: o tilemap nunca desenha os 64*64 tiles do mapa inteiro
  //    de uma vez, so o que cabe no viewport.
  const estadoCulling = await estado();
  afirmar(
    estadoCulling.tilesRenderizados < 64 * 64,
    `tilesRenderizados deveria ser < 4096 (culling ligado), veio ${estadoCulling.tilesRenderizados}`,
  );

  // 4. arrastar a camera com o botao do meio
  const centroX = 640;
  const centroY = 360;
  await page.mouse.move(centroX, centroY);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(centroX - 200, centroY - 150, { steps: 10 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(200);
  await capturar('camera-movida');

  const estadoAposArrasto = await estado();
  afirmar(
    estadoAposArrasto.camera.scrollX > 0 || estadoAposArrasto.camera.scrollY > 0,
    `a camera deveria ter se movido do (0,0), veio ${JSON.stringify(estadoAposArrasto.camera)}`,
  );

  // 5. arrastar muito alem da borda oposta -> a camera bate no limite (0,0)
  await page.mouse.move(centroX, centroY);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(centroX + 5000, centroY + 5000, { steps: 20 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(200);

  const estadoNoLimite = await estado();
  afirmar(
    estadoNoLimite.camera.scrollX === 0 && estadoNoLimite.camera.scrollY === 0,
    `a camera deveria ter batido no limite (0,0), veio ${JSON.stringify(estadoNoLimite.camera)}`,
  );
}

module.exports = { roteiro };
