'use strict';
// G-ARTE-TRABALHO-DENTRO-DO-PREDIO: o trabalhador aparece produzindo no espaco da casa. Carrega a
// vila pronta, avanca a sim ate cada predio com quadro de trabalho publicar um quadro da arte nova
// (`window.__cangaco.quadrosDeTrabalho`, com `sprite` verdadeiro: a textura da entrada `trabalho` existe) e captura
// os tres primeiros que trabalharem.
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const { predios: defs } = require('../../data/buildings.json');

const COM_TRABALHO = ['quarry', 'wineyard', 'sawmill', 'mill', 'bakery', 'butchers', 'tannery', 'metallurgists',
  'iron_smithy', 'weapons_workshop', 'armory_workshop', 'weapon_smithy', 'armor_smithy'];
const TETO_TICKS = 6000;
const PASSO = 25;
const CAPTURAS = 3;

async function roteiro({ page, capturar, estado, afirmar }) {
  const envelope = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  await page.evaluate((v) => window.localStorage.setItem('cangaco:partida', v), JSON.stringify(envelope));
  await page.keyboard.press('h'); await page.waitForTimeout(200);
  await page.click('#ajuda [data-acao="carregar"]'); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  afirmar((await estado()).tick === envelope.estado.tick, 'save carregado');
  const canvas = await retanguloDoCanvas(page);
  const s0 = envelope.estado;
  const tipoDe = Object.fromEntries(s0.predios.ordem.map((id) => [id, s0.predios.porId[id].tipo]));
  const vistos = new Set();
  for (let t = 0; t < TETO_TICKS && vistos.size < CAPTURAS; t += PASSO) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    await page.waitForTimeout(120);
    const s = await estado();
    for (const [id, q] of Object.entries(s.quadrosDeTrabalho)) {
      const tipo = tipoDe[id];
      if (!COM_TRABALHO.includes(tipo) || vistos.has(tipo) || q.sprite !== true) continue;
      const p = s0.predios.porId[id];
      const [w, h] = defs.find((d) => d.id === tipo).tamanho;
      await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
        scrollX: Math.round((p.gx + w / 2) * terreno.tile_px - canvas.width / 2),
        scrollY: Math.round((p.gy + h / 2 - 1) * terreno.tile_px - canvas.height / 2),
      });
      await page.waitForTimeout(250);
      await capturar(`${tipo}-${q.laco}_${q.n}`);
      vistos.add(tipo);
    }
  }
  afirmar(vistos.size >= 1, `nenhum predio publicou quadro da arte nova em ${TETO_TICKS} ticks`);
}
module.exports = { roteiro };
