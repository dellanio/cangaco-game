'use strict';
// Roteiro da F17f — O PRIMEIRO SPRITE REAL NA TELA.
//
// O que ele existe para provar, e um screenshot sozinho nao provaria: que
// sprite e placeholder CONVIVEM. Predio com arte e desenhado por PNG; predio sem
// entrada no manifesto continua retangulo, e o jogo nao quebra por isso (§9). As
// duas metades saem da MESMA estrutura, `window.__cangaco.spritesDePredio`:
// chave de textura para quem tem arte, `null` para quem caiu no retangulo.
//
// Afirma estado, nunca pixel (§8). O runner ja reprova por erro de console,
// entao um 404 de asset derruba a feature sozinho — nao ha o que afirmar aqui.
//
// A primeira foto e a que o operador pediu para julgar ESCALA: o armazem real,
// a escola e uma unidade no mesmo quadro. O GDD diz que o civil tem cerca da
// altura de uma porta.
//
// O lado do retangulo mudou de dono (BUG-M, 2026-09-26). Quando este roteiro
// nasceu, a escola da abertura nao tinha arte e era ela o placeholder; o lote de
// sprites (`f83f8a4`) deu arte a escola, a taverna, a pedreira e ao lenhador — os
// quatro predios plantaveis na abertura. Nao sobrou predio sem arte ao alcance do
// primeiro clique. O primeiro que sobra e a torre de vigia (`watchtower`,
// desbloqueada pela pedreira de pe), entao o roteiro levanta a pedreira pelo
// caminho da F11c (`_pedreira.js`) e planta a torre: a obra de um predio sem
// arte, ao lado do armazem com arte, e o §9 provado no que o jogador PLANTA.
// Quem e o placeholder sai do manifesto, afirmado, e nao da memoria: se a torre
// ganhar arte, este roteiro acusa em vez de passar calado.
//
// Geometria: a pedreira da F-T3 (a oeste do armazem, com a rua ate a escola) e
// a torre a direita da escola, na linha de porta.
const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { arrastosDaRua } = require('./_recursos');
const { pedreiraNoLajedo } = require('./_pedreira');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');
const { assets } = require('../../assets/manifest.json');
const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);
const temArte = (id) => assets.some((e) => e.id === id);
/** O predio sem arte que o jogador planta: o outro lado do §9, na obra. */
const TIPO_DA_OBRA = 'watchtower';

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

  /** Avanca de `passo` em `passo` ticks ate a condicao valer; falha alto se nunca vale. */
  async function ate(cond, passo, maximo, descricao) {
    for (let i = 0; i < maximo; i++) {
      const s = await estado();
      if (cond(s)) return s;
      await avancar(passo);
      await esperarFrame();
    }
    return afirmar(false, `a condicao '${descricao}' nunca valeu em ${maximo} tentativas de ${passo} ticks`);
  }

  /** Anda a camera com as setas ate a coluna cair no meio do quadro (molde da F-T3). */
  async function centrarEm(gx) {
    const alvo = Math.max(0, gx * TILE_PX - (canvas.right - canvas.left) / 2);
    for (let i = 0; i < 30; i += 1) {
      const { camera } = await estado();
      const delta = alvo - camera.scrollX;
      if (Math.abs(delta) < TILE_PX) return;
      const tecla = delta > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(tecla);
      await page.waitForTimeout(120);
      await page.keyboard.up(tecla);
      await esperarFrame();
    }
  }

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

  // ---- geometria e premissas, tiradas dos JSON -----------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largAr, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu] = defDe('quarry').tamanho;
  const [, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const obra = { gx: escola.gx + largEs + 1, gy: yRua - altObra }; // uma coluna livre depois da escola
  afirmar(largAr === 3, `este roteiro assume o armazem com 3 tiles de largura, veio ${largAr}`);
  afirmar(temArte('storehouse') && temArte('schoolhouse'), 'o armazem e a escola deveriam ter entrada no manifesto');
  afirmar(
    !temArte(TIPO_DA_OBRA),
    `'${TIPO_DA_OBRA}' ganhou entrada no manifesto: escolha outro predio sem arte para o lado do retangulo`,
  );
  afirmar(
    defDe(TIPO_DA_OBRA).desbloqueadoPor === 'quarry',
    `este roteiro levanta a pedreira para liberar '${TIPO_DA_OBRA}', que pede '${defDe(TIPO_DA_OBRA).desbloqueadoPor}'`,
  );

  // ---- 1. ACEITE: sprites e unidade no mesmo quadro ------------------------
  const inicial = await estado();
  const idArmazem = idEm(inicial.prediosDoEstado, armazem.gx, armazem.gy);
  const idEscola = idEm(inicial.prediosDoEstado, escola.gx, escola.gy);

  afirmar(
    (await spriteDe(idArmazem)) === 'predio:storehouse:completo',
    `o armazem deveria ser desenhado pelo PNG do estagio completo, veio ${await spriteDe(idArmazem)}`,
  );
  afirmar(
    (await spriteDe(idEscola)) === 'predio:schoolhouse:completo',
    `a escola deveria ser desenhada pelo PNG do estagio completo, veio ${await spriteDe(idEscola)}`,
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
  await capturar('armazem-escola-unidade');

  // ---- 2. a pedreira de pe, que libera a torre -----------------------------
  const { pedreira, tilesDaRua: rua } = pedreiraNoLajedo({
    armazem, escola, tamanhoDe: (id) => defDe(id).tamanho, afirmar,
  });
  await centrarEm(pedreira.gx + largQu);
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  await clicarNoTile(pedreira.gx, pedreira.gy);
  await avancar(1); // o clique so enfileira o comando; um passo o aplica (F11a)
  await esperarFrame();
  await page.keyboard.press('Escape');
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const { gy, de, ate: ateX } of arrastosDaRua(rua)) {
    await centrarEm(Math.floor((de + ateX) / 2));
    await arrastarDentroDoCanvas(page, canvas, [await pontoDoTile(de, gy), await pontoDoTile(ateX, gy)]);
    await avancar(1); // o arrasto so enfileira o PlaceRoad
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  // O estado da SIM, e nao um canal do render: o que interessa aqui e o desbloqueio.
  const idPedreira = idEm((await estado()).prediosDoEstado, pedreira.gx, pedreira.gy);
  await ate(
    (e) => e.prediosDoEstado[idPedreira]?.estado === 'completo',
    20, 150, 'a pedreira deveria ficar de pe',
  );

  // ---- 3. uma OBRA sem arte, ao lado do armazem com arte -------------------
  // O §9 vale tambem para o que o jogador acabou de plantar: obra de predio sem
  // entrada no manifesto continua sendo a marcacao geometrica de sempre, e o
  // sprite do vizinho nao muda por causa dela.
  await centrarEm(obra.gx);
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
    depoisDePlantar.prediosDoEstado[ID_DA_OBRA].tipo === TIPO_DA_OBRA
      && depoisDePlantar.prediosDoEstado[ID_DA_OBRA].estado === 'obra',
    `a ${TIPO_DA_OBRA} recem-plantada deveria estar em obra, veio `
      + `${JSON.stringify(depoisDePlantar.prediosDoEstado[ID_DA_OBRA])}`,
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
