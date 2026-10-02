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

function vistaComMaisAgua() {
  const simbolo = Object.keys(mapa.legenda).find((ch) => mapa.legenda[ch] === 'agua');
  const largura = Math.ceil(1280 / terreno.tile_px);
  const altura = Math.ceil(720 / terreno.tile_px);
  let melhor = { gx: 0, gy: 0, total: -1 };
  for (let gy = 0; gy <= mapa.altura - altura; gy += 1) {
    for (let gx = 0; gx <= mapa.largura - largura; gx += 1) {
      let total = 0;
      for (let y = gy; y < gy + altura; y += 1) {
        for (let x = gx; x < gx + largura; x += 1) if (mapa.linhas[y][x] === simbolo) total += 1;
      }
      if (total > melhor.total) melhor = { gx, gy, total };
    }
  }
  return { x: melhor.gx * terreno.tile_px, y: melhor.gy * terreno.tile_px };
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

  // Medida da corrida, sem assercao: mesmo acude, viewport e estado pausado.
  const medirQuadro = () => page.evaluate(async () => {
    let anterior = await new Promise((resolve) => window.requestAnimationFrame(resolve));
    let soma = 0;
    for (let i = 0; i < 60; i += 1) {
      const agora = await new Promise((resolve) => window.requestAnimationFrame(resolve));
      soma += agora - anterior;
      anterior = agora;
    }
    return soma / 60;
  });
  const vistaCheia = vistaComMaisAgua();
  await page.evaluate(({ x, y }) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), vistaCheia);
  await page.waitForTimeout(200);
  const aguaNaVistaCheia = Object.keys((await estado()).variantesDaAguaVisivel).length;
  await page.evaluate((n) => window.__cangaco.avancar(n), config.periodo);
  await page.waitForTimeout(200);
  const trocadasNaVistaCheia = (await estado()).celulasDaAguaTrocadas;
  const comAguaMs = await medirQuadro();
  await page.goto(`${page.url()}&aguaDesligada`);
  await page.waitForFunction(() => Boolean(window.__cangaco?.pronto));
  await page.evaluate(({ x, y }) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), vistaCheia);
  await page.waitForTimeout(200);
  const semAguaMs = await medirQuadro();
  console.log(`custo D-TELA-AGUA-VIVA: com=${comAguaMs.toFixed(3)} ms/quadro; sem=${semAguaMs.toFixed(3)} ms/quadro; aguaNaVistaMaisCheia=${aguaNaVistaCheia}; trocadasNoPeriodo=${trocadasNaVistaCheia}`);
}

module.exports = { roteiro };
