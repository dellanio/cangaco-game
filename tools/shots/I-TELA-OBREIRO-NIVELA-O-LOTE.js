'use strict';
// I-TELA-OBREIRO-NIVELA-O-LOTE (aceite 2) — uma obra nova de lenhador (3x2) plantada pela tela, abaixo da vila do jogo
// livre (o mesmo lote do I-ARTE-MARCACAO-DO-CANTEIRO): o obreiro que nivela e desenhado DENTRO do lote, passa por pelo
// menos 2 tiles com a enxada (`arar`) e anda entre eles; a terra raspada cobre menos tiles no comeco que no fim.
const { writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const economia = require('../../data/economy.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const px = terreno.tile_px;
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = async (n) => { const t = (await estado()).tick; await page.evaluate((k) => window.__cangaco.avancar(k), n); await page.waitForFunction((x) => window.__cangaco.tick > x, t); await page.waitForTimeout(60); };
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [gx, gy] = [armazem.gx, armazem.gy + 9];
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((gx + 1.5) * px - canvas.width / 2), scrollY: Math.round((gy + 1) * px - canvas.height / 2),
  });
  await esperarFrame();
  const { camera } = await estado();
  await page.click('[data-predio="woodcutters"]');
  await esperarFrame();
  const x = canvas.left + gx * px + px / 2 - camera.scrollX; const y = canvas.top + gy * px + px / 2 - camera.scrollY;
  await page.mouse.move(x, y); await esperarFrame(); await page.mouse.click(x, y);
  await avancar(1); await esperarFrame(); await page.keyboard.press('Escape');
  const obraId = Object.entries((await estado()).canteirosDeObra).find(([, c]) => c.tilesProntos === 0)?.[0];
  afirmar(obraId !== undefined, 'a obra nova tem canteiro');

  const dentro = (u) => u.noLote && u.noLote.tile && u.noLote.tile.gx >= gx && u.noLote.tile.gx < gx + 3 && u.noLote.tile.gy >= gy && u.noLote.tile.gy < gy + 2;
  const tiles = new Set(); const gestos = new Set(); let andou = false; let prontosNoComeco = null; let capturas = 0; let tickDaPrimeira = -1; const fotos = [];
  for (let n = 0; n < 1500; n++) {
    await avancar(1);
    const s = await estado();
    const c = s.canteirosDeObra[obraId];
    if (!c) break;
    const obreiro = s.unidadesRenderizadas.find((u) => u.tipo === 'laborer' && u.fsm === 'nivelando');
    if (obreiro) {
      afirmar(dentro(obreiro), `o obreiro que nivela e desenhado no lote: ${JSON.stringify(obreiro.noLote)}`);
      if (prontosNoComeco === null) prontosNoComeco = c.tilesProntos;
      tiles.add(`${obreiro.noLote.tile.gx},${obreiro.noLote.tile.gy}`);
      if (obreiro.animacao) gestos.add(obreiro.animacao);
      if (obreiro.noLote.andando) andou = true;
      if (capturas === 0 && !obreiro.noLote.andando && obreiro.animacao === 'arar') { await capturar('nivelando-no-lote'); capturas++; tickDaPrimeira = s.tick; fotos.push({ tick: s.tick, prontos: c.tilesProntos }); }
      else if (capturas === 1 && s.tick > tickDaPrimeira && c.tilesProntos >= c.tilesTotais - 2 && c.tilesProntos > fotos[0].prontos) { await capturar('lote-quase-nivelado'); capturas++; fotos.push({ tick: s.tick, prontos: c.tilesProntos }); }
    }
    if (c.nivelada) break;
  }
  const fim = (await estado()).canteirosDeObra[obraId];
  afirmar(tiles.size >= 2, `o obreiro passa por pelo menos 2 tiles do lote: ${[...tiles]}`);
  afirmar(gestos.has('arar'), `o gesto de nivelar e a enxada: ${[...gestos]}`);
  afirmar(andou, 'o obreiro anda entre os tiles');
  afirmar(capturas === 2, `as duas fotos, em ticks diferentes: ${JSON.stringify(fotos)}`);
  afirmar(prontosNoComeco !== null && fim && fim.tilesProntos > prontosNoComeco, `a terra raspada cresce: ${prontosNoComeco} -> ${fim?.tilesProntos}`);
  // passo despausado (CLAUDE.md §8)
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p'); await page.waitForTimeout(150);
  writeFileSync('test-output/I-TELA-OBREIRO-NIVELA-O-LOTE.json', JSON.stringify({ tiles: [...tiles], gestos: [...gestos], andou, prontosNoComeco, prontosNoFim: fim?.tilesProntos, fotos }, null, 2));
}

module.exports = { roteiro };
