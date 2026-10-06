'use strict';
// I-ARTE-IGREJA e I-PREDIO-IGREJA: carrega a partida que `tests/I-PREDIO-IGREJA.test.ts` grava (a vila e
// a Igreja completa com 5 de ouro, sem rua), captura a Igreja, abre o painel com o jogo ANDANDO (§8) e
// contrata o padre pelo botao: o ouro cai pelo custo e o padre aparece na porta.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const units = require('../../data/units.json');

const TILE_PX = terreno.tile_px;
const CUSTO = units.mercenarios.tipos.find((t) => t.id === 'priest').custoOuro;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const esperar = (ms = 250) => page.waitForTimeout(ms);
  const arquivo = 'test-output/I-PREDIO-IGREJA.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode o teste antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), ['cangaco:partida', readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperar();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperar();
  await page.keyboard.press('Escape');
  await esperar();

  let s = await estado();
  const igreja = s.prediosDoEstado.igreja;
  afirmar(igreja && igreja.tipo === 'church' && igreja.estado === 'completo', `a partida deveria ter a Igreja completa: ${JSON.stringify(igreja)}`);
  afirmar(s.spritesDePredio.igreja !== null, `a Igreja deveria estar desenhada pelo sprite, veio ${s.spritesDePredio.igreja}`);
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((igreja.gx + 1.5) * TILE_PX - canvas.width / 2),
    scrollY: Math.round((igreja.gy + 1.5) * TILE_PX - canvas.height / 2),
  });
  await esperar(400);
  await capturar('igreja');

  // o painel, com o jogo andando
  s = await estado();
  const noCanvas = { x: canvas.left + (igreja.gx + 1.5) * TILE_PX - s.camera.scrollX, y: canvas.top + (igreja.gy + 1.5) * TILE_PX - s.camera.scrollY };
  await page.keyboard.press('p');
  await page.mouse.move(noCanvas.x, noCanvas.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperar(500);
  const botoes = await page.$$eval('#painel-predio button.contratar', (bs) => bs.map((b) => b.dataset.tipo));
  afirmar(JSON.stringify(botoes) === JSON.stringify(['priest']), `o painel da Igreja deveria oferecer so o padre: ${JSON.stringify(botoes)}`);
  const antes = (await estado()).unidadesRenderizadas.filter((u) => u.tipo === 'priest').length;
  // o painel se refaz a cada tick (por desenho; o BUG-B segura o redesenho so com o botao apertado): o
  // ponto e lido numa chamada so, com o no vivo, e nao por `$eval`, que mede um no ja trocado
  const b = await page.evaluate(() => { const r = window.document.querySelector('#painel-predio button.contratar[data-tipo="priest"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperar(500);
  await page.keyboard.press('p');
  await esperar();
  const ouro = Number(await page.getAttribute('#painel-predio .linha.prefeitura', 'data-ouro'));
  const depois = (await estado()).unidadesRenderizadas.filter((u) => u.tipo === 'priest').length;
  const sim = await page.evaluate(() => Object.values(JSON.parse(window.__cangacoPartida.estadoSerializado()).estado?.unidades?.porId ?? {}).filter((u) => u.tipo === 'priest').length);
  afirmar(depois === antes + 1, `o padre deveria aparecer: ${antes} -> ${depois} (no estado: ${sim}); ouro ${ouro}`);
  afirmar(ouro === 5 - CUSTO, `o ouro da Igreja deveria cair para ${5 - CUSTO}, esta ${ouro}`);
  await capturar('padre-contratado');
}
module.exports = { roteiro };
