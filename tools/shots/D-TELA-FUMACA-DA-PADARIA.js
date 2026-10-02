'use strict';
const config = require('../../data/fumaca.json');
const { retanguloDoCanvas, pontoDoTileNaTela, pontoParaApertar } = require('./_canvas');

async function roteiro({ page, estado, afirmar, capturar }) {
  const frame = () => page.waitForTimeout(100);
  await page.evaluate(async () => {
    const texto = await (await window.fetch('/saves/teste-operador-vila-pronta.txt')).text();
    window.localStorage.setItem('cangaco:partida', texto);
  });
  await page.keyboard.press('h');
  await frame();
  await page.click('#ajuda [data-acao="carregar"]');
  await frame();
  await page.keyboard.press('Escape');
  await frame();
  const canvas = await retanguloDoCanvas(page);
  const padaria = (await estado()).prediosDoEstado.padaria;
  afirmar(padaria?.tipo === 'bakery', 'O save precisa conter a padaria.');
  await page.evaluate((camera) => window.__cangaco.fixarCamera(camera), {
    scrollX: (padaria.gx + 1.5) * 64 - canvas.width / 2,
    scrollY: (padaria.gy + 0.5) * 64 - canvas.height / 2, zoom: 1,
  });
  await frame();
  let s = await estado();
  let avancados = 0;
  const amostras = [];
  // O save nasce sem farinha. Espera a cadeia milho -> moinho -> padaria;
  // os 2 000 ticks do save sao o aceite de armas, nao o da cadeia de alimento.
  while (!(s.quadrosDeTrabalho.padaria && s.fumacaPorPredio.padaria?.length >= 12) && avancados < 6000) {
    const passo = s.quadrosDeTrabalho.padaria ? 2 : 10;
    await page.evaluate((n) => window.__cangaco.avancar(n), passo);
    avancados += passo;
    await frame();
    s = await estado();
    if (avancados % 100 === 0) amostras.push({ tick: s.tick, quadro: s.quadrosDeTrabalho.padaria,
      fumaca: s.fumacaPorPredio.padaria?.length,
      forneiro: s.unidadesRenderizadas.find((u) => u.id === 'forneiro')?.fsm });
  }
  if (!s.quadrosDeTrabalho.padaria) console.log(JSON.stringify({ avancados, padaria: s.prediosDoEstado.padaria, amostras }));
  afirmar(Boolean(s.quadrosDeTrabalho.padaria), 'A padaria precisa estar trabalhando.');
  afirmar(s.fumacaPorPredio.padaria?.length > 0, 'A padaria trabalhando precisa mostrar fumaca.');
  const quantidadeTrabalhando = s.fumacaPorPredio.padaria.length;
  const pool = s.poolDaFumaca;
  await capturar('trabalhando-com-fumaca');
  const ponto = pontoDoTileNaTela(canvas, { gx: padaria.gx + 1, gy: padaria.gy + 1 }, s.camera, 64);
  await page.mouse.click(ponto.x, ponto.y);
  await frame();
  afirmar(await page.getAttribute('#painel-predio', 'data-predio-aberto') === 'padaria', 'O painel precisa ser o da padaria.');
  const botao = await pontoParaApertar(page, '#painel-predio [data-pausar="true"]');
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'O gesto do painel precisa estar despausado (§8).');
  await page.mouse.move(botao.x, botao.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await frame();
  await page.keyboard.press('p');
  await frame();
  s = await estado();
  afirmar(s.pausado && s.prediosDoEstado.padaria.pausado, 'O painel precisa pausar a padaria.');
  afirmar(s.fumacaPorPredio.padaria?.length > 0, 'A pausa deve deixar a fumaca antiga se desfazer.');
  await page.keyboard.press('Escape');
  await page.evaluate((n) => window.__cangaco.avancar(n), config.vidaTicks);
  await frame();
  s = await estado();
  afirmar(s.fumacaPorPredio.padaria?.length === 0, 'Depois de vidaTicks a fumaca precisa chegar a zero.');
  afirmar(s.poolDaFumaca === pool, 'O pool nao deve criar nem destruir objetos durante a animacao.');
  await page.mouse.move(canvas.left + 5, canvas.top + 5);
  await frame();
  await capturar('pausada-sem-fumaca');
  console.log(`fumaca: trabalho ${quantidadeTrabalhando}, pausa 0; pool proprio ${pool}; espera ${avancados} ticks; avancou ${config.vidaTicks} ticks apos a pausa`);
}

module.exports = { roteiro };
