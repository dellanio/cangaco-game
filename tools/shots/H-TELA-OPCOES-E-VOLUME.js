'use strict';
// Roteiro da H-TELA-OPCOES-E-VOLUME — a tela de opcoes de som.
//   (c) abrir pelo MENU INICIAL (o botao Opcoes) e pelo JOGO (a ajuda, H > Opcoes de som); mexer no
//       volume com o aperto segurado (mouse.down / 150 ms / mouse.up, §8), o do jogo DESPAUSADO; e
//       a foto de cada uma.
//   (b, pela tela) a escolha sobrevive a recarregar a pagina: o deslizador volta onde ficou.
// O valor sai do `localStorage` (a chave `cangaco:som`) e do `value` do deslizador, nunca de pixel.
const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');
const som = require('../../data/som.json');

const CHAVE = 'cangaco:som';
const CAIXA = '#opcoes-de-som';
const TIMEOUT_PRONTO_MS = 10_000;

async function roteiro({ page, capturar, afirmar }) {
  const base = new URL('/', page.url()).href;
  const guardado = () => page.evaluate((k) => JSON.parse(window.localStorage.getItem(k) ?? 'null'), CHAVE);
  const valor = (campo) => page.$eval(`${CAIXA} input[data-volume="${campo}"]`, (n) => Number(n.value));

  /** Aperta o deslizador na fracao `f` da largura, segurando 150 ms (§8). */
  async function arrastar(campo, f) {
    const r = await page.$eval(`${CAIXA} input[data-volume="${campo}"]`, (n) => {
      const c = n.getBoundingClientRect();
      return { x: c.left, y: c.top + c.height / 2, w: c.width };
    });
    await page.mouse.move(r.x + r.w * f, r.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }
  async function apertar(seletor) {
    const r = await page.$eval(seletor, (n) => {
      const c = n.getBoundingClientRect();
      return { x: c.left + c.width / 2, y: c.top + c.height / 2 };
    });
    await page.mouse.move(r.x, r.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }

  // ---- 1. pelo menu inicial ---------------------------------------------------------------------
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(base);
  await page.waitForSelector('#menu-inicial');
  afirmar((await page.textContent('#menu-inicial button[data-acao="opcoes"]')) === tema.menuInicial.opcoes,
    `o menu deveria ter o botao '${tema.menuInicial.opcoes}'`);
  await apertar('#menu-inicial button[data-acao="opcoes"]');
  await page.waitForTimeout(150);
  afirmar(await page.isVisible(CAIXA), 'o botao Opcoes do menu deveria abrir a caixa de som');
  afirmar((await valor('geral')) === Math.round(som.volumePadrao.geral * 100), 'sem nada guardado, o geral e o padrao do dado');
  afirmar((await page.textContent(`${CAIXA} h2`)) === tema.som.titulo, 'o titulo vem do tema');
  await arrastar('geral', 0.25);
  const geralNoMenu = await valor('geral');
  afirmar(geralNoMenu >= 15 && geralNoMenu <= 35, `o aperto a 1/4 deveria levar o geral para perto de 25, veio ${geralNoMenu}`);
  afirmar(Math.round((await guardado()).geral * 100) === geralNoMenu, 'o volume escolhido vai para o localStorage');
  await capturar('pelo-menu');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  afirmar(await page.isHidden(CAIXA), 'Esc fecha a caixa de som');
  afirmar(await page.isVisible('#menu-inicial'), 'fechar a caixa de som nao sai do menu');

  // ---- 2. recarregar: o volume ficou ------------------------------------------------------------
  await page.goto(base);
  await page.waitForSelector('#menu-inicial');
  await apertar('#menu-inicial button[data-acao="opcoes"]');
  await page.waitForTimeout(150);
  afirmar((await valor('geral')) === geralNoMenu, `depois de recarregar, o geral deveria continuar em ${geralNoMenu}, veio ${await valor('geral')}`);
  await page.keyboard.press('Escape');

  // ---- 3. pelo jogo, despausado -----------------------------------------------------------------
  await page.goto(`${base}?pausado`);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TIMEOUT_PRONTO_MS });
  await page.keyboard.press('h');
  await page.waitForTimeout(150);
  const botaoNaAjuda = '#ajuda button[data-acao="opcoes-de-som"]';
  afirmar((await page.textContent(botaoNaAjuda)) === tema.som.abrirNaAjuda, 'a ajuda em jogo deveria ter o botao das opcoes de som');
  const tickAntes = await page.evaluate(() => window.__cangaco.tick);
  await page.keyboard.press('p');
  await apertar(botaoNaAjuda);
  await page.waitForTimeout(150);
  afirmar(await page.isVisible(CAIXA), 'o botao da ajuda deveria abrir a caixa de som');
  afirmar((await valor('geral')) === geralNoMenu, 'o jogo le o mesmo volume que o menu guardou');
  await arrastar('efeitos', 0.5);
  await apertar(`${CAIXA} input[data-volume="mudo"]`);
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const tickDepois = await page.evaluate(() => window.__cangaco.tick);
  afirmar(tickDepois > tickAntes, `o passo do jogo deveria rodar despausado: tick ${tickAntes} -> ${tickDepois}`);
  const efeitos = await valor('efeitos');
  afirmar(efeitos >= 40 && efeitos <= 60, `o aperto na metade deveria levar efeitos para perto de 50, veio ${efeitos}`);
  const final = await guardado();
  afirmar(final.mudo === true && Math.round(final.efeitos * 100) === efeitos, `o jogo guarda o mudo e os efeitos: ${JSON.stringify(final)}`);
  afirmar(await page.isVisible(CAIXA) && await page.isVisible('#ajuda'), 'a caixa de som fica por cima da ajuda, as duas abertas');
  await capturar('pelo-jogo');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  afirmar(await page.isHidden(CAIXA) && await page.isVisible('#ajuda'), 'o primeiro Esc fecha so a caixa de som; a ajuda fica');
  console.log(`[H-TELA-OPCOES-E-VOLUME] guardado: ${JSON.stringify(final)}; ticks despausado: ${tickDepois - tickAntes}`);
}

module.exports = { roteiro };
