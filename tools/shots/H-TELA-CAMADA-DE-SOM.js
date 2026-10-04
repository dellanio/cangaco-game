'use strict';
// Roteiro da H-TELA-CAMADA-DE-SOM — o render toca os eventos da sim.
//   (c) a partida andando (despausada, §8): zero erro de console (o runner reprova qualquer um) e o
//       contador de sons pedidos (`window.__cangacoSom`) maior que zero.
// O pedido vem do gesto do jogador: a planta posicionada pede o som seco no quadro do clique, e a
// recusa (se o tile nao servir) pede o dela no passo seguinte.
// Desde a H-ARTE-SONS-APROVADOS a planta TEM arquivo e a recusa NAO (o operador deixou a linha em
// branco): o roteiro afirma os dois lados. O som com arquivo toca e o arquivo dele e pedido; o som
// sem arquivo e silencio, sem requisicao e sem erro. O "todo som faltando" inteiro e o teste
// headless (`criarCamadaDeSom` com `disponiveis` vazio).
const manifesto = require('../../assets/manifest.json');
const { retanguloDoCanvas } = require('./_canvas');

async function roteiro({ page, capturar, afirmar }) {
  const base = page.url().split('?')[0];
  // a requisicao de midia nao entra no Resource Timing do Chromium: escuta-se a rede direto
  const pedidosDeAudio = [];
  page.on('request', (r) => { if (/\.(ogg|mp3|wav)(\?|$)/.test(r.url())) pedidosDeAudio.push(r.url()); });
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
  const comArquivo = (id) => manifesto.sons[id] !== undefined;
  afirmar(comArquivo('blueprint-placed') && !comArquivo('command-rejected'), 'premissa: a planta tem arquivo, a recusa nao');
  afirmar(depois.tocados === (depois.porId['blueprint-placed'] ?? 0), `toca so o que tem arquivo (a planta): ${JSON.stringify(depois)}`);
  afirmar(depois.emSilencio === (depois.porId['command-rejected'] ?? 0), `o que nao tem arquivo e silencio (a recusa): ${JSON.stringify(depois)}`);
  const audios = [...pedidosDeAudio];
  afirmar(audios.some((n) => n.includes('blueprint-placed')), `o arquivo da planta deveria ser pedido: ${JSON.stringify(audios)}`);
  afirmar(!audios.some((n) => n.includes('command-rejected')), `sem arquivo, a recusa nao pede nada: ${JSON.stringify(audios)}`);
  console.log(`[H-TELA-CAMADA-DE-SOM] contadores: ${JSON.stringify(depois)}`);
  await capturar('partida-andando-sem-som');
}

module.exports = { roteiro };
