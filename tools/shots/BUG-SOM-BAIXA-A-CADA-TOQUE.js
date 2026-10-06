'use strict';
// BUG-SOM-BAIXA-A-CADA-TOQUE (aceite 2 e 3): a vila pronta a 3x por 60 s reais, com o cache desligado
// como no DevTools aberto e o gesto que libera o som. Com o tocador de antes, cada toque baixava o
// arquivo (15 toques, 15 downloads, na sonda de 2026-10-05). Agora: no maximo 1 download por arquivo
// de som, enquanto os toques passam disso; o tick anda o tempo todo; e nenhum 404 (o /favicon.ico).
const { readFileSync } = require('node:fs');
const { URL } = require('node:url');

const AMOSTRAS = 12;
const INTERVALO_MS = 5000;

async function roteiro({ page, estado, afirmar }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  const porArquivo = {};
  const falhas = [];
  page.on('request', (r) => {
    const caminho = new URL(r.url()).pathname;
    if (caminho.includes('/sons/')) porArquivo[caminho] = (porArquivo[caminho] ?? 0) + 1;
    if (caminho === '/favicon.ico') falhas.push('pediu /favicon.ico');
  });
  page.on('response', (r) => { if (r.status() >= 400) falhas.push(`${r.status()} ${r.url()}`); });
  // conta os toques no ponto em que o som vira fonte (cada toque com buffer pronto e um start())
  await page.evaluate(() => {
    window.__toques = 0;
    const original = window.AudioBufferSourceNode.prototype.start;
    window.AudioBufferSourceNode.prototype.start = function (...a) { window.__toques++; return original.apply(this, a); };
  });

  const texto = readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8');
  await page.evaluate((t) => window.localStorage.setItem('cangaco:partida', t), texto);
  await page.keyboard.press('h');
  await page.waitForTimeout(200);
  await page.click('#ajuda [data-acao="carregar"]');
  await page.waitForTimeout(500);
  await page.mouse.click(700, 400); // o gesto que libera o som
  await page.keyboard.press('p');
  await page.keyboard.press('+');
  await page.keyboard.press('+');
  let tickAntes = (await estado()).tick;
  for (let i = 0; i < AMOSTRAS; i++) {
    await page.waitForTimeout(INTERVALO_MS);
    const tick = await page.evaluate(() => window.__cangaco.tick);
    afirmar(tick > tickAntes, `o tick deveria andar a cada ${INTERVALO_MS} ms: parou em ${tick}`);
    tickAntes = tick;
  }
  await page.keyboard.press('p');
  const toques = await page.evaluate(() => window.__toques);
  const downloads = Object.values(porArquivo).reduce((a, n) => a + n, 0);
  console.log(`BUG-SOM-BAIXA-A-CADA-TOQUE — ${toques} toques, ${downloads} downloads ${JSON.stringify(porArquivo)}`);
  afirmar(Object.values(porArquivo).every((n) => n <= 1), `no maximo 1 download por arquivo de som: ${JSON.stringify(porArquivo)}`);
  afirmar(toques > downloads, `os toques (${toques}) deveriam passar dos downloads (${downloads}): senao o roteiro nao exerceu o som`);
  afirmar(falhas.length === 0, `nenhuma resposta de erro: ${JSON.stringify(falhas)}`);
}
module.exports = { roteiro };
