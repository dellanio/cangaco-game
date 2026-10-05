'use strict';
// I-TELA-BARRA-RAPIDA-DE-RECURSOS: a barra fina no alto do meio do canvas. O roteiro confere a
// geometria (altura ate 28 px, centrada sobre o canvas) e os numeros contra o HUD da aba Estado da
// vila (o mesmo seletor da sim), antes e depois de a pedra baixar com uma rua puxada.
const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const config = require('../../data/barra-rapida.json');

const TILE_PX = terreno.tile_px;
const RUA = { de: { gx: 29, gy: 34 }, ate: { gx: 22, gy: 34 } };
/** categoria da barra -> campo do HUD com o mesmo numero */
const DO_HUD = { madeira: 'timber', pedra: 'stone', ouro: 'gold' };

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const ler = () => page.evaluate((pares) => {
    const barra = window.document.getElementById('barra-rapida');
    const caixa = barra.getBoundingClientRect();
    const valores = {};
    for (const item of barra.querySelectorAll('.item')) valores[item.dataset.categoria] = item.querySelector('.valor').textContent;
    const hud = {};
    for (const campo of Object.values(pares)) hud[campo] = window.document.querySelector(`#hud [data-campo="${campo}"]`)?.textContent ?? null;
    const icones = barra.querySelectorAll('img').length;
    return { caixa: { x: caixa.x, y: caixa.y, w: caixa.width, h: caixa.height }, valores, hud, icones };
  }, DO_HUD);
  const conferir = (b, marco) => {
    afirmar(b.caixa.h > 0 && b.caixa.h <= 28, `${marco}: a barra deveria ter ate 28 px de altura, tem ${b.caixa.h}`);
    const meio = b.caixa.x + b.caixa.w / 2;
    const meioDoCanvas = canvas.left + canvas.width / 2;
    afirmar(Math.abs(meio - meioDoCanvas) <= 2, `${marco}: a barra deveria estar centrada no canvas (${meio} contra ${meioDoCanvas})`);
    afirmar(b.caixa.y - canvas.top <= 8, `${marco}: a barra deveria estar no alto do canvas, esta a ${b.caixa.y - canvas.top} px`);
    afirmar(Object.keys(b.valores).join() === config.categorias.map((c) => c.id).join(), `${marco}: categorias ${Object.keys(b.valores)}`);
    afirmar(b.icones === config.categorias.length, `${marco}: cada categoria deveria ter o icone, vieram ${b.icones}`);
    for (const [categoria, campo] of Object.entries(DO_HUD)) {
      afirmar(b.valores[categoria] === b.hud[campo], `${marco}: ${categoria} ${b.valores[categoria]} na barra, ${b.hud[campo]} no HUD`);
    }
  };

  const inicio = await ler();
  conferir(inicio, 'inicio');

  // a rua gasta pedra: o numero da barra acompanha o do HUD
  const fixar = (gx, gy) => page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((gx + 0.5) * TILE_PX - canvas.width / 2),
    scrollY: Math.round((gy + 0.5) * TILE_PX - canvas.height / 2),
  });
  await fixar((RUA.de.gx + RUA.ate.gx) / 2, RUA.de.gy);
  await page.waitForTimeout(150);
  await page.click('[data-ferramenta="estrada"]');
  await page.waitForTimeout(150);
  const { camera } = await estado();
  const ponto = (t) => ({ x: canvas.left + t.gx * TILE_PX + TILE_PX / 2 - camera.scrollX, y: canvas.top + t.gy * TILE_PX + TILE_PX / 2 - camera.scrollY });
  await arrastarDentroDoCanvas(page, canvas, [ponto(RUA.de), ponto(RUA.ate)]);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__cangaco.avancar(400));
  await page.waitForTimeout(300);
  const depois = await ler();
  conferir(depois, 'depois da rua');
  afirmar(Number(depois.valores.pedra) < Number(inicio.valores.pedra),
    `a pedra deveria ter baixado com a rua: ${inicio.valores.pedra} -> ${depois.valores.pedra}`);
  console.log(`I-TELA-BARRA-RAPIDA-DE-RECURSOS — inicio ${JSON.stringify(inicio.valores)}; depois ${JSON.stringify(depois.valores)}; caixa ${JSON.stringify(depois.caixa)}`);
  await capturar('barra');
}
module.exports = { roteiro };
