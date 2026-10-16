'use strict';
// I-TELA-RUA-SENDO-ASSENTADA (aceite 3) — um tile de rua sendo calcado: o roteiro desenha a rua pela ferramenta,
// avanca a sim pela ponte e le, a cada passo, o estagio que a camada da rua desenhou no tile, ate ele virar rua. Uma
// captura por estagio. Depois roda despausado um instante (CLAUDE.md §8), para o laco real redesenhar.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TETO = 400;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const px = terreno.tile_px;
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [larg, alt] = predios.find((p) => p.id === 'storehouse').tamanho;
  // um tile logo abaixo da porta do armazem: o obreiro e a pedra chegam em poucos passos
  const alvo = { gx: armazem.gx + Math.floor(larg / 2), gy: armazem.gy + alt + 1 };
  const chave = `${alvo.gx},${alvo.gy}`;

  await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
    scrollX: Math.round((alvo.gx + 0.5) * px - canvas.width / 2),
    scrollY: Math.round((alvo.gy + 0.5) * px - canvas.height / 2),
  });
  await esperarFrame();
  const { camera } = await estado();
  const x = canvas.left + alvo.gx * px + px / 2 - camera.scrollX;
  const y = canvas.top + alvo.gy * px + px / 2 - camera.scrollY;
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');

  const vistos = [];
  for (let n = 0; n < TETO; n += 1) {
    const s = await estado();
    const estagio = s.estagiosDaRuaEmObra[chave];
    if (estagio === undefined && vistos.length > 0) break;
    if (estagio !== undefined && vistos[vistos.length - 1] !== estagio) {
      vistos.push(estagio);
      await capturar(estagio);
    }
    await avancar(1);
    await page.waitForTimeout(60);
  }
  const fim = await estado();
  afirmar(fim.estagiosDaRuaEmObra[chave] === undefined && fim.estradasRenderizadas > 0, `o tile virou rua: ${JSON.stringify(fim.estagiosDaRuaEmObra)}`);
  afirmar(JSON.stringify(vistos) === JSON.stringify(['marcado', 'pedras', 'obra-1', 'obra-2']), `os estagios na ordem: ${JSON.stringify(vistos)}`);
  await capturar('rua-pronta');

  // despausado um instante: o laco real redesenha sem quebrar
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  console.log(`[I-TELA-RUA-SENDO-ASSENTADA] ${JSON.stringify(vistos)}`);
}

module.exports = { roteiro };
