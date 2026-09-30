'use strict';
// Roteiro da F-VIVO-e — O OCIOSO: CASA OCUPADA E PARADA NAO E CASA VAZIA.
//
// Carrega pelo botao "carregar" (F23b) a partida que `tests/F-VIVO-e-ocioso.test.ts` grava:
// a pedreira `q1` com o canteiro dentro e a saida cheia (sem serf, ninguem a esvazia) ao
// lado da pedreira `q2`, completa e sem ocupante. Passo 0 mede pela ponte de debug, nao
// pelo olho: `quadrosOciosos` tem a q1 e nao tem a q2. Depois DESPAUSA (§8) e le o `n`
// varias vezes: ele anda na q1 e a q2 segue ausente. Pausa de volta e captura.
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

  for (const arquivo of ['test-output/F-VIVO-e.save.txt', 'test-output/F-VIVO-e.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/F-VIVO-e.partida.json', 'utf8'));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/F-VIVO-e.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // passo 0: a medida, pausado
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  afirmar(s.quadrosOciosos[plano.cheia] !== undefined, `a ${plano.cheia} (ocupada, saida cheia) deveria ter ocioso`);
  afirmar(s.quadrosOciosos[plano.vazia] === undefined, `a ${plano.vazia} (vazia) nao deveria ter ocioso`);
  afirmar(s.quadrosDeTrabalho[plano.cheia] === undefined, `a ${plano.cheia} parada nao deveria ter quadro de trabalho`);

  await zoomPara(ZOOM);
  await centrarNoEixo(plano.centro.gx, 'x');
  await centrarNoEixo(plano.centro.gy, 'y');

  // despausado (§8): o n anda na cheia e a vazia segue sem ocioso
  const ns = new Set();
  await page.keyboard.press('p');
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    afirmar(s.quadrosOciosos[plano.vazia] === undefined, `despausado, a ${plano.vazia} ganhou ocioso`);
    const q = s.quadrosOciosos[plano.cheia];
    afirmar(q !== undefined, `despausado, a ${plano.cheia} perdeu o ocioso no tick ${s.tick}`);
    ns.add(q.n);
  }
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(ns.size > 1, `o n do ocioso deveria andar despausado, leu so ${[...ns].join(', ')}`);
  s = await estado();
  afirmar(s.tick > plano.tick, 'o relogio deveria ter andado');
  await capturar('ocupada-e-vazia');
}

module.exports = { roteiro };
