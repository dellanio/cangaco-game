'use strict';
const { carregarGaveta } = require('./_partida');
// I-ARTE-UNIDADES-PIXELLAB-V2 (aceite 3) — obreiro, lenhador, cabra e lavrador novos, lado a lado na vila pronta do
// operador: cada um usa o atlas novo e o parado respira (passa por mais de um quadro com o jogo despausado).
const { readFileSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TIPOS = ['laborer', 'woodcutter', 'militia', 'farmer'];

async function roteiro({ page, capturar, estado, afirmar }) {
  const salvo = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  const unidades = salvo.estado.unidades;
  // o obreiro ocioso da vila e o modelo; os outros tres sao copias dele com outro tipo, ao lado
  const modelo = unidades.porId['u7'];
  TIPOS.slice(1).forEach((tipo, i) => {
    const id = `v2-${tipo}`;
    unidades.porId[id] = { ...modelo, id, tipo, gx: modelo.gx + i + 1 };
    unidades.ordem.push(id);
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
    scrollX: Math.round((modelo.gx + 2) * terreno.tile_px - canvas.width / 2),
    scrollY: Math.round((modelo.gy + 0.5) * terreno.tile_px - canvas.height / 2),
  });
  const ids = ['u7', ...TIPOS.slice(1).map((t) => `v2-${t}`)];
  await page.waitForFunction((lista) => lista.every((id) => window.__cangaco.unidadesRenderizadas.find((u) => u.id === id)?.frame), ids);
  // passo despausado (CLAUDE.md §8): o parado respira enquanto o relogio anda
  const vistos = Object.fromEntries(ids.map((id) => [id, new Set()]));
  await page.keyboard.press('p');
  for (let n = 0; n < 12; n++) {
    for (const u of (await estado()).unidadesRenderizadas) if (vistos[u.id] && u.animacao === 'parado') vistos[u.id].add(u.frame);
    await page.waitForTimeout(120);
  }
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  const resultado = {};
  ids.forEach((id, i) => {
    const tipo = TIPOS[i];
    const atlas = JSON.parse(readFileSync(`assets/sprites/units/${tipo}/${tipo}.json`, 'utf8'));
    const quadros = [...vistos[id]];
    afirmar(quadros.length > 0 && quadros.every((f) => f.startsWith(`${tipo}/parado/`) && f in atlas.frames), `${tipo} parado no atlas novo: ${quadros}`);
    afirmar(quadros.length >= 2, `${tipo} respira (mais de um quadro do parado): ${quadros}`);
    resultado[tipo] = quadros;
  });
  await capturar('quatro-unidades');
  writeFileSync('test-output/I-ARTE-UNIDADES-PIXELLAB-V2.json', JSON.stringify(resultado, null, 2));
}

module.exports = { roteiro };
