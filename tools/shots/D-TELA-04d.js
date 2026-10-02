'use strict';
const { URL } = require('node:url');
async function roteiro({ page, estado, afirmar, capturar }) {
  await page.goto(new URL('/?vitrine=serf', page.url()).href);
  await page.waitForFunction(() => window.__cangaco?.pronto);
  await page.evaluate(() => window.__cangaco.fixarCamera({ scrollX: 0, scrollY: 0 }));
  const passos = [[0, 'ne'], [0.7, 'l'], [1.4, 'se'], [2.1, 's']];
  const quadros = [];
  for (const [ticks, direcao] of passos) {
    await page.evaluate((t) => window.__cangaco.mostrarViradaDoSerf(t), ticks);
    await page.waitForTimeout(40);
    const s = await estado();
    afirmar(s.viradaDoSerf?.direcao === direcao, `${ticks} ticks deve mostrar ${direcao}`);
    afirmar(s.viradaDoSerf.peY === 0, 'virada mantém pé na linha');
    quadros.push(s.viradaDoSerf.quadro);
    if (ticks === 1.4) await capturar('virada-180-intermediaria-se');
  }
  afirmar(new Set(quadros.slice(0, 3)).size > 1, 'walk deve avançar durante a virada');
}
module.exports = { roteiro };
