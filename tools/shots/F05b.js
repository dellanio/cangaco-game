'use strict';

// Roteiro da F05b. So isto muda de feature para feature — tools/shot.js e o
// runner generico e nao sabe nada de HUD, predios ou camera.

const { retanguloDoCanvas } = require('./_canvas');

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const s = await estado();

  // 1. a camera abriu na vila, nao no canto
  afirmar(s.centroDaVila !== null, 'centroDaVila deveria estar publicado');
  afirmar(
    s.camera.scrollX > 0 && s.camera.scrollY > 0,
    `a camera deveria ter centralizado na vila, veio ${JSON.stringify(s.camera)}`,
  );

  // 2. os dois predios do GameState desenhados
  afirmar(
    s.prediosRenderizados === 2,
    `deveria haver 2 predios desenhados, veio ${s.prediosRenderizados}`,
  );

  // 3. o HUD mostra os numeros da tabela do cenario inicial, nao um placeholder
  const ler = (campo) => page.textContent(`#hud .valor[data-campo="${campo}"]`);
  afirmar(await ler('gold') === '20', `gold deveria ser 20, veio ${await ler('gold')}`);
  afirmar(await ler('timber') === '40', `timber deveria ser 40, veio ${await ler('timber')}`);
  afirmar(await ler('stone') === '30', `stone deveria ser 30, veio ${await ler('stone')}`);
  afirmar(await ler('comida') === '25', `comida deveria ser 25 (loaves 15 + sausages 10), veio ${await ler('comida')}`);
  afirmar(await ler('populacao') === '6/0', `populacao deveria ser 6/0, veio ${await ler('populacao')}`);

  // 4. os nomes sao do tema, nao os ids neutros da simulacao
  const textoDoHud = await page.textContent('#hud');
  for (const id of ['gold', 'timber', 'stone']) {
    afirmar(!textoDoHud.includes(id), `o HUD nao deveria mostrar o id neutro '${id}', texto: ${textoDoHud}`);
  }

  await capturar('vila'); // a screenshot do aceite: HUD + os dois predios
  const canvas = await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  await page.waitForTimeout(200);
  await capturar('hud-e-highlight');
}

module.exports = { roteiro };
