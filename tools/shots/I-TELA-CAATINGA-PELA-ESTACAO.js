'use strict';
const { writeFileSync } = require('node:fs');
const { URL } = require('node:url');
const clima = require('../../data/clima.json');
const tempo = require('../../data/time.json');
const terreno = require('../../data/terrain.json');
const { retanguloDoCanvas } = require('./_canvas');
const ticks = clima.ciclo.map(f => Math.round(f.duracao_segundos_base / tempo.escalas[clima.escala] * tempo.tickHz));
async function roteiro({ page, capturar, estado, afirmar }) {
  const url = new URL(page.url()); url.searchParams.set('semNevoa', '');
  await page.goto(url.toString()); await page.waitForFunction(() => window.__cangaco?.pronto);
  const canvas = await retanguloDoCanvas(page);
  let mato = false;
  for (let gy = 32; gy < 112 && !mato; gy += 16) for (let gx = 32; gx < 112 && !mato; gx += 16) {
    const s = await estado();
    await page.evaluate(({ x, y }) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), {
      x: (gx + 0.5) * terreno.tile_px - canvas.width / (2 * s.camera.zoom),
      y: (gy + 0.5) * terreno.tile_px - canvas.height / (2 * s.camera.zoom),
    });
    await page.waitForTimeout(100);
    mato = (await estado()).caatinga.normal > 20;
  }
  afirmar(mato, 'vista com vegetacao suficiente');
  const inverno = (await estado()).caatinga;
  afirmar(inverno.normal > 0 && inverno.seca === 0, 'inverno inteiramente normal');
  await capturar('inverno');
  await page.evaluate(() => window.__cangaco.avancar(1)); await page.waitForTimeout(100);
  const tickMesmoDegrau = (await estado()).caatinga;
  afirmar(tickMesmoDegrau.recalculos === inverno.recalculos && tickMesmoDegrau.repinturas === inverno.repinturas, 'tick sem trocar degrau nao repinta caatinga');
  async function avancarAte(alvo) {
    let tick = await page.evaluate(() => window.__cangaco.tick);
    while (tick < alvo) {
      const n = Math.min(500, alvo - tick);
      await page.evaluate(n => window.__cangaco.avancar(n), n);
      tick = await page.evaluate(() => window.__cangaco.tick);
    }
    await page.waitForTimeout(200);
  }
  await avancarAte(ticks[0] + Math.floor(ticks[1] / 2));
  const metade = (await estado()).caatinga;
  const proporcao = metade.seca / (metade.normal + metade.seca);
  afirmar(proporcao > 0.3 && proporcao < 0.7, `transicao parcial: ${JSON.stringify(metade)}`);
  await capturar('transicao');
  await avancarAte(ticks[0] + ticks[1]);
  const seca = (await estado()).caatinga;
  afirmar(seca.seca > 0 && seca.normal === 0, `seca inteira: ${JSON.stringify(seca)}`);
  afirmar(seca.repinturas > inverno.repinturas, 'mudanca de degrau refez sprites');
  await capturar('seca');
  await page.waitForTimeout(250);
  const parada = (await estado()).caatinga;
  afirmar(parada.recalculos === seca.recalculos && parada.repinturas === seca.repinturas, 'quadros pausados nao repintam');
  writeFileSync('test-output/I-TELA-CAATINGA-PELA-ESTACAO-medidas.json', JSON.stringify({ inverno, tickMesmoDegrau, metade, seca, parada }, null, 2));
}
module.exports = { roteiro };
