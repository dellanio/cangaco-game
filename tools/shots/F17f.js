'use strict';

// Roteiro da F17f — O PRIMEIRO SPRITE REAL NA TELA.
//
// O que ele existe para provar, e um screenshot sozinho nao provaria: que
// sprite e placeholder CONVIVEM. O armazem e desenhado por PNG; os outros 27
// predios continuam retangulo, e o jogo nao quebra por isso (§9). As duas
// metades saem da MESMA estrutura, `window.__cangaco.spritesDePredio`: chave de
// textura para quem tem arte, `null` para quem caiu no retangulo.
//
// Afirma estado, nunca pixel (§8). O runner ja reprova por erro de console,
// entao um 404 de asset derruba a feature sozinho — nao ha o que afirmar aqui.
//
// A primeira foto e a que o operador pediu para julgar ESCALA: o armazem real,
// um predio placeholder e uma unidade no mesmo quadro. O GDD diz que o civil
// tem cerca da altura de uma porta, e isso nunca foi visto.
//
// O QUE ESTE ROTEIRO NAO MOSTRA, e por que: os sprites de `marcacao` e
// `madeira` do armazem. Nao ha como pol-los na tela hoje — o armazem e
// PERMANENTEMENTE nao construivel (`desbloqueadoPor: null` em buildings.json
// com `menuBuildInicial` vazio, contra o "Storehouse (adicional)" pendurado na
// Sawmill na arvore do GDD; ver BUG-002). Os tres estagios sao provados no
// teste headless (tests/F17f-manifesto.test.ts), que resolve os tres arquivos e
// confere a dimensao de cada um; o que falta e so a prova NA TELA, e ela volta
// junto com a correcao do BUG-002.
//
// Geometria: a mesma linha ja validada na F16b e na F17b — rua na linha de
// porta do armazem, o predio novo a direita da escola.

const { retanguloDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Um predio sem entrada no manifesto, ja de pe na abertura: o outro lado do §9. */
const TIPO_PLACEHOLDER = 'schoolhouse';
/** E um predio sem arte que o jogador PLANTA, para o outro lado do §9 valer
 *  tambem para obra, e nao so para predio pronto. Construivel hoje: a escola da
 *  abertura o desbloqueia. */
const TIPO_DA_OBRA = 'woodcutters';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    const x = canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  const clicarNoTile = async (gx, gy) => {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  };

  /** A textura com que a cena desenhou um predio, ou null se ele virou retangulo. */
  async function spriteDe(id) {
    const mapa = (await estado()).spritesDePredio;
    afirmar(
      Object.prototype.hasOwnProperty.call(mapa, id),
      `a cena deveria publicar o predio ${id} em spritesDePredio, veio `
        + `${JSON.stringify(Object.keys(mapa))}`,
    );
    return mapa[id];
  }

  const idEm = (doEstado, gx, gy) => {
    const achado = Object.entries(doEstado).find(([, p]) => p.gx === gx && p.gy === gy);
    afirmar(achado !== undefined, `deveria existir um predio em (${gx},${gy})`);
    return achado[0];
  };

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado(TIPO_PLACEHOLDER);
  const [largAr, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe(TIPO_PLACEHOLDER).tamanho;
  const [, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const obra = { gx: escola.gx + largEs + 1, gy: yRua - altObra }; // uma coluna livre entre as duas
  afirmar(largAr === 3, `este roteiro assume o armazem com 3 tiles de largura, veio ${largAr}`);

  // ---- 1. ACEITE: sprite, placeholder e unidade no mesmo quadro -------------
  const inicial = await estado();
  const idArmazem = idEm(inicial.prediosDoEstado, armazem.gx, armazem.gy);
  const idEscola = idEm(inicial.prediosDoEstado, escola.gx, escola.gy);

  afirmar(
    (await spriteDe(idArmazem)) === 'predio:storehouse:completo',
    `o armazem deveria ser desenhado pelo PNG do estagio completo, veio ${await spriteDe(idArmazem)}`,
  );
  // O outro lado do §9, na mesma estrutura: sem entrada no manifesto, retangulo.
  afirmar(
    (await spriteDe(idEscola)) === null,
    `a escola nao tem arte e deveria cair no retangulo, veio ${await spriteDe(idEscola)}`,
  );

  // A unidade precisa estar DENTRO do quadro, senao a foto nao responde a
  // pergunta de escala que ela existe para responder.
  const unidades = inicial.unidadesRenderizadas;
  afirmar(unidades.length > 0, 'a abertura deveria ter unidades desenhadas');
  const camera = inicial.camera;
  const visiveis = unidades.filter((u) => {
    const x = canvas.left + u.gxDesenhado * TILE_PX - camera.scrollX;
    const y = canvas.top + u.gyDesenhado * TILE_PX - camera.scrollY;
    return x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom;
  });
  afirmar(
    visiveis.length > 0,
    'alguma unidade tem de estar no quadro para a foto de escala; nenhuma das '
      + `${unidades.length} caiu dentro do canvas`,
  );
  await capturar('armazem-placeholder-unidade');

  // ---- 2. uma OBRA sem arte, ao lado do armazem com arte -------------------
  // O §9 vale tambem para o que o jogador acabou de plantar: obra de predio sem
  // entrada no manifesto continua sendo a marcacao geometrica de sempre, e o
  // sprite do vizinho nao muda por causa dela.
  await page.click(`[data-predio="${TIPO_DA_OBRA}"]`);
  await esperarFrame();
  await clicarNoTile(obra.gx, obra.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape'); // larga a planta fantasma
  await esperarFrame();

  const depoisDePlantar = await estado();
  const ID_DA_OBRA = idEm(depoisDePlantar.prediosDoEstado, obra.gx, obra.gy);
  afirmar(
    depoisDePlantar.prediosDoEstado[ID_DA_OBRA].estado === 'obra',
    'o predio recem-plantado deveria estar em obra',
  );
  afirmar(
    depoisDePlantar.estagiosDeObraRenderizados.marcacao >= 1,
    'deveria haver uma obra em marcacao, veio '
      + `${JSON.stringify(depoisDePlantar.estagiosDeObraRenderizados)}`,
  );
  afirmar(
    (await spriteDe(ID_DA_OBRA)) === null,
    `a obra de um predio sem arte deveria cair no retangulo, veio ${await spriteDe(ID_DA_OBRA)}`,
  );
  afirmar(
    (await spriteDe(idArmazem)) === 'predio:storehouse:completo',
    'o armazem nao deveria perder o sprite por causa da obra nova ao lado',
  );
  await capturar('obra-placeholder-ao-lado-do-sprite');
}

module.exports = { roteiro };
