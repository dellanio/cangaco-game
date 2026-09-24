'use strict';

// Roteiro da F-T2b — A ARVORE E OBSTACULO, E A TELA DIZ ISSO.
//
// A F-T2a ja punha marcador de recurso na tela, um codigo de tile por tipo. O
// que muda aqui nao e o desenho: e o SIGNIFICADO de um deles. A arvore em pe
// deixou de ser enfeite e passou a reprovar o passo, no A* e na rede de
// estradas. Duas coisas, entao, precisam aparecer no mesmo quadro:
//
//   1. o marcador da arvore existe e e DISTINTO do da rocha — dois recursos,
//      duas cores, no mesmo pedaco de mapa;
//   2. a rua nao atravessa a arvore, e a previa diz POR QUE: motivo `recurso`,
//      que a F-T2b separou de `terreno` de proposito (terreno nao se remove,
//      arvore se corta).
//
// Nenhuma coordenada de arvore ou de rocha esta digitada aqui: o par sai de
// `data/maps/sertao-128.json`, o mesmo arquivo que alimenta a simulacao. Se o
// gerador mudar de semente, o roteiro acompanha.
//
// O passo 2 roda DESPAUSADO e segura o botao (CLAUDE.md §8): ele mexe em
// `#menu-build`, e `page.click()` aperta e solta no mesmo instante — com o laco
// parado o quadro nunca se redesenha entre os dois, e a classe de defeito do
// BUG-B passaria batida.

const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;

/** O tipo de terreno do tile, lido do MESMO arquivo que a sim le. */
function tipoNoTile(gx, gy) {
  const linha = mapa.linhas[gy];
  if (linha === undefined || gx < 0 || gx >= linha.length) return null;
  return mapa.legenda[linha[gx]] ?? null;
}

const transponivel = (gx, gy) => {
  const tipo = tipoNoTile(gx, gy);
  return tipo !== null && !terreno.intransponivel.includes(tipo);
};

/** O recurso do tile, pelas listas do arquivo de mapa. */
function recursoNoTile(gx, gy) {
  for (const [tipo, lista] of Object.entries(mapa.recursos)) {
    if (lista.some(([x, y]) => x === gx && y === gy)) return tipo;
  }
  return null;
}

/**
 * Uma arvore com rocha por perto e com vizinho LIMPO por onde comecar a rua.
 * Varredura em ordem fixa sobre as listas do arquivo: mesma escolha em toda
 * maquina, e nenhum numero de jazida neste arquivo.
 */
function alvoDaCena() {
  for (const [tx, ty] of mapa.recursos.tree) {
    const rocha = mapa.recursos.rock.find(
      ([rx, ry]) => Math.max(Math.abs(rx - tx), Math.abs(ry - ty)) <= 6,
    );
    if (rocha === undefined) continue;
    // O vizinho de onde a rua parte: terreno que se pisa, sem recurso nenhum.
    // Ortogonal, para o trecho de dois tiles sair reto.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const [vx, vy] = [tx + dx, ty + dy];
      if (!transponivel(vx, vy) || recursoNoTile(vx, vy) !== null) continue;
      return { arvore: { gx: tx, gy: ty }, rocha: { gx: rocha[0], gy: rocha[1] }, partida: { gx: vx, gy: vy } };
    }
  }
  throw new Error('F-T2b: o mapa nao tem arvore com rocha a 6 tiles e vizinho limpo');
}

/** O retangulo do MUNDO que cabe no quadro agora (mesma conta da F-T2a). */
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

