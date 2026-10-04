'use strict';
const fs = require('node:fs');
const mapa = require('../../data/maps/sertao-128.json');
const terreno = require('../../data/terrain.json');
const SAIDA = 'test-output/D-TELA-VEU-DOS-DETALHES.json';
// BUG-ROTEIRO-DE-DUAS-ETAPAS (decisao do operador, 2026-10-04: A, separar). Sem variavel, o roteiro
// e de NAO-REGRESSAO: afirma o que vale sozinho no codigo de hoje (agua e grama sem detalhes, nos
// dois zooms) e grava a medida em `regressao`. A comparacao e o modo `CANGACO_VEU_ETAPA=antes|depois`,
// e so ele exige a medida "antes" (o que saiu para ele: a medida anterior existir).
const etapa = process.env.CANGACO_VEU_ETAPA ?? 'regressao';

function vista(tipo) {
  const simbolo = Object.keys(mapa.legenda).find((s) => mapa.legenda[s] === tipo);
  for (let y = 8; y < mapa.altura - 8; y += 1) for (let x = 8; x < mapa.largura - 8; x += 1) {
    let puro = true;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
      if (mapa.linhas[y + dy][x + dx] !== simbolo) puro = false;
    }
    if (puro) return { x, y };
  }
  throw new Error(`Sem vista pura de ${tipo}`);
}

async function roteiro({ page, estado, afirmar, capturar }) {
  afirmar(['antes', 'depois', 'regressao'].includes(etapa), 'etapa valida');
  const anterior = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : {};
  if (etapa === 'depois') afirmar(Boolean(anterior.antes), 'medida anterior existe');
  const canvas = await page.locator('#jogo canvas').boundingBox();
  const resultado = {};
  for (const tipo of ['agua', 'grama']) for (const zoom of [1, 2]) {
    const centro = vista(tipo);
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    for (let i = 0; (await estado()).camera.zoom !== zoom && i < 8; i += 1) {
      await page.mouse.wheel(0, (await estado()).camera.zoom < zoom ? -100 : 100);
      await page.waitForTimeout(100);
    }
    afirmar((await estado()).camera.zoom === zoom, `zoom ${zoom}`);
    await page.evaluate(({ x, y }) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), {
      x: centro.x * terreno.tile_px - canvas.width / 2,
      y: centro.y * terreno.tile_px - canvas.height / 2,
    });
    await page.mouse.move(100, 100);
    await page.waitForTimeout(150);
    const arquivo = await capturar(`${etapa}-${tipo}-${zoom}`);
    const s = await estado();
    // vale sozinho: so a medida "antes", tirada no codigo de antes do veu, tinha detalhes
    if (etapa !== 'antes') afirmar(s.detalhesDoTerrenoPorTipo[tipo] === 0, `${tipo} sem detalhes`);
    const medida = await page.evaluate(async ({ b64, canvas, camera, centro, tilePx }) => {
      const img = new window.Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = window.document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
      const cor = (dx, dy) => {
        const x = Math.round(canvas.x + canvas.width / 2 + ((centro.x + dx + 0.5) * tilePx - camera.scrollX - canvas.width / 2) * camera.zoom);
        const y = Math.round(canvas.y + canvas.height / 2 + ((centro.y + dy + 0.5) * tilePx - camera.scrollY - canvas.height / 2) * camera.zoom);
        return Array.from(pixels.slice((y * c.width + x) * 4, (y * c.width + x) * 4 + 3));
      };
      let soma = 0; let pares = 0;
      for (let y = -2; y <= 1; y += 1) for (let x = -2; x <= 1; x += 1) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const a = cor(x, y); const b = cor(x + dx, y + dy);
          soma += a.reduce((soma, v, i) => soma + Math.abs(v - b[i]), 0) / 3; pares += 1;
        }
      }
      return { media: soma / pares, pares };
    }, { b64: fs.readFileSync(arquivo).toString('base64'), canvas, camera: s.camera, centro, tilePx: terreno.tile_px });
    resultado[`${tipo}-${zoom}`] = { ...medida, arquivo, centro, camera: s.camera, tick: s.tick };
    console.log(`${etapa} ${tipo} zoom ${zoom}: ${JSON.stringify(medida)}`);
  }
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.keyboard.press('p'); await page.waitForTimeout(150); await page.keyboard.press('p');
  fs.mkdirSync('test-output', { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify({ ...anterior, [etapa]: resultado }, null, 2) + '\n');
}
module.exports = { roteiro };
