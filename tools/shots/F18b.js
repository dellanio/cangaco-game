'use strict';

// Roteiro da F18b — O MAPA GRANDE.
//
// Um mapa quatro vezes maior que ninguem consegue ver nao foi entregue. O que
// este roteiro mede: a camera ALCANCA o canto sudeste do mapa novo — um tile
// que no 64x64 da Fase A nao existia — e o jogo destaca esse tile sob o
// ponteiro.
//
// Afirma NUMERO publicado pela cena (CLAUDE.md 8), nunca pixel. O tamanho do
// mapa nao esta digitado aqui: vem de `data/terrain.json`, o mesmo arquivo que
// a cena le.

const { retanguloDoCanvas, pontoDoTileNaTela, bordaVisivel } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const { largura, altura } = terreno.mapaPadrao;
const NIVEIS = terreno.zoom.niveis;
const MENOR = NIVEIS[0];
const INICIAL = terreno.zoom.inicial;
/** O canto sudeste do mapa DECLARADO. Em 64x64 este tile nao existe. */
const CANTO = { gx: largura - 1, gy: altura - 1 };
const LADO_DA_FASE_A = 64;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  /**
   * Herdado da F18a, e ja custou um defeito: a cena so atualiza `tileSobMouse`
   * no pointermove. Depois de mexer a camera (roda ou arrasto), sem reamostrar
   * a afirmacao leria o valor de ANTES e passaria sozinha.
   */
  async function reamostrar(ponto) {
    await page.mouse.move(ponto.x + 3, ponto.y + 3);
    await page.mouse.move(ponto.x, ponto.y);
    await esperarFrame();
    return estado();
  }

  /** Arrasta a camera com o botao do MEIO, que e como a cena a move. */
  async function arrastarCamera(de, ate) {
    await page.mouse.move(de.x, de.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(ate.x, ate.y, { steps: 10 });
    await page.mouse.up({ button: 'middle' });
    await esperarFrame();
    return estado();
  }

  // ---- 0. o mapa que o dado publica e maior que o da Fase A -----------------
  afirmar(
    largura > LADO_DA_FASE_A && altura > LADO_DA_FASE_A,
    `o mapa publicado (${largura}x${altura}) deveria ser maior que o `
      + `${LADO_DA_FASE_A}x${LADO_DA_FASE_A} da Fase A`,
  );
  const abertura = await estado();
  afirmar(
    abertura.camera.zoom === INICIAL,
    `a cena deveria abrir no nivel do dado (${INICIAL}), veio ${abertura.camera.zoom}`,
  );
  // A vila nao se moveu com o mapa (decisao registrada da F18b): ela fica no
  // quadrante noroeste, e a camera abre nela, nao no canto.
  afirmar(
    abertura.centroDaVila !== null && abertura.centroDaVila.gx < largura / 2
      && abertura.centroDaVila.gy < altura / 2,
    `a vila deveria nascer no quadrante noroeste, veio ${JSON.stringify(abertura.centroDaVila)}`,
  );

  // ---- 1. o canto sudeste esta FORA do quadro na abertura -------------------
  // Se ele ja aparecesse, "chegar la" nao provaria nada.
  const naAbertura = pontoDoTileNaTela(canvas, CANTO, abertura.camera, TILE_PX);
  afirmar(
    naAbertura.x > canvas.right || naAbertura.y > canvas.bottom,
    `o canto ${JSON.stringify(CANTO)} deveria comecar fora do quadro, mas caiu em `
      + `(${Math.round(naAbertura.x)},${Math.round(naAbertura.y)}) dentro do canvas`,
  );

  // ---- 2. zoom minimo: mais mapa no quadro ---------------------------------
  const centroDoCanvas = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };
  await page.mouse.move(centroDoCanvas.x, centroDoCanvas.y);
  await esperarFrame();
  const noNeutro = await estado();
  for (let i = 0; i < NIVEIS.length + 2; i++) {
    await page.mouse.wheel(0, +200);
    await esperarFrame();
  }
  let s = await reamostrar(centroDoCanvas);
  afirmar(
    s.camera.zoom === MENOR,
    `rolando para baixo a camera deveria parar no menor nivel (${MENOR}), veio ${s.camera.zoom}`,
  );
  const tilesNoMinimo = s.tilesRenderizados;
  afirmar(
    tilesNoMinimo > noNeutro.tilesRenderizados,
    `o zoom minimo deveria caber mais tiles que o neutro: ${tilesNoMinimo} contra `
      + `${noNeutro.tilesRenderizados}`,
  );
  const areaEmTiles = largura * altura;
  const porcento = (n) => (100 * n / areaEmTiles).toFixed(1);
  afirmar(
    true,
    `medida: o quadro mais largo desenha ${tilesNoMinimo} tiles de ${areaEmTiles} `
      + `(${porcento(tilesNoMinimo)}% do mapa); no nivel ${INICIAL} sao `
      + `${noNeutro.tilesRenderizados} (${porcento(noNeutro.tilesRenderizados)}%)`,
  );

  // ---- 3. arrastar ate o canto sudeste, ate o clamp de setBounds parar ------
  // O passo do arrasto e o quadro; o limite de voltas e o que basta para
  // atravessar o mapa inteiro, com folga, seja qual for o tamanho declarado.
  const esquerda = { x: canvas.left + canvas.width * 0.15, y: canvas.top + canvas.height * 0.15 };
  const direita = { x: canvas.left + canvas.width * 0.85, y: canvas.top + canvas.height * 0.85 };
  const maximoDeVoltas = Math.ceil((largura * TILE_PX) / (canvas.width * 0.7)) + 4;
  let voltas = 0;
  let anterior = s.camera;
  for (; voltas < maximoDeVoltas; voltas += 1) {
    const depois = await arrastarCamera(direita, esquerda);
    if (depois.camera.scrollX === anterior.scrollX && depois.camera.scrollY === anterior.scrollY) break;
    anterior = depois.camera;
  }
  s = await estado();
  afirmar(
    voltas < maximoDeVoltas,
    `a camera deveria ter encostado na borda em menos de ${maximoDeVoltas} arrastos, e nao parou`,
  );
  afirmar(
    s.camera.scrollX > abertura.camera.scrollX && s.camera.scrollY > abertura.camera.scrollY,
    `a camera deveria ter andado para sudeste: de (${Math.round(abertura.camera.scrollX)},`
      + `${Math.round(abertura.camera.scrollY)}) para (${Math.round(s.camera.scrollX)},`
      + `${Math.round(s.camera.scrollY)})`,
  );
  // O clamp de setBounds e o que prova que o mundo ACABA onde o dado diz. O que
  // para na borda nao e o `scroll` — e a area EXIBIDA (`bordaVisivel`): num mapa
  // de 8192 px com quadro de 1020 e zoom 0.5, o scroll encosta em 6662.
  const borda = bordaVisivel(canvas, s.camera);
  afirmar(
    Math.abs(borda.x - largura * TILE_PX) < 1 && Math.abs(borda.y - altura * TILE_PX) < 1,
    `a camera deveria parar com a borda do mapa (${largura * TILE_PX},${altura * TILE_PX}) `
      + `na borda do quadro, veio (${Math.round(borda.x)},${Math.round(borda.y)}) com scroll `
      + `(${Math.round(s.camera.scrollX)},${Math.round(s.camera.scrollY)})`,
  );
  afirmar(
    true,
    `medida: ${voltas} arrastos de quadro levaram a camera da vila ate a borda sudeste, `
      + `no zoom ${s.camera.zoom}`,
  );

  // ---- 4. o ACEITE: o jogo destaca o canto que no 64x64 nao existia ---------
  const pontoDoCanto = pontoDoTileNaTela(canvas, CANTO, s.camera, TILE_PX);
  afirmar(
    pontoDoCanto.x > canvas.left && pontoDoCanto.x < canvas.right
      && pontoDoCanto.y > canvas.top && pontoDoCanto.y < canvas.bottom,
    `o canto ${JSON.stringify(CANTO)} deveria estar dentro do quadro depois do arrasto, `
      + `caiu em (${Math.round(pontoDoCanto.x)},${Math.round(pontoDoCanto.y)})`,
  );
  s = await reamostrar(pontoDoCanto);
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(CANTO),
    `o jogo deveria destacar o canto ${JSON.stringify(CANTO)}, destacou `
      + `${JSON.stringify(s.tileSobMouse)}`,
  );
  await capturar('canto-sudeste');

  // ---- 5. de volta ao nivel neutro, ancorado no canto -----------------------
  // Fecha o aceite no nivel em que todo roteiro ja validado trabalha, e de
  // quebra reconfirma a ancoragem da F18a longe da vila, encostado na borda.
  for (let i = 0; i < NIVEIS.indexOf(INICIAL) - NIVEIS.indexOf(MENOR); i += 1) {
    await page.mouse.wheel(0, -200);
    await esperarFrame();
  }
  s = await reamostrar(pontoDoCanto);
  afirmar(
    s.camera.zoom === INICIAL,
    `deveria dar para voltar ao nivel inicial pela roda, parou em ${s.camera.zoom}`,
  );
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(CANTO),
    `de volta ao nivel ${INICIAL} o ponto deveria seguir sobre ${JSON.stringify(CANTO)}, `
      + `veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  await capturar('canto-sudeste-neutro');
}

module.exports = { roteiro };
