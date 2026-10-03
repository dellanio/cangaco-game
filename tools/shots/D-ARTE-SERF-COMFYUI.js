'use strict';
// D-ARTE-SERF-COMFYUI: o serf gerado no ComfyUI local anda pelo atlas real, no jogo normal (sem ?depuracao).
const { writeFileSync } = require('node:fs');
const { retanguloDoCanvas, pontoDoTileNaTela, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');
const atlas = require('../../assets/sprites/units/serf/serf.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const quadrosReais = new Set(Object.keys(atlas.frames));
  let s = await estado();
  const parados = s.unidadesRenderizadas.filter((u) => u.tipo === 'serf');
  afirmar(parados.length > 0, 'a partida deve abrir com serfs');
  afirmar(parados.every((u) => u.frame && quadrosReais.has(u.frame)), 'todo serf parado deve usar um quadro do atlas real');
  await page.evaluate((camera) => window.__cangaco.fixarCamera(camera), { scrollX: s.camera.scrollX, scrollY: s.camera.scrollY });
  await capturar('serfs-parados');

  // Uma estrada a partir do armazem poe os serfs para andar (o mesmo gesto do D-TELA-04c).
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

  const passos = [];
  let id = null;
  let capturouAndando = false;
  let carregou = false;
  for (let n = 0; n < 260; n++) {
    await page.evaluate(() => window.__cangaco.avancar(1));
    await page.waitForFunction((tick) => window.__cangaco.tick > tick, s.tick);
    s = await estado();
    afirmar(s.unidadesRenderizadas.filter((u) => u.tipo === 'serf').every((u) => !u.frame || quadrosReais.has(u.frame)),
      'nenhum serf pode usar quadro fora do atlas real');
    const u = id ? s.unidadesRenderizadas.find((x) => x.id === id)
      : s.unidadesRenderizadas.find((x) => x.tipo === 'serf' && (x.animacao === 'andar' || x.animacao === 'carregando'));
    if (u?.animacao === 'andar' || u?.animacao === 'carregando') {
      if (u.animacao === 'carregando') carregou = true;
      id = u.id;
      // D-TELA-SERF-CARREGANDO: com carga, a animacao e a de carregar; sem carga, o andar.
      afirmar(u.frame.startsWith(u.carga ? 'serf/carregando/' : 'serf/andar/'), `quadro inesperado (carga ${u.carga}): ${u.frame}`);
      afirmar(u.peY === 0, `o pe saiu da linha: ${u.peY}`);
      passos.push({ tick: s.tick, id, direcao: u.direcao, quadro: u.quadro, frame: u.frame });
      if (!capturouAndando && passos.length === 6) { await capturar('serf-andando-1'); capturouAndando = true; }
    }
    if (passos.length >= 24 && new Set(passos.map((p) => p.quadro)).size >= 5) break;
  }
  afirmar(passos.length >= 24, 'um serf deve andar pelo menos 24 ticks');
  afirmar(new Set(passos.map((p) => p.quadro)).size >= 5, 'os quadros do andar devem avancar');
  // Se o serf acompanhado nao carregou nada, procura qualquer serf com carga no ultimo estado.
  if (!carregou) {
    for (let n = 0; n < 200 && !carregou; n++) {
      await page.evaluate(() => window.__cangaco.avancar(1));
      await page.waitForFunction((tick) => window.__cangaco.tick > tick, s.tick);
      s = await estado();
      carregou = s.unidadesRenderizadas.some((x) => x.tipo === 'serf' && x.carga && x.animacao === 'carregando'
        && x.frame.startsWith('serf/carregando/'));
    }
  }
  afirmar(carregou, 'um serf com carga deve andar com a animacao de carregar');
  await capturar('serf-carregando');
  await capturar('serf-andando-2');
  // Passo despausado (CLAUDE.md §8): o laco roda de verdade e o serf continua no atlas real.
  await page.keyboard.press('p'); await page.waitForTimeout(600); await page.keyboard.press('p');
  await page.waitForTimeout(150);
  s = await estado();
  afirmar(s.unidadesRenderizadas.filter((x) => x.tipo === 'serf').every((x) => !x.frame || quadrosReais.has(x.frame)),
    'depois do passo despausado, os serfs continuam no atlas real');
  await capturar('serf-depois-de-despausar');
  writeFileSync('test-output/D-ARTE-SERF-COMFYUI.json', JSON.stringify({ passos }, null, 2));
}
module.exports = { roteiro };