/** Quantos tiles de `lista` o ARQUIVO poe nesta vista: inteiramente dentro, e
 *  tocando a borda. A cena desenha tile parcial, entao o numero publicado tem
 *  de cair ENTRE os dois (F-T2a). */
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
  const ALVO = alvoDaCena();

  /** Leva a camera ate centrar `tile`. Arrasto com o botao do MEIO (o esquerdo
   *  e desenho de estrada e nao mexe a camera um pixel), em passos de meio
   *  quadro para nunca sair do canvas — mesmo laco da F-T2a. */
  const irPara = async (tile, camera) => {
    let s = { camera };
    const destino = {
      x: tile.gx * TILE_PX + TILE_PX / 2 - canvas.width / 2,
      y: tile.gy * TILE_PX + TILE_PX / 2 - canvas.height / 2,
    };
    const margem = 40;
    for (let tentativa = 0; tentativa < 16; tentativa += 1) {
      const faltaX = destino.x - s.camera.scrollX;
      const faltaY = destino.y - s.camera.scrollY;
      if (Math.abs(faltaX) < 1 && Math.abs(faltaY) < 1) break;
      const passoX = Math.max(Math.min(faltaX, canvas.width / 2 - margem), -(canvas.width / 2 - margem));
      const passoY = Math.max(Math.min(faltaY, canvas.height / 2 - margem), -(canvas.height / 2 - margem));
      await page.mouse.move(meio.x, meio.y);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(meio.x - passoX, meio.y - passoY, { steps: 10 });
      await page.mouse.up({ button: 'middle' });
      await esperarFrame();
      s = await estado();
    }
    return s;
  };

  // ---- 0. a cor da arvore e a cor da rocha sao cores diferentes -----------
  // Antes de olhar a tela: se o tema desse a mesma cor aos dois, o quadro
  // ficaria "certo" e ilegivel, e nenhuma contagem acusaria.
  afirmar(
    typeof tema.recursos.tree === 'string' && typeof tema.recursos.rock === 'string',
    `o tema precisa de cor para 'tree' e 'rock', veio ${JSON.stringify(tema.recursos)}`,
  );
  afirmar(
    tema.recursos.tree !== tema.recursos.rock,
    `a arvore e a rocha nao podem ter a mesma cor de marcador (${tema.recursos.tree})`,
  );

  let s = await estado();
  afirmar(s.pronto === true, 'a cena deveria estar pronta');
  await capturar('vila-de-abertura');

  // ---- 1. arvore e rocha no MESMO quadro, e a conta bate com o arquivo ----
  s = await irPara(ALVO.arvore, s.camera);
  const vista = mundoVisivel(canvas, s.camera);
  for (const tipo of ['tree', 'rock']) {
    const doMapa = contarDoMapa(mapa.recursos[tipo], vista);
    afirmar(
      doMapa.dentro > 0,
      `a vista escolhida deveria ter '${tipo}' pelo arquivo de mapa, veio ${JSON.stringify(doMapa)}`,
    );
    afirmar(
      s.recursosVisiveis[tipo] >= doMapa.dentro && s.recursosVisiveis[tipo] <= doMapa.tocando,
      `a cena desenhou ${s.recursosVisiveis[tipo]} marcadores de '${tipo}' nesta vista, mas o `
      + `mapa poe entre ${doMapa.dentro} e ${doMapa.tocando} ali`,
    );
  }
  await capturar('arvore-e-rocha-no-mesmo-quadro');

  // ---- 2. DESPAUSADO: a rua para na arvore, e a previa diz por que ---------
  // `press('p')` solta o laco; dai em diante todo gesto acontece com quadro
  // sendo redesenhado por baixo dele, que e a condicao em que o BUG-B aparecia.
  await page.keyboard.press('p');
  await esperarFrame();
  const antesDoGesto = await estado();
  afirmar(antesDoGesto.pausado === false, `o laco deveria estar rodando, veio ${JSON.stringify(antesDoGesto.pausado)}`);

  // O botao da ferramenta com APERTAR e SOLTAR separados, com o laco vivo entre
  // os dois: e o gesto do jogador, e nao o clique instantaneo do Playwright.
  const botao = await page.locator('[data-ferramenta="estrada"]').boundingBox();
  afirmar(botao !== null, 'o botao da estrada deveria existir no menu');
  await page.mouse.move(botao.x + botao.width / 2, botao.y + botao.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  // Pelo `aria-pressed` do proprio botao (F08): o modo de estrada nao vai para
  // `window.__cangaco` — o que a cena publica ali e a PLANTA ativa, que na
  // estrada e nula de direito. Publicar um campo novo para este roteiro seria
  // mexer em `src/render/` numa feature de sim.
  afirmar(
    await page.getAttribute('[data-ferramenta="estrada"]', 'aria-pressed') === 'true',
    'o botao da estrada deveria ficar marcado depois do aperta-e-solta',
  );

  // Arrasto de dois tiles: comeca no vizinho limpo e entra na arvore. Botao
  // SEGURADO enquanto a previa e lida — soltar aqui viraria a rua planejada, e
  // o que interessa e o que a tela diz ANTES de o jogador se comprometer.
  const partida = pontoDoTileNaTela(canvas, ALVO.partida, s.camera, TILE_PX);
  const sobreArvore = pontoDoTileNaTela(canvas, ALVO.arvore, s.camera, TILE_PX);
  await page.mouse.move(partida.x, partida.y);
  await page.mouse.down();
  await page.mouse.move(sobreArvore.x, sobreArvore.y, { steps: 8 });
  await page.waitForTimeout(150);
  s = await estado();
  afirmar(
    s.tileSobMouse !== null && s.tileSobMouse.gx === ALVO.arvore.gx && s.tileSobMouse.gy === ALVO.arvore.gy,
    `o ponteiro deveria estar sobre a arvore ${JSON.stringify(ALVO.arvore)}, `
    + `veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  afirmar(
    s.previaDeEstrada !== null && s.previaDeEstrada.valida === false,
    `a previa sobre a arvore deveria ser invalida, veio ${JSON.stringify(s.previaDeEstrada)}`,
  );
  afirmar(
    s.previaDeEstrada.motivo === 'recurso',
    `o motivo deveria ser 'recurso' e nao 'terreno' — arvore se corta, serra nao. `
    + `Veio ${JSON.stringify(s.previaDeEstrada)}`,
  );
  await capturar('a-rua-nao-atravessa-a-arvore');

  // Solta FORA de um tile valido nao existe: solta onde esta e confere que a
  // recusa se manteve — nenhum canteiro nasceu por cima da arvore.
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  afirmar(
    s.estradasPlanejadasRenderizadas === 0 && s.estradasRenderizadas === 0,
    `a rua recusada nao pode virar canteiro: planejadas=${s.estradasPlanejadasRenderizadas} `
    + `de pe=${s.estradasRenderizadas}`,
  );
  await page.keyboard.press('p');
  await esperarFrame();
  await capturar('nenhum-canteiro-sobre-a-arvore');
}

module.exports = { roteiro };
