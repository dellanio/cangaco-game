'use strict';
// Roteiro da F-VIVO-e, decisao D3 do operador (2026-10-01) — PAUSADO: O HOMEM FICA DENTRO E
// A CASA MOSTRA O OCIOSO.
//
// Carrega pelo botao "carregar" (F23b) a partida que o aceite 6 de
// `tests/F-VIVO-e-ocioso.test.ts` grava: a serraria `s1` pausada pelo comando com o serrador
// dentro. Passo 0 mede pela ponte de debug, nao pelo olho: a s1 tem ocioso e nao tem quadro
// de trabalho, e o serrador segue na lista (`unidadesRenderizadas`) com `visivel: false`.
// Depois DESPAUSA o relogio (§8) e le varias vezes: o ocioso anda e o serrador continua
// escondido. Pausa de volta e captura. Nao clica em painel: o `#ajuda` do carregar e o
// mesmo da F-VIVO-e.
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
  const serrador = (s, id) => s.unidadesRenderizadas.find((u) => u.id === id);

  for (const arquivo of ['test-output/F-VIVO-e-pausado.save.txt', 'test-output/F-VIVO-e-pausado.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/F-VIVO-e-pausado.partida.json', 'utf8'));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/F-VIVO-e-pausado.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // passo 0: a medida, com o relogio parado
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  afirmar(s.quadrosOciosos[plano.predio] !== undefined, `a ${plano.predio} pausada deveria ter ocioso`);
  afirmar(s.quadrosDeTrabalho[plano.predio] === undefined, `a ${plano.predio} pausada nao deveria ter quadro de trabalho`);
  const u0 = serrador(s, plano.ocupante);
  afirmar(u0 !== undefined, `o serrador ${plano.ocupante} deveria estar na lista de unidades`);
  afirmar(u0.visivel === false, `o serrador ${plano.ocupante} da casa pausada deveria estar escondido`);

  await zoomPara(ZOOM);
  await centrarNoEixo(plano.centro.gx, 'x');
  await centrarNoEixo(plano.centro.gy, 'y');

  // relogio andando (§8): o ocioso anda e o serrador segue dentro
  const ns = new Set();
  await page.keyboard.press('p');
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    const q = s.quadrosOciosos[plano.predio];
    afirmar(q !== undefined, `com o relogio andando, a ${plano.predio} perdeu o ocioso no tick ${s.tick}`);
    ns.add(q.n);
    afirmar(s.quadrosDeTrabalho[plano.predio] === undefined, `pausada, a ${plano.predio} ganhou quadro de trabalho no tick ${s.tick}`);
    const u = serrador(s, plano.ocupante);
    afirmar(u !== undefined && u.visivel === false, `o serrador apareceu no tick ${s.tick}`);
  }
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(ns.size > 1, `o n do ocioso deveria andar, leu so ${[...ns].join(', ')}`);
  s = await estado();
  afirmar(s.tick > plano.tick, 'o relogio deveria ter andado');
  await capturar('serraria-pausada');
}

module.exports = { roteiro };
