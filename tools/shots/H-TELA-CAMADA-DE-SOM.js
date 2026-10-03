'use strict';
// Roteiro da H-TELA-CAMADA-DE-SOM — o render toca os eventos da sim, com TODO som faltando.
//   (c) a partida andando (despausada, §8) e nenhum arquivo de som: zero erro de console (o runner
//       reprova qualquer um) e o contador de sons pedidos (`window.__cangacoSom`) maior que zero.
// O pedido vem do gesto do jogador: a planta posicionada pede o som seco no quadro do clique, e a
// recusa (se o tile nao servir) pede o dela no passo seguinte. Nenhuma requisicao de audio sai da
// pagina: sem arquivo, o tocador nunca cria um `Audio`.
const { retanguloDoCanvas } = require('./_canvas');

async function roteiro({ page, capturar, afirmar }) {
  const base = page.url().split('?')[0];
  await page.goto(`${base}?pausado`);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto && window.__cangacoSom));
  const contadores = () => page.evaluate(() => window.__cangacoSom.contadores());

  const antes = await contadores();
  afirmar(antes.pedidos === 0, `no tick 0, pausado, nenhum som deveria ter sido pedido: ${JSON.stringify(antes)}`);

  // a planta na mao, e o jogo correndo
  await page.click('[data-predio="quarry"]');
  await page.waitForTimeout(200);
  await page.keyboard.press('p');
  const canvas = await retanguloDoCanvas(page);
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(1500);
  await page.keyboard.press('p');
  await page.waitForTimeout(200);

  const depois = await contadores();
  afirmar(depois.pedidos > 0, `com a planta posicionada, o contador de sons pedidos deveria passar de 0: ${JSON.stringify(depois)}`);
  afirmar((depois.porId['blueprint-placed'] ?? 0) >= 1, `a planta deveria pedir 'blueprint-placed': ${JSON.stringify(depois.porId)}`);
  afirmar(depois.tocados === 0 && depois.emSilencio === depois.pedidos, `sem arquivo, todo pedido e silencio: ${JSON.stringify(depois)}`);
  const audios = await page.evaluate(() => window.performance.getEntriesByType('resource')
    .filter((r) => /\.(ogg|mp3|wav)(\?|$)/.test(r.name)).length);
  afirmar(audios === 0, `sem arquivo, nenhuma requisicao de audio deveria sair, sairam ${audios}`);
  console.log(`[H-TELA-CAMADA-DE-SOM] contadores: ${JSON.stringify(depois)}`);
  await capturar('partida-andando-sem-som');
}

module.exports = { roteiro };
