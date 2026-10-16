'use strict';
// I-ARTE-RUA-DE-PEDRA-ANTIGA (aceite 3) — uma rua pronta com reta, curva e cruzamento, de pe no jogo, com o calcamento
// antigo. O roteiro desenha duas ruas que se cruzam e uma que dobra, pela ferramenta, e espera o canteiro esvaziar.
const { retanguloDoCanvas } = require('./_canvas');
const { erguerRua } = require('./_estradas');
const terreno = require('../../data/terrain.json');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TETO_DE_TICKS = 4000;

async function roteiro(ctx) {
  const { page, capturar, estado } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const px = terreno.tile_px;
  const esperarFrame = () => page.waitForTimeout(200);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [larg, alt] = predios.find((p) => p.id === 'storehouse').tamanho;
  // abaixo da porta do armazem: um cruzamento (+) e, ao lado, uma curva (L)
  const meio = { gx: armazem.gx + Math.floor(larg / 2), gy: armazem.gy + alt + 2 };
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((meio.gx + 1.5) * px - canvas.width / 2),
    scrollY: Math.round((meio.gy + 1.5) * px - canvas.height / 2),
  });
  await esperarFrame();
  const { camera } = await estado();
  const naTela = (t) => ({ x: canvas.left + t.gx * px + px / 2 - camera.scrollX, y: canvas.top + t.gy * px + px / 2 - camera.scrollY });
  const arrastar = async (de, ate) => {
    const a = naTela(de);
    const b = naTela(ate);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.evaluate(() => window.__cangaco.avancar(1));
    await esperarFrame();
  };
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await arrastar({ gx: meio.gx - 2, gy: meio.gy }, { gx: meio.gx + 2, gy: meio.gy });
  await arrastar({ gx: meio.gx, gy: meio.gy - 1 }, { gx: meio.gx, gy: meio.gy + 2 });
  await arrastar({ gx: meio.gx + 2, gy: meio.gy + 1 }, { gx: meio.gx + 2, gy: meio.gy + 3 });
  await arrastar({ gx: meio.gx + 3, gy: meio.gy + 3 }, { gx: meio.gx + 4, gy: meio.gy + 3 });
  await page.keyboard.press('Escape');
  const { ticks, dePe } = await erguerRua(ctx, { teto: TETO_DE_TICKS });
  console.log(`I-ARTE-RUA-DE-PEDRA-ANTIGA: ${dePe} tiles de pe em ${ticks} ticks`);
  await page.mouse.move(20, 20);
  await esperarFrame();
  await capturar('rua-pronta');
}

module.exports = { roteiro };
