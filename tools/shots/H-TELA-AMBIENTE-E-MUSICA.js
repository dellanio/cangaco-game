'use strict';
// Roteiro da H-TELA-AMBIENTE-E-MUSICA — o sertao de fundo.
//   (c) pelo contador (`window.__cangacoSom.contadores().fundo`): no JOGO o ambiente fica ligado e
//       o numero de quadros com ambiente cresce, com o jogo despausado e pausado; o botao Menu da
//       ajuda leva ao MENU, e la o jogo nao existe: nenhum contador, nenhum `Audio`. Sem arquivo
//       nenhum, tudo e silencio: o tocador nunca e chamado e nenhuma requisicao de audio sai.
const { URL } = require('node:url');
const som = require('../../data/som.json');

const TIMEOUT_PRONTO_MS = 10_000;

async function roteiro({ page, capturar, afirmar }) {
  const base = new URL('/', page.url()).href;
  const fundo = () => page.evaluate(() => window.__cangacoSom.contadores().fundo);
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

  // ---- 1. no jogo: o ambiente liga e fica ------------------------------------------------------
  await page.goto(`${base}?pausado`);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto && window.__cangacoSom), { timeout: TIMEOUT_PRONTO_MS });
  const a = await fundo();
  afirmar(JSON.stringify(a.ambienteLigado) === JSON.stringify(som.ambiente.lacos), `no jogo, os lacos de ambiente ligados: ${JSON.stringify(a.ambienteLigado)}`);
  afirmar(a.faixa === 'paz', `sem luta, a faixa e a da paz, veio ${a.faixa}`);
  await page.keyboard.press('p');
  await page.waitForTimeout(600);
  await page.keyboard.press('p');
  const b = await fundo();
  afirmar(b.quadrosComAmbiente > a.quadrosComAmbiente, `o ambiente toca quadro a quadro: ${a.quadrosComAmbiente} -> ${b.quadrosComAmbiente}`);
  afirmar(b.niveis.paz > a.niveis.paz, `a musica da paz sobe em passagem: ${a.niveis.paz} -> ${b.niveis.paz}`);
  await page.waitForTimeout(300);
  const c = await fundo();
  afirmar(c.quadrosComAmbiente > b.quadrosComAmbiente, 'pausado, o ambiente continua (o sertao nao para com o relogio)');
  const audios = await page.evaluate(() => window.performance.getEntriesByType('resource').filter((r) => /\.(ogg|mp3|wav)(\?|$)/.test(r.name)).length);
  afirmar(audios === 0, `sem arquivo, nenhuma requisicao de audio, sairam ${audios}`);
  await capturar('no-jogo');

  // ---- 2. o Menu da ajuda: o jogo deixa de existir, e o ambiente com ele --------------------------
  await page.keyboard.press('h');
  await page.waitForTimeout(150);
  await apertar('#ajuda button[data-acao="menu"]');
  await page.waitForSelector('#menu-inicial');
  await page.waitForTimeout(300);
  const noMenu = await page.evaluate(() => ({
    contador: window.__cangacoSom !== undefined,
    audios: window.document.querySelectorAll('audio').length,
    canvas: window.document.querySelectorAll('canvas').length,
  }));
  afirmar(!noMenu.contador && noMenu.canvas === 0, `no menu o jogo nao existe, e o ambiente nao toca: ${JSON.stringify(noMenu)}`);
  await capturar('no-menu');
  console.log(`[H-TELA-AMBIENTE-E-MUSICA] jogo: ${JSON.stringify(c)}; menu: ${JSON.stringify(noMenu)}`);
}

module.exports = { roteiro };
