'use strict';
// I-TELA-MENU-VIDEO-DE-CAPA (aceite 2, emenda de 2026-10-16) — o video do operador na tela inicial, sobre a capa:
// mudo, sem laco, sem controle, toca (o tempo anda) e cobre a janela; perto do fim some num fade e sai, e fica a capa
// com a caixa e os botoes. Com `?capaFixa`, nada de video. Duas resolucoes: durante o video e depois do fim.
const { URL } = require('node:url');

const TIMEOUT_MENU_MS = 10_000;
const TIMEOUT_FIM_DO_VIDEO_MS = 20_000;
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
    afirmar(v1.mudo && !v1.laco && !v1.controles, `${l}x${a}: mudo, sem laco, sem controle: ${JSON.stringify(v1)}`);
    afirmar(Math.abs(v1.duracao - 10) <= 0.5, `${l}x${a}: o video tem ~10 s, so para frente: ${v1.duracao}`);
    afirmar(v1.cobre && v1.caixaPorCima && v1.capaDeFundo, `${l}x${a}: cobre a janela, a caixa por cima e a capa de fundo: ${JSON.stringify(v1)}`);
    await page.waitForTimeout(1800);
    await capturar(`${l}x${a}-1`);
    await page.waitForTimeout(2500);
    const t2 = await page.evaluate(() => window.document.querySelector('#menu-inicial video').currentTime);
    afirmar(t2 > v1.tempo, `${l}x${a}: o video toca (${v1.tempo} -> ${t2})`);
    await capturar(`${l}x${a}-2`);

    // o fim: o video some e sai; a capa, a caixa e os botoes continuam
    await page.waitForFunction(() => window.document.querySelector('#menu-inicial video') === null, undefined, { timeout: TIMEOUT_FIM_DO_VIDEO_MS });
    const fim = await page.evaluate(() => {
      const menu = window.document.querySelector('#menu-inicial');
      const botoes = [...menu.querySelectorAll('.caixa button')].filter((b) => !b.disabled);
      return {
        capaDeFundo: window.getComputedStyle(menu).backgroundImage.includes('capa.jpg'),
        caixa: menu.querySelector('.caixa') !== null,
        botoes: botoes.length,
      };
    });
    afirmar(fim.capaDeFundo && fim.caixa && fim.botoes > 0, `${l}x${a}: depois do video fica a capa com a caixa: ${JSON.stringify(fim)}`);
    await capturar(`${l}x${a}-depois-do-video`);
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
