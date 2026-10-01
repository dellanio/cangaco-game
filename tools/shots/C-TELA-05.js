'use strict';
// Roteiro da C-TELA-05 — O PAINEL DA FEIRA MANDA A ORDEM (SetTrade).
//
// Carrega a partida que `tests/F35-feira.test.ts` grava: uma feira ligada ao armazem com a
// ordem "madeira -> dinheiro, 3" e nenhuma madeira, parada.
//   1. abre o painel com o jogo ANDANDO (mouse.down/up, §8);
//   2. ainda andando, gira "Dar" ate pedra e "Receber" ate dinheiro, e desce a quantidade
//      para 2;
//   3. manda: a linha da ordem passa a pedra x2;
//   4. o armazem tem pedra: a feira fecha as 2 trocas;
//   5. cancela: "Sem ordem de troca".
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
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const vao = eixo === 'x' ? canvas.width : canvas.height;
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), [eixo, alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
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
  await page.waitForTimeout(300);

  // 2. com o jogo ANDANDO, cada botao seguro 150 ms (§8): o redesenho de 10 Hz nao pode
  //    engolir o clique nem voltar o rascunho ao comeco
  const apertar = async (papel) => {
    // o retangulo numa leitura SINCRONA: andando, o redesenho troca o no entre duas
    // chamadas do Playwright, e o `locator().boundingBox()` pega o no ja destacado
    const caixa = await page.evaluate((sel) => {
      const r = window.document.querySelector(sel)?.getBoundingClientRect();
      return r === undefined ? null : { x: r.x, y: r.y, width: r.width, height: r.height };
    }, `#painel-predio [data-feira-controle="${papel}"]`);
    afirmar(caixa !== null, `o painel da feira deveria ter o botao ${papel}`);
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  const rascunho = async (campo) => page.getAttribute(`#painel-predio .linha.feira-rascunho.${campo}`, `data-${campo}`);
  afirmar((await rascunho('da')) === 'timber', `o rascunho deveria comecar na ordem em vigor (timber), veio ${await rascunho('da')}`);
  for (let i = 0; i < 30 && (await rascunho('da')) !== 'stone'; i += 1) await apertar('da-proxima');
  for (let i = 0; i < 30 && (await rascunho('para')) !== 'gold'; i += 1) await apertar('para-proxima');
  await apertar('menos');
  const montado = { da: await rascunho('da'), para: await rascunho('para'), quantidade: await rascunho('quantidade') };
  afirmar(montado.da === 'stone' && montado.para === 'gold' && montado.quantidade === '2',
    `o rascunho deveria ser pedra -> dinheiro, 2; veio ${JSON.stringify(montado)}`);

  // 3. manda: a linha da ordem passa a ser a do rascunho
  await apertar('mandar');
  await page.keyboard.press('p');
  await esperarFrame();
  const linhaDaOrdem = async () => ({
    da: await page.getAttribute('#painel-predio .linha.feira', 'data-da'),
    quantidade: await page.getAttribute('#painel-predio .linha.feira', 'data-quantidade'),
    feitas: await page.getAttribute('#painel-predio .linha.feira', 'data-feitas'),
  });
  const mandada = await linhaDaOrdem();
  afirmar(mandada.da === 'stone' && mandada.quantidade === '2', `a feira deveria ter a ordem pedra x2, veio ${JSON.stringify(mandada)}`);
  await capturar('ordem-mandada');

  // 4. a pedra do armazem chega e a feira troca
  let cumprida = mandada;
  for (let i = 0; i < 40 && cumprida.feitas !== '2'; i += 1) {
    await page.evaluate(() => window.__cangaco.avancar(50));
    await esperarFrame();
    cumprida = await linhaDaOrdem();
  }
  afirmar(cumprida.feitas === '2', `a feira deveria fechar as 2 trocas, fez ${cumprida.feitas}`);

  // 5. cancelar, de novo andando
  await page.keyboard.press('p');
  await apertar('cancelar');
  await page.keyboard.press('p');
  await esperarFrame();
  const motivo = await page.getAttribute('#painel-predio .feira-nao-troca', 'data-motivo');
  afirmar(motivo === 'sem-ordem', `cancelada, a feira deveria dizer sem-ordem, veio ${motivo}`);
  const texto = (await page.textContent('#painel-predio .feira-nao-troca')) ?? '';
  afirmar(texto === tema.painelPredio.feiraSemOrdem, `o texto deveria ser "${tema.painelPredio.feiraSemOrdem}", veio "${texto}"`);

  console.log(`C-TELA-05: ${JSON.stringify({ montado, mandada, cumprida, cancelada: motivo })}`);
}

module.exports = { roteiro };
