'use strict';
// Roteiro da D-TELA-06 — O JOGO EXIGE WEBGL.
//
//   1. com o jogo rodando, o renderizador ativo e WebGL: `game.renderer.type`, publicado pela
//      cena em `__cangaco.renderizador.tipo`, e igual a `Phaser.WEBGL` (`.webgl`). Um passo
//      despausado confirma que o quadro segue desenhando;
//   2. a mesma pagina com o WebGL negado (getContext('webgl') devolve null, antes de qualquer
//      script): o jogo nao inicia (`__cangaco` nao existe, nenhum canvas do Phaser) e a
//      mensagem aparece.
const MENSAGEM = 'Este jogo precisa de WebGL; ative a aceleração de hardware do navegador';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;

  // 1. o renderizador ativo
  let s = await estado();
  afirmar(s.renderizador.webgl >= 0, `a cena deveria publicar o renderizador: ${JSON.stringify(s.renderizador)}`);
  afirmar(s.renderizador.tipo === s.renderizador.webgl,
    `o renderizador ativo deveria ser WebGL (Phaser.WEBGL=${s.renderizador.webgl}), veio ${s.renderizador.tipo}`);
  const tick0 = s.tick;
  await page.keyboard.press('p');
  await page.waitForTimeout(600);
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  s = await estado();
  afirmar(s.tick > tick0, 'despausado, o jogo deveria andar no WebGL');
  afirmar(await page.$('#sem-webgl') === null, 'com WebGL nao deveria haver aviso');
  await capturar('com-webgl');

  // 2. sem WebGL: o portao recusa antes do jogo existir
  await page.addInitScript(() => {
    const original = window.HTMLCanvasElement.prototype.getContext;
    window.HTMLCanvasElement.prototype.getContext = function getContext(tipo, ...resto) {
      if (tipo === 'webgl' || tipo === 'webgl2' || tipo === 'experimental-webgl') return null;
      return original.call(this, tipo, ...resto);
    };
  });
  await page.reload();
  await page.waitForSelector('#sem-webgl', { timeout: 10000 });
  const texto = await page.textContent('#sem-webgl');
  afirmar(texto === MENSAGEM, `a mensagem deveria ser a do pedido, veio "${texto}"`);
  afirmar(await page.isVisible('#sem-webgl'), 'a mensagem deveria estar visivel');
  await page.waitForTimeout(500);
  const semJogo = await page.evaluate(() => ({ ponte: window.__cangaco === undefined, canvas: window.document.querySelectorAll('#jogo canvas').length }));
  afirmar(semJogo.ponte && semJogo.canvas === 0, `sem WebGL o jogo nao deveria iniciar: ${JSON.stringify(semJogo)}`);
  await capturar('sem-webgl');
}

module.exports = { roteiro };
