#!/usr/bin/env node
'use strict';

// Deriva o sprite de jogo a partir da IMAGEM BASE versionada (CLAUDE.md §9:
// toda geracao deriva da base). Roda a mao, NAO entra em `npm run verify`: a
// saida e commitada, entao o jogo nunca depende deste script para subir.
//
//   node tools/derivar-sprites.js
//
// Escala o CANVAS INTEIRO, sem recorte pelo conteudo. Medido em 2026-09-23: os
// tres estagios do armazem tem bbox de alpha diferente (1454x961, 1498x964,
// 1514x1007, com offsets diferentes), e recortar cada um pelo seu faria o
// predio PULAR de posicao ao trocar de estagio. Escalando o quadro inteiro, o
// registro entre estagios se preserva por construcao.
//
// Usa o Chromium do Playwright, que ja e devDependency (`npm run shot` depende
// dele): nenhuma dependencia nova para um passo que roda uma vez por predio.

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const RAIZ = path.join(__dirname, '..', 'assets');

// A LARGURA manda: 3 tiles x 64 px. A altura sai da razao da fonte — a arte
// isometrica e 3:2, e forcar um quadrado a esticaria 1,5x na vertical.
const LARGURA_ALVO = 192;

const ALVOS = [
  { base: 'base/storehouse/armazem_01_obra.png', saida: 'sprites/storehouse/storehouse_marcacao.png' },
  { base: 'base/storehouse/armazem_02_estrutura.png', saida: 'sprites/storehouse/storehouse_madeira.png' },
  { base: 'base/storehouse/armazem_03_completo.png', saida: 'sprites/storehouse/storehouse_completo.png' },
];

async function main() {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  try {
    for (const alvo of ALVOS) {
      const origem = path.join(RAIZ, alvo.base);
      const b64 = fs.readFileSync(origem).toString('base64');
      const r = await pagina.evaluate(async (arg) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + arg.b64;
        await img.decode();
        const escala = arg.largura / img.width;
        const altura = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = arg.largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, arg.largura, altura);
        return {
          dados: canvas.toDataURL('image/png').split(',')[1],
          largura: arg.largura,
          altura,
          fonte: [img.width, img.height],
        };
      }, { b64, largura: LARGURA_ALVO });

      const destino = path.join(RAIZ, alvo.saida);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(r.dados, 'base64'));
      const kb = Math.round(fs.statSync(destino).size / 1024);
      console.log(
        `${alvo.base} ${r.fonte[0]}x${r.fonte[1]} -> ${alvo.saida} ${r.largura}x${r.altura} (${kb} KB)`,
      );
    }
  } finally {
    await navegador.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
