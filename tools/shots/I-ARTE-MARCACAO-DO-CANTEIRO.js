'use strict';
// I-ARTE-MARCACAO-DO-CANTEIRO — o lote em marcacao desenhado com as pecas do Codex (estacas, cordel, terra raspada),
// no lugar do retangulo branco. Planta pela tela, no jogo livre, um lenhador (3x2) e uma Bodega (4x3) abaixo da vila,
// sem material nenhum entregue: os dois ficam em `marcacao`.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const economia = require('../../data/economy.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const px = terreno.tile_px;
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  // abaixo das rocas de milho e cana do sertao-128 (linhas 35 e 36), em grama limpa
  const lotes = [['woodcutters', armazem.gx, armazem.gy + 9], ['inn', armazem.gx + 6, armazem.gy + 9]];

  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((armazem.gx + 5) * px - canvas.width / 2),
    scrollY: Math.round((armazem.gy + 10) * px - canvas.height / 2),
  });
  await esperarFrame();
  for (const [id, gx, gy] of lotes) {
    const { camera } = await estado();
    await page.click(`[data-predio="${id}"]`);
    await esperarFrame();
    const x = canvas.left + gx * px + px / 2 - camera.scrollX;
    const y = canvas.top + gy * px + px / 2 - camera.scrollY;
    await page.mouse.move(x, y);
    await esperarFrame();
    await page.mouse.click(x, y);
    await avancar(1);
    await esperarFrame();
    await page.keyboard.press('Escape');
  }
  const s = await estado();
  afirmar(s.canteiroComArte === true, 'as quatro pecas do canteiro carregadas');
  afirmar((s.estagiosDeObraRenderizados.marcacao ?? 0) === 2, `os dois lotes em marcacao: ${JSON.stringify(s.estagiosDeObraRenderizados)}`);
  await capturar('lotes-em-marcacao');
}

module.exports = { roteiro };
