'use strict';
// Roteiro da F35 — A FEIRA NA TELA.
//
// Carrega a partida que `tests/F35-feira.test.ts` grava: a vila, uma feira ligada ao
// armazem pela rua, com a ordem "3 de ouro por madeira" e NENHUMA madeira no armazem.
//   1. abre o painel da feira com o jogo ANDANDO (mouse.down/up, §8);
//   2. deixa andar: nenhuma troca acontece, e o painel diz por que (sem-mercadoria),
//      com o texto do tema e o nome da mercadoria que falta.
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

  const arquivo = 'test-output/F35.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const feira = s.prediosDoEstado.feira;
  afirmar(feira !== undefined && feira.tipo === 'marketplace', 'a partida deveria ter a feira');

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
  await centrarNoEixo(feira.gx + 1, 'x');
  await centrarNoEixo(feira.gy + 1, 'y');
  s = await estado();

  // 1. o painel, aberto com o jogo andando
  const noCanvas = {
    x: canvas.left + (feira.gx + 1) * TILE_PX - s.camera.scrollX,
    y: canvas.top + (feira.gy + 1) * TILE_PX - s.camera.scrollY,
  };
  await page.keyboard.press('p');
  await page.mouse.move(noCanvas.x, noCanvas.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  // 2. anda um pouco: o painel resiste ao redesenho e nenhuma troca acontece
  await page.waitForTimeout(1500);
  await page.keyboard.press('p');
  await esperarFrame();

  const feitas = await page.getAttribute('#painel-predio .linha.feira', 'data-feitas');
  const quantidade = await page.getAttribute('#painel-predio .linha.feira', 'data-quantidade');
  afirmar(feitas === '0' && quantidade === '3', `o painel deveria mostrar 0/3 trocas, veio ${feitas}/${quantidade}`);
  const motivo = await page.getAttribute('#painel-predio .feira-nao-troca', 'data-motivo');
  afirmar(motivo === 'sem-mercadoria', `o painel deveria dizer sem-mercadoria, veio ${motivo}`);
  const texto = (await page.textContent('#painel-predio .feira-nao-troca')) ?? '';
  const nome = tema.mercadorias?.timber ?? 'timber';
  const esperado = tema.painelPredio.feiraSemMercadoria.replace('{da}', nome);
  afirmar(texto === esperado, `o texto deveria ser "${esperado}", veio "${texto}"`);
  await capturar('feira-sem-mercadoria');
  console.log(`F35: painel ${feitas}/${quantidade}, motivo ${motivo}, texto "${texto}"`);
}

module.exports = { roteiro };
