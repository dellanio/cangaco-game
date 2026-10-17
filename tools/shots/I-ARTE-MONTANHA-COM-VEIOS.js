'use strict';
// I-ARTE-MONTANHA-COM-VEIOS (aceite 2) — no sertao, um bloco de granito por tile de montanha (e o bloco com veio nos
// veios da saia de rocha), os veios de ferro e de ouro nos tiles deles, nenhum morrinho de veio, e a captura do macico do
// sudeste, onde ficam o ferro e o ouro. `?semNevoa` tira so a camada escura (o macico fica longe da vila).
const { writeFileSync } = require('node:fs');
const { URL } = require('node:url');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const url = new URL(page.url());
  url.search = '?pausado&semNevoa';
  await page.goto(url.href);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
  await page.waitForTimeout(300);
  const t = (x, y) => mapa.legenda[mapa.linhas[y][x]];
  const montanhas = mapa.contagemPorTipo.montanha;
  const veiosNaRocha = ['iron_ore', 'gold_ore'].reduce((n, tipo) => n + mapa.recursos[tipo].filter(([x, y]) => t(x, y) === 'rocha').length, 0);
  const s = await estado();
  afirmar(s.macico.blocos === montanhas + veiosNaRocha, `um bloco por tile de montanha (${montanhas}) e por veio na rocha (${veiosNaRocha}): ${JSON.stringify(s.macico)}`);
  afirmar(s.macico.ferro === mapa.recursos.iron_ore.length, `os veios de ferro: ${s.macico.ferro} de ${mapa.recursos.iron_ore.length}`);
  afirmar(s.macico.ouro === mapa.recursos.gold_ore.length, `os veios de ouro: ${s.macico.ouro} de ${mapa.recursos.gold_ore.length}`);
  // o macico inteiro (zoom 1) e cada veio de perto (zoom 2): o primeiro tile de ferro e o primeiro de ouro na montanha
  const canvas = await retanguloDoCanvas(page);
  const [fx, fy] = mapa.recursos.iron_ore[0];
  const [ox, oy] = mapa.recursos.gold_ore.find(([x, y]) => t(x, y) === 'montanha');
  for (const [nome, zoom, cx, cy] of [['macico', 1, (fx + ox) / 2, (fy + oy) / 2], ['veio-de-ferro', 2, fx, fy], ['veio-de-ouro', 2, ox, oy]]) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let n = 0; n < 10 && (await estado()).camera.zoom !== zoom; n++) { await page.mouse.wheel(0, (await estado()).camera.zoom < zoom ? -200 : 200); await page.waitForTimeout(200); }
    await page.evaluate((c) => window.__cangaco.fixarCamera(c), { scrollX: Math.round((cx + 0.5) * terreno.tile_px - canvas.width / 2), scrollY: Math.round(cy * terreno.tile_px - canvas.height / 2) });
    await page.waitForTimeout(300);
    await capturar(nome);
  }
  // passo despausado (CLAUDE.md §8)
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p'); await page.waitForTimeout(150);
  writeFileSync('test-output/I-ARTE-MONTANHA-COM-VEIOS.json', JSON.stringify({ macico: s.macico, montanhas, veiosNaRocha }, null, 2));
}

module.exports = { roteiro };
