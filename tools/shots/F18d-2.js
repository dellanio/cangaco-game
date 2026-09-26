'use strict';

// Roteiro do aceite da F18d-2. Afirma ESTADO e MEDICAO, nao pixel.
//
// A ordem que a F18d-1b instalou, vista da tela, no MESMO cenario:
//   o arrasto DESENHA (canteiro sobe, pedra intacta) -> o laborer assenta (de pe
//   sobe, canteiro desce) -> a pedra cai, uma vez so, pelo traçado inteiro.
//
// Desde a F18g (BUG-I, 2026-09-26) a pedra de cada tile sai do armazem na COLETA do
// serf, nao no assentamento: ela viaja, fica parada no tile e o laborer a consome.
// A conta do meio afirma essa regra — a pedra que saiu e a de pe, mais a parada no
// canteiro, mais a que esta na mao de serf — e que ela ja saiu ANTES de assentar.
//
// A soma `de pe + planejados` e afirmada em TODO passo: e ela que impede um tile
// de sumir entre os dois conjuntos sem ninguem notar. E a captura do passo 3 e o
// que o aceite pede — os dois estados na mesma tela, com a rua meio erguida.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { erguerRua } = require('./_estradas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const BLOCO_CURTO = 5;
const TETO_DO_MEIO = 200;
const defDe = (id) => predios.find((p) => p.id === id);

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);

  const esperarFrame = () => page.waitForTimeout(200); // window.__cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const pedraDoHud = () => page.textContent('#hud .valor[data-campo="stone"]');

  async function pontoDoTile(tile) {
    const { camera } = await estado();
    const x = canvas.left + tile.gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + tile.gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${tile.gx},${tile.gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  /** Os dois contadores do mesmo quadro, com a soma conferida contra o traçado. */
  async function contagem(quando, total) {
    const s = await estado();
    afirmar(
      s.estradasRenderizadas + s.estradasPlanejadasRenderizadas === total,
      `${quando}: de pe (${s.estradasRenderizadas}) + planejados `
      + `(${s.estradasPlanejadasRenderizadas}) deveria fechar em ${total}`,
    );
    return { dePe: s.estradasRenderizadas, planejados: s.estradasPlanejadasRenderizadas, tick: s.tick };
  }

  const custoPorTile = terreno.estrada.custoStonePorTile;
  const pedraInicial = economia.estadoInicial.estoque.stone;

  // a mesma geometria do F08: o L ao longo da borda sul do armazem, tirado dos JSON
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const escola = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
  const [, alturaDoArmazem] = defDe('storehouse').tamanho;
  const yRua = armazem.gy + alturaDoArmazem;
  const inicio = { gx: armazem.gx, gy: yRua };
  const canto = { gx: escola.gx + 1, gy: yRua };
  const ponta = { gx: canto.gx, gy: yRua + 2 };
  const totalDeTiles = (canto.gx - inicio.gx + 1) + (ponta.gy - canto.gy);

  // 0. abertura: nem rua nem canteiro
  const abertura = await contagem('na abertura', 0);
  afirmar(abertura.dePe === 0 && abertura.planejados === 0, 'a abertura nao deveria ter estrada nenhuma');
  const pedraAntes = await pedraDoHud();
  afirmar(pedraAntes === String(pedraInicial), `a Pedra inicial deveria ser ${pedraInicial}, veio ${pedraAntes}`);

  // 1. arrastar e soltar: o comando DESENHA o traçado inteiro e nao gasta pedra
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pontos = [await pontoDoTile(inicio), await pontoDoTile(canto), await pontoDoTile(ponta)];
  await arrastarDentroDoCanvas(page, canvas, pontos, { soltar: false });
  await esperarFrame();
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();

  const desenhada = await contagem('no tick do comando', totalDeTiles);
  afirmar(
    desenhada.planejados === totalDeTiles && desenhada.dePe === 0,
    `soltar deveria DESENHAR ${totalDeTiles} tiles e erguer 0, veio ${desenhada.planejados} e ${desenhada.dePe}`,
  );
  afirmar(
    (await pedraDoHud()) === String(pedraInicial),
    `o comando nao gasta: a Pedra deveria seguir em ${pedraInicial}, veio ${await pedraDoHud()}`,
  );
  await capturar('canteiro-desenhado');

  // 2. o laborer comeca a assentar: existe um quadro com OS DOIS estados na tela
  let meio = desenhada;
  let gastos = 0;
  while (meio.dePe === 0 && gastos < TETO_DO_MEIO) {
    await avancar(BLOCO_CURTO);
    gastos += BLOCO_CURTO;
    await esperarFrame();
    meio = await contagem('assentando', totalDeTiles);
  }
  afirmar(
    meio.dePe > 0 && meio.planejados > 0,
    `deveria haver um quadro com os dois estados na tela; no tick ${meio.tick} veio `
    + `${meio.dePe} de pe e ${meio.planejados} planejados`,
  );
  const pedraNoMeio = Number(await pedraDoHud());
  const quadro = await estado();
  const noCanteiro = quadro.pedraNoCanteiroNoEstado;
  const naMao = quadro.unidadesRenderizadas.filter((u) => u.carga === 'stone').length;
  const saiu = meio.dePe * custoPorTile + noCanteiro + naMao;
  // neste cenario so a rua gasta pedra: toda pedra que falta no armazem esta numa das tres
  afirmar(
    pedraNoMeio === pedraInicial - saiu,
    `a pedra que saiu deveria ser a de pe + a parada no canteiro + a na mao de serf `
    + `(${meio.dePe} x ${custoPorTile} + ${noCanteiro} + ${naMao} = ${saiu}), `
    + `veio ${pedraInicial} - ${pedraNoMeio} = ${pedraInicial - pedraNoMeio}`,
  );
  // a regra da F18g, e nao so a conta: a pedra sai na coleta, antes de o tile subir
  afirmar(
    pedraNoMeio < pedraInicial - meio.dePe * custoPorTile,
    `a pedra deveria ter saido do armazem antes de assentar (F18g): com ${meio.dePe} de pe `
    + `veio ${pedraNoMeio}, que e so o assentado`,
  );
  await capturar('metade-erguida');

  // 3. a rua inteira de pe: canteiro vazio e a pedra caiu uma vez, pelo traçado inteiro
  const { ticks } = await erguerRua(ctx, { tiles: totalDeTiles });
  const fim = await contagem('com a rua de pe', totalDeTiles);
  afirmar(fim.dePe === totalDeTiles && fim.planejados === 0, 'no fim tudo deveria estar de pe');
  const pedraEsperada = pedraInicial - totalDeTiles * custoPorTile;
  afirmar(
    (await pedraDoHud()) === String(pedraEsperada),
    `a Pedra deveria cair de ${pedraInicial} para ${pedraEsperada} `
    + `(${totalDeTiles} x ${custoPorTile}), veio ${await pedraDoHud()}`,
  );
  afirmar(ticks > 0, 'erguer a rua deveria ter custado tempo de laborer, nao zero tick');
  await capturar('rua-de-pe');
}

module.exports = { roteiro };
