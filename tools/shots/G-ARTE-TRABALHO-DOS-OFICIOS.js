'use strict';
// G-ARTE-TRABALHO-DOS-OFICIOS: o lenhador colhe com o quadro `trabalhar` do atlas real de pixel art,
// no jogo normal (sem ?depuracao). O save e o do D-TELA-05c (gerado pelo `npm run test`).
const { readFileSync, existsSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const atlas = require('../../assets/sprites/units/woodcutter/woodcutter.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const save = 'test-output/D-TELA-05c-lenhador.save.txt';
  afirmar(existsSync(save), `${save} nao existe: rode \`npm run test\` antes`);
  const quadrosReais = new Set(Object.keys(atlas.frames));
  await page.evaluate((texto) => window.localStorage.setItem('cangaco:partida', texto), readFileSync(save, 'utf8'));
  await page.keyboard.press('h'); await page.click('#ajuda [data-acao="carregar"]'); await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  let s = await estado();
  const inicio = s.unidadesRenderizadas.find((u) => u.id === 'lenhador-1');
  afirmar(inicio, 'save do lenhador carregado');
  const c = await retanguloDoCanvas(page);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), { scrollX: inicio.gx * 64 - c.width / 2, scrollY: inicio.gy * 64 - c.height / 2 });
  await page.waitForTimeout(100);
  const quadros = new Set();
  for (let n = 0; n < 400 && quadros.size < 3; n++) {
    await page.evaluate(() => window.__cangaco.avancar(1));
    await page.waitForFunction((tick) => window.__cangaco.tick > tick, s.tick);
    s = await estado();
    const u = s.unidadesRenderizadas.find((x) => x.id === 'lenhador-1');
    if (u?.animacao === 'trabalhar') {
      afirmar(u.frame?.startsWith('woodcutter/trabalhar/') && quadrosReais.has(u.frame), `quadro fora do atlas real: ${u.frame}`);
      afirmar(u.peY === 0, `o pe saiu da linha: ${u.peY}`);
      quadros.add(u.frame);
    }
  }
  afirmar(quadros.size >= 3, `o lenhador deve trabalhar passando por quadros do atlas (viu ${quadros.size})`);
  const fim = s.unidadesRenderizadas.find((x) => x.id === 'lenhador-1');
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), { scrollX: fim.gx * 64 - c.width / 2, scrollY: fim.gy * 64 - c.height / 2 });
  await page.waitForTimeout(150);
  await capturar('lenhador-cortando');
  // Passo despausado (CLAUDE.md §8).
  await page.keyboard.press('p'); await page.waitForTimeout(600); await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await capturar('depois-de-despausar');
  writeFileSync('test-output/G-ARTE-TRABALHO-DOS-OFICIOS.json', JSON.stringify({ quadros: [...quadros] }, null, 2));
}
module.exports = { roteiro };
