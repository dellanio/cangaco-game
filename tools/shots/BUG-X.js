'use strict';
// Roteiro do BUG-X — O ESPECIALISTA TRABALHA DENTRO DA CASA, NAO NA PORTA.
//
// Carrega pelo botao "carregar" (F23b) a partida que `tests/BUG-X-especialista-dentro.test.ts`
// grava no primeiro tick da vila da calibracao em que a serraria esta ocupada com o serrador
// `trabalhando` e um lenhador esta `colhendo` no mato. Passo 0 mede pela ponte de debug, nao
// pelo olho: o serrador segue na lista (`unidadesRenderizadas`) com `visivel: false`, no tile
// da porta, e nenhuma unidade visivel esta nesse tile; o lenhador no lajedo, `visivel: true`.
// Depois centra na serraria e no lenhador e captura os dois. Nao clica em painel: o
// `#ajuda` do carregar e o mesmo do BUG-W.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const ZOOM = 2;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER

  async function centrarNoEixo(alvoEmTiles, eixo) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const vao = eixo === 'x' ? canvas.width : canvas.height;
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), [eixo, alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX / 2) return;
      const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 60);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  async function zoomPara(nivel) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 10; i += 1) {
      const { camera } = await estado();
      if (camera.zoom === nivel) return;
      await page.mouse.wheel(0, camera.zoom > nivel ? +200 : -200);
      await esperarFrame();
    }
    afirmar((await estado()).camera.zoom === nivel, `a camera deveria chegar a ${nivel}`);
  }

  for (const arquivo of ['test-output/BUG-X.save.txt', 'test-output/BUG-X.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/BUG-X.partida.json', 'utf8'));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/BUG-X.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // passo 0: a medida
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  const achar = (id) => s.unidadesRenderizadas.find((u) => u.id === id);
  const serrador = achar(plano.serrador);
  const lenhador = achar(plano.lenhador);
  afirmar(serrador !== undefined, `o serrador ${plano.serrador} deveria seguir na ponte de debug`);
  afirmar(serrador.fsm === 'trabalhando', `o serrador deveria estar trabalhando, esta '${serrador.fsm}'`);
  afirmar(serrador.gx === plano.porta.gx && serrador.gy === plano.porta.gy, `o serrador deveria estar no tile da porta ${plano.porta.gx},${plano.porta.gy}`);
  afirmar(serrador.visivel === false, 'o serrador dentro da serraria nao deveria ser desenhado');
  const naPorta = s.unidadesRenderizadas.filter((u) => u.visivel && Math.round(u.gx) === plano.porta.gx && Math.round(u.gy) === plano.porta.gy);
  afirmar(naPorta.length === 0, `a porta deveria estar vazia na tela, tem ${naPorta.map((u) => `${u.id}:${u.fsm}`).join(', ')}`);
  afirmar(lenhador !== undefined && lenhador.fsm === 'colhendo', 'o lenhador deveria estar colhendo');
  afirmar(lenhador.visivel === true, 'o lenhador no mato deveria ser desenhado');

  await zoomPara(ZOOM);
  await centrarNoEixo(plano.porta.gx + 0.5, 'x');
  await centrarNoEixo(plano.porta.gy - 0.5, 'y');
  s = await estado();
  afirmar(achar(plano.serrador).visivel === false, 'depois de centrar, o serrador continua sem desenho');
  await capturar('serraria-porta-vazia');

  await centrarNoEixo(plano.noLajedo.gx + 0.5, 'x');
  await centrarNoEixo(plano.noLajedo.gy + 0.5, 'y');
  s = await estado();
  afirmar(achar(plano.lenhador).visivel === true, 'o lenhador colhendo continua desenhado');
  await capturar('lenhador-colhendo-visivel');
}

module.exports = { roteiro };
