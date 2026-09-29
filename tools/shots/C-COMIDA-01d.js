'use strict';
// Roteiro da C-COMIDA-01d + 01f — O PAINEL DO GRUPO COM O ALIMENTAR, E O ALERTA DE TROPA
// COM FOME NO HUD.
//
// Carrega a partida que `tests/C-COMIDA-01d-painel-do-grupo.test.ts` grava: a vila e tres
// cabras do jogador a 30 % (abaixo do alerta de 35 % e do pedido de 55 %). Pelo mouse:
//   1. caixa em volta dos tres: o corpo da aba vira o painel do grupo, com a condicao a
//      30 % e o marcador aceso; o alerta "tropa com fome" diz 3  -> captura 1;
//   2. DESPAUSADO, Alimentar com mouse.down / 150 ms / mouse.up (§8: o laco redesenha entre
//      o aperto e a soltura); espera um serf sair com comida  -> pausa, captura 2;
//   3. despausa ate os tres comerem: o painel volta a ~100 %, "esperando" some, o alerta
//      some  -> captura 3;
//   4. despausado, Alimentar de novo: "Ninguem com fome".
// O px sai do debug (`unidadesRenderizadas`), nunca de pixel da captura.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts
const SOLDADOS = ['cabra1', 'cabra2', 'cabra3'];

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/C-COMIDA-01d.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  afirmar(SOLDADOS.every((id) => s.unidadesRenderizadas.some((u) => u.id === id)), 'a partida deveria ter as tres cabras desenhadas');

  const c1 = s.unidadesRenderizadas.find((u) => u.id === 'cabra2');
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
  await centrarNoEixo(c1.gx, 'x');
  await centrarNoEixo(c1.gy - 3, 'y');

  async function pontoDaUnidade(id) {
    const agora = await estado();
    const u = agora.unidadesRenderizadas.find((x) => x.id === id);
    return {
      x: canvas.left + u.gxDesenhado * TILE_PX + TILE_PX / 2 + u.deslocamentoPx.x - agora.camera.scrollX,
      y: canvas.top + u.gyDesenhado * TILE_PX + TILE_PX / 2 + u.deslocamentoPx.y - agora.camera.scrollY,
    };
  }
  async function apertarBotao(seletor) {
    const caixa = await page.locator(seletor).boundingBox();
    afirmar(caixa !== null, `${seletor} deveria estar visivel`);
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await esperarFrame();
  }
  const texto = (seletor) => page.$eval(seletor, (n) => (n.hidden ? null : n.textContent));
  const visivel = (seletor) => page.$eval(seletor, (n) => !n.hidden && n.offsetParent !== null);

  // 1. a caixa em volta dos tres
  const pontos = await Promise.all(SOLDADOS.map((id) => pontoDaUnidade(id)));
  const a = { x: Math.min(...pontos.map((p) => p.x)) - TILE_PX, y: Math.min(...pontos.map((p) => p.y)) - TILE_PX };
  const b = { x: Math.max(...pontos.map((p) => p.x)) + TILE_PX, y: Math.max(...pontos.map((p) => p.y)) + TILE_PX };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  afirmar(s.selecaoMilitar.length === 3, `a caixa deveria pegar as tres cabras, veio ${JSON.stringify(s.selecaoMilitar)}`);
  afirmar(await page.$eval('body', (b) => b.dataset.corpo) === 'grupo', 'o corpo da aba deveria ser o painel do grupo');
  afirmar(await visivel('#painel-grupo [data-acao="alimentar"]'), 'o botao Alimentar deveria estar visivel');
  const condicaoAntes = await texto('#painel-grupo [data-grupo="condicao"]');
  afirmar(/30%/.test(condicaoAntes), `a condicao do grupo deveria ser 30 %, veio ${condicaoAntes}`);
  afirmar(SOLDADOS.every((id) => s.unidadesRenderizadas.find((u) => u.id === id).marcadorDeFome), 'as tres deveriam ter o marcador de fome aceso');
  const alertaAntes = await texto('#alertas [data-alerta="tropa-com-fome"] .contagem');
  afirmar(alertaAntes === '3', `o alerta de tropa com fome deveria dizer 3, veio ${alertaAntes}`);
  await capturar('grupo-com-fome');

  // 2. despausado, Alimentar, ate um serf sair com comida
  await page.keyboard.press('p');
  await apertarBotao('#painel-grupo [data-acao="alimentar"]');
  let aCaminho = false;
  for (let i = 0; i < 80 && !aCaminho; i += 1) {
    await page.waitForTimeout(100);
    const agora = await estado();
    aCaminho = agora.unidadesRenderizadas.some((u) => u.tipo === 'serf' && (u.carga === 'loaves' || u.carga === 'sausages') && u.fsm === 'indo_entregar');
  }
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(aCaminho, 'um serf deveria sair do armazem com comida para a tropa');
  // BUG-O: a etiqueta da carga e o nome do tema, nunca o id da sim
  const comComida = (await estado()).unidadesRenderizadas.filter((u) => u.tipo === 'serf' && u.carga === 'loaves');
  afirmar(comComida.length > 0 && comComida.every((u) => u.rotuloDaCarga === 'Cuscuz'),
    `a carga de pao deveria aparecer como "Cuscuz", veio ${JSON.stringify(comComida.map((u) => u.rotuloDaCarga))}`);
  const esperando = await texto('#painel-grupo [data-grupo="esperando"]');
  afirmar(esperando !== null && /esperando/.test(esperando), `o painel deveria dizer quantos esperam comida, veio ${esperando}`);
  await capturar('pao-a-caminho');

  // 3. despausado ate os tres comerem
  await page.keyboard.press('p');
  let cheios = false;
  for (let i = 0; i < 120 && !cheios; i += 1) {
    await page.waitForTimeout(250);
    const agora = await estado();
    cheios = SOLDADOS.every((id) => !agora.unidadesRenderizadas.find((u) => u.id === id).marcadorDeFome)
      && (await texto('#painel-grupo [data-grupo="esperando"]')) === null;
  }
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(cheios, 'as tres cabras deveriam comer: marcador apagado e ninguem esperando');
  const condicaoDepois = await texto('#painel-grupo [data-grupo="condicao"]');
  afirmar(/(99|100)%/.test(condicaoDepois), `a condicao do grupo deveria voltar a ~100 %, veio ${condicaoDepois}`);
  afirmar(await page.$eval('#alertas [data-alerta="tropa-com-fome"]', (n) => n.hidden), 'o alerta de tropa com fome deveria sumir');
  await capturar('grupo-cheio');

  // 4. despausado, Alimentar de novo: ninguem com fome
  await page.keyboard.press('p');
  await apertarBotao('#painel-grupo [data-acao="alimentar"]');
  await page.waitForTimeout(400);
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(await visivel('#painel-grupo [data-grupo="ninguem-com-fome"]'), 'o segundo Alimentar deveria dizer "Ninguem com fome"');
  s = await estado();
  console.log(`C-COMIDA-01d: antes "${condicaoAntes}", depois "${condicaoDepois}", tick ${s.tick}`);
}

module.exports = { roteiro };
