#!/usr/bin/env node
'use strict';

// Deriva o sprite de jogo a partir da IMAGEM BASE versionada (CLAUDE.md §9:
// toda geração deriva da base). Roda à mão, NÃO entra em `npm run verify`:
// a saída é commitada, então o jogo nunca depende deste script para subir.
//
//   node tools/derivar-sprites.js
//
// Dentro de cada prédio, o recorte é a UNIÃO das bounding boxes de alpha de
// todos os estágios. Um único retângulo, uma única translação e uma única
// escala impedem o prédio de pular quando o estágio muda.
//
// NUNCA compartilhe a união entre prédios. Silhuetas e canvas distintos fariam
// um prédio contaminar o recorte do outro, reintroduzindo o salto que esta
// organização por grupos existe para impedir.

const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const RAIZ = path.join(__dirname, '..', 'assets');
const ARQUIVO_PREDIOS = path.join(__dirname, '..', 'data', 'buildings.json');
const TILE_PX = 64;

// Limiar que separa conteúdo de resíduo semitransparente do gerador. A bbox é
// estável nessa vizinhança; o log imprime as uniões nos três limiares.
const ALFA_MINIMO = 16;
const LIMIARES_DO_LOG = [0, 16, 64];

const GRUPOS = [
  {
    id: 'storehouse',
    alvos: [
      { base: 'base/storehouse/storehouse_01_marcacao.png', saida: 'sprites/storehouse/storehouse_marcacao.png' },
      { base: 'base/storehouse/storehouse_02_fundacao.png', saida: 'sprites/storehouse/storehouse_fundacao.png' },
      { base: 'base/storehouse/storehouse_03_estrutura.png', saida: 'sprites/storehouse/storehouse_estrutura.png' },
      { base: 'base/storehouse/storehouse_04_paredes.png', saida: 'sprites/storehouse/storehouse_paredes.png' },
      { base: 'base/storehouse/storehouse_05_cobertura.png', saida: 'sprites/storehouse/storehouse_cobertura.png' },
      { base: 'base/storehouse/storehouse_06_completo.png', saida: 'sprites/storehouse/storehouse_completo.png' },
    ],
  },
  {
    id: 'woodcutters',
    alvos: [
      { base: 'base/woodcutters/woodcutters_01_marcacao.png', saida: 'sprites/woodcutters/woodcutters_marcacao.png' },
      { base: 'base/woodcutters/woodcutters_02_fundacao.png', saida: 'sprites/woodcutters/woodcutters_fundacao.png' },
      { base: 'base/woodcutters/casa_lenhador_02_estrutura.png', saida: 'sprites/woodcutters/woodcutters_estrutura.png' },
      { base: 'base/woodcutters/woodcutters_04_paredes.png', saida: 'sprites/woodcutters/woodcutters_paredes.png' },
      { base: 'base/woodcutters/woodcutters_05_cobertura.png', saida: 'sprites/woodcutters/woodcutters_cobertura.png' },
      { base: 'base/woodcutters/casa_lenhador_03_completo.png', saida: 'sprites/woodcutters/woodcutters_completo.png' },
    ],
  },
  {
    id: 'quarry',
    alvos: [
      { base: 'base/quarry/quarry_01_marcacao.png', saida: 'sprites/quarry/quarry_marcacao.png' },
      { base: 'base/quarry/quarry_02_fundacao.png', saida: 'sprites/quarry/quarry_fundacao.png' },
      { base: 'base/quarry/quarry_03_estrutura.png', saida: 'sprites/quarry/quarry_estrutura.png' },
      { base: 'base/quarry/quarry_04_paredes.png', saida: 'sprites/quarry/quarry_paredes.png' },
      { base: 'base/quarry/quarry_05_cobertura.png', saida: 'sprites/quarry/quarry_cobertura.png' },
      { base: 'base/quarry/quarry_06_completo.png', saida: 'sprites/quarry/quarry_completo.png' },
    ],
  },
  {
    id: 'sawmill',
    alvos: [
      { base: 'base/sawmill/sawmill_01_marcacao.png', saida: 'sprites/sawmill/sawmill_marcacao.png' },
      { base: 'base/sawmill/sawmill_02_fundacao.png', saida: 'sprites/sawmill/sawmill_fundacao.png' },
      { base: 'base/sawmill/sawmill_03_estrutura.png', saida: 'sprites/sawmill/sawmill_estrutura.png' },
      { base: 'base/sawmill/sawmill_04_paredes.png', saida: 'sprites/sawmill/sawmill_paredes.png' },
      { base: 'base/sawmill/sawmill_05_cobertura.png', saida: 'sprites/sawmill/sawmill_cobertura.png' },
      { base: 'base/sawmill/sawmill_06_completo.png', saida: 'sprites/sawmill/sawmill_completo.png' },
    ],
  },
  {
    id: 'schoolhouse',
    alvos: [
      { base: 'base/schoolhouse/schoolhouse_01_marcacao.png', saida: 'sprites/schoolhouse/schoolhouse_marcacao.png' },
      { base: 'base/schoolhouse/schoolhouse_02_fundacao.png', saida: 'sprites/schoolhouse/schoolhouse_fundacao.png' },
      { base: 'base/schoolhouse/schoolhouse_03_estrutura.png', saida: 'sprites/schoolhouse/schoolhouse_estrutura.png' },
      { base: 'base/schoolhouse/schoolhouse_04_paredes.png', saida: 'sprites/schoolhouse/schoolhouse_paredes.png' },
      { base: 'base/schoolhouse/schoolhouse_05_cobertura.png', saida: 'sprites/schoolhouse/schoolhouse_cobertura.png' },
      { base: 'base/schoolhouse/schoolhouse_06_completo.png', saida: 'sprites/schoolhouse/schoolhouse_completo.png' },
    ],
  },
  {
    id: 'inn',
    alvos: [
      { base: 'base/inn/inn_01_marcacao.png', saida: 'sprites/inn/inn_marcacao.png' },
      { base: 'base/inn/inn_02_fundacao.png', saida: 'sprites/inn/inn_fundacao.png' },
      { base: 'base/inn/inn_03_estrutura.png', saida: 'sprites/inn/inn_estrutura.png' },
      { base: 'base/inn/inn_04_paredes.png', saida: 'sprites/inn/inn_paredes.png' },
      { base: 'base/inn/inn_05_cobertura.png', saida: 'sprites/inn/inn_cobertura.png' },
      { base: 'base/inn/inn_06_completo.png', saida: 'sprites/inn/inn_completo.png' },
    ],
  },
];

