'use strict';
const { carregarGaveta } = require('./_partida');
// I-TELA-LENHADOR-CORTA-E-DERRUBA (aceite 2) — na vila pronta do operador, o lenhador sai para cortar: e desenhado a
// menos de meio tile do pe da arvore, as lascas saltam nos golpes, a arvore cai no fim do primeiro corte e fica deitada,
// e ele volta para a cabana com a tora nas maos.
const { readFileSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const salvo = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  // a arvore que o lenhador corta primeiro nesta vila e a do tile 39,22 (o cursor dele); as arvores logo ao sul dela, que
  // a tapariam na foto, saem da copia do save (so a foto muda: o lenhador corta a mesma arvore)
  for (const chave of Object.keys(salvo.estado.recursos)) {
    const [gx, gy] = chave.split(',').map(Number);
    if (salvo.estado.recursos[chave].tipo === 'tree' && Math.abs(gx - 39) <= 2 && gy >= 23 && gy <= 25) delete salvo.estado.recursos[chave];
  }
  const texto = JSON.stringify(salvo);
  await page.evaluate((t) => window.localStorage.setItem('cangaco:partida', t), texto);
  await carregarGaveta(page); await page.keyboard.press('Escape');
  const canvas = await retanguloDoCanvas(page);
  const lado = terreno.tile_px;
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let n = 0; n < 10 && (await estado()).camera.zoom !== 2; n++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(200); }
  const avancar = async (k) => { const t = (await estado()).tick; await page.evaluate((x) => window.__cangaco.avancar(x), k); await page.waitForFunction((x) => window.__cangaco.tick > x, t); await page.waitForTimeout(40); };
  const centrar = async (gx, gy) => { await page.evaluate((c) => window.__cangaco.fixarCamera(c), { scrollX: Math.round((gx + 0.5) * lado - canvas.width / 2), scrollY: Math.round((gy + 0.5) * lado - canvas.height / 2) }); };
  const lenhador = (s) => s.unidadesRenderizadas.find((u) => u.id === 'woodcutter-1');

  let arvore = null; let menor = Infinity; let lascas = 0; let fotos = 0; let caida = null; let comTora = false;
  for (let n = 0; n < 4000; n++) {
    await avancar(1);
    const s = await estado();
    const u = lenhador(s);
    if (!u) continue;
    if (u.arvoreCortada && u.fsm === 'colhendo') {
      if (arvore === null) { arvore = u.arvoreCortada; await centrar(arvore.gx, arvore.gy); }
      const x = u.gxDesenhado + 0.5 + (u.noLote ? u.noLote.x / lado : 0); const y = u.gyDesenhado + 0.5 + (u.noLote ? u.noLote.y / lado : 0);
      if (u.noLote && !u.noLote.andando) menor = Math.min(menor, Math.hypot(x - (arvore.gx + 0.5), y - (arvore.gy + 1)));
      if ((u.lascas ?? 0) > lascas && fotos === 0) { await page.waitForTimeout(120); await capturar('cortando-com-lascas'); fotos++; }
      lascas = Math.max(lascas, u.lascas ?? 0);
    }
    if (arvore !== null && caida === null && s.arvoresNaTela[`${arvore.gx},${arvore.gy}`]) {
      caida = s.arvoresNaTela[`${arvore.gx},${arvore.gy}`];
      await page.waitForTimeout(900);
      await capturar('arvore-caida');
    }
    if (caida !== null && u.fsm === 'voltando' && u.carga === 'tree_trunk') {
      comTora = true;
      await page.evaluate((c) => window.__cangaco.fixarCamera(c), { scrollX: Math.round((u.gxDesenhado + 0.5) * lado - canvas.width / 2), scrollY: Math.round((u.gyDesenhado + 0.5) * lado - canvas.height / 2) });
      await page.waitForTimeout(200);
      await capturar('levando-a-tora');
      break;
    }
  }
  afirmar(arvore !== null, 'o lenhador saiu para cortar uma arvore');
  afirmar(menor < 0.5, `o lenhador desenhado a menos de meio tile do tronco: ${menor}`);
  afirmar(lascas > 0, `as lascas saltaram nos golpes: ${lascas}`);
  afirmar(caida === 'caida-3', `a arvore caiu e ficou deitada com 3 troncos: ${caida}`);
  afirmar(comTora, 'o lenhador volta com a tora nas maos');
  const s = await estado();
  afirmar(s.quedasDeArvore >= 1, `a queda da arvore: ${s.quedasDeArvore}`);
  // passo despausado (CLAUDE.md §8)
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p'); await page.waitForTimeout(150);
  writeFileSync('test-output/I-TELA-LENHADOR-CORTA-E-DERRUBA.json', JSON.stringify({ arvore, distanciaAoTronco: menor, lascas, caida, comTora, quedas: s.quedasDeArvore }, null, 2));
}

module.exports = { roteiro };
