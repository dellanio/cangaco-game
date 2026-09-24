'use strict';

// Roteiro da F18e — A ESTRADA EM DIAGONAL.
//
// O aceite pede "screenshot de uma estrada em diagonal desenhada por arrasto".
// A imagem sozinha nao prova nada, entao o roteiro afirma o NUMERO que separa a
// rua nova da antiga: um arrasto de `n` tiles em 45 graus publica `n + 1` tiles
// na previa. Ate a F18d o mesmo gesto subia escadinha ortogonal e publicaria
// `2n + 1` — a conta esta escrita abaixo e comparada, para a asserção reprovar
// se a interpolacao voltar a ser 4-conectada.
//
// Como sempre: afirma o que a cena publica em window.__cangaco e o texto do HUD,
// nunca pixel. O custo por tile vem de `data/terrain.json`.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { erguerRua } = require('./_estradas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
/** Passos do arrasto em 45 graus. 4 passos = 5 tiles; a escada antiga daria 9. */
const PASSOS = 4;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const pedra = () => page.textContent('#hud .valor[data-campo="stone"]');

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

  // A diagonal nasce a sudoeste do armazem, em chao livre, e desce para sudeste:
  // passa rente ao canto do predio sem encostar no footprint, e cabe no quadro da
  // abertura (o `pontoDoTile` reprova se sair do canvas).
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const inicio = { gx: armazem.gx - 3, gy: armazem.gy + 1 };
  const fim = { gx: inicio.gx + PASSOS, gy: inicio.gy + PASSOS };
  const custoPorTile = terreno.estrada.custoStonePorTile;
  const tilesDaDiagonal = PASSOS + 1;          // 8-conectada (F18e)
  const tilesDaEscadaAntiga = 2 * PASSOS + 1;  // 4-conectada (F08)

  // ---- 0. ponto de partida --------------------------------------------------
  const abertura = await estado();
  afirmar(
    abertura.estradasRenderizadas === 0 && abertura.estradasPlanejadasRenderizadas === 0,
    `no inicio nao deveria haver estrada nem canteiro, veio ${abertura.estradasRenderizadas} `
      + `e ${abertura.estradasPlanejadasRenderizadas}`,
  );
  const pedraInicial = Number(await pedra());

  // ---- 1. arrastar em 45 graus: a previa tem a conta da DIAGONAL -----------
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pInicio = await pontoDoTile(inicio);
  const pFim = await pontoDoTile(fim);
  await arrastarDentroDoCanvas(page, canvas, [pInicio, pFim], { soltar: false });
  await esperarFrame();
  let s = await estado();
  afirmar(
    s.previaDeEstrada !== null && s.previaDeEstrada.tiles === tilesDaDiagonal,
    `o arrasto de (${inicio.gx},${inicio.gy}) a (${fim.gx},${fim.gy}) deveria pedir `
      + `${tilesDaDiagonal} tiles (diagonal), veio ${JSON.stringify(s.previaDeEstrada)}`,
  );
  afirmar(
    s.previaDeEstrada.tiles < tilesDaEscadaAntiga,
    `a escadinha 4-conectada da F08 pediria ${tilesDaEscadaAntiga} tiles para o mesmo gesto; `
      + `a previa veio com ${s.previaDeEstrada.tiles} — se voltar a ${tilesDaEscadaAntiga}, a `
      + 'interpolacao do arrasto regrediu',
  );
  afirmar(
    s.previaDeEstrada.valida === true
      && s.previaDeEstrada.custo === tilesDaDiagonal * custoPorTile,
    `a previa deveria ser valida e custar ${tilesDaDiagonal * custoPorTile}, veio `
      + JSON.stringify(s.previaDeEstrada),
  );
  await capturar('previa-diagonal');

  // ---- 2. soltar: o traçado diagonal e DESENHADO; o laborer o ergue ---------
  //       A ponte de canto (F18e) e o desenho de "ha passagem": ela so aparece na rua
  //       de pe. O canteiro nao a ganha, entao a captura do fim e a que a mostra.
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(
    s.estradasPlanejadasRenderizadas === tilesDaDiagonal && s.estradasRenderizadas === 0,
    `soltar deveria desenhar ${tilesDaDiagonal} tiles em diagonal e erguer 0, veio `
      + `${s.estradasPlanejadasRenderizadas} e ${s.estradasRenderizadas}`,
  );
  afirmar(s.previaDeEstrada === null, 'depois de soltar a previa some');
  afirmar(
    Number(await pedra()) === pedraInicial,
    `o comando reserva, nao gasta: a Pedra deveria seguir em ${pedraInicial}, veio ${await pedra()}`,
  );

  await erguerRua(ctx, { tiles: tilesDaDiagonal });
  s = await estado();
  afirmar(
    s.estradasRenderizadas === tilesDaDiagonal,
    `deveriam existir ${tilesDaDiagonal} tiles de estrada, veio ${s.estradasRenderizadas}`,
  );
  const pedraDepois = Number(await pedra());
  afirmar(
    pedraDepois === pedraInicial - tilesDaDiagonal * custoPorTile,
    `a Pedra deveria cair ${tilesDaDiagonal * custoPorTile} (de ${pedraInicial}), veio ${pedraDepois}`,
  );
  afirmar(
    true,
    `medida: o mesmo gesto custava ${tilesDaEscadaAntiga * custoPorTile} de pedra em escada `
      + `4-conectada e custa ${tilesDaDiagonal * custoPorTile} em diagonal`,
  );
  await capturar('estrada-diagonal');
}

module.exports = { roteiro };
