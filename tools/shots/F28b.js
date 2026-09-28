'use strict';
// Roteiro da F28b — A TORRE DE PEDRA NA TELA.
//
// Carrega a partida que `tests/F28b-torre.test.ts` grava: a vila, uma torre ocupada
// pelo recruta com DUAS pedras, tres inimigos no alcance e um soldado do jogador no
// MESMO tile do primeiro inimigo (fogo amigo). Sem rua ate a torre: a pedra nao repoe.
//   1. abre o painel da torre (clique com o jogo ANDANDO, mouse.down/up, §8): 2/5 pedras;
//   2. espera a primeira pedra e captura o traco na tela;
//   3. espera a torre esvaziar: o painel diz "sem pedra", e o amigo do ponto morreu.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/F28b.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const torre = s.prediosDoEstado.torre;
  afirmar(torre !== undefined && torre.tipo === 'watchtower', 'a partida deveria ter a torre');
  afirmar(s.unidadesRenderizadas.some((u) => u.id === 'amigo'), 'a partida deveria ter o amigo no ponto');

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 300 : 80);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  await centrarNoEixo(torre.gx + 1, 'x');
  await centrarNoEixo(torre.gy + 1, 'y');
  s = await estado();

  // 1. o painel, aberto com o jogo andando
  const noCanvas = {
    x: canvas.left + (torre.gx + 1) * TILE_PX - s.camera.scrollX,
    y: canvas.top + (torre.gy + 1) * TILE_PX - s.camera.scrollY,
  };
  const pedrasAntes = s.pedrasDaTorre;
  await page.keyboard.press('p');
  await page.mouse.move(noCanvas.x, noCanvas.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();

  // 2. a primeira pedra: captura enquanto o traco esta na tela (meio segundo)
  let viuPedra = false;
  for (let i = 0; i < 200 && !viuPedra; i += 1) {
    await page.waitForTimeout(30);
    viuPedra = (await estado()).pedrasDaTorre > pedrasAntes;
  }
  afirmar(viuPedra, 'a torre deveria atirar uma pedra com o jogo andando');
  await capturar('pedra-no-ar');
  const primeira = (await estado()).ultimaPedra;
  afirmar(primeira !== null && primeira.predio === 'torre', `a primeira pedra deveria sair da torre, veio ${JSON.stringify(primeira)}`);

  // 3. a torre esvazia: o painel diz por que parou
  let vazia = false;
  for (let i = 0; i < 100 && !vazia; i += 1) {
    await page.waitForTimeout(100);
    vazia = (await page.getAttribute('#painel-predio .linha.torre', 'data-pedras')) === '0';
  }
  // C2: a pedra VOA — a ultima ainda esta no ar quando o painel chega a 0; espera cair
  await page.waitForTimeout(1500);
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(vazia, 'o painel da torre deveria chegar a 0 pedras');
  const motivo = await page.getAttribute('#painel-predio .torre-nao-atira', 'data-motivo');
  afirmar(motivo === 'sem-pedra', `o painel deveria dizer sem-pedra, veio ${motivo}`);
  const texto = (await page.textContent('#painel-predio .torre-nao-atira')) ?? '';
  afirmar(texto === tema.painelPredio.torreSemPedra, `o texto deveria ser o do tema, veio "${texto}"`);
  s = await estado();
  afirmar(!s.unidadesRenderizadas.some((u) => u.id === 'amigo'), 'o amigo no tile do alvo deveria ter morrido pela pedra');
  afirmar(s.pedrasDaTorre - pedrasAntes >= 1, 'a tela deveria ter desenhado as pedras');
  await capturar('torre-sem-pedra');
  console.log(`F28b: pedras desenhadas ${s.pedrasDaTorre - pedrasAntes}, ultima ${JSON.stringify(s.ultimaPedra)}`);
}

module.exports = { roteiro };
