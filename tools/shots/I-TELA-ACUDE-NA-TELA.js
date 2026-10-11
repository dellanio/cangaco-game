'use strict';
// I-TELA-ACUDE-NA-TELA: carrega a partida que o teste grava (a fazenda de um tile com o Acude cheio no raio
// dela). Com o jogo ANDANDO (§8): abre o painel do Acude e le o nivel; abre o da fazenda e le "Irrigada";
// arma a planta do Acude pelo menu e le o raio que ela publica. Tres capturas.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const { aneisEmVolta, lotePelaPlanta } = require('./_lote-pela-planta');
const terreno = require('../../data/terrain.json');
const acudeJson = require('../../data/acude.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const esperar = (ms = 250) => page.waitForTimeout(ms);
  const arquivo = 'test-output/I-TELA-ACUDE-NA-TELA.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode o teste antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), ['cangaco:partida', readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperar();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperar();
  await page.keyboard.press('Escape');
  await esperar();

  let s = await estado();
  const acude = s.prediosDoEstado.a1;
  const fazenda = s.prediosDoEstado.f1;
  afirmar(acude && acude.tipo === 'reservoir' && fazenda && fazenda.tipo === 'farm', `a partida deveria ter o Acude a1 e a fazenda f1: ${JSON.stringify({ acude, fazenda })}`);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((acude.gx + 2) * TILE_PX - canvas.width / 2),
    scrollY: Math.round((acude.gy + 3) * TILE_PX - canvas.height / 2),
  });
  await esperar(400);
  s = await estado();
  const noDebug = s.acudes.a1;
  afirmar(noDebug && noDebug.agua === acudeJson.capacidade && noDebug.estado === 'cheio', `o Acude cheio deveria estar desenhado no estado cheio: ${JSON.stringify(noDebug)}`);

  const naPagina = (gx, gy) => ({ x: canvas.left + gx * TILE_PX - s.camera.scrollX, y: canvas.top + gy * TILE_PX - s.camera.scrollY });
  const segurar = async (p) => {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await esperar(400);
  };

  // 1. o painel do Acude, com o jogo andando
  await page.keyboard.press('p');
  await segurar(naPagina(acude.gx + 2, acude.gy + 1.5));
  await page.keyboard.press('p');
  await esperar();
  const linhaDoAcude = await page.evaluate(() => {
    const l = window.document.querySelector('#painel-predio .linha.acude');
    return l === null ? null : { agua: Number(l.dataset.agua), capacidade: Number(l.dataset.capacidade), texto: l.textContent };
  });
  afirmar(linhaDoAcude !== null && linhaDoAcude.capacidade === acudeJson.capacidade && linhaDoAcude.agua > 0,
    `o painel do Acude deveria mostrar o nivel: ${JSON.stringify(linhaDoAcude)}`);
  await capturar('painel-do-acude');

  // 2. o painel da fazenda: irrigada
  await page.keyboard.press('p');
  await segurar(naPagina(fazenda.gx + 2, fazenda.gy + 1.5));
  await page.keyboard.press('p');
  await esperar();
  const irrigada = await page.evaluate(() => window.document.querySelector('#painel-predio .linha.irrigada')?.textContent ?? null);
  afirmar(irrigada === tema.painelPredio.irrigada, `o painel da fazenda deveria dizer "${tema.painelPredio.irrigada}": ${irrigada}`);
  await capturar('fazenda-irrigada');

  // 3. a planta do Acude, armada pelo menu, desenha o raio
  await page.keyboard.press('Escape');
  await esperar();
  const botao = await page.locator('[data-predio="reservoir"]').boundingBox();
  afirmar(botao !== null, 'o botao do Acude deveria existir no menu');
  await page.keyboard.press('p');
  await segurar({ x: botao.x + botao.width / 2, y: botao.y + botao.height / 2 });
  await page.keyboard.press('p');
  // O lote da planta e o que a propria planta aprova, perto da fazenda e na vista (`_lote-pela-planta`).
  // Ate 2026-10-11 era um tile fixo a leste da fazenda; com predio proibido na roca
  // (I-OBRA-SEM-PREDIO-NA-ROCA) o Acude do teste mudou de lado, e aquele tile saiu da vista.
  const { escolhido, recusados } = await lotePelaPlanta({
    page, estado, canvas, tilePx: TILE_PX, esperar: () => esperar(),
    candidatos: aneisEmVolta({ gx: fazenda.gx, gy: fazenda.gy }, acudeJson.raio_tiles).map((t) => [t]),
  });
  afirmar(escolhido !== null, `a planta deveria aprovar um lote para o Acude perto da fazenda (recusados: ${recusados})`);
  s = await estado();
  afirmar(s.plantaFantasma !== null && s.plantaFantasma.tipo === 'reservoir' && s.plantaFantasma.irrigacao !== null
    && s.plantaFantasma.irrigacao.raio === acudeJson.raio_tiles, `a planta do Acude deveria publicar o raio ${acudeJson.raio_tiles}: ${JSON.stringify(s.plantaFantasma)}`);
  console.log(`I-TELA-ACUDE-NA-TELA — painel ${JSON.stringify(linhaDoAcude)}; fazenda "${irrigada}"; planta ${JSON.stringify(s.plantaFantasma.irrigacao)}`);
  await capturar('planta-com-o-raio');
}
module.exports = { roteiro };
