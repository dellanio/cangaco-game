'use strict';
// I-TERRENO-MINAS-PERTO-DA-VILA: a serra do oeste, com os veios de carvao, ferro e ouro na face leste,
// ao lado esquerdo da vila. Ela nasce debaixo da nevoa (o civil ve 9 tiles, units.json): o roteiro faz
// o que o jogador faria, puxa uma rua da porta do armazem para oeste e anda o relogio ate um civil
// chegar perto o bastante para ver a face da serra. Entao centra entre a serra e a vila e captura.
const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const unidades = require('../../data/units.json');
const mapa = require('../../data/maps/sertao-128.json');
const { SERRA_DO_OESTE } = require('../gerar-mapa.js');

const TILE_PX = terreno.tile_px;
/** A linha logo abaixo da porta do armazem inicial (a linha 33 cruza a pedra do lajedo em 24,33). */
const RUA = { de: { gx: 29, gy: 34 }, ate: { gx: 18, gy: 34 } };
const TETO = 3000;
const PASSO = 50;

async function roteiro({ page, capturar, estado, afirmar }) {
  const { x1, y0, y1, veios } = SERRA_DO_OESTE;
  for (const v of veios) {
    const n = mapa.recursos[v.tipo].filter(([x, y]) => x === x1 && y >= v.y0 && y <= v.y1).length;
    afirmar(n === v.y1 - v.y0 + 1, `o veio de ${v.tipo} deveria estar na face leste da serra: ${n}`);
  }
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const fixar = (gx, gy) => page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((gx + 0.5) * TILE_PX - canvas.width / 2),
    scrollY: Math.round((gy + 0.5) * TILE_PX - canvas.height / 2),
  });
  const pontoDoTile = (gx, gy, camera) => ({
    x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
    y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
  });

  // a rua para oeste
  await fixar((RUA.de.gx + RUA.ate.gx) / 2, RUA.de.gy);
  await esperarFrame();
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const { camera } = await estado();
  await arrastarDentroDoCanvas(page, canvas, [pontoDoTile(RUA.de.gx, RUA.de.gy, camera), pontoDoTile(RUA.ate.gx, RUA.ate.gy, camera)]);
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.keyboard.press('Escape');
  await esperarFrame();

  // o relogio anda ate um civil ver o meio da face leste (raio euclidiano, como a sim)
  const raio = unidades.civis._comum.visao;
  const meio = { gx: x1, gy: (y0 + y1) / 2 };
  const ve = (u) => (u.gx - meio.gx) ** 2 + (u.gy - meio.gy) ** 2 <= raio * raio;
  let ticks = 0;
  let quem = null;
  while (ticks < TETO) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    ticks += PASSO;
    await esperarFrame();
    quem = (await estado()).unidadesRenderizadas.find(ve) ?? null;
    if (quem !== null) break;
  }
  if (quem === null) {
    const s = await estado();
    afirmar(false, `nenhum civil chegou a ver a serra em ${TETO} ticks: ruas ${s.estradasRenderizadas}, canteiros `
      + `${s.estradasPlanejadasRenderizadas}, civis ${JSON.stringify(s.unidadesRenderizadas.map((u) => [u.tipo, u.gx, u.gy, u.fsm]))}`);
  }
  console.log(`I-TERRENO-MINAS-PERTO-DA-VILA — ${quem.tipo} em (${quem.gx},${quem.gy}) ve a serra no tick ${ticks}`);
  // a serra inteira e a ponta da rua: o painel cobre ~4 tiles da esquerda do canvas
  await fixar(x1 + 3, (y0 + y1) / 2);
  await page.keyboard.press('p');
  await page.waitForTimeout(400);
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
  await capturar('serra-do-oeste');
}
module.exports = { roteiro };
