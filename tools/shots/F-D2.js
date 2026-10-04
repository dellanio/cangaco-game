'use strict';

// Roteiro da F-D2 — A CAMERA ANDA COM O TECLADO, E O `Espaco` ARRASTA.
//
// O teste headless prova a aritmetica (aceleracao, teto, diagonal, foco
// perdido). O que so existe aqui e a cena consumindo aquilo: seta apertada vira
// `scrollX`, o clamp da F04 continua segurando as quatro bordas, e o `Espaco`
// com planta na mao anda com o mapa SEM plantar nada.
//
// CLAUDE.md §8: o passo do `Espaco` roda DESPAUSADO, e nao por formalidade —
// com o jogo pausado o comando de construir ficaria na fila e o prédio nao
// nasceria de todo jeito. O passo verde nao provaria nada.

const { retanguloDoCanvas } = require('./_canvas');
const terrain = require('../../data/terrain.json');

const DADOS = terrain.camera;
const LARGURA_PX = terrain.mapaPadrao.largura * terrain.tile_px;
const ALTURA_PX = terrain.mapaPadrao.altura * terrain.tile_px;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);

  /** Segura a tecla por `ms` e devolve o quanto a camera andou. */
  const segurar = async (tecla, ms) => {
    const antes = (await estado()).camera;
    await page.keyboard.down(tecla);
    await page.waitForTimeout(ms);
    const durante = (await estado()).navegacao;
    await page.keyboard.up(tecla);
    await esperarFrame();
    const depois = (await estado()).camera;
    return {
      dx: depois.scrollX - antes.scrollX,
      dy: depois.scrollY - antes.scrollY,
      velocidade: durante.velocidade,
      depois,
    };
  };

  const canvas = await retanguloDoCanvas(page);

  // ---- 1. cada seta anda para o lado dela ----------------------------------
  const direita = await segurar('ArrowRight', 300);
  afirmar(direita.dx > 0, `a seta direita deveria aumentar o scrollX, veio ${direita.dx}`);
  afirmar(Math.abs(direita.dy) < 1, `a seta direita mexeu no Y: ${direita.dy}`);

  const baixo = await segurar('ArrowDown', 300);
  afirmar(baixo.dy > 0, `a seta para baixo deveria aumentar o scrollY, veio ${baixo.dy}`);
  afirmar(Math.abs(baixo.dx) < 1, `a seta para baixo mexeu no X: ${baixo.dx}`);

  const esquerda = await segurar('ArrowLeft', 300);
  afirmar(esquerda.dx < 0, `a seta esquerda deveria diminuir o scrollX, veio ${esquerda.dx}`);

  const cima = await segurar('ArrowUp', 300);
  afirmar(cima.dy < 0, `a seta para cima deveria diminuir o scrollY, veio ${cima.dy}`);

  // `WASD` e sinonimo, e a tela de ajuda promete isso numa linha so.
  const comD = await segurar('d', 300);
  afirmar(comD.dx > 0, `a tecla D deveria andar como a seta direita, veio ${comD.dx}`);

  // ---- 2. segurar acelera, e para no teto do DADO --------------------------
  // BUG-ROTEIRO-F-D2-RELOGIO (§8): a aceleracao se afirma pelos QUADROS, nao pelos pixels andados
  // num tempo de parede. A versao antiga comparava 1,2 s segurando com 4 toques de 300 ms, e com a
  // maquina carregada o navegador entrega menos quadros e a conta virava. Aqui o roteiro espera,
  // quadro a quadro, a velocidade publicada passar da inicial e depois crescer de novo (ou chegar ao
  // teto); soltar volta exatamente a inicial, e e isso que faz o toque curto andar sempre o mesmo
  // passo. Nenhum limiar depende de quantos quadros couberam num intervalo.
  const velocidade = async () => (await estado()).navegacao.velocidade;
  const inicial = DADOS.velocidadeInicialPxPorSegundo;
  afirmar((await velocidade()) === inicial, `parado, a velocidade deveria ser a inicial do dado (${inicial})`);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((v) => window.__cangaco.navegacao.velocidade > v, inicial, { timeout: 15_000 });
  const v1 = await velocidade();
  await page.waitForFunction(([v, teto]) => window.__cangaco.navegacao.velocidade > v || window.__cangaco.navegacao.velocidade >= teto,
    [v1, DADOS.tetoPxPorSegundo], { timeout: 15_000 });
  const v2 = await velocidade();
  await page.keyboard.up('ArrowRight');
  await esperarFrame();
  await page.waitForFunction((v) => window.__cangaco.navegacao.velocidade === v, inicial, { timeout: 15_000 });
  afirmar(v1 > inicial, `segurar deveria acelerar: ${v1} contra a inicial ${inicial}`);
  afirmar(v2 > v1 || v2 === DADOS.tetoPxPorSegundo, `segurando, a velocidade deveria continuar crescendo ate o teto: ${v1} -> ${v2}`);
  afirmar(v2 <= DADOS.tetoPxPorSegundo, `a velocidade (${v2}) passou do teto do dado (${DADOS.tetoPxPorSegundo})`);
  // o teto de verdade: segurando mais, a velocidade chega a ele e para la
  await page.keyboard.down('ArrowLeft');
  await page.waitForFunction((teto) => window.__cangaco.navegacao.velocidade >= teto, DADOS.tetoPxPorSegundo, { timeout: 30_000 });
  const noTeto = await velocidade();
  await page.keyboard.up('ArrowLeft');
  await esperarFrame();
  afirmar(noTeto === DADOS.tetoPxPorSegundo, `segurando, a velocidade deveria parar no teto do dado: ${noTeto}`);
  console.log(`F-D2: velocidade ${inicial} -> ${v1.toFixed(0)} -> ${v2.toFixed(0)} -> teto ${noTeto}; solta, volta a ${inicial}`);

  // ---- 3. o clamp da F04 nas quatro bordas ---------------------------------
  // Esquerda e topo primeiro: a vila abre perto deles, entao sao baratos.
  await segurar('ArrowLeft', 4000);
  await segurar('ArrowUp', 4000);
  const noCanto = (await estado()).camera;
  afirmar(noCanto.scrollX === 0, `a borda esquerda deveria travar em 0, veio ${noCanto.scrollX}`);
  afirmar(noCanto.scrollY === 0, `a borda de cima deveria travar em 0, veio ${noCanto.scrollY}`);
  await capturar('canto-noroeste');

  // Direita e baixo: o mapa tem 8192px de lado, entao a travessia e longa de
  // proposito — e ela tambem prova que a aceleracao chega ao teto de verdade.
  await segurar('ArrowRight', 9000);
  await segurar('ArrowDown', 9000);
  const noFim = (await estado()).camera;
  const maxX = LARGURA_PX - canvas.width / noFim.zoom;
  const maxY = ALTURA_PX - canvas.height / noFim.zoom;
  afirmar(
    Math.abs(noFim.scrollX - maxX) < 1,
    `a borda direita deveria travar em ${maxX.toFixed(1)}, veio ${noFim.scrollX.toFixed(1)}`,
  );
  afirmar(
    Math.abs(noFim.scrollY - maxY) < 1,
    `a borda de baixo deveria travar em ${maxY.toFixed(1)}, veio ${noFim.scrollY.toFixed(1)}`,
  );

  // Volta para perto da vila para o resto do roteiro ter mapa dos dois lados.
  await segurar('ArrowLeft', 4000);
  await segurar('ArrowUp', 4000);

  // ---- 4. o `Espaco` arrasta COM PLANTA NA MAO, e nao planta ---------------
  // Despausado (CLAUDE.md §8): com o jogo parado o comando de construir ficaria
  // na fila sem ser aplicado, e o passo passaria mesmo com o gesto quebrado.
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo do arrasto precisa rodar com o laco ANDANDO');

  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  afirmar(
    await page.getAttribute('[data-predio="quarry"]', 'aria-pressed') === 'true',
    'a pedreira deveria estar na mao antes do arrasto',
  );

  const antesDoArrasto = await estado();
  const prediosAntes = Object.keys(antesDoArrasto.prediosDoEstado).length;
  const centroX = canvas.left + Math.floor(canvas.width / 2);
  const centroY = canvas.top + Math.floor(canvas.height / 2);

  await page.keyboard.down(' ');
  await esperarFrame();
  afirmar((await estado()).navegacao.espacoApertado === true, 'o Espaco segurado deveria ser publicado');
  // `#jogo canvas`, nao `canvas`: desde a D-TELA-02 o primeiro canvas da pagina e o do
  // minimapa (cursor `pointer`), e o roteiro lia o cursor dele.
  const cursorComEspaco = await page.$eval('#jogo canvas', (el) => getComputedStyle(el).cursor);
  afirmar(
    cursorComEspaco === 'grab' || cursorComEspaco === 'grabbing',
    `com o Espaco segurado o cursor deveria avisar que da para arrastar, veio "${cursorComEspaco}"`,
  );

  await page.mouse.move(centroX, centroY);
  await page.mouse.down();
  await page.mouse.move(centroX - 250, centroY - 180, { steps: 10 });
  await capturar('espaco-arrastando');
  await page.mouse.up();
  await page.keyboard.up(' ');
  await esperarFrame();

  const depoisDoArrasto = await estado();
  afirmar(
    depoisDoArrasto.camera.scrollX > antesDoArrasto.camera.scrollX
      && depoisDoArrasto.camera.scrollY > antesDoArrasto.camera.scrollY,
    'arrastar com o Espaco deveria mover a camera: '
      + `${JSON.stringify(antesDoArrasto.camera)} -> ${JSON.stringify(depoisDoArrasto.camera)}`,
  );
  const prediosDepois = Object.keys(depoisDoArrasto.prediosDoEstado).length;
  afirmar(
    prediosDepois === prediosAntes,
    `o arrasto com Espaco plantou ${prediosDepois - prediosAntes} predio(s): `
      + 'a camera nao pode depender da mao estar vazia',
  );
  afirmar(
    await page.getAttribute('[data-predio="quarry"]', 'aria-pressed') === 'true',
    'e a planta deveria continuar na mao depois do arrasto',
  );

  // ---- 5. `Espaco` sem arrastar nao rola a pagina nem aperta o botao -------
  await page.focus('[data-predio="woodcutters"]');
  const pressedAntes = await page.getAttribute('[data-predio="woodcutters"]', 'aria-pressed');
  await page.keyboard.press(' ');
  await esperarFrame();
  afirmar(
    await page.getAttribute('[data-predio="woodcutters"]', 'aria-pressed') === pressedAntes,
    'o Espaco disparou o botao com foco: o preventDefault nao esta acontecendo',
  );
  afirmar(
    await page.evaluate(() => window.scrollY) === 0,
    'o Espaco rolou a pagina',
  );
  afirmar(
    (await estado()).navegacao.espacoApertado === false,
    'soltar o Espaco deveria desarmar o arrasto',
  );

  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro deveria terminar pausado');
}

module.exports = { roteiro };
