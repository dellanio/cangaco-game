'use strict';
// I-ARTE-PADRE: carrega a partida que `tests/I-ARTE-PADRE.test.ts` grava (o padre, tres cabras em volta e
// um cabra inimigo a 6 tiles), captura a aura da bencao com o brilho nos abencoados, e depois, com o jogo
// ANDANDO (§8), seleciona o padre pela caixa e da o botao direito no inimigo: o padre reza (animacao
// `rezar`, o facho ao alvo) e converte (o clarao, o inimigo passa ao lado do jogador).
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const esperar = (ms = 250) => page.waitForTimeout(ms);
  const arquivo = 'test-output/I-ARTE-PADRE.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode o teste antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), ['cangaco:partida', readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperar();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperar();
  await page.keyboard.press('Escape');
  await esperar();

  let s = await estado();
  const padre = s.unidadesRenderizadas.find((u) => u.id === 'padre');
  afirmar(padre !== undefined, 'a partida deveria ter o padre');
  await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
    scrollX: Math.round((padre.gx + 3.5) * TILE_PX - canvas.width / 2),
    scrollY: Math.round((padre.gy + 0.5) * TILE_PX - canvas.height / 2),
  });
  await esperar(400);
  s = await estado();
  afirmar(s.padre !== null && s.padre.aneis === 1, `deveria haver um anel da bencao: ${JSON.stringify(s.padre)}`);
  afirmar(s.padre.abencoados >= 3, `os tres cabras deveriam brilhar: ${JSON.stringify(s.padre)}`);
  const doPadre = s.unidadesRenderizadas.find((u) => u.id === 'padre');
  afirmar(typeof doPadre.frame === 'string' && doPadre.frame.startsWith('priest/'), `o padre deveria vir do atlas: ${doPadre.frame}`);
  await capturar('bencao');

  // a ordem, despausada: a caixa so em volta do padre, e o botao direito no inimigo
  const naPagina = (x, y, cam) => ({
    x: canvas.left + (x - cam.scrollX - canvas.width / 2) * cam.zoom + canvas.width / 2,
    y: canvas.top + (y - cam.scrollY - canvas.height / 2) * cam.zoom + canvas.height / 2,
  });
  await page.keyboard.press('p');
  s = await estado();
  const p = s.unidadesRenderizadas.find((u) => u.id === 'padre');
  const a = naPagina((p.gx + 0.1) * TILE_PX, (p.gy + 0.1) * TILE_PX, s.camera);
  const b = naPagina((p.gx + 0.9) * TILE_PX, (p.gy + 0.9) * TILE_PX, s.camera);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperar();
  s = await estado();
  afirmar(JSON.stringify(s.selecaoMilitar) === JSON.stringify(['padre']), `a caixa deveria pegar so o padre: ${JSON.stringify(s.selecaoMilitar)}`);
  const inimigo = s.unidadesRenderizadas.find((u) => u.id === 'inimigo');
  const alvo = naPagina((inimigo.gx + 0.5) * TILE_PX, (inimigo.gy + 0.5) * TILE_PX, s.camera);
  await page.mouse.move(alvo.x, alvo.y);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(150);
  await page.mouse.up({ button: 'right' });

  // rezando: o facho e a animacao
  let rezando = null;
  for (let i = 0; i < 60 && rezando === null; i += 1) {
    await page.waitForTimeout(100);
    s = await estado();
    const r = s.unidadesRenderizadas.find((u) => u.id === 'padre');
    if (s.padre && s.padre.fachos === 1 && r.animacao === 'rezar') rezando = r;
  }
  afirmar(rezando !== null, `o padre deveria rezar com o facho: ${JSON.stringify(s.padre)} ${JSON.stringify(s.unidadesRenderizadas.find((u) => u.id === 'padre'))}`);
  await page.keyboard.press('p');
  await esperar();
  await capturar('convertendo');
  await page.keyboard.press('p');

  // convertido: o clarao, e o inimigo do lado do jogador
  let convertido = false;
  for (let i = 0; i < 150 && !convertido; i += 1) {
    await page.waitForTimeout(50);
    s = await estado();
    convertido = s.padre !== null && s.padre.claroes > 0;
  }
  await page.keyboard.press('p');
  afirmar(convertido, `o clarao da conversao deveria aparecer: ${JSON.stringify(s.padre)}`);
  const lado = s.unidadesRenderizadas.find((u) => u.id === 'inimigo').lado;
  afirmar(lado === s.unidadesRenderizadas.find((u) => u.id === 'padre').lado, `o inimigo deveria passar ao lado do padre: ${lado}`);
  const convertidoR = s.unidadesRenderizadas.find((u) => u.id === 'inimigo');
  const padreR = s.unidadesRenderizadas.find((u) => u.id === 'padre');
  // a cor PINTADA no rotulo (o fundo do texto do Phaser), e nao a que o lado daria
  afirmar(convertidoR.corDoRotulo === padreR.corDoRotulo, `o rotulo do convertido deveria ter a cor do bando do padre: ${convertidoR.corDoRotulo} contra ${padreR.corDoRotulo}`);
  await capturar('convertido');
}
module.exports = { roteiro };
