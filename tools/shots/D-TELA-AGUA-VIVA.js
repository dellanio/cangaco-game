'use strict';

const mapa = require('../../data/maps/sertao-128.json');
const terreno = require('../../data/terrain.json');
const config = require('../../data/agua.json');

function centroDaAgua() {
  const simbolo = Object.keys(mapa.legenda).find((ch) => mapa.legenda[ch] === 'agua');
  const tiles = [];
  for (let gy = 0; gy < mapa.altura; gy += 1) for (let gx = 0; gx < mapa.largura; gx += 1) {
    if (mapa.linhas[gy][gx] === simbolo) tiles.push({ gx, gy });
  }
  if (tiles.length === 0) throw new Error('O mapa nao tem agua.');
  const medio = tiles.reduce((a, t) => ({ gx: a.gx + t.gx, gy: a.gy + t.gy }), { gx: 0, gy: 0 });
  medio.gx /= tiles.length;
  medio.gy /= tiles.length;
  return tiles.reduce((melhor, t) =>
    (t.gx - medio.gx) ** 2 + (t.gy - medio.gy) ** 2 <
      (melhor.gx - medio.gx) ** 2 + (melhor.gy - medio.gy) ** 2 ? t : melhor);
}

function variante(tick, gx, gy) {
  const fase = ((Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663)) >>> 0) % config.variantes.length;
  return config.variantes[(Math.floor(tick / config.periodo) + fase) % config.variantes.length];
}

async function roteiro({ page, estado, afirmar, capturar }) {
  const tile = centroDaAgua();
  await page.evaluate(({ x, y }) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), {
    x: tile.gx * terreno.tile_px - 640,
    y: tile.gy * terreno.tile_px - 360,
  });
  await page.waitForTimeout(200);
  const antes = await estado();
  const entradas = Object.entries(antes.variantesDaAguaVisivel);
  afirmar(entradas.length > 0, 'O acude precisa estar na vista.');
  for (const [xy, valor] of entradas) {
    const [gx, gy] = xy.split(',').map(Number);
    afirmar(valor === variante(antes.tick, gx, gy), `Variante errada em ${xy}: ${valor}`);
  }
  afirmar(antes.celulasDaAguaTrocadas <= entradas.length, 'Trocas excedem a agua da vista.');
  await capturar('tick-T');
  await page.evaluate((n) => window.__cangaco.avancar(n), config.periodo);
  await page.waitForTimeout(200);
  const depois = await estado();
  afirmar(depois.tick === antes.tick + config.periodo, 'A ponte nao avancou o periodo.');
  let mudaram = 0;
  for (const [xy, valor] of Object.entries(depois.variantesDaAguaVisivel)) {
    const [gx, gy] = xy.split(',').map(Number);
    afirmar(valor === variante(depois.tick, gx, gy), `Variante errada em ${xy}: ${valor}`);
    if (antes.variantesDaAguaVisivel[xy] !== valor) mudaram += 1;
  }
  afirmar(mudaram > 0, 'Nenhum tile mudou depois de um periodo.');
  afirmar(depois.celulasDaAguaTrocadas <= Object.keys(depois.variantesDaAguaVisivel).length,
    'Trocas excedem a agua da vista.');
  await capturar('tick-T-mais-periodo');
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('p');

}

module.exports = { roteiro };
