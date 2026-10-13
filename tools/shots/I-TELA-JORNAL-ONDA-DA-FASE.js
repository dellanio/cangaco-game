'use strict';
// I-TELA-JORNAL-ONDA-DA-FASE (aceite 3) — a fase 1 avanca pela ponte ate a primeira onda; o icone do jornal
// aparece, e o jornal aberto (o aperto segurado 150 ms, com o laco ANDANDO; CLAUDE.md §8) mostra a manchete
// da onda.
const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');

const PASSO = 100;
const TETO = 6000;
const TIMEOUT_PRONTO_MS = 15_000;

async function roteiro({ page, capturar, afirmar }) {
  const esperarFrame = () => page.evaluate(() => new Promise((ok) => window.requestAnimationFrame(() => window.requestAnimationFrame(ok))));
  const url = new URL(page.url());
  url.search = '?pausado&campanha=fase-01-pianco';
  await page.goto(url.href);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS });
  const manchete = tema.jornal.noticias.ondaChegou.manchete;
  const ondas = () => page.evaluate(() => JSON.parse(window.__cangacoPartida.estadoSerializado()).fase.ondasDisparadas);
  const lerIcone = () => page.$eval('#jornal-icone', (n) => {
    const r = n.getBoundingClientRect();
    return { hidden: n.hidden, x: r.x, y: r.y, w: r.width, h: r.height };
  });

  let ticks = 0;
  // a lista do jornal so e desenhada aberta: o relogio para na primeira onda, pela ponte
  while (ticks < TETO && (await ondas()) < 1) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    ticks += PASSO;
    await esperarFrame();
  }
  const icone = await lerIcone();
  afirmar(!icone.hidden && (await ondas()) >= 1, `a onda e o icone deveriam chegar ate ${TETO} ticks: ${JSON.stringify({ icone, ticks })}`);
  await capturar('icone');

  // o aperto com o jogo ANDANDO (§8)
  await page.keyboard.press('p');
  await esperarFrame();
  await page.mouse.move(icone.x + icone.w / 2, icone.y + icone.h / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();

  const folha = await page.$eval('#jornal', (n) => ({ hidden: n.hidden, manchetes: [...n.querySelectorAll('h2')].map((h) => h.textContent), chaves: [...n.querySelectorAll('.noticia')].map((x) => x.dataset.chave) }));
  afirmar(!folha.hidden && folha.manchetes.includes(manchete), `o jornal aberto deveria mostrar '${manchete}': ${JSON.stringify(folha)}`);
  await capturar('jornal');
}

module.exports = { roteiro };
