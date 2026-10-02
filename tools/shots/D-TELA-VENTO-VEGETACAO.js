'use strict';

const { retanguloDoCanvas } = require('./_canvas');
const mapa = require('../../data/maps/sertao-128.json');
const terreno = require('../../data/terrain.json');
const manifesto = require('../../assets/manifest.json');

function arvoresNaVista(camera, canvas) {
  const entrada = manifesto.assets.find((asset) => asset.tipo === 'vegetacao' && asset.id === 'tree');
  const [largura, altura] = entrada.tamanho;
  const [anchorX, anchorY] = entrada.anchor;
  const direita = camera.scrollX + canvas.width / camera.zoom;
  const baixo = camera.scrollY + canvas.height / camera.zoom;
  return mapa.recursos.tree.filter(([gx, gy]) => {
    const peX = gx * terreno.tile_px + terreno.tile_px / 2;
    const peY = (gy + 1) * terreno.tile_px;
    const esquerda = peX - anchorX * largura;
    const cima = peY - anchorY * altura;
    return esquerda < direita && esquerda + largura > camera.scrollX &&
      cima < baixo && cima + altura > camera.scrollY;
  }).length;
}

function vistaMaisCheia() {
  let melhor = { x: 0, y: 0, n: 0 };
  for (let y = 0; y < mapa.altura - 11; y += 1) for (let x = 0; x < mapa.largura - 20; x += 1) {
    const n = mapa.recursos.tree.filter(([gx, gy]) => gx >= x && gx < x + 20 && gy >= y && gy < y + 11).length;
    if (n > melhor.n) melhor = { x, y, n };
  }
  return melhor;
}

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const mato = vistaMaisCheia();
  afirmar(mato.n > 0, 'o mapa precisa ter arvores para a captura');
  await page.evaluate((scroll) => window.__cangaco.fixarCamera(scroll), {
    scrollX: Math.round((mato.x + 10) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((mato.y + 5.5) * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(200);
  const antes = await estado();
  afirmar(antes.pausado, 'o roteiro inicia pausado');
  afirmar(antes.vegetacaoBalancando === 0, 'quadro repetido atualiza 0 sprites');
  const novoTick = await page.evaluate(async () => {
    window.__cangaco.avancar(1);
    await new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
    const { tick, vegetacaoBalancando, ticksDaVegetacaoNaVista } = window.__cangaco;
    return { tick, vegetacaoBalancando, ticksDaVegetacaoNaVista };
  });
  afirmar(novoTick.vegetacaoBalancando === arvoresNaVista(antes.camera, canvas),
    `tick novo atualiza exatamente as arvores da vista: ${novoTick.vegetacaoBalancando}`);
  afirmar(novoTick.vegetacaoBalancando === Object.keys(novoTick.ticksDaVegetacaoNaVista).length,
    'a ponte publica cada arvore da vista');
  afirmar(novoTick.vegetacaoBalancando > 0, 'deve haver arvores na vista balancando');
  await page.waitForTimeout(100);
  afirmar((await estado()).vegetacaoBalancando === 0, 'quadro repetido apos tick atualiza 0 sprites');
  await page.evaluate(() => window.__cangaco.fixarCamera({ scrollX: 0, scrollY: 0 }));
  await page.waitForTimeout(100);
  const fora = await estado();
  await page.evaluate((scroll) => window.__cangaco.fixarCamera(scroll), {
    scrollX: Math.round((mato.x + 10) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((mato.y + 5.5) * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForTimeout(100);
  const entrou = await estado();
  const novas = Object.keys(entrou.ticksDaVegetacaoNaVista).filter((chave) => !(chave in fora.ticksDaVegetacaoNaVista));
  afirmar(novas.length > 0, 'camera trouxe arvores novas para a vista');
  afirmar(novas.every((chave) => entrou.ticksDaVegetacaoNaVista[chave] === entrou.tick),
    'arvores que entram pela camera ja recebem o tick atual');
  await capturar('tick-T');
  const regiao = { x: canvas.left, y: canvas.top, width: canvas.width, height: canvas.height };
  const imagemT = await page.screenshot({ clip: regiao });
  await page.evaluate(() => window.__cangaco.avancar(5));
  await page.waitForTimeout(200);
  const depois = await estado();
  afirmar(depois.tick === entrou.tick + 5, 'a ponte precisa avancar cinco ticks');
  await capturar('tick-T-mais-5');
  const imagemDepois = await page.screenshot({ clip: regiao });
  afirmar(!imagemT.equals(imagemDepois), 'a regiao das arvores precisa mudar em T+5');
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('p');
  afirmar((await estado()).pausado, 'o passo despausado terminou pausado');
  console.log(`vento: ${novoTick.vegetacaoBalancando} sprites da vista no tick novo; ${novas.length} entraram pela camera`);
}

module.exports = { roteiro };
