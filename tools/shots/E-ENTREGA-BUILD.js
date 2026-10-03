'use strict';

// Roteiro da E-ENTREGA-BUILD — O JOGO FORA DO DEV SERVER.
//
// `npm run shot:dist` faz o `npm run build` e roda este roteiro com `--preview`: o runner serve o
// `dist/` pelo `vite preview`, e qualquer erro de console (um sprite 404, um modulo que nao achou o
// caminho) reprova, como em todo roteiro. No `shot:todos` ele roda contra o dev server, como
// nao-regressao do mesmo caminho.
//
// O caminho do jogador: `/` mostra o menu (sem canvas), Novo jogo > Escaramuca > Comecar (segurado
// 150 ms, despausado, §8), a tela de carregamento aparece, vai a 100% e some, e a escaramuca anda 300
// ticks (a 3x, para a corrida durar ~10 s). O tempo ate o menu e numero da corrida, gravado em
// `test-output/E-ENTREGA-BUILD.json` so no modo preview, nunca afirmado (§8).

const fs = require('node:fs');
const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');

const BOTAO = (acao) => `#menu-inicial button[data-acao="${acao}"]`;
const TICKS = 300;
const SAIDA = 'test-output/E-ENTREGA-BUILD.json';

async function roteiro(ctx) {
  const { page, capturar, afirmar, servidor } = ctx;
  const base = new URL('/', page.url()).href;

  // ---- 1. o menu, e o tempo ate ele ---------------------------------------------------------
  await page.evaluate(() => window.localStorage.clear());
  const t0 = Date.now();
  await page.goto(base);
  await page.waitForSelector('#menu-inicial button[data-acao="novo"]', { state: 'visible', timeout: 30_000 });
  const tempoAteMenuMs = Date.now() - t0;
  afirmar((await page.evaluate(() => window.document.querySelectorAll('canvas').length)) === 0, 'o menu e antes do jogo: sem canvas');
  await capturar('menu');

  // ---- 2. a escaramuca, com a tela de carregamento ------------------------------------------
  // um observador anota o que a tela de carregamento mostrou: ela pode durar menos que um quadro
  await page.evaluate(() => {
    window.__carregamentoVisto = [];
    new window.MutationObserver(() => {
      const no = window.document.querySelector('#carregamento [data-campo="carregamento"]');
      if (no !== null) window.__carregamentoVisto.push(no.textContent);
    }).observe(window.document.body, { childList: true, subtree: true, characterData: true });
  });
  await page.click(BOTAO('novo'));
  await page.click(BOTAO('escaramuca'));
  const c = await page.$eval(BOTAO('comecar'), (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: 60_000 });
  const visto = await page.evaluate(() => window.__carregamentoVisto);
  const cem = tema.carregamento.progresso.replace('{pct}', '100');
  afirmar(visto.length > 0, 'a tela de carregamento deveria ter aparecido');
  afirmar(visto.includes(cem), `a tela de carregamento deveria chegar a '${cem}': ${JSON.stringify(visto.slice(-5))}`);
  afirmar((await page.$('#carregamento')) === null, 'a tela de carregamento deveria sumir quando o jogo fica pronto');

  // ---- 3. a escaramuca anda 300 ticks --------------------------------------------------------
  await page.keyboard.press('=');
  await page.keyboard.press('=');
  await page.waitForFunction((n) => window.__cangaco.tick >= n, TICKS, { timeout: 90_000 });
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  const fim = await page.evaluate(() => ({ tick: window.__cangaco.tick, pausado: window.__cangaco.pausado, velocidade: window.__cangaco.velocidade }));
  afirmar(fim.pausado && fim.tick >= TICKS, `a escaramuca deveria ter andado ${TICKS} ticks e pausado: ${JSON.stringify(fim)}`);
  afirmar((await page.textContent('#minimapa [data-campo="paz"]')).startsWith(tema.paz.rotulo.split('{')[0]), 'o contador de paz deveria estar correndo');
  await capturar('escaramuca');

  if (servidor === 'preview') {
    const anterior = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : {};
    fs.mkdirSync('test-output', { recursive: true });
    fs.writeFileSync(SAIDA, JSON.stringify({
      ...anterior,
      roteiro: { servidor, tempoAteMenuMs, tickFinal: fim.tick, velocidade: fim.velocidade, carregamentoVisto: visto.length, quando: new Date().toISOString() },
    }, null, 2));
  }
  console.log(`E-ENTREGA-BUILD (${servidor}): menu em ${tempoAteMenuMs} ms, carregamento visto ${visto.length}x, tick ${fim.tick}`);
}

module.exports = { roteiro };
