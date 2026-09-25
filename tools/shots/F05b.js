'use strict';

// Roteiro da F05b. So isto muda de feature para feature — tools/shot.js e o
// runner generico e nao sabe nada de HUD, predios ou camera.

const { retanguloDoCanvas } = require('./_canvas');
// A tabela do cenario inicial vem do DADO, e nao copiada aqui: este roteiro
// afirmava `'30'` de pedra, e a decisao do operador de subir a folga da abertura
// para 8 (2026-09-25) reprovaria o roteiro sem nada estar errado na tela. O que o
// aceite da F05b afirma e "o HUD mostra a tabela, nao um placeholder" — e isso se
// afirma comparando com a tabela.
const { estadoInicial } = require('../../data/economy.json');

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
  const esperado = (campo) => String(estadoInicial.estoque[campo] ?? 0);
  for (const campo of ['gold', 'timber', 'stone']) {
    afirmar(
      (await ler(campo)) === esperado(campo),
      `${campo} deveria ser ${esperado(campo)} (data/economy.json), veio ${await ler(campo)}`,
    );
  }
  const daComida = (estadoInicial.estoque['loaves'] ?? 0) + (estadoInicial.estoque['sausages'] ?? 0);
  afirmar(
    (await ler('comida')) === String(daComida),
    `comida deveria ser ${daComida} (loaves + sausages de data/economy.json), veio ${await ler('comida')}`,
  );
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
