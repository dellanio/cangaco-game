'use strict';

// Roteiro da E-SAVE-GAVETAS — TRES GAVETAS PELA TELA.
//
// O headless (`tests/E-SAVE-GAVETAS.test.ts`) prova o arquivo com uma gaveta de mentira. Aqui, o
// gesto: no jogo (o runner abre `/?pausado`), guardar na 3 e estragar a versao dela, guardar na 1 no
// tick 20 e na 2 no tick 60; cada linha da ajuda diz o que tem. O botao "Menu inicial" volta ao menu,
// o Carregar mostra a 3 recusada com o motivo, e o Continuar, DESPAUSADO e segurado 150 ms (§8), abre
// a 2: a partida segue do tick 60, e nao do 20 da gaveta 1.

const tema = require('../../data/theme-sertao.json');

const ROTULOS = tema.hud.arquivo;
const GAVETAS = ROTULOS.gavetas;
const NA_AJUDA = (acao, n) => `#ajuda .arquivo button[data-acao="${acao}"][data-gaveta="${n}"]`;
const LINHA = (n) => `#ajuda .arquivo .gaveta[data-gaveta="${n}"] [data-campo="gaveta"]`;
const NO_MENU = (acao) => `#menu-inicial button[data-acao="${acao}"]`;
const TIMEOUT_PRONTO_MS = 10_000;
/** Teto do passo despausado, com folga: seguranca contra o relogio disparar, nao medida (§8). */
const TETO_DE_TICKS_DESPAUSADO = 60;

async function roteiro(ctx) {
  const { page, capturar, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = async (n) => {
    await page.evaluate((k) => window.__cangaco.avancar(k), n);
    await esperarFrame();
  };
  const tick = () => page.evaluate(() => window.__cangaco.tick);
  const guardar = async (n) => {
    await page.click(NA_AJUDA('salvar', n));
    await esperarFrame();
  };

  await page.evaluate(() => window.localStorage.clear());
  await page.keyboard.press('h');
  await esperarFrame();
  afirmar(await page.isVisible('#ajuda .arquivo .gavetas'), 'a secao Partida deveria ter a lista das gavetas');
  for (const n of [1, 2, 3]) {
    const texto = await page.textContent(LINHA(n));
    afirmar(texto === `${GAVETAS.nome.replace('{n}', String(n))}: ${GAVETAS.vazia}`, `a gaveta ${n} deveria nascer vazia, diz '${texto}'`);
  }

  // ---- 1. a 3 guardada e estragada (a versao de outra build), a 1 no tick 20, a 2 no 60 ---------
  await guardar(3);
  await page.evaluate(() => {
    const envelope = JSON.parse(window.localStorage.getItem('cangaco:partida:3'));
    envelope.versao += 50;
    window.localStorage.setItem('cangaco:partida:3', JSON.stringify(envelope));
  });
  await avancar(20);
  await guardar(1);
  await avancar(40);
  afirmar((await tick()) === 60, `a partida deveria estar no tick 60, esta no ${await tick()}`);
  await guardar(2);
  const linhas = {};
  for (const n of [1, 2, 3]) linhas[n] = await page.textContent(LINHA(n));
  afirmar(linhas[1].includes('tick 20') && linhas[2].includes('tick 60'), `as linhas deveriam dizer o tick de cada gaveta: ${JSON.stringify(linhas)}`);
  afirmar(linhas[1].includes(GAVETAS.tipos.livre), `a gaveta 1 deveria dizer o tipo da partida: '${linhas[1]}'`);
  afirmar(linhas[3].includes('versao'), `a gaveta 3 deveria aparecer recusada, com o motivo: '${linhas[3]}'`);
  await capturar('gavetas-no-jogo');

  // ---- 2. o menu inicial: o Carregar mostra as tres, a 3 recusada --------------------------------
  await page.click('#ajuda .arquivo button[data-acao="menu"]');
  await page.waitForSelector('#menu-inicial', { timeout: TIMEOUT_PRONTO_MS });
  afirmar((await page.evaluate(() => window.document.querySelectorAll('canvas').length)) === 0, 'o menu inicial e antes do jogo: sem canvas');
  afirmar((await page.getAttribute(NO_MENU('continuar'), 'aria-disabled')) === null, 'com save, o Continuar deveria abrir');
  await page.click(NO_MENU('carregar'));
  const desabilitada = await page.getAttribute(NO_MENU('gaveta-3'), 'aria-disabled');
  const motivo = await page.textContent('#menu-inicial [data-motivo="gaveta-3"]');
  afirmar(desabilitada === 'true' && motivo.includes('versao'), `a gaveta 3 deveria estar recusada com o motivo, diz '${motivo}'`);
  for (const n of [1, 2]) {
    afirmar((await page.getAttribute(NO_MENU(`gaveta-${n}`), 'aria-disabled')) === null, `a gaveta ${n} deveria abrir`);
  }
  await capturar('carregar-no-menu');
  await page.click('#menu-inicial [data-tela="carregar"] button[data-acao="voltar"]');

  // ---- 3. o Continuar, despausado e segurado: abre a 2 -------------------------------------------
  const c = await page.$eval(NO_MENU('continuar'), (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TIMEOUT_PRONTO_MS });
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  const aberta = await page.evaluate(() => ({ tick: window.__cangaco.tick, pausado: window.__cangaco.pausado }));
  afirmar(aberta.pausado, 'P deveria pausar de volta');
  afirmar(aberta.tick >= 60 && aberta.tick <= 60 + TETO_DE_TICKS_DESPAUSADO,
    `o Continuar deveria abrir a gaveta 2 (tick 60) e seguir dela, esta no tick ${aberta.tick}`);
  console.log(`E-SAVE-GAVETAS: ${JSON.stringify(linhas)}; Continuar abriu a 2 e seguiu ate o tick ${aberta.tick}`);
}

module.exports = { roteiro };
