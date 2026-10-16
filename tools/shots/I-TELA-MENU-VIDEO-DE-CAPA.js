'use strict';
// I-TELA-MENU-VIDEO-DE-CAPA (aceite 2) — o video do operador na tela inicial, sobre a capa: mudo, em laco, sem
// controle, toca (o tempo anda) e cobre a janela; a capa continua de fundo e a caixa por cima. Com `?capaFixa`, nada
// de video. Duas resolucoes, dois instantes cada.
const { URL } = require('node:url');

const TIMEOUT_MENU_MS = 10_000;
const RESOLUCOES = [[1280, 720], [1920, 1080]];

async function roteiro({ page, capturar, afirmar }) {
  const base = new URL('/', page.url()).href;
  for (const [l, a] of RESOLUCOES) {
    await page.setViewportSize({ width: l, height: a });
    await page.goto(base);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(base);
    await page.waitForSelector('#menu-inicial .caixa', { timeout: TIMEOUT_MENU_MS });
    await page.waitForFunction(() => {
      const v = window.document.querySelector('#menu-inicial video');
      return v !== null && v.classList.contains('tocando');
    }, undefined, { timeout: TIMEOUT_MENU_MS });
    const v1 = await page.evaluate(() => {
      const v = window.document.querySelector('#menu-inicial video');
      const r = v.getBoundingClientRect();
      const caixa = window.document.querySelector('#menu-inicial .caixa');
      const fundo = window.getComputedStyle(window.document.querySelector('#menu-inicial')).backgroundImage;
      return {
        mudo: v.muted, laco: v.loop, controles: v.controls, tempo: v.currentTime, duracao: v.duration,
        cobre: Math.round(r.width) === window.innerWidth && Math.round(r.height) === window.innerHeight,
        caixaPorCima: Number(window.getComputedStyle(caixa).zIndex) > Number(window.getComputedStyle(v).zIndex),
        capaDeFundo: fundo.includes('capa.jpg'),
      };
    });
    afirmar(v1.mudo && v1.laco && !v1.controles, `${l}x${a}: mudo, em laco, sem controle: ${JSON.stringify(v1)}`);
    afirmar(v1.cobre && v1.caixaPorCima && v1.capaDeFundo, `${l}x${a}: cobre a janela, a caixa por cima e a capa de fundo: ${JSON.stringify(v1)}`);
    await page.waitForTimeout(1800);
    await capturar(`${l}x${a}-1`);
    await page.waitForTimeout(2500);
    const t2 = await page.evaluate(() => window.document.querySelector('#menu-inicial video').currentTime);
    afirmar(t2 > v1.tempo, `${l}x${a}: o video toca (${v1.tempo} -> ${t2})`);
    await capturar(`${l}x${a}-2`);
  }

  // a capa fixa: sem video
  const url = new URL(base);
  url.search = '?menu&capaFixa';
  await page.goto(url.href);
  await page.waitForSelector('#menu-inicial .caixa', { timeout: TIMEOUT_MENU_MS });
  const semVideo = await page.evaluate(() => window.document.querySelector('#menu-inicial video') === null);
  afirmar(semVideo, 'com ?capaFixa nao ha video');
}

module.exports = { roteiro };
