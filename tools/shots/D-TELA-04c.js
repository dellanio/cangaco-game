'use strict';
const { URL } = require('node:url');
const { writeFileSync } = require('node:fs');
const { retanguloDoCanvas, pontoDoTileNaTela, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const navegar = async (busca) => {
    await page.goto(new URL(`/${busca}`, page.url()).href);
    await page.waitForFunction(() => window.__cangaco?.pronto);
  };
  let s = await estado();
  afirmar(s.unidadesRenderizadas.filter((u) => u.tipo === 'serf').every((u) => !u.frame), 'jogo normal deve preservar sprites atuais');
  await navegar('?vitrine=serf');
  s = await estado();
  afirmar(s.tick === 0 && s.unidadesRenderizadas.length === 0, 'vitrine não inicia partida');
  afirmar(s.pesDosQuadrosDoSerf.length === 144, 'vitrine deve mostrar 8 direções × 18 quadros');
  afirmar(s.pesDosQuadrosDoSerf.every((p) => p.peY === 0), 'pés da vitrine devem assentar na linha');
  await capturar('vitrine');
  await navegar('?pausado&depuracao');
  s = await estado();
  await page.evaluate((camera) => window.__cangaco.fixarCamera(camera), { scrollX: s.camera.scrollX, scrollY: s.camera.scrollY });
  const canvas = await retanguloDoCanvas(page);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [w,h] = predios.find((p) => p.id === 'storehouse').tamanho;
  const y = armazem.gy + h;
  await page.keyboard.press('r'); await page.waitForTimeout(100);
  await arrastarDentroDoCanvas(page, canvas, [
    pontoDoTileNaTela(canvas, { gx: armazem.gx, gy: y }, s.camera, terreno.tile_px),
    pontoDoTileNaTela(canvas, { gx: armazem.gx + w + 1, gy: y }, s.camera, terreno.tile_px),
  ]);
  await page.keyboard.press('Escape');
  const passos = [];
  let id = null;
  for (let n = 0; n < 220; n++) {
    await page.evaluate(() => window.__cangaco.avancar(1));
    await page.waitForFunction((tick) => window.__cangaco.tick > tick, s.tick);
    s = await estado();
    const u = id ? s.unidadesRenderizadas.find((u) => u.id === id)
      : s.unidadesRenderizadas.find((u) => u.tipo === 'serf' && u.animacao === 'andar');
    if (u?.animacao === 'andar') {
      id = u.id;
      afirmar(u.peY === 0, `pé da partida mudou: ${u.peY}`);
      afirmar(u.quadro === Math.floor(u.distanciaAnimada / 2 * 8) % 8, 'andar deve seguir distância');
      passos.push({ tick: s.tick, id, direcao: u.direcao, quadro: u.quadro, distancia: u.distanciaAnimada });
    }
    if (passos.length >= 20 && new Set(passos.map((p) => p.quadro)).size >= 4) break;
  }
  afirmar(passos.length >= 20, 'serf deve andar pelo menos 20 ticks');
  afirmar(new Set(passos.map((p) => p.quadro)).size >= 4, 'quadros devem avançar na partida');
  await capturar('partida-serf-andando');
  await page.keyboard.press('p'); await page.waitForTimeout(150); await page.keyboard.press('p');
  await page.waitForTimeout(100);
  s = await estado();
  afirmar(s.animacoesDeUnidadeTrabalhadas === 0, 'pausa e câmera parada devem dar zero');
  writeFileSync('test-output/D-TELA-04c.json', JSON.stringify({ passos }, null, 2));
}
module.exports = { roteiro };
