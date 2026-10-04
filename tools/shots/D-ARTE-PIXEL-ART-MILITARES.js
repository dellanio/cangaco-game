'use strict';
// D-ARTE-PIXEL-ART-MILITARES: o obreiro novo trabalha (nivela e martela a estrada) com o quadro
// `trabalhar` do atlas de pixel art, no jogo normal (sem ?depuracao).
const { writeFileSync } = require('node:fs');
const { retanguloDoCanvas, pontoDoTileNaTela, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');
const atlas = require('../../assets/sprites/units/laborer/laborer.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const quadrosReais = new Set(Object.keys(atlas.frames));
  let s = await estado();
  afirmar(s.unidadesRenderizadas.some((u) => u.tipo === 'laborer' && quadrosReais.has(u.frame)),
    'o obreiro da partida deve usar o atlas novo');
  // A mesma estrada do D-ARTE-SERF-COMFYUI: o obreiro vai nivelar e martelar.
  const canvas = await retanguloDoCanvas(page);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [w, h] = predios.find((p) => p.id === 'storehouse').tamanho;
  const y = armazem.gy + h;
  await page.keyboard.press('r'); await page.waitForTimeout(100);
  await arrastarDentroDoCanvas(page, canvas, [
    pontoDoTileNaTela(canvas, { gx: armazem.gx, gy: y }, s.camera, terreno.tile_px),
    pontoDoTileNaTela(canvas, { gx: armazem.gx + w + 1, gy: y }, s.camera, terreno.tile_px),
  ]);
  await page.keyboard.press('Escape');
  let obreiro = null;
  const quadros = new Set();
  for (let n = 0; n < 900 && quadros.size < 3; n++) {
    await page.evaluate(() => window.__cangaco.avancar(1));
    await page.waitForFunction((tick) => window.__cangaco.tick > tick, s.tick);
    s = await estado();
    const u = s.unidadesRenderizadas.find((x) => x.tipo === 'laborer' && x.animacao === 'assentar'
      && (obreiro === null || x.id === obreiro));
    if (u) {
      // G-TELA-OBREIRO-POR-TAREFA: na estrada, o gesto e assentar a pedra, e nao o martelo
      afirmar(u.frame.startsWith('laborer/assentar/') && quadrosReais.has(u.frame), `quadro fora do atlas: ${u.frame}`);
      afirmar(u.peY === 0, `o pe saiu da linha: ${u.peY}`);
      obreiro = u.id;
      quadros.add(u.frame);
      if (quadros.size === 1) {
        await page.evaluate((cam) => window.__cangaco.fixarCamera(cam),
          { scrollX: u.gx * terreno.tile_px - canvas.width / 2, scrollY: u.gy * terreno.tile_px - canvas.height / 2 });
        await page.waitForTimeout(100);
      }
    }
  }
  afirmar(quadros.size >= 3, `o obreiro deve trabalhar passando por quadros do atlas (viu ${quadros.size})`);
  await capturar('obreiro-trabalhando');
  // Passo despausado (CLAUDE.md §8).
  await page.keyboard.press('p'); await page.waitForTimeout(600); await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await capturar('depois-de-despausar');
  writeFileSync('test-output/D-ARTE-PIXEL-ART-MILITARES.json', JSON.stringify({ obreiro, quadros: [...quadros] }, null, 2));
}
module.exports = { roteiro };
