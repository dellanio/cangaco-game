'use strict';
// Roteiro da F-T2a — A TELA NAO MENTE SOBRE O RECURSO.
//
// O desenho desta feature e MINIMO por decisao do operador: um marcador por
// tipo de recurso sobre o tile, sem arte. O item escreve "Render: o marcador de
// rocha, e so ele". O que este roteiro mede nao e beleza, e a correspondencia:
// a camera vai ate a mancha de rocha, a cena PUBLICA quantos tiles de cada
// recurso estao na vista, e esse numero e conferido contra o proprio arquivo de
// mapa que alimentou a simulacao. O jogador ve a rocha ANTES de plantar a
// pedreira, em vez de plantar no escuro.
//
// Afirma numero publicado pela cena (CLAUDE.md §8), nunca pixel. Nenhuma
// coordenada de jazida esta digitada aqui: a mancha sai de
// `data/maps/sertao-128.json`, o mesmo arquivo que a sim le.
const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const recursos = require('../../data/resources.json');

const TILE_PX = terreno.tile_px;
const PREDIO = 'quarry'; // liberado no estado inicial, e a primeira consumidora
const ROCHA = mapa.recursos.rock.map(([gx, gy]) => ({ gx, gy }));

/** O tile de rocha com mais rocha em volta, num raio de meia tela. E onde a
 *  jazida e mais densa, lido do mapa — nao ha coordenada escolhida a mao. */
function centroDaJazida(raioEmTiles) {
  let melhor = ROCHA[0];
  let maior = -1;
  for (const alvo of ROCHA) {
    let vizinhos = 0;
    for (const outro of ROCHA) {
      if (Math.abs(outro.gx - alvo.gx) <= raioEmTiles && Math.abs(outro.gy - alvo.gy) <= raioEmTiles) {
        vizinhos += 1;
      }
    }
    if (vizinhos > maior) { maior = vizinhos; melhor = alvo; }
  }
  return melhor;
}

/** O retangulo de MUNDO que a camera exibe, em pixel, com a origem 0.5 do
 *  Phaser (a mesma conta de `bordaVisivel`, nos dois sentidos). */
function mundoVisivel(canvas, camera) {
  const meioX = canvas.width / 2;
  const meioY = canvas.height / 2;
  return {
    x0: camera.scrollX + meioX - meioX / camera.zoom,
    x1: camera.scrollX + meioX + meioX / camera.zoom,
    y0: camera.scrollY + meioY - meioY / camera.zoom,
    y1: camera.scrollY + meioY + meioY / camera.zoom,
  };
}

/** Quantos tiles de `lista` o ARQUIVO DE MAPA poe dentro da vista. Duas
 *  contagens, nao uma: `dentro` so conta tile inteiramente dentro do quadro e
 *  `tocando` conta tambem o que a borda corta. A cena desenha tile parcial, e
 *  ficar preso a um dos dois numeros seria afirmar sobre arredondamento de
 *  borda em vez de sobre o recurso. O numero publicado tem de cair ENTRE eles. */
