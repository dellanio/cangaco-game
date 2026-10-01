'use strict';
// Roteiro da F-VIVO-f — O CASO 2 SO NA FASE DA CASA.
//
// Carrega pelo botao "carregar" (F23b) a partida que `tests/F-VIVO-f-caso-2-na-casa.test.ts`
// grava: a pedreira `q1` com o canteiro dentro, na fase da casa (quadro de trabalho), ao lado
// da pedreira `q2` com o canteiro `u9` no tile, colhendo. Passo 0 mede pela ponte de debug:
// a q1 tem quadro de trabalho, a q2 nao tem nem trabalho nem ocioso, e o `u9` e desenhado.
// Depois DESPAUSA (§8): o quadro da q1 anda, a q2 segue sem quadro enquanto o `u9` colhe.
// Pausa de volta e captura.
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

  for (const arquivo of ['test-output/F-VIVO-f.save.txt', 'test-output/F-VIVO-f.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/F-VIVO-f.partida.json', 'utf8'));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/F-VIVO-f.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // passo 0: a medida, pausado
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  const canteiro = () => s.unidadesRenderizadas.find((u) => u.id === plano.canteiroNoTile);
  afirmar(s.quadrosDeTrabalho[plano.naCasa] !== undefined, `a ${plano.naCasa} (canteiro dentro, fase da casa) deveria ter quadro de trabalho`);
  afirmar(s.quadrosDeTrabalho[plano.noTile] === undefined, `a ${plano.noTile} (canteiro no tile) nao deveria ter quadro de trabalho`);
  afirmar(s.quadrosOciosos[plano.noTile] === undefined, `a ${plano.noTile} (canteiro no tile) nao deveria ter ocioso`);
  afirmar(canteiro()?.fsm === 'colhendo', `o ${plano.canteiroNoTile} deveria estar colhendo, esta '${canteiro()?.fsm}'`);
  afirmar(canteiro().visivel === true, `o ${plano.canteiroNoTile} no tile deveria ser desenhado`);

  await zoomPara(ZOOM);
  // enquadra as duas pedreiras inteiras (x no meio delas) e sobe ate o canteiro no tile (y)
  const noTile = canteiro();
  await centrarNoEixo(plano.centro.gx, 'x');
  await centrarNoEixo((plano.centro.gy + noTile.gy) / 2, 'y');

  // despausado (§8): o quadro da q1 anda; a q2 segue sem quadro enquanto o canteiro colhe
  const quadros = new Set();
  await page.keyboard.press('p');
  for (let i = 0; i < 14; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    const q = s.quadrosDeTrabalho[plano.naCasa];
    afirmar(q !== undefined, `despausado, a ${plano.naCasa} perdeu o quadro de trabalho no tick ${s.tick}`);
    quadros.add(`${q.laco}_${q.n}`);
    if (canteiro()?.fsm === 'colhendo') {
      afirmar(s.quadrosDeTrabalho[plano.noTile] === undefined, `despausado, a ${plano.noTile} ganhou quadro com o canteiro no tile`);
      afirmar(s.quadrosOciosos[plano.noTile] === undefined, `despausado, a ${plano.noTile} ganhou ocioso com o canteiro no tile`);
    }
  }
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(quadros.size > 1, `o quadro da ${plano.naCasa} deveria andar despausado, leu so ${[...quadros].join(', ')}`);
  s = await estado();
  afirmar(s.tick > plano.tick, 'o relogio deveria ter andado');
  await capturar('dentro-e-no-tile');
}

module.exports = { roteiro };
