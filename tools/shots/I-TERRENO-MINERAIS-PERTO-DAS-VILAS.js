'use strict';
const { URL } = require('node:url');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const economia = require('../../data/economy.json');
const escaramuca = require('../../data/escaramuca.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const url = new URL(page.url()); url.searchParams.set('semNevoa', '');
  await page.goto(url.toString()); await page.waitForFunction(() => window.__cangaco?.pronto);
  const canvas = await retanguloDoCanvas(page);
  const vilas = [economia.estadoInicial.predios.find(p => p.id === 'storehouse'), escaramuca.predios.find(p => p.id === 'storehouse')];
  for (const [tipo, total] of Object.entries(terreno.geracao.mineraisPertoDasVilas.totais)) afirmar(mapa.recursos[tipo].length === total, `${tipo}: total ${total} conservado`);
  for (const [i, vila] of vilas.entries()) {
    const pontos = Object.keys(terreno.geracao.mineraisPertoDasVilas.totais).map(tipo => {
      const ts = mapa.recursos[tipo].slice().sort((a, b) => Math.max(Math.abs(a[0] - vila.gx), Math.abs(a[1] - vila.gy)) - Math.max(Math.abs(b[0] - vila.gx), Math.abs(b[1] - vila.gy)));
      const [gx, gy] = ts[0];
      afirmar(Math.max(Math.abs(gx - vila.gx), Math.abs(gy - vila.gy)) <= terreno.geracao.mineraisPertoDasVilas.raioMaximo, `${tipo} perto da vila${i}`);
      return { tipo, gx, gy };
    });
    const gx = pontos.reduce((s, p) => s + p.gx, 0) / pontos.length;
    const gy = pontos.reduce((s, p) => s + p.gy, 0) / pontos.length;
    const s = await estado();
    await page.evaluate(c => window.__cangaco.fixarCamera(c), {
      scrollX: (gx + 0.5) * terreno.tile_px - canvas.width / (2 * s.camera.zoom),
      scrollY: (gy + 0.5) * terreno.tile_px - canvas.height / (2 * s.camera.zoom),
    });
    await page.waitForTimeout(200);
    const atual = await estado();
    for (const p of pontos) afirmar(atual.fontesNaturais.tiles[`${p.gx},${p.gy}`]?.tipo === p.tipo, `${p.tipo}: fonte real presente na ponte`);
    await capturar(`minerais-perto-${i === 0 ? 'jogador' : 'ai'}`);
  }
}
module.exports = { roteiro };
