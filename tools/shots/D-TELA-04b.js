'use strict';
const { URL } = require('node:url');

async function roteiro({ page, estado, afirmar, capturar }) {
  await page.goto(new URL('/?pausado&depuracao', page.url()).href);
  await page.waitForFunction(() => window.__cangaco?.pronto);
  await page.evaluate(() => window.__cangaco.fixarCamera({ scrollX: window.__cangaco.camera.scrollX, scrollY: window.__cangaco.camera.scrollY }));
  await page.waitForTimeout(100);
  let s = await estado();
  afirmar(s.pesDosQuadrosDoSerf.length === 144, 'todos os 18 quadros × 8 direções devem resolver');
  for (const p of s.pesDosQuadrosDoSerf) {
    afirmar(p.peY === 0, `pé mudou em ${p.frame}, direção ${p.direcao}: ${p.peY}`);
    afirmar(p.espelhado === ['so', 'o', 'no'].includes(p.direcao), `espelho errado em ${p.direcao}`);
  }
  const antes = s.unidadesRenderizadas.filter((u) => u.tipo === 'serf' && u.frame);
  afirmar(antes.length > 0, 'serf da partida deve carregar atlas');
  await page.waitForTimeout(150);
  s = await estado();
  afirmar(s.animacoesDeUnidadeTrabalhadas === 0, 'pausado e câmera parada: nenhum trabalho de animação');
  afirmar(antes.every((u) => s.unidadesRenderizadas.find((v) => v.id === u.id)?.frame === u.frame), 'pausa congela quadros');
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.waitForTimeout(100);
  s = await estado();
  afirmar(antes.some((u) => s.unidadesRenderizadas.find((v) => v.id === u.id)?.frame !== u.frame), 'tick deve avançar parado');
  await page.keyboard.press('p'); await page.waitForTimeout(150); await page.keyboard.press('p');
  await page.waitForTimeout(100);
  await capturar('serf-atlas-pe-constante');
}
module.exports = { roteiro };
