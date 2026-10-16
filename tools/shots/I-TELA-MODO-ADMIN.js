'use strict';
// I-TELA-MODO-ADMIN (aceites 2 e 3) — sem o modo admin, a obra sem arte nao tem o nome e o estagio escritos e as
// unidades nao tem o nome em cima; com `?admin`, os dois voltam. O mesmo plantio do roteiro do canteiro: um
// lenhador abaixo da vila do jogo livre, em marcacao.
const { URL } = require('node:url');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const economia = require('../../data/economy.json');

const TIMEOUT_PRONTO_MS = 10_000;

async function roteiro({ page, capturar, estado, afirmar }) {
  const px = terreno.tile_px;
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const lote = { gx: armazem.gx, gy: armazem.gy + 9 };

  async function abrirEPlantar(busca) {
    const url = new URL(page.url());
    url.search = busca;
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS });
    const canvas = await retanguloDoCanvas(page);
    await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
      scrollX: Math.round((armazem.gx + 2) * px - canvas.width / 2),
      scrollY: Math.round((armazem.gy + 7) * px - canvas.height / 2),
    });
    await esperarFrame();
    const { camera } = await estado();
    await page.click('[data-predio="woodcutters"]');
    await esperarFrame();
    const x = canvas.left + lote.gx * px + px / 2 - camera.scrollX;
    const y = canvas.top + lote.gy * px + px / 2 - camera.scrollY;
    await page.mouse.move(x, y);
    await esperarFrame();
    await page.mouse.click(x, y);
    await avancar(1);
    await esperarFrame();
    await page.keyboard.press('Escape');
    await esperarFrame();
    const s = await estado();
    afirmar((s.estagiosDeObraRenderizados.marcacao ?? 0) === 1, `o lote em marcacao: ${JSON.stringify(s.estagiosDeObraRenderizados)}`);
    return s;
  }

  // sem admin (o navegador limpo): nenhum rotulo de predio e nenhum nome de unidade a vista
  await page.evaluate(() => window.localStorage.removeItem('cangaco:admin'));
  const sem = await abrirEPlantar('?pausado');
  afirmar(sem.modoAdmin === false, 'sem ?admin, o modo esta desligado');
  afirmar(sem.rotulosDePredio === 0, `sem admin, nenhum rotulo de predio: ${sem.rotulosDePredio}`);
  const nomesVisiveis = (sem.unidadesRenderizadas ?? []).filter((u) => u.nomeVisivel).length;
  afirmar(nomesVisiveis === 0, `sem admin, nenhum nome de unidade visivel: ${nomesVisiveis}`);
  await capturar('sem-admin');

  // com admin: os dois voltam
  const com = await abrirEPlantar('?pausado&admin');
  afirmar(com.modoAdmin === true, 'com ?admin, o modo esta ligado');
  afirmar(com.rotulosDePredio > 0, `com admin, o rotulo do lote: ${com.rotulosDePredio}`);
  const nomesComAdmin = (com.unidadesRenderizadas ?? []).filter((u) => u.nomeVisivel).length;
  afirmar(nomesComAdmin > 0, `com admin, os nomes das unidades: ${nomesComAdmin}`);
  await capturar('com-admin');
  console.log(`[I-TELA-MODO-ADMIN] sem: rotulos ${sem.rotulosDePredio}, nomes ${nomesVisiveis}; com: rotulos ${com.rotulosDePredio}, nomes ${nomesComAdmin}`);
}

module.exports = { roteiro };
