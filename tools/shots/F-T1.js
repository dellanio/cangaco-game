'use strict';

// Roteiro da F-T1 — A TELA NAO MENTE SOBRE O TERRENO.
//
// O desenho desta feature e MINIMO de proposito: uma cor por tipo de terreno,
// sem textura e sem transicao. O que este roteiro mede nao e beleza, e a
// correspondencia: a camera vai ate o lago, a cena PUBLICA quantos tiles de
// cada tipo estao na vista, e a planta fantasma sobre a agua recusa dizendo
// `terreno`. O jogador ve a agua ANTES de a construcao ser recusada por ela.
//
// Afirma numero publicado pela cena (CLAUDE.md 8), nunca pixel. Nem o tamanho
// do mapa nem a posicao do lago estao digitados: os dois saem de
// `data/terrain.json` e de `data/maps/<id>.json`, os mesmos arquivos que a cena
// le.

const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');

const TILE_PX = terreno.tile_px;
const PREDIO = 'quarry'; // liberado no estado inicial; e o predio que a F06 usa

/** Acha, lendo o mapa, o tile de agua mais proximo do centro da mancha de agua.
 *  Nenhuma coordenada de lago digitada aqui: se o mapa mudar, o roteiro segue. */
function centroDaAgua() {
  const charDeAgua = Object.keys(mapa.legenda).find((ch) => mapa.legenda[ch] === 'agua');
  const tiles = [];
  for (let gy = 0; gy < mapa.altura; gy += 1) {
    const linha = mapa.linhas[gy];
    for (let gx = 0; gx < mapa.largura; gx += 1) {
      if (linha[gx] === charDeAgua) tiles.push({ gx, gy });
    }
  }
  if (tiles.length === 0) throw new Error('F-T1: o mapa nao tem nenhum tile de agua.');
  const soma = tiles.reduce((a, t) => ({ gx: a.gx + t.gx, gy: a.gy + t.gy }), { gx: 0, gy: 0 });
  const medio = { gx: soma.gx / tiles.length, gy: soma.gy / tiles.length };
  let melhor = tiles[0];
  let menor = Infinity;
  for (const t of tiles) {
    const d = (t.gx - medio.gx) ** 2 + (t.gy - medio.gy) ** 2;
    if (d < menor) { menor = d; melhor = t; }
  }
  return melhor;
}

const AGUA = centroDaAgua();

/** O primeiro tile a OESTE do lago, na mesma linha, em que o footprint inteiro
 *  da pedreira mais a linha da porta caem em terreno pisavel. Lido do mapa e do
 *  `intransponivel` de `terrain.json` — as mesmas duas fontes que `canPlace` le;
 *  a afirmacao continua sendo sobre o que a CENA respondeu. */
