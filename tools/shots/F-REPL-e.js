'use strict';
// Roteiro da F-REPL-e — OS ESTADOS DA ARVORE NA TELA.
//
// Carrega pelo botao "carregar" (F23b) a partida que `tests/F-REPL-e-arvore.test.ts`
// grava no tick em que o lenhador acabou de replantar um toco, centra no tile a
// zoom 2 e anda o relogio (`__cangaco.avancar`) ate cada fronteira que o teste
// gravou em `test-output/F-REPL-e.json`: muda -> crescendo_1 -> crescendo_2 -> adulta.
// Em cada uma afirma o estado que o sprite desenhou e que o placeholder (sem PNG do
// estado) cresce; na adulta, o tile sai do crescimento e o sprite continua em pe.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const ZOOM_DA_ARVORE = 2;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX / 2) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 60);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  /** A roda, com o cursor no meio do canvas: o centro da vista nao anda. */
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

  for (const arquivo of ['test-output/F-REPL-e.save.txt', 'test-output/F-REPL-e.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/F-REPL-e.json', 'utf8'));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/F-REPL-e.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  const [gx, gy] = plano.tile.split(',').map(Number);
  await zoomPara(terreno.zoom.inicial);
  await centrarNoEixo(gx + 0.5, 'x');
  await centrarNoEixo(gy + 0.5, 'y');
  await zoomPara(ZOOM_DA_ARVORE);

  let escalaAnterior = 0;
  for (const { estado: esperado, desde } of plano.fronteiras) {
    s = await estado();
    if (desde > s.tick) await avancar(desde - s.tick);
    await esperarFrame();
    s = await estado();
    const desenhado = s.crescimentoDasArvores[plano.tile];
    afirmar(desenhado !== undefined, `t${s.tick}: o tile ${plano.tile} deveria estar crescendo`);
    afirmar(desenhado.estado === esperado, `t${s.tick}: o sprite deveria desenhar '${esperado}', desenhou '${desenhado.estado}'`);
    afirmar(desenhado.fonte === 'placeholder', `'${esperado}' nao tem PNG hoje: deveria ser o placeholder, veio ${desenhado.fonte}`);
    afirmar(desenhado.escala > escalaAnterior && desenhado.escala < 1, `'${esperado}': a escala ${desenhado.escala} deveria crescer e ficar abaixo da adulta`);
    escalaAnterior = desenhado.escala;
    await capturar(esperado);
  }

  s = await estado();
  const vegetacaoAntes = s.vegetacaoRenderizada;
  await avancar(plano.adultaEm - s.tick);
  await esperarFrame();
  s = await estado();
  afirmar(s.crescimentoDasArvores[plano.tile] === undefined, `t${s.tick}: a adulta deveria sair do crescimento`);
  afirmar(s.vegetacaoRenderizada === vegetacaoAntes, `t${s.tick}: a adulta continua em pe (${vegetacaoAntes} -> ${s.vegetacaoRenderizada} sprites)`);
  await capturar('adulta');
}

module.exports = { roteiro };
