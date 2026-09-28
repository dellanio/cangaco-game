#!/usr/bin/env node
'use strict';

// Deriva o ICONE de menu de cada predio a partir da IMAGEM BASE versionada
// (CLAUDE.md §9: toda geracao deriva da base; nada nasce de prompt solto).
// Roda a mao, NAO entra em `npm run verify`: a saida e commitada, entao o jogo
// nunca depende deste script para subir.
//
//   node tools/derivar-icones.js            # todos os predios com base
//   node tools/derivar-icones.js storehouse # um so
//
// Para cada `assets/base/<id>/*_03_completo.png` (o estagio completo e o que
// o menu mostra: o jogador escolhe o predio pronto, nao a obra):
//   1. mede a bbox do conteudo (alpha > ALFA_MINIMO), como derivar-sprites.js;
//   2. recorta pela bbox, escala para caber em LADO x LADO (proporcao mantida,
//      centrado, fundo transparente) — LADO e 2x o tamanho em tela (36 px)
//      para nao borrar em monitor de alta densidade;
//   3. grava `assets/sprites/<id>/icone.png` e registra em
//      `assets/manifest.json > icones.predios.<id>` com bbox, escala e a base.
//
// Usa o Chromium do Playwright, que ja e devDependency (`npm run shot` depende
// dele): nenhuma dependencia nova.

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

const RAIZ = path.join(__dirname, '..', 'assets');
const MANIFESTO = path.join(RAIZ, 'manifest.json');
const LADO = 72; // 2x os 36 px que o botao de 40 mostra por dentro da borda
const ALFA_MINIMO = 16;

function basesDisponiveis(filtro) {
  const dir = path.join(RAIZ, 'base');
  const ids = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((id) => filtro.length === 0 || filtro.includes(id));
  const alvos = [];
  for (const id of ids) {
    const arquivos = fs.readdirSync(path.join(dir, id));
    // Quando existe, a base de icone e uma ilustracao aprovada para leitura em
    // 52 px. Ela vence o sprite completo, que continua sendo a fonte do mundo.
    const completo = arquivos.find((f) => /_menu_icon\.png$/.test(f))
      ?? arquivos.find((f) => /_03_completo\.png$/.test(f));
    if (!completo) {
      console.warn(`${id}: sem *_menu_icon.png ou *_03_completo.png em assets/base/${id}/ — pulado`);
      continue;
    }
    alvos.push({ id, base: `base/${id}/${completo}`, saida: `sprites/${id}/icone.png` });
  }
  return alvos;
}

async function derivar(pagina, alvo) {
  const b64 = fs.readFileSync(path.join(RAIZ, alvo.base)).toString('base64');
  return pagina.evaluate(async (arg) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + arg.b64;
    await img.decode();
    const medida = document.createElement('canvas');
    medida.width = img.width;
    medida.height = img.height;
    const mctx = medida.getContext('2d');
    mctx.drawImage(img, 0, 0);
    const px = mctx.getImageData(0, 0, img.width, img.height).data;
    let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
    for (let y = 0; y < img.height; y += 1) {
      for (let x = 0; x < img.width; x += 1) {
        if (px[(y * img.width + x) * 4 + 3] > arg.alfa) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const largura = x1 - x0 + 1;
    const altura = y1 - y0 + 1;
    const escala = Math.min(arg.lado / largura, arg.lado / altura);
    const w = Math.round(largura * escala);
    const h = Math.round(altura * escala);
    const canvas = document.createElement('canvas');
    canvas.width = arg.lado;
    canvas.height = arg.lado;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x0, y0, largura, altura, Math.round((arg.lado - w) / 2), Math.round((arg.lado - h) / 2), w, h);
    return {
      dados: canvas.toDataURL('image/png').split(',')[1],
      fonte: [img.width, img.height],
      bbox: [x0, y0, largura, altura],
      escala: Number(escala.toFixed(4)),
    };
  }, { b64, lado: LADO, alfa: ALFA_MINIMO });
}

async function main() {
  const filtro = process.argv.slice(2);
  const alvos = basesDisponiveis(filtro);
  if (alvos.length === 0) {
    console.error('derivar-icones: nenhuma base encontrada.');
    process.exit(1);
  }
  const manifesto = JSON.parse(fs.readFileSync(MANIFESTO, 'utf8'));
  manifesto.icones = manifesto.icones || {};
  manifesto.icones.predios = manifesto.icones.predios || {};

  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  try {
    for (const alvo of alvos) {
      const r = await derivar(pagina, alvo);
      const destino = path.join(RAIZ, alvo.saida);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, Buffer.from(r.dados, 'base64'));
      manifesto.icones.predios[alvo.id] = {
        arquivo: alvo.saida,
        tamanho: [LADO, LADO],
        licenca: 'arte propria do projeto, fornecida pelo operador',
        origem: {
          base: alvo.base,
          semente: null,
          nota: `Derivado por tools/derivar-icones.js: ${r.fonte[0]}x${r.fonte[1]}, bbox alpha>${ALFA_MINIMO} em `
            + `${r.bbox[0]},${r.bbox[1]} ${r.bbox[2]}x${r.bbox[3]}, escala ${r.escala}, centrado em ${LADO}x${LADO}.`,
        },
      };
      console.log(`${alvo.id}: ${alvo.base} ${r.fonte[0]}x${r.fonte[1]} bbox ${r.bbox.join(',')} -> ${alvo.saida} ${LADO}x${LADO}`);
    }
  } finally {
    await navegador.close();
  }
  fs.writeFileSync(MANIFESTO, JSON.stringify(manifesto, null, 2) + '\n');
  console.log(`manifesto: ${Object.keys(manifesto.icones.predios).length} icone(s) de predio registrados.`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
