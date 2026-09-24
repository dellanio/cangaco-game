'use strict';

// Roteiro da F18a — ZOOM DA CAMERA.
//
// O aceite do BUILD_PLAN: "screenshot no zoom minimo e no maximo com o mesmo
// ponto de mouse destacando o mesmo tile". E o que este roteiro mede: um ponto
// de TELA fixo, a camera levada a ponta de baixo e a ponta de cima pela roda, e
// `tileSobMouse` afirmado igual nos dois.
//
// Afirma NUMERO, nunca pixel (CLAUDE.md 8): `camera.zoom` e `tileSobMouse`, que
// a cena publica. Os niveis nao estao digitados aqui — vem de
// `data/terrain.json`, o mesmo arquivo que a cena le.

const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const NIVEIS = terreno.zoom.niveis;
const INICIAL = terreno.zoom.inicial;
const MENOR = NIVEIS[0];
const MAIOR = NIVEIS[NIVEIS.length - 1];
/** Passos de roda de sobra para atravessar a lista inteira, venha de onde vier. */
const PASSOS = NIVEIS.length + 2;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  /**
   * A cena so atualiza `tileSobMouse` no pointermove — a roda do mouse nao
   * dispara um. Sem reamostrar, toda afirmacao de ancoragem leria o valor de
   * ANTES do zoom e passaria sozinha, provando nada. Sai 3 px e volta ao MESMO
   * ponto: o que se mede continua sendo o ponto de tela escolhido no passo 1.
   */
  async function reamostrar(ponto) {
    await page.mouse.move(ponto.x + 3, ponto.y + 3);
    await page.mouse.move(ponto.x, ponto.y);
    await esperarFrame();
    return estado();
  }

  /** Roda para cima (deltaY < 0) aproxima, como na cena. */
  async function rodar(vezes, deltaY, ponto) {
    for (let i = 0; i < vezes; i++) {
      await page.mouse.wheel(0, deltaY);
      await esperarFrame();
    }
    return reamostrar(ponto);
  }

  // ---- 0. abertura: o nivel inicial e o do dado ----------------------------
  const inicial = await estado();
  afirmar(
    inicial.camera.zoom === INICIAL,
    `a cena deveria abrir no nivel do dado (${INICIAL}), veio ${inicial.camera.zoom}`,
  );
  afirmar(
    inicial.camera.zoom === 1,
    'o nivel inicial precisa ser 1: e o que mantem a geometria de todo roteiro ja validado',
  );

  // ---- 1. o ponto de mouse, fixo pelo resto do roteiro ---------------------
  // O tile do centro da vila existe em qualquer mapa, e vira ponto de tela pelo
  // helper ciente de zoom — a formula velha, sem o fator, erraria fora do neutro.
  // `centroDaVila` e a MEDIA das posicoes, entao cai em meio tile (gy 31.5 no
  // cenario de hoje). O alvo do mouse tem de ser um tile inteiro, senao a
  // afirmacao compararia um tile com uma fracao.
  const centro = inicial.centroDaVila;
  afirmar(
    centro !== null && centro !== undefined,
    'o roteiro precisa do centro da vila que a cena publica',
  );
  const alvo = { gx: Math.round(centro.gx), gy: Math.round(centro.gy) };
  const ponto = pontoDoTileNaTela(canvas, alvo, inicial.camera, TILE_PX);
  afirmar(
    ponto.x > canvas.left && ponto.x < canvas.right
      && ponto.y > canvas.top && ponto.y < canvas.bottom,
    `o ponto de mouse (${Math.round(ponto.x)},${Math.round(ponto.y)}) precisa cair dentro `
      + `do canvas (${Math.round(canvas.left)},${Math.round(canvas.top)})-`
      + `(${Math.round(canvas.right)},${Math.round(canvas.bottom)})`,
  );
  await page.mouse.move(ponto.x, ponto.y);
  await esperarFrame();

  const comeco = await estado();
  const sobOPonto = comeco.tileSobMouse;
  afirmar(sobOPonto !== null, 'o ponto escolhido deveria estar sobre um tile do mapa, veio null');
  afirmar(
    JSON.stringify(sobOPonto) === JSON.stringify(alvo),
    `o helper deveria mirar o tile ${JSON.stringify(alvo)}, o jogo destacou ${JSON.stringify(sobOPonto)}`,
  );
  const tilesNoNeutro = comeco.tilesRenderizados;

  // ---- 2. ate a ponta de BAIXO --------------------------------------------
  let s = await rodar(PASSOS, +200, ponto);
  afirmar(
    s.camera.zoom === MENOR,
    `rolando para baixo a camera deveria parar no menor nivel (${MENOR}), veio ${s.camera.zoom}`,
  );
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(sobOPonto),
    `ancoragem: no zoom minimo o mesmo ponto de mouse deveria seguir sobre `
      + `${JSON.stringify(sobOPonto)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  const tilesNoMinimo = s.tilesRenderizados;
  await capturar('zoom-minimo');

  // ---- 3. ate a ponta de CIMA ---------------------------------------------
  s = await rodar(PASSOS * 2, -200, ponto);
  afirmar(
    s.camera.zoom === MAIOR,
    `rolando para cima a camera deveria parar no maior nivel (${MAIOR}), veio ${s.camera.zoom}`,
  );
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(sobOPonto),
    `ancoragem: no zoom maximo o mesmo ponto de mouse deveria seguir sobre `
      + `${JSON.stringify(sobOPonto)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  const tilesNoMaximo = s.tilesRenderizados;
  // Mais mapa no quadro e o que o zoom existe para dar: a Nota do BUILD_PLAN
  // mede que ele e necessidade de NAVEGACAO, nao de desempenho.
  afirmar(
    tilesNoMinimo > tilesNoMaximo,
    `no zoom minimo o quadro deveria caber MAIS tiles que no maximo: `
      + `${tilesNoMinimo} contra ${tilesNoMaximo}`,
  );
  afirmar(
    true,
    `medida: tiles desenhados por nivel — ${tilesNoMinimo} em zoom ${MENOR}, `
      + `${tilesNoNeutro} em zoom ${INICIAL}, ${tilesNoMaximo} em zoom ${MAIOR}`,
  );
  await capturar('zoom-maximo');

  // ---- 4. a ponta nao vaza -------------------------------------------------
  s = await rodar(3, -200, ponto);
  afirmar(
    s.camera.zoom === MAIOR,
    `no maior nivel a roda nao pode passar da lista, veio ${s.camera.zoom}`,
  );

  // ---- 5. de volta ao neutro ----------------------------------------------
  // O caminho do ponteiro passa ESCALA_DO_MUNDO porque getWorldPoint ja inverteu
  // o zoom. Se alguem trocar isso pelo nivel, e aqui e no passo 2 que aparece.
  // Desce ate a ponta de baixo e sobe o numero exato de passos ate o inicial:
  // e a lista que diz quantos sao, nao um numero digitado aqui.
  await rodar(PASSOS, +200, ponto);
  s = await rodar(NIVEIS.indexOf(INICIAL), -200, ponto);
  afirmar(
    s.camera.zoom === INICIAL,
    `deveria dar para voltar ao nivel inicial pela roda, parou em ${s.camera.zoom}`,
  );
  afirmar(
    JSON.stringify(s.tileSobMouse) === JSON.stringify(sobOPonto),
    `de volta ao neutro o ponto deveria seguir sobre ${JSON.stringify(sobOPonto)}, `
      + `veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  // NAO se afirma contagem igual a da abertura: a ancoragem move o scroll de
  // proposito (o tile fica sob o cursor, nao a camera no lugar de antes), e um
  // scroll com fracao de tile faz o culling desenhar uma coluna e uma linha a
  // mais. O que vale no neutro e a ordem: mais mapa que no maximo, menos que no
  // minimo.
  afirmar(
    s.tilesRenderizados > tilesNoMaximo && s.tilesRenderizados < tilesNoMinimo,
    `de volta ao neutro o quadro deveria ficar ENTRE o maximo (${tilesNoMaximo}) e o `
      + `minimo (${tilesNoMinimo}), veio ${s.tilesRenderizados}`,
  );
  afirmar(
    true,
    `medida: a ida e volta pelo zoom nao devolve o scroll da abertura `
      + `(${Math.round(comeco.camera.scrollX)},${Math.round(comeco.camera.scrollY)}) -> `
      + `(${Math.round(s.camera.scrollX)},${Math.round(s.camera.scrollY)}); o que a ancoragem `
      + `promete e o TILE sob o cursor, e esse voltou igual`,
  );
  await capturar('zoom-neutro');
}

module.exports = { roteiro };
