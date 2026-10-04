'use strict';
// G-ARTE-MORTE-DAS-UNIDADES: o cabra que morre de fome cai com o atlas real de pixel art (sem ?depuracao),
// passa pela queda e pelo esmaecer e some no fim. O save e o do D-TELA-05c (gerado pelo `npm run test`).
const { readFileSync, existsSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const atlas = require('../../assets/sprites/units/militia/militia.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const save = 'test-output/D-TELA-05c-morte.save.txt';
  afirmar(existsSync(save), `${save} nao existe: rode \`npm run test\` antes`);
  const quadrosReais = new Set(Object.keys(atlas.frames));
  await page.evaluate((texto) => window.localStorage.setItem('cangaco:partida', texto), readFileSync(save, 'utf8'));
  await page.keyboard.press('h'); await page.click('#ajuda [data-acao="carregar"]'); await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  let s = await estado();
  const vivo = s.unidadesRenderizadas.find((u) => u.id === 'faminto');
  afirmar(vivo, 'save da fome carregado');
  const c = await retanguloDoCanvas(page);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), { scrollX: vivo.gx * 64 - c.width / 2, scrollY: vivo.gy * 64 - c.height / 2 });
  // o atlas da unidade carrega sob demanda depois do save (carga tardia)
  await page.waitForFunction(() => window.__cangaco.unidadesRenderizadas.find((u) => u.id === 'faminto')?.frame);
  const comQuadro = (await estado()).unidadesRenderizadas.find((u) => u.id === 'faminto');
  afirmar(quadrosReais.has(comQuadro.frame), `o cabra vivo usa o atlas real: ${comQuadro.frame}`);
  const avancar = async (n) => { const t = (await estado()).tick; await page.evaluate((p) => window.__cangaco.avancar(p), n); await page.waitForFunction((x) => window.__cangaco.tick > x, t); await page.waitForTimeout(50); };
  await avancar(1);
  s = await estado();
  afirmar(!s.unidadesRenderizadas.some((u) => u.id === 'faminto'), 'a morte logica tirou o cabra da lista viva');
  const corpo0 = s.mortesRenderizadas[0];
  afirmar(corpo0?.quadro === 0 && corpo0.frame?.startsWith('militia/morrer/') && quadrosReais.has(corpo0.frame), `o corpo comeca no quadro 0 do atlas real: ${JSON.stringify(corpo0)}`);
  await capturar('cabra-caindo');
  const quadros = [corpo0.frame];
  await avancar(6);
  s = await estado();
  const meio = s.mortesRenderizadas[0];
  afirmar(meio && meio.quadro > 0 && meio.quadro < 11 && quadrosReais.has(meio.frame), `um quadro do meio da queda: ${JSON.stringify(meio)}`);
  quadros.push(meio.frame);
  await capturar('cabra-no-chao');
  await avancar(10);
  s = await estado();
  afirmar(s.mortesRenderizadas.length === 0 && s.corposNaMemoria === 0, 'o corpo some no fim da sequencia');
  writeFileSync('test-output/G-ARTE-MORTE-DAS-UNIDADES.json', JSON.stringify({ quadros }, null, 2));
}
module.exports = { roteiro };
