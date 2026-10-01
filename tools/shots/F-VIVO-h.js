'use strict';
// Roteiro da F-VIVO-h (a escola anima enquanto ha recruta em treino), aceite do BUILD_PLAN.md.
//
// Carrega pelo botao "carregar" (F23b) a partida que `tests/F-VIVO-h-escola.test.ts` grava: a
// escola com um pedido `aguardando`, o ouro ainda no armazem. Passo 0 mede pela ponte de debug
// que a escola esperando a mercadoria nao anima. Depois DESPAUSA o relogio (§8) e le a ponte a
// cada 150 ms: `debug.quadrosDaEscola` (src/render/debug.ts) tem a escola enquanto a sim treina
// e nao tem antes nem depois. Pausa no meio do treino para a captura, despausa ate o recruta
// sair e pausa de novo. Nao clica em painel: o `#ajuda` do carregar e o mesmo da F-VIVO-g.
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

  for (const arquivo of ['test-output/F-VIVO-h.save.txt', 'test-output/F-VIVO-h.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/F-VIVO-h.partida.json', 'utf8'));
  const treino = (s) => s.quadrosDaEscola[plano.predio] ?? null;
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/F-VIVO-h.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // passo 0: a medida, com o relogio parado
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  afirmar(treino(s) === null, `a ${plano.predio} esperando o ouro nao deveria animar`);

  await zoomPara(ZOOM);
  await centrarNoEixo(plano.centro.gx, 'x');
  await centrarNoEixo(plano.centro.gy, 'y');
  // o quadrado claro que o avaliador viu ao lado da escola e o realce do tile sob o mouse
  // (`highlight`, WorldScene), deixado no mapa pelo `zoomPara`. O mouse sai do canvas para a
  // barra, e o realce apaga (GAME_OUT): a captura mostra o jogo, nao o cursor do roteiro.
  const sobOMouse = (await estado()).tileSobMouse;
  afirmar(sobOMouse !== null, 'depois do zoom o mouse deveria estar sobre um tile do mapa');
  const barra = await page.evaluate(() => {
    const r = window.document.querySelector('#barra').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(barra.x, barra.y);
  await esperarFrame();
  afirmar((await estado()).tileSobMouse === null,
    `com o mouse na barra, nenhum tile deveria estar sob ele (estava em ${JSON.stringify(sobOMouse)})`);

  // relogio andando (§8): cada leitura confere o laco contra a janela de treino da sim
  let vistos = 0;
  const conferir = () => {
    const dentro = s.tick >= plano.comeca && s.tick < plano.sai;
    afirmar((treino(s) !== null) === dentro,
      `tick ${s.tick}: laco ${treino(s) === null ? 'ausente' : 'presente'}, a sim treina de ${plano.comeca} a ${plano.sai - 1}`);
    if (treino(s) !== null) vistos += 1;
  };
  const meio = plano.comeca + Math.floor((plano.sai - plano.comeca) / 2);
  await page.keyboard.press('p');
  for (let i = 0; i < 400 && s.tick < meio; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    conferir();
  }
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.tick >= plano.comeca && s.tick < plano.sai, `a captura deveria cair no treino, veio o tick ${s.tick}`);
  afirmar(treino(s) !== null, `pausada no tick ${s.tick}, a ${plano.predio} deveria mostrar o laco`);
  await capturar('escola-treinando');

  await page.keyboard.press('p');
  for (let i = 0; i < 400 && s.tick < plano.sai + 5; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    conferir();
  }
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.tick >= plano.sai, `o relogio deveria passar do tick ${plano.sai}, parou em ${s.tick}`);
  afirmar(treino(s) === null, `o recruta saiu no tick ${plano.sai}: no ${s.tick} a escola nao deveria animar`);
  afirmar(vistos > 5, `poucas leituras com o laco: ${vistos}`);
  await capturar('escola-depois-do-treino');
}

module.exports = { roteiro };