function tileLimpoAOesteDaAgua() {
  const barrado = new Set(terreno.intransponivel.filter((t) => t !== 'predio'));
  const predio = require('../../data/buildings.json').predios.find((p) => p.id === PREDIO);
  const [largura, altura] = predio.tamanho;
  const pisavel = (gx, gy) => {
    const linha = mapa.linhas[gy];
    if (linha === undefined || linha[gx] === undefined) return false;
    return !barrado.has(mapa.legenda[linha[gx]]);
  };
  for (let gx = AGUA.gx - 1; gx > 0; gx -= 1) {
    let limpo = true;
    for (let dy = 0; dy <= altura && limpo; dy += 1) { // altura + a linha da porta
      for (let dx = 0; dx < largura && limpo; dx += 1) limpo = pisavel(gx + dx, AGUA.gy + dy);
    }
    if (limpo) return { gx, gy: AGUA.gy };
  }
  return null;
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  /** A cena so atualiza `tileSobMouse` no pointermove: depois de mover a camera
   *  e preciso reamostrar, ou a afirmacao le o valor de ANTES (defeito herdado
   *  da F18a, ja documentado no roteiro da F18b). */
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

  const soma = (contagem) => Object.values(contagem || {}).reduce((a, n) => a + n, 0);

  // ---- 0. a abertura: a vila esta em terreno construivel, e so ------------
  let s = await estado();
  afirmar(
    soma(s.terrenoVisivel) > 0,
    `a cena deveria publicar a contagem de terreno visivel, veio ${JSON.stringify(s.terrenoVisivel)}`,
  );
  afirmar(
    s.terrenoVisivel.grama > 0,
    `a vista de abertura deveria ter grama, veio ${JSON.stringify(s.terrenoVisivel)}`,
  );
  afirmar(
    (s.terrenoVisivel.agua || 0) === 0 && (s.terrenoVisivel.montanha || 0) === 0,
    'a vila inicial nasce em regiao inteira construivel: a vista de abertura nao deveria '
      + `ter agua nem montanha, veio ${JSON.stringify(s.terrenoVisivel)}`,
  );
  await capturar('vila-em-terreno-limpo');

  // ---- 1. a camera vai ate a agua -----------------------------------------
  // O alvo e o scroll que poe o tile de agua no meio do quadro. Arrasta em
  // etapas porque a distancia (dezenas de tiles) e maior que o canvas.
  const alvo = {
    x: AGUA.gx * TILE_PX + TILE_PX / 2 - canvas.width / 2,
    y: AGUA.gy * TILE_PX + TILE_PX / 2 - canvas.height / 2,
  };
  const meio = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };
  const margem = 40;
  for (let tentativa = 0; tentativa < 12; tentativa += 1) {
    const faltaX = alvo.x - s.camera.scrollX;
    const faltaY = alvo.y - s.camera.scrollY;
    if (Math.abs(faltaX) < 1 && Math.abs(faltaY) < 1) break;
    // Arrastar para a ESQUERDA leva a camera para a DIREITA: o passo e o
    // simetrico do que falta, limitado ao que cabe no canvas.
    const passoX = Math.max(Math.min(faltaX, canvas.width / 2 - margem), -(canvas.width / 2 - margem));
    const passoY = Math.max(Math.min(faltaY, canvas.height / 2 - margem), -(canvas.height / 2 - margem));
    s = await arrastarCamera(meio, { x: meio.x - passoX, y: meio.y - passoY });
  }

  const pontoDaAgua = pontoDoTileNaTela(canvas, AGUA, s.camera, TILE_PX);
  s = await reamostrar(pontoDaAgua);
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(AGUA),
    `o ponteiro deveria estar sobre ${JSON.stringify(AGUA)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  afirmar(
    s.terrenoVisivel.agua > 0,
    `com a camera no lago, a cena deveria ter agua desenhada na vista, veio ${JSON.stringify(s.terrenoVisivel)}`,
  );
  // Mais de um tipo na vista: cor unica chapada no mapa inteiro tambem passaria
  // na afirmacao acima, e nao e isso que a feature entrega.
  const tiposNaVista = Object.entries(s.terrenoVisivel).filter(([, n]) => n > 0).map(([t]) => t);
  afirmar(
    tiposNaVista.length >= 2,
    `a vista do lago deveria ter mais de um tipo de terreno, veio ${JSON.stringify(s.terrenoVisivel)}`,
  );
  await capturar('lago-e-praia');

  // ---- 2. a recusa aparece no lugar onde a agua aparece --------------------
  await page.click(`[data-predio="${PREDIO}"]`);
  await esperarFrame();
  s = await reamostrar(pontoDaAgua);
  afirmar(
    s.plantaFantasma !== null && s.plantaFantasma.valida === false
      && s.plantaFantasma.motivo === 'terreno',
    'a planta sobre a agua deveria recusar por `terreno`, veio '
      + `${JSON.stringify(s.plantaFantasma)}`,
  );
  await capturar('planta-recusada-pela-agua');

  // ---- 3. e a mesma planta, em terreno pisavel ao lado, aceita ------------
  // Sem este passo o caso anterior passaria com uma planta que recusa sempre.
  // O tile e escolhido LENDO O MAPA (footprint inteiro + linha da porta fora do
  // intransponivel), nao chutando uma distancia: o footprint da pedreira cresce
  // para leste, e chutar poria metade dela dentro do lago.
  const emTerra = tileLimpoAOesteDaAgua();
  afirmar(
    emTerra !== null,
    'a oeste do lago deveria haver footprint inteiro em terreno pisavel para a mesma planta',
  );
  const centroDoTile = {
    x: canvas.left + canvas.width / 2,
    y: canvas.top + canvas.height / 2,
  };
  const alvoDaMargem = {
    x: emTerra.gx * TILE_PX + TILE_PX / 2 - canvas.width / 2,
    y: emTerra.gy * TILE_PX + TILE_PX / 2 - canvas.height / 2,
  };
  s = await arrastarCamera(centroDoTile, {
    x: centroDoTile.x - (alvoDaMargem.x - s.camera.scrollX),
    y: centroDoTile.y - (alvoDaMargem.y - s.camera.scrollY),
  });
  s = await reamostrar(pontoDoTileNaTela(canvas, emTerra, s.camera, TILE_PX));
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(emTerra),
    `o ponteiro deveria estar sobre ${JSON.stringify(emTerra)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  afirmar(
    s.plantaFantasma !== null && s.plantaFantasma.valida === true,
    `a mesma planta, em terreno pisavel, deveria ser aceita, veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  await capturar('planta-aceita-na-margem');
}

module.exports = { roteiro };