function carregarPredios() {
  const dados = JSON.parse(fs.readFileSync(ARQUIVO_PREDIOS, 'utf8'));
  if (!Array.isArray(dados.predios)) {
    throw new Error('data/buildings.json não contém o array `predios`');
  }
  return dados.predios;
}

function larguraDoSprite(predios, id) {
  const predio = predios.find((item) => item.id === id);
  if (!predio) {
    throw new Error(`Prédio ausente em data/buildings.json: ${id}`);
  }
  if (!Array.isArray(predio.tamanho) || !Number.isInteger(predio.tamanho[0])) {
    throw new Error(`Footprint inválido em data/buildings.json para ${id}`);
  }
  return predio.tamanho[0] * TILE_PX;
}

/** Bbox do conteúdo (`alpha > limiar`) de uma imagem, na resolução da base. */
async function medir(pagina, arquivo) {
  const b64 = fs.readFileSync(arquivo).toString('base64');
  return pagina.evaluate(async (arg) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + arg.b64;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, img.width, img.height).data;

    const caixas = {};
    for (const limiar of arg.limiares) {
      let x0 = img.width;
      let y0 = img.height;
      let x1 = -1;
      let y1 = -1;
      for (let y = 0; y < img.height; y += 1) {
        for (let x = 0; x < img.width; x += 1) {
          if (px[(y * img.width + x) * 4 + 3] > limiar) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }
      caixas[limiar] = [x0, y0, x1, y1];
    }
    return { fonte: [img.width, img.height], caixas };
  }, { b64, limiares: LIMIARES_DO_LOG });
}

function uniao(caixas) {
  return [
    Math.min(...caixas.map((caixa) => caixa[0])),
    Math.min(...caixas.map((caixa) => caixa[1])),
    Math.max(...caixas.map((caixa) => caixa[2])),
    Math.max(...caixas.map((caixa) => caixa[3])),
  ];
}

async function processarGrupo(pagina, grupo, larguraAlvo) {
  console.log(`\n[${grupo.id}] largura ${larguraAlvo}px`);

  // Mede todos os estágios deste prédio antes de cortar qualquer um. A união é
  // deliberadamente local ao grupo; nunca acumule medidas de outro prédio.
  const medidas = [];
  for (const alvo of grupo.alvos) {
    const medida = await medir(pagina, path.join(RAIZ, alvo.base));
    medidas.push(medida);
    const caixa = medida.caixas[ALFA_MINIMO];
    console.log(`${alvo.base} ${medida.fonte[0]}x${medida.fonte[1]} bbox ${caixa[0]},${caixa[1]}..${caixa[2]},${caixa[3]}`);
  }

  for (const limiar of LIMIARES_DO_LOG) {
    const caixa = uniao(medidas.map((medida) => medida.caixas[limiar]));
    console.log(`  união com alpha > ${limiar}: ${caixa[0]},${caixa[1]}..${caixa[2]},${caixa[3]} (${caixa[2] - caixa[0] + 1}x${caixa[3] - caixa[1] + 1})`);
  }

  const [ux0, uy0, ux1, uy1] = uniao(medidas.map((medida) => medida.caixas[ALFA_MINIMO]));
  const recorte = { x: ux0, y: uy0, largura: ux1 - ux0 + 1, altura: uy1 - uy0 + 1 };
  const alturaAlvo = Math.round(recorte.altura * (larguraAlvo / recorte.largura));

  for (const alvo of grupo.alvos) {
    const b64 = fs.readFileSync(path.join(RAIZ, alvo.base)).toString('base64');
    const resultado = await pagina.evaluate(async (arg) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + arg.b64;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = arg.largura;
      canvas.height = arg.altura;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      const { x, y, largura, altura } = arg.recorte;
      ctx.drawImage(img, x, y, largura, altura, 0, 0, arg.largura, arg.altura);
      return {
        dados: canvas.toDataURL('image/png').split(',')[1],
        fonte: [img.width, img.height],
      };
    }, { b64, largura: larguraAlvo, altura: alturaAlvo, recorte });

    const destino = path.join(RAIZ, alvo.saida);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, Buffer.from(resultado.dados, 'base64'));
    const kb = Math.round(fs.statSync(destino).size / 1024);
    console.log(
      `${alvo.base} ${resultado.fonte[0]}x${resultado.fonte[1]} recorte ${recorte.largura}x${recorte.altura}`
      + ` em ${recorte.x},${recorte.y} -> ${alvo.saida} ${larguraAlvo}x${alturaAlvo} (${kb} KB)`,
    );
  }

  console.log(`  manifest.json: "tamanho": [${larguraAlvo}, ${alturaAlvo}]`);
}

async function main() {
  const predios = carregarPredios();
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  try {
    for (const grupo of GRUPOS) {
      await processarGrupo(pagina, grupo, larguraDoSprite(predios, grupo.id));
    }
  } finally {
    await navegador.close();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
