'use strict';
// I-TELA-ENFEITES-EM-SITIOS (aceite 2) — no sertao, sem nevoa: a contagem de cada enfeite desenhado (os de gente so nos
// sitios, os avulsos so o natural) e a captura do primeiro sitio abandonado.
const { writeFileSync } = require('node:fs');
const { URL } = require('node:url');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const config = require('../../data/enfeites.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const url = new URL(page.url());
  url.search = '?pausado&semNevoa';
  await page.goto(url.href);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
  const canvas = await retanguloDoCanvas(page);
  // a camera passa pelo mapa todo uma vez: o enfeite e desenhado pela memoria, nao pela vista
  await page.waitForTimeout(400);
  const s = await estado();
  const porTipo = s.enfeitesPorTipo;
  const deGente = [...new Set(config.sitios.arranjo.map((p) => p.id))];
  const sitios = Math.max(...deGente.filter((id) => id !== 'tapera').map((id) => (porTipo[id] ?? 0) / config.sitios.arranjo.filter((p) => p.id === id).length));
  afirmar(sitios >= 1 && sitios <= 3, `de 1 a 3 sitios no sertao: ${JSON.stringify(porTipo)}`);
  for (const id of deGente) {
    if (id === 'tapera' && !(id in porTipo)) continue; // a arte da casa velha ainda pode nao existir
    afirmar((porTipo[id] ?? 0) === sitios * config.sitios.arranjo.filter((p) => p.id === id).length, `${id} so nos sitios: ${porTipo[id]}`);
  }
  const avulsos = Object.entries(porTipo).filter(([id]) => !deGente.includes(id));
  afirmar(avulsos.every(([id]) => id in config.avulsos.pesos), `avulsos so o natural: ${JSON.stringify(avulsos)}`);
  // o primeiro sitio: o centro e o tile a direita da carroca (dx -2) e acima dela (dy 1)
  const carroca = await page.evaluate(() => window.__cangaco.enfeitesDesenhadosEm?.('ox_cart')?.[0] ?? null);
  afirmar(carroca !== null, 'a ponte da o tile da carroca');
  const centro = { gx: carroca.gx + 2, gy: carroca.gy - 1 };
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let n = 0; n < 10 && (await estado()).camera.zoom !== 2; n++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(200); }
  await page.evaluate((c) => window.__cangaco.fixarCamera(c), { scrollX: Math.round((centro.gx + 0.5) * terreno.tile_px - canvas.width / 2), scrollY: Math.round((centro.gy + 0.5) * terreno.tile_px - canvas.height / 2) });
  await page.waitForTimeout(300);
  await capturar('sitio-abandonado');
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p'); await page.waitForTimeout(150);
  writeFileSync('test-output/I-TELA-ENFEITES-EM-SITIOS.json', JSON.stringify({ porTipo, sitios, centro }, null, 2));
}

module.exports = { roteiro };
