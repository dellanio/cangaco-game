'use strict';
// BUG-PLACA-NO-PEITO — o serf com a pedra fora da pose de carregar (parado, esperando para larga-la na rua) nao mostra a
// placa escura no peito: a pedra fica nas maos. O roteiro desenha uma rua longe do armazem e avanca a sim ate um serf
// com carga ficar fora da pose de carregar.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TETO = 600;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const px = terreno.tile_px;
  const esperarFrame = () => page.waitForTimeout(150);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [larg, alt] = predios.find((p) => p.id === 'storehouse').tamanho;
  const inicio = { gx: armazem.gx + Math.floor(larg / 2), gy: armazem.gy + alt + 1 };
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((inicio.gx + 0.5) * px - canvas.width / 2),
    scrollY: Math.round((inicio.gy + 2.5) * px - canvas.height / 2),
  });
  await esperarFrame();
  const { camera } = await estado();
  const naTela = (t) => ({ x: canvas.left + t.gx * px + px / 2 - camera.scrollX, y: canvas.top + t.gy * px + px / 2 - camera.scrollY });
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const a = naTela(inicio);
  const b = naTela({ gx: inicio.gx, gy: inicio.gy + 4 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');

  let achado = null;
  let comCarga = 0;
  for (let n = 0; n < TETO && achado === null; n += 1) {
    await avancar(1);
    await page.waitForTimeout(30);
    const s = await estado();
    for (const u of s.unidadesRenderizadas) {
      if (u.tipo !== 'serf' || u.carga === null) continue;
      comCarga += 1;
      afirmar(u.placaDaCarga !== true, `o serf ${u.id} com ${u.carga} (pose ${u.animacao}) nao deveria ter a placa escura`);
      if (u.animacao !== 'carregando' && u.marcaDaCarga === 'icone') achado = u;
    }
  }
  afirmar(achado !== null, `um serf com a carga fora da pose de carregar deveria aparecer em ${TETO} passos (quadros com carga: ${comCarga})`);
  console.log(`BUG-PLACA-NO-PEITO: serf ${achado.id} com ${achado.carga} na pose ${achado.animacao}, placa ${achado.placaDaCarga}`);
  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((achado.gxDesenhado + 0.5) * px - canvas.width / 2),
    scrollY: Math.round((achado.gyDesenhado + 0.5) * px - canvas.height / 2),
  });
  await page.mouse.move(20, 20);
  await esperarFrame();
  await capturar('serf-parado-com-pedra');
}

module.exports = { roteiro };
