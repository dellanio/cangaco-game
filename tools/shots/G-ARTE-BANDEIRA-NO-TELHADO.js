'use strict';
// G-ARTE-BANDEIRA-NO-TELHADO: as casas dos prints do operador com a bandeira presa na cumeeira. O save
// da vila pronta tem lenhador, serraria, pedreira, fazenda e canavial do jogador (a casa do pescador
// nao esta nele; ela fica coberta pelo teste do ponto no sprite).
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const { predios: defs } = require('../../data/buildings.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const envelope = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  await page.evaluate((v) => window.localStorage.setItem('cangaco:partida', v), JSON.stringify(envelope));
  await page.keyboard.press('h'); await page.waitForTimeout(200);
  await page.click('#ajuda [data-acao="carregar"]'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  afirmar((await estado()).tick === envelope.estado.tick, 'save carregado');
  const canvas = await retanguloDoCanvas(page);
  const s = envelope.estado;
  for (const tipo of ['woodcutters', 'sawmill', 'quarry', 'farm', 'wineyard']) {
    const p = s.predios.ordem.map((id) => s.predios.porId[id]).find((x) => x.tipo === tipo && x.lado === 0);
    afirmar(p, `o save precisa de ${tipo} do jogador`);
    const [w, h] = defs.find((d) => d.id === tipo).tamanho;
    await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
      scrollX: Math.round((p.gx + w / 2) * terreno.tile_px - canvas.width / 2),
      scrollY: Math.round((p.gy + h / 2 - 1) * terreno.tile_px - canvas.height / 2),
    });
    await page.waitForTimeout(250);
    await capturar(tipo);
  }
}
module.exports = { roteiro };
