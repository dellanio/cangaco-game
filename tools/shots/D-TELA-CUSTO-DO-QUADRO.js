'use strict';

const fs = require('node:fs');
const mapa = require('../../data/maps/sertao-128.json');
const terreno = require('../../data/terrain.json');

function vistas() {
  const largura = Math.ceil(1280 / terreno.tile_px);
  const altura = Math.ceil(720 / terreno.tile_px);
  const agua = Object.keys(mapa.legenda).find((ch) => mapa.legenda[ch] === 'agua');
  const melhores = { arvores: { n: -1 }, agua: { n: -1 } };
  for (let gy = 0; gy <= mapa.altura - altura; gy += 1) for (let gx = 0; gx <= mapa.largura - largura; gx += 1) {
    const nArvores = mapa.recursos.tree.filter(([x, y]) => x >= gx && x < gx + largura && y >= gy && y < gy + altura).length;
    let nAgua = 0;
    for (let y = gy; y < gy + altura; y += 1) for (let x = gx; x < gx + largura; x += 1) {
      if (mapa.linhas[y][x] === agua) nAgua += 1;
    }
    if (nArvores > melhores.arvores.n) melhores.arvores = { gx, gy, n: nArvores };
    if (nAgua > melhores.agua.n) melhores.agua = { gx, gy, n: nAgua };
  }
  return melhores;
}

async function medir(page, vista, modo) {
  return page.evaluate(async ({ gx, gy, modo }) => {
    const ponte = window.__cangaco;
    ponte.fixarCamera({ scrollX: gx * 64, scrollY: gy * 64 });
    const quadro = () => new Promise((resolve) => window.requestAnimationFrame(() => setTimeout(resolve, 0)));
    await quadro();
    ponte.zerarCusto();
    if (modo === 'pausado') {
      for (let i = 0; i < 60; i += 1) await quadro();
    } else {
      for (let i = 0; i < 60; i += 1) { ponte.avancar(1); await quadro(); }
    }
    const custo = JSON.parse(JSON.stringify(ponte.custo));
    return Object.fromEntries(Object.entries(custo).map(([camada, valor]) => [camada, {
      msPorQuadro: valor.chamadas ? valor.ms / valor.chamadas : 0,
      itensPorQuadro: valor.chamadas ? valor.itens / valor.chamadas : 0,
      chamadas: valor.chamadas,
      ms: valor.ms,
      itens: valor.itens,
    }]));
  }, { gx: vista.gx, gy: vista.gy, modo });
}

async function roteiro({ page, afirmar }) {
  const locais = vistas();
  afirmar(locais.arvores.n > 0 && locais.agua.n > 0, 'as duas vistas precisam conter arvores e agua');
  const resultado = {};
  for (const [nome, vista] of Object.entries(locais)) {
    resultado[nome] = { vista, pausado: await medir(page, vista, 'pausado'), ticks: await medir(page, vista, 'ticks') };
    afirmar(resultado[nome].pausado.agua.itens === 0, 'agua parada com camera fixa trabalha 0 celulas');
    afirmar(resultado[nome].ticks.vento.itens > 0, 'vento trabalha arvores durante os ticks');
  }
  fs.mkdirSync('test-output', { recursive: true });
  fs.writeFileSync('test-output/D-TELA-CUSTO-DO-QUADRO.json', JSON.stringify(resultado, null, 2) + '\n');
  console.log(JSON.stringify(resultado));
}

module.exports = { roteiro };
