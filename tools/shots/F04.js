'use strict';

// Roteiro da F04. So isto muda de feature para feature — tools/shot.js e o
// runner generico e nao sabe nada sobre grid, camera ou highlight.
//
// A partir da F05b a camera abre centrada na vila (centroDaVila), nao mais
// no scroll (0,0) — por isso o tile alvo do passo 2 e o delta do passo 4 sao
// calculados a partir do que a pagina publicou, nunca mais um literal fixo
// que presume onde a camera comecou. Desde a F06 o canvas tambem nao esta mais
// em (0,0) da pagina (fica abaixo do HUD): todo ponto de mouse e convertido
// pelo retangulo do canvas.

const { retanguloDoCanvas } = require('./_canvas');

const TILE_PX = 64;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;

  // 1. o mapa desenhado
  await capturar('mapa');

  // 2. mouse sobre o centro do viewport -> tileSobMouse bate com a mesma
  //    regra de screenToGrid (Math.floor(px / tilePx)), calculado a partir
  //    do scroll atual da camera.
  const canvas = await retanguloDoCanvas(page);
  const antesDeMover = await estado();
  // ponto no CENTRO do canvas, em coordenada de canvas e em coordenada de pagina
  const pontoNoCanvas = { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) };
  const tileAlvo = {
    gx: Math.floor((antesDeMover.camera.scrollX + pontoNoCanvas.x) / TILE_PX),
    gy: Math.floor((antesDeMover.camera.scrollY + pontoNoCanvas.y) / TILE_PX),
  };
  await page.mouse.move(canvas.left + pontoNoCanvas.x, canvas.top + pontoNoCanvas.y);
  // o listener de pointermove roda a cada frame; da um tempo pro Phaser processar.
  await page.waitForTimeout(200);
  const estadoAposMover = await estado();
  afirmar(
    Boolean(estadoAposMover.tileSobMouse)
      && estadoAposMover.tileSobMouse.gx === tileAlvo.gx
      && estadoAposMover.tileSobMouse.gy === tileAlvo.gy,
    `tileSobMouse deveria ser (${tileAlvo.gx},${tileAlvo.gy}), veio ${JSON.stringify(estadoAposMover.tileSobMouse)}`,
  );
  await capturar('highlight');

  // 3. culling ligado: o tilemap nunca desenha os 64*64 tiles do mapa inteiro
  //    de uma vez, so o que cabe no viewport.
  const estadoCulling = await estado();
  afirmar(
    estadoCulling.tilesRenderizados < 64 * 64,
    `tilesRenderizados deveria ser < 4096 (culling ligado), veio ${estadoCulling.tilesRenderizados}`,
  );

  // 4. arrastar a camera com o botao do meio -> o scroll se move pelo delta
  //    exato do arrasto, nao mais "> 0" (que com a camera ja centrada na
  //    vila seria verdade antes mesmo do arrasto, e nao provaria nada).
  const antesDoArrasto = await estado();
  const centroX = canvas.left + pontoNoCanvas.x;
  const centroY = canvas.top + pontoNoCanvas.y;
  const deltaX = -200;
  const deltaY = -150;
  await page.mouse.move(centroX, centroY);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(centroX + deltaX, centroY + deltaY, { steps: 10 });
  await page.mouse.up({ button: 'middle' });
  await page.waitForTimeout(200);
  await capturar('camera-movida');

  const estadoAposArrasto = await estado();
  // arrastar para a esquerda/cima move a camera para a esquerda/cima
  // tambem (WorldScene.ts: scroll -= dx, com dx negativo aqui).
  afirmar(
    estadoAposArrasto.camera.scrollX === antesDoArrasto.camera.scrollX - deltaX
      && estadoAposArrasto.camera.scrollY === antesDoArrasto.camera.scrollY - deltaY,
    `a camera deveria ter mudado em (${-deltaX},${-deltaY}) a partir de `
      + `${JSON.stringify(antesDoArrasto.camera)}, veio ${JSON.stringify(estadoAposArrasto.camera)}`,
  );

  // 5. arrastar repetidamente ate bater no limite (0,0). Um unico arrasto
  //    saindo do canvas nao funciona: passar da borda tira o ponteiro
  //    da pagina, o Chromium para de entregar mousemove e o excesso pedido
  //    (ex.: 5000px) nao vira scroll nenhum — confirmado com um script de
  //    depuracao nesta sessao (ver PROGRESS.md). Por isso cada arrasto fica
  //    dentro da viewport, e repete ate a camera nao ter mais para onde ir.
  // scrollX/scrollY caem quando o mouse anda para a direita/baixo (dx e dy
  // positivos): camera.scrollX -= dx (WorldScene.ts). Por isso o arrasto vai
  // do canto superior esquerdo para o inferior direito, nao o contrario.
  const margem = { x: 30, y: 20 };
  const cantoInicial = { x: canvas.left + margem.x, y: canvas.top + margem.y };
  const cantoFinal = { x: canvas.right - margem.x, y: canvas.bottom - margem.y };
  for (let i = 0; i < 8; i++) {
    const antesDaIteracao = await estado();
    if (antesDaIteracao.camera.scrollX === 0 && antesDaIteracao.camera.scrollY === 0) break;
    await page.mouse.move(cantoInicial.x, cantoInicial.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(cantoFinal.x, cantoFinal.y, { steps: 20 });
    await page.mouse.up({ button: 'middle' });
    await page.waitForTimeout(100);
  }

  const estadoNoLimite = await estado();
  afirmar(
    estadoNoLimite.camera.scrollX === 0 && estadoNoLimite.camera.scrollY === 0,
    `a camera deveria ter batido no limite (0,0), veio ${JSON.stringify(estadoNoLimite.camera)}`,
  );
}

module.exports = { roteiro };
