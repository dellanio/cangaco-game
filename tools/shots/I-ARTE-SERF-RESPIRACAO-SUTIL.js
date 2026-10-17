'use strict';
const { carregarGaveta } = require('./_partida');
// I-ARTE-SERF-RESPIRACAO-SUTIL (aceite 3) — tres serfs parados lado a lado na vila pronta do operador, no zoom 2: o parado
// respira de leve (passa por mais de um quadro com o jogo despausado). Duas capturas, uma no meio do folego.
const { readFileSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const salvo = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  const unidades = salvo.estado.unidades;
  // o obreiro ocioso da vila e o modelo; os tres serfs sao copias dele, ao lado
  const modelo = unidades.porId['u7'];
  const ids = [0, 1, 2].map((i) => {
    const id = `resp-serf-${i}`;
    unidades.porId[id] = { ...modelo, id, tipo: 'serf', gx: modelo.gx + 1 + i };
    unidades.ordem.push(id);
    return id;
  });
  await page.evaluate((s) => window.localStorage.setItem('cangaco:partida', s), JSON.stringify(salvo));
  await carregarGaveta(page);
  await page.keyboard.press('Escape');
  const canvas = await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let n = 0; n < 10 && (await estado()).camera.zoom !== 2; n++) {
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(200);
  }
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((modelo.gx + 2.5) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((modelo.gy + 0.5) * terreno.tile_px - canvas.height / 2),
  });
  await page.waitForFunction((lista) => lista.every((id) => window.__cangaco.unidadesRenderizadas.find((u) => u.id === id)?.frame), ids);
  // passo despausado (CLAUDE.md §8): a 1,5 fps um quadro dura ~0,67 s; 4 s cobrem mais de um folego
  const vistos = Object.fromEntries(ids.map((id) => [id, new Set()]));
  let capturouNoFolego = false;
  await page.keyboard.press('p');
  for (let n = 0; n < 20; n++) {
    const renderizadas = (await estado()).unidadesRenderizadas.filter((u) => vistos[u.id]);
    for (const u of renderizadas) if (u.animacao === 'parado') vistos[u.id].add(u.frame);
    if (!capturouNoFolego && renderizadas.some((u) => /\/000[12]$/.test(u.frame))) {
      await capturar('folego');
      capturouNoFolego = true;
    }
    await page.waitForTimeout(200);
  }
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const resultado = {};
  for (const id of ids) {
    const atlas = JSON.parse(readFileSync('assets/sprites/units/serf/serf.json', 'utf8'));
    const quadros = [...vistos[id]].sort();
    afirmar(quadros.length > 0 && quadros.every((f) => f.startsWith('serf/parado/') && f in atlas.frames), `${id} parado no atlas: ${quadros}`);
    afirmar(quadros.length >= 2, `${id} respira (mais de um quadro do parado): ${quadros}`);
    resultado[id] = quadros;
  }
  afirmar(capturouNoFolego, 'capturou um serf no meio do folego');
  await capturar('tres-serfs');
  writeFileSync('test-output/I-ARTE-SERF-RESPIRACAO-SUTIL.json', JSON.stringify(resultado, null, 2));
}

module.exports = { roteiro };