function contarDoMapa(lista, vista) {
  let dentro = 0;
  let tocando = 0;
  for (const [gx, gy] of lista) {
    const x0 = gx * TILE_PX;
    const y0 = gy * TILE_PX;
    if (x0 + TILE_PX <= vista.x1 && x0 >= vista.x0 && y0 + TILE_PX <= vista.y1 && y0 >= vista.y0) dentro += 1;
    if (x0 + TILE_PX > vista.x0 && x0 < vista.x1 && y0 + TILE_PX > vista.y0 && y0 < vista.y1) tocando += 1;
  }
  return { dentro, tocando };
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const meio = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };

  /** A cena so atualiza `tileSobMouse`/`plantaFantasma` no pointermove: depois
   *  de mexer a camera, o valor publicado e o de antes ate o mouse se mover.
   *  Dois moves porque o Phaser ignora move para o mesmo pixel. */
  const reamostrar = async (ponto) => {
    await page.mouse.move(ponto.x + 3, ponto.y + 3);
    await page.mouse.move(ponto.x, ponto.y);
    await esperarFrame();
    return estado();
  };

  /** Leva a camera ate por `alvo` no meio do quadro, arrastando em etapas: a
   *  distancia e maior que o canvas, e um arrasto so nao chega. */
  const irPara = async (alvo, inicial) => {
    let s = inicial;
    const destino = {
      x: alvo.gx * TILE_PX + TILE_PX / 2 - canvas.width / 2,
      y: alvo.gy * TILE_PX + TILE_PX / 2 - canvas.height / 2,
    };
    const margem = 40;
    for (let tentativa = 0; tentativa < 16; tentativa += 1) {
      const faltaX = destino.x - s.camera.scrollX;
      const faltaY = destino.y - s.camera.scrollY;
      if (Math.abs(faltaX) < 1 && Math.abs(faltaY) < 1) break;
      // Arrastar para ESQUERDA leva a camera para DIREITA: o passo e o simetrico
      // do que falta, limitado a meio quadro para nao sair do canvas.
      const passoX = Math.max(Math.min(faltaX, canvas.width / 2 - margem), -(canvas.width / 2 - margem));
      const passoY = Math.max(Math.min(faltaY, canvas.height / 2 - margem), -(canvas.height / 2 - margem));
      // Botao do MEIO, nao o esquerdo (`WorldScene.pointermove`): o esquerdo e
      // arrasto de estrada e nao mexe a camera um pixel. Por isso nao da para
      // usar `arrastarDentroDoCanvas`, que e o helper do arrasto esquerdo.
      await page.mouse.move(meio.x, meio.y);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(meio.x - passoX, meio.y - passoY, { steps: 10 });
      await page.mouse.up({ button: 'middle' });
      await esperarFrame();
      s = await estado();
    }
    return s;
  };

  const soma = (contagem) => Object.values(contagem).reduce((a, n) => a + n, 0);

  // ---- 0. a cena publica a contagem de recurso, por tipo -------------------
  let s = await estado();
  afirmar(
    Object.keys(s.recursosVisiveis).length > 0,
    `a cena deveria publicar contagem de recurso visivel, veio ${JSON.stringify(s.recursosVisiveis)}`,
  );
  for (const tipo of Object.keys(recursos.tipos)) {
    afirmar(
      typeof s.recursosVisiveis[tipo] === 'number',
      `o tipo '${tipo}' esta em data/resources.json e deveria ter contagem na tela, ` +
      `veio ${JSON.stringify(s.recursosVisiveis)}`,
    );
  }
  // Nada foi colhido ainda: o unico `esgotado` da abertura e o que NASCE vazio
  // (o milho do chao arado e a cana em pousio), que desde a noite 17 entra no
  // quadro de abertura. A conta vem do arquivo de mapa, tipo a tipo pela
  // `quantidadeInicial`: um tile colhido a mais, ou um tipo cheio desenhado
  // como esgotado, sai da faixa.
  const vistaDeAbertura = mundoVisivel(canvas, s.camera);
  const letras = (nome) => Object.keys(mapa.legenda).filter((l) => mapa.legenda[l] === nome);
  const vazios = [];
  for (const [id, def] of Object.entries(recursos.tipos)) {
    if ((def.quantidadeInicial ?? def.rendimentoPorTile) !== 0) continue;
    vazios.push(...(mapa.recursos[id] || []));
    if (def.terreno === undefined) continue;
    const dele = letras(def.terreno);
    mapa.linhas.forEach((linha, gy) => [...linha].forEach((l, gx) => {
      if (dele.includes(l)) vazios.push([gx, gy]);
    }));
  }
  const pousio = contarDoMapa(vazios, vistaDeAbertura);
  afirmar(
    s.recursosVisiveis.esgotado >= pousio.dentro && s.recursosVisiveis.esgotado <= pousio.tocando,
    `nada foi colhido ainda: 'esgotado' deveria ser so o que nasce vazio, entre ${pousio.dentro} e `
      + `${pousio.tocando} tiles; veio ${JSON.stringify(s.recursosVisiveis)}`,
  );
  await capturar('vila-de-abertura');

  // ---- 1. a camera vai ate a jazida, e o numero bate com o mapa ------------
  // Meia tela em tiles: e o raio que define "denso o bastante para caber no quadro".
  const raio = Math.floor(canvas.width / TILE_PX / 2);
  const JAZIDA = centroDaJazida(raio);
  s = await irPara(JAZIDA, s);

  const pontoDaJazida = pontoDoTileNaTela(canvas, JAZIDA, s.camera, TILE_PX);
  s = await reamostrar(pontoDaJazida);
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(JAZIDA),
    `o ponteiro deveria estar sobre ${JSON.stringify(JAZIDA)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  afirmar(
    s.recursosVisiveis.rock > 0,
    `a vista da jazida deveria ter rocha, veio ${JSON.stringify(s.recursosVisiveis)}`,
  );

  // A afirmacao que fecha o desenho minimo: o que a cena tem DESENHADO (lido de
  // volta da camada) e o que o arquivo de mapa poe nesta vista sao a mesma
  // coisa. Um marcador a mais ou a menos e a tela mentindo sobre onde ha rocha.
  const vista = mundoVisivel(canvas, s.camera);
  for (const tipo of Object.keys(mapa.recursos)) {
    const doMapa = contarDoMapa(mapa.recursos[tipo], vista);
    afirmar(
      s.recursosVisiveis[tipo] >= doMapa.dentro && s.recursosVisiveis[tipo] <= doMapa.tocando,
      `a cena desenhou ${s.recursosVisiveis[tipo]} marcadores de '${tipo}' nesta vista, mas o ` +
      `mapa poe entre ${doMapa.dentro} e ${doMapa.tocando} ali`,
    );
  }
  afirmar(
    soma(s.terrenoVisivel) > 0,
    'a camada de terreno (F-T1) deveria continuar publicada sob os marcadores, ' +
    `veio ${JSON.stringify(s.terrenoVisivel)}`,
  );
  await capturar('jazida-de-rocha-visivel');

  // ---- 2. a pedreira se planta VENDO a rocha ------------------------------
  // E o motivo de o marcador existir, escrito na nota de integracao do item:
  // recurso que so a simulacao enxerga faz o jogador plantar a pedreira no
  // escuro. Aqui a planta fantasma e o marcador estao no mesmo quadro.
  await page.click(`[data-predio="${PREDIO}"]`);
  await esperarFrame();
  s = await reamostrar(pontoDaJazida);
  afirmar(
    s.ferramentaAtiva === PREDIO,
    `a ferramenta deveria estar com '${PREDIO}', veio ${JSON.stringify(s.ferramentaAtiva)}`,
  );
  afirmar(
    s.plantaFantasma !== null,
    'a planta fantasma deveria aparecer sobre o tile de rocha, veio null',
  );
  afirmar(
    s.recursosVisiveis.rock > 0,
    'a rocha deveria continuar visivel com a planta por cima — e a decisao que o ' +
    `marcador existe para informar, veio ${JSON.stringify(s.recursosVisiveis)}`,
  );
  await capturar('planta-da-pedreira-sobre-a-jazida');
}

module.exports = { roteiro };
