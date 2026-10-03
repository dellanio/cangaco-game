'use strict';

// Roteiro da E-TELA-MENU-INICIAL — A PORTA DO JOGO.
//
// O runner abre `/?pausado` (o jogo direto, como todo roteiro: com parametro, o menu nao aparece).
// Daqui o roteiro navega por conta propria:
//   1. `/` sem parametro e sem save: o menu, NENHUM canvas e nenhum `__cangaco` (aceite a); o
//      Continuar desabilitado, com o motivo do tema (aceite c); a foto do menu (aceite e).
//   2. `/?menu&pausado`: Novo jogo > Escaramuca. O estado do tick 0 e o do `/?escaramuca&pausado`,
//      byte a byte (aceite b), pelo `__cangacoPartida.estadoSerializado()` do laco externo.
//   3. `/` DESPAUSADO (§8): Novo jogo > Jogo livre com mouse.down / 150 ms / mouse.up; o relogio
//      corre depois da escolha, e o roteiro pausa de volta (`p`).

const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');

const ROTULOS = tema.menuInicial;
const BOTAO = (acao) => `#menu-inicial button[data-acao="${acao}"]`;
const TIMEOUT_PRONTO_MS = 10_000;

async function roteiro(ctx) {
  const { page, capturar, afirmar } = ctx;
  const base = new URL('/', page.url()).href;

  /** O clique segurado 150 ms (§8): o laco, se correr, redesenha entre o aperto e a soltura. */
  async function segurar(acao) {
    const caixa = await page.$eval(BOTAO(acao), (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(caixa.x, caixa.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
  const esperarJogo = () => page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TIMEOUT_PRONTO_MS });
  const serializado = () => page.evaluate(() => window.__cangacoPartida.estadoSerializado());

  // ---- 1. `/` sem save: o menu, e nada do jogo ------------------------------------------------
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(base);
  await page.waitForSelector('#menu-inicial');
  await page.waitForTimeout(300);
  const antesDaEscolha = await page.evaluate(() => ({
    canvas: window.document.querySelectorAll('canvas').length,
    cangaco: window.__cangaco !== undefined,
    partida: window.__cangacoPartida !== undefined,
  }));
  afirmar(antesDaEscolha.canvas === 0, `antes da escolha nao deveria existir canvas, ha ${antesDaEscolha.canvas}`);
  afirmar(!antesDaEscolha.cangaco && !antesDaEscolha.partida, 'antes da escolha o jogo nao deveria ter nascido');
  for (const [acao, rotulo] of [['novo', ROTULOS.novoJogo], ['continuar', ROTULOS.continuar], ['carregar', ROTULOS.carregar], ['ajuda', ROTULOS.ajuda]]) {
    afirmar((await page.textContent(BOTAO(acao))) === rotulo, `o botao '${acao}' deveria dizer '${rotulo}'`);
  }
  afirmar((await page.getAttribute(BOTAO('continuar'), 'aria-disabled')) === 'true', 'sem save, o Continuar deveria estar desabilitado');
  const motivo = await page.textContent('#menu-inicial [data-motivo="continuar"]');
  afirmar(motivo === ROTULOS['sem-save'], `o Continuar deveria dizer por que: '${ROTULOS['sem-save']}', veio '${motivo}'`);
  await page.click(BOTAO('continuar'), { force: true });
  await page.waitForTimeout(200);
  afirmar(await page.isVisible('#menu-inicial'), 'clicar no Continuar desabilitado nao pode sair do menu');
  await capturar('menu');

  // a Ajuda abre por cima do menu e fecha com Esc, sem comecar o jogo
  await page.click(BOTAO('ajuda'));
  await page.waitForTimeout(200);
  afirmar(await page.isVisible('#ajuda'), 'a Ajuda do menu deveria abrir a tela de ajuda');
  await capturar('ajuda');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  afirmar(await page.isHidden('#ajuda'), 'Esc deveria fechar a ajuda do menu');
  afirmar((await page.evaluate(() => window.document.querySelectorAll('canvas').length)) === 0, 'a ajuda nao pode comecar o jogo');

  // ---- 2. a escaramuca pelo menu e a do ?escaramuca, no tick 0 --------------------------------
  await page.goto(`${base}?menu&pausado`);
  await page.waitForSelector('#menu-inicial');
  await page.click(BOTAO('novo'));
  afirmar((await page.textContent(BOTAO('escaramuca'))) === ROTULOS.escaramuca, 'Novo jogo deveria oferecer a escaramuca');
  afirmar((await page.textContent(BOTAO('livre'))) === ROTULOS.livre, 'Novo jogo deveria oferecer o jogo livre');
  await page.click(BOTAO('escaramuca'));
  await esperarJogo();
  afirmar(await page.isHidden('#menu-inicial').catch(() => true), 'o menu deveria sumir depois da escolha');
  const peloMenu = await serializado();
  afirmar((await page.evaluate(() => window.__cangaco.tick)) === 0, 'a escaramuca pausada deveria estar no tick 0');
  await capturar('escaramuca-pelo-menu');
  await page.goto(`${base}?escaramuca&pausado`);
  await esperarJogo();
  afirmar((await page.evaluate(() => window.document.querySelector('#menu-inicial'))) === null, 'com ?escaramuca o menu nao deveria aparecer');
  const pelaUrl = await serializado();
  afirmar(peloMenu === pelaUrl, `a escaramuca do menu deveria ser igual a do ?escaramuca no tick 0 (${peloMenu.length} contra ${pelaUrl.length} bytes)`);

  // ---- 3. despausado: o clique segurado 150 ms comeca o jogo livre, e o relogio corre ----------
  await page.goto(base);
  await page.waitForSelector('#menu-inicial');
  await segurar('novo');
  await page.waitForTimeout(150);
  await segurar('livre');
  await esperarJogo();
  await page.waitForFunction(() => window.__cangaco.tick > 0, { timeout: TIMEOUT_PRONTO_MS });
  const corrido = await page.evaluate(() => ({ tick: window.__cangaco.tick, pausado: window.__cangaco.pausado }));
  afirmar(!corrido.pausado && corrido.tick > 0, `o jogo livre do menu deveria correr: ${JSON.stringify(corrido)}`);
  const ids = await page.evaluate(() => Object.keys(window.__cangaco.prediosDoEstado).length);
  afirmar(ids > 0, 'o jogo livre deveria nascer com a vila inicial');
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  afirmar(await page.evaluate(() => window.__cangaco.pausado), 'P deveria pausar de volta');
  console.log(`E-TELA-MENU-INICIAL: sem canvas antes da escolha, escaramuca igual (${peloMenu.length} bytes), livre correu ate o tick ${corrido.tick}`);
}

module.exports = { roteiro };
