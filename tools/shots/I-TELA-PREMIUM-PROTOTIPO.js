'use strict';
// I-TELA-PREMIUM-PROTOTIPO (aceite 1 a 4) — a mesma vista da vila com e sem `?premium`, e a tropa da escaramuca
// selecionada no premium, com a barra de baixo. Sem `?premium`: nenhuma sombra, nenhuma gradacao, nenhuma classe
// `premium`. Com ele: sombras de contato, gradacao, e a barra com um retrato por soldado e os comandos espelhados.
// A selecao e a caixa arrastada despausada (§8), como na C-COMBATE-01c.
const { URL } = require('node:url');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const LADO_DO_JOGADOR = 0;
const TIMEOUT_PRONTO_MS = 20_000;

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperarFrame = () => page.waitForTimeout(250);
  const abrir = async (busca) => {
    const url = new URL(page.url());
    url.search = busca;
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS });
    await esperarFrame();
    await esperarFrame();
  };

  // 1. o jogo de hoje: nada do premium
  await abrir('?pausado');
  const s0 = await estado();
  const classe0 = await page.evaluate(() => window.document.body.classList.contains('premium'));
  afirmar(!s0.premium.ligado && s0.premium.sombras === 0 && !s0.premium.gradacao && !classe0,
    `sem ?premium nada do premium deveria nascer: ${JSON.stringify(s0.premium)}, classe ${classe0}`);
  await capturar('vila-hoje');

  // 2. a mesma vista com o premium
  await abrir('?pausado&premium');
  const s1 = await estado();
  const classe1 = await page.evaluate(() => window.document.body.classList.contains('premium'));
  afirmar(s1.premium.ligado && s1.premium.sombras > 0 && s1.premium.gradacao && classe1,
    `com ?premium deveria haver sombras e gradacao: ${JSON.stringify(s1.premium)}, classe ${classe1}`);
  afirmar(s1.camera.scrollX === s0.camera.scrollX && s1.camera.scrollY === s0.camera.scrollY, 'a vista deveria ser a mesma');
  console.log(`I-TELA-PREMIUM-PROTOTIPO: ${s1.premium.sombras} sombras de contato na vila`);
  await capturar('vila-premium');

  // 3. a escaramuca no premium, com a tropa selecionada
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  let s = await estado();
  const cabras = (st) => st.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
  const tropa = cabras(s);
  const canvas = await retanguloDoCanvas(page);
  const meio = {
    x: (tropa.reduce((n, u) => n + u.gx, 0) / tropa.length + 0.5) * TILE_PX,
    y: (tropa.reduce((n, u) => n + u.gy, 0) / tropa.length + 0.5) * TILE_PX,
  };
  await page.evaluate(([x, y]) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), [meio.x - canvas.width / 2, meio.y - canvas.height / 2 + 2 * TILE_PX]);
  await esperarFrame();
  s = await estado();
  const naPagina = (x, y, cam) => ({
    x: canvas.left + (x - cam.scrollX - canvas.width / 2) * cam.zoom + canvas.width / 2,
    y: canvas.top + (y - cam.scrollY - canvas.height / 2) * cam.zoom + canvas.height / 2,
  });
  const c = cabras(s).map((u) => ({ x: (u.gx + 0.5) * TILE_PX, y: (u.gy + 0.5) * TILE_PX }));
  const a = naPagina(Math.min(...c.map((p) => p.x)) - TILE_PX, Math.min(...c.map((p) => p.y)) - TILE_PX, s.camera);
  const b = naPagina(Math.max(...c.map((p) => p.x)) + TILE_PX, Math.max(...c.map((p) => p.y)) + TILE_PX, s.camera);
  await page.keyboard.press('p');
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  const barra = await page.evaluate(() => {
    const raiz = window.document.querySelector('#barra-da-tropa');
    if (raiz === null) return null;
    return {
      visivel: !raiz.hidden,
      retratos: raiz.querySelectorAll('.retrato:not(.mais)').length,
      comImagem: [...raiz.querySelectorAll('.retrato:not(.mais)')].filter((n) => n.style.backgroundImage !== '').length,
      comandos: [...raiz.querySelectorAll('.comandos button')].filter((n) => !n.hidden).map((n) => n.dataset.espelha),
      originais: [...window.document.querySelectorAll('#painel-grupo button[data-acao]')].filter((n) => !n.hidden).map((n) => n.dataset.acao),
    };
  });
  afirmar(barra !== null && barra.visivel && barra.retratos > 0 && barra.comImagem === barra.retratos,
    `a barra da tropa deveria mostrar retratos com imagem: ${JSON.stringify(barra)} (selecionados ${s.selecaoMilitar.length})`);
  afirmar(barra.comandos.every((acao) => barra.originais.includes(acao)) && barra.comandos.length > 0,
    `todo comando da barra deveria existir no painel do grupo: ${JSON.stringify(barra)}`);
  console.log(`I-TELA-PREMIUM-PROTOTIPO: ${s.selecaoMilitar.length} selecionados, ${barra.retratos} retratos, comandos ${barra.comandos.join(', ')}`);
  await capturar('tropa-premium');
}

module.exports = { roteiro };
