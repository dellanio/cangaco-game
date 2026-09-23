#!/usr/bin/env node
'use strict';

// Deriva o sprite de jogo a partir da IMAGEM BASE versionada (CLAUDE.md §9:
// toda geracao deriva da base). Roda a mao, NAO entra em `npm run verify`: a
// saida e commitada, entao o jogo nunca depende deste script para subir.
//
//   node tools/derivar-sprites.js
//
// Recorta pela UNIAO das bboxes de alpha dos tres estagios — UM retangulo so,
// igual para todos. Recortar cada estagio pelo SEU faria o predio PULAR de
// posicao ao trocar de estagio (as tres bboxes sao diferentes); o recorte comum
// e translacao mais escala uniforme identica para os tres, entao o registro
// entre eles se preserva por construcao, como se preservava escalando o quadro
// inteiro.
//
// Isto e COSMETICO, e vale registrar o que ele NAO conserta. Medido em
// 2026-09-23 sobre os derivados de 192x128: a margem transparente respondia por
// pouco (18% da largura no `completo`), e o quadro cheio deixava o predio
// cobrindo 31,8% do quadrado de chao de 192x192 — contra 100% do retangulo
// placeholder da Casa do Coronel. A causa medida e a PROJECAO: o plano de chao
// da arte e um losango isometrico ~2:1 (a bbox do `marcacao` esta 55,8%
// preenchida, contra os 50% de um losango perfeito), e nenhum fator de escala
// concilia losango com footprint quadrado — §4 pede 3/4 sobre grid ortogonal.
// O recorte devolve ~12% de tamanho linear; o resto e decisao de arte.
//
// Usa o Chromium do Playwright, que ja e devDependency (`npm run shot` depende
// dele): nenhuma dependencia nova para um passo que roda uma vez por predio.

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const RAIZ = path.join(__dirname, '..', 'assets');

// A LARGURA manda: 3 tiles x 64 px. A altura sai da razao da UNIAO das bboxes —
// forcar um quadrado esticaria a arte na vertical.
const LARGURA_ALVO = 192;

// Abaixo disto o pixel e halo de antialias, invisivel em tela, e so incharia o
// recorte. A bbox e estavel nessa vizinhanca: ver o log de `medir`, que imprime
// a uniao para tres limiares antes de escolher este.
const ALFA_MINIMO = 16;
const LIMIARES_DO_LOG = [0, 16, 64];

const ALVOS = [
  { base: 'base/storehouse/armazem_01_obra.png', saida: 'sprites/storehouse/storehouse_marcacao.png' },
  // F17e: a chave do manifesto para esta saida e `estrutura` (o estagio `madeira`
  // deixou de existir). O NOME do arquivo fica: `manifesto.ts` nao parseia nome.
  { base: 'base/storehouse/armazem_02_estrutura.png', saida: 'sprites/storehouse/storehouse_madeira.png' },
  { base: 'base/storehouse/armazem_03_completo.png', saida: 'sprites/storehouse/storehouse_completo.png' },
];

/** Bbox do conteudo (`alpha > limiar`) de uma imagem, na resolucao da BASE.
 *  Devolve tambem a uniao para outros limiares, so para o log: e o que permite
 *  afirmar que o recorte nao depende do numero escolhido. */
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
      let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
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

const uniao = (caixas) => [
  Math.min(...caixas.map((c) => c[0])), Math.min(...caixas.map((c) => c[1])),
  Math.max(...caixas.map((c) => c[2])), Math.max(...caixas.map((c) => c[3])),
];

async function main() {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  try {
    // 1. medir os tres ANTES de cortar qualquer um: o recorte e da uniao.
    const medidas = [];
    for (const alvo of ALVOS) {
      const m = await medir(pagina, path.join(RAIZ, alvo.base));
      medidas.push(m);
      const c = m.caixas[ALFA_MINIMO];
      console.log(`${alvo.base} ${m.fonte[0]}x${m.fonte[1]} bbox ${c[0]},${c[1]}..${c[2]},${c[3]}`);
    }
    for (const limiar of LIMIARES_DO_LOG) {
      const u = uniao(medidas.map((m) => m.caixas[limiar]));
      console.log(`  uniao com alpha > ${limiar}: ${u[0]},${u[1]}..${u[2]},${u[3]} (${u[2] - u[0] + 1}x${u[3] - u[1] + 1})`);
    }

    const [ux0, uy0, ux1, uy1] = uniao(medidas.map((m) => m.caixas[ALFA_MINIMO]));
    const recorte = { x: ux0, y: uy0, largura: ux1 - ux0 + 1, altura: uy1 - uy0 + 1 };
    const alturaAlvo = Math.round(recorte.altura * (LARGURA_ALVO / recorte.largura));

    // 2. cortar e escalar os tres com o MESMO retangulo.
    for (const alvo of ALVOS) {
      const b64 = fs.readFileSync(path.join(RAIZ, alvo.base)).toString('base64');
      const r = await pagina.evaluate(async (arg) => {
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
        return { dados: canvas.toDataURL('image/png').split(',')[1], fonte: [img.width, img.height] };
      }, { b64, largura: LARGURA_ALVO, altura: alturaAlvo, recorte });

      const destino = path.join(RAIZ, alvo.saida);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(r.dados, 'base64'));
      const kb = Math.round(fs.statSync(destino).size / 1024);
      console.log(
        `${alvo.base} ${r.fonte[0]}x${r.fonte[1]} recorte ${recorte.largura}x${recorte.altura}`
        + ` em ${recorte.x},${recorte.y} -> ${alvo.saida} ${LARGURA_ALVO}x${alturaAlvo} (${kb} KB)`,
      );
    }
    console.log(`
manifest.json: "tamanho": [${LARGURA_ALVO}, ${alturaAlvo}]`);
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
