'use strict';

const mapa = require('../../data/maps/sertao-128.json');
const terreno = require('../../data/terrain.json');
const config = require('../../data/poeira.json');

function vistaDeAreiaEGrama() {
  const largura = Math.ceil(1280 / terreno.tile_px);
  const altura = Math.ceil(720 / terreno.tile_px);
  let melhor = { gx: 0, gy: 0, pontos: -1 };
  for (let gy = 0; gy <= mapa.altura - altura; gy += 1) {
    for (let gx = 0; gx <= mapa.largura - largura; gx += 1) {
      let areia = 0;
      let grama = 0;
      for (let y = gy; y < gy + altura; y += 1) for (let x = gx; x < gx + largura; x += 1) {
        const tipo = mapa.legenda[mapa.linhas[y][x]];
        if (tipo === 'areia') areia += 1;
        if (tipo === 'grama') grama += 1;
      }
      const pontos = Math.min(areia, grama);
      if (pontos > melhor.pontos) melhor = { gx, gy, pontos };
    }
  }
  if (melhor.pontos <= 0) throw new Error('Nao ha vista com areia e grama.');
  return { scrollX: melhor.gx * terreno.tile_px, scrollY: melhor.gy * terreno.tile_px };
}

function centroDoAcude() {
  const agua = Object.keys(mapa.legenda).find((ch) => mapa.legenda[ch] === 'agua');
  const tiles = [];
  for (let gy = 0; gy < mapa.altura; gy += 1) for (let gx = 0; gx < mapa.largura; gx += 1) {
    if (mapa.linhas[gy][gx] === agua) tiles.push({ gx, gy });
  }
  if (tiles.length === 0) throw new Error('O mapa nao tem acude.');
  const medio = tiles.reduce((s, t) => ({ gx: s.gx + t.gx, gy: s.gy + t.gy }), { gx: 0, gy: 0 });
  const cx = medio.gx / tiles.length;
  const cy = medio.gy / tiles.length;
  const tile = tiles.reduce((a, b) =>
    (b.gx - cx) ** 2 + (b.gy - cy) ** 2 < (a.gx - cx) ** 2 + (a.gy - cy) ** 2 ? b : a);
  return { scrollX: tile.gx * terreno.tile_px - 640, scrollY: tile.gy * terreno.tile_px - 360 };
}

async function roteiro({ page, estado, afirmar, capturar }) {
  let maximoDoPool = 0;
  const conferir = async () => {
    const atual = await estado();
    afirmar(atual.poeiraDesenhada.length <= config.maximoNaVista, 'Poeira excedeu maximoNaVista.');
    afirmar(atual.poolDaPoeira <= config.maximoNaVista, 'Pool excedeu maximoNaVista.');
    maximoDoPool = Math.max(maximoDoPool, atual.poolDaPoeira);
    return atual;
  };
  await page.evaluate((camera) => window.__cangaco.fixarCamera(camera), vistaDeAreiaEGrama());
  await page.waitForTimeout(200);
  const antes = await conferir();
  afirmar(antes.poeiraDesenhada.length > 0, 'A vista de areia e grama precisa mostrar poeira.');
  await capturar('tick-T');
  await page.evaluate(() => window.__cangaco.avancar(5));
  await page.waitForTimeout(200);
  const depois = await conferir();
  afirmar(depois.tick === antes.tick + 5, 'A ponte nao avancou cinco ticks.');
  await capturar('tick-T-mais-5');

  await page.evaluate((camera) => window.__cangaco.fixarCamera(camera), centroDoAcude());
  await page.waitForTimeout(200);
  const acude = await conferir();
  afirmar(Object.keys(acude.variantesDaAguaVisivel).length > 0, 'O acude precisa estar na vista.');
  for (const particula of acude.poeiraDesenhada) {
    const tipo = mapa.legenda[mapa.linhas[particula.gy][particula.gx]];
    afirmar(tipo !== 'agua', `Poeira sobre agua em ${particula.gx},${particula.gy}.`);
  }
  await capturar('acude');
  await page.evaluate(() => window.__cangaco.avancar(50));
  await page.waitForTimeout(200);
  await conferir();
  await page.evaluate((camera) => window.__cangaco.fixarCamera(camera), vistaDeAreiaEGrama());
  await page.waitForTimeout(200);
  await conferir();
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('p');
  afirmar((await conferir()).pausado, 'O passo despausado precisa terminar pausado.');
  console.log(`poolDaPoeira maximo visto: ${maximoDoPool}`);
}

module.exports = { roteiro };
