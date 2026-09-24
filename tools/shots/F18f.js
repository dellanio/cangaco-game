'use strict';

// F18f — unidade empilhada nao some.
//
// A regra de colisao da F03 continua: civis ocupam o mesmo tile. O que muda e o DESENHO —
// cada unidade sai do centro do tile por um deslocamento derivado do id. O roteiro monta o
// cenario onde a pilha foi MEDIDA (rua do armazem ate a pedreira + pedreira plantada, a
// geometria do F22), espera POR CONDICAO ate haver uma pilha, e afirma que as N unidades do
// mesmo tile tem N centros desenhados distintos em pixel.

const { retanguloDoCanvas, arrastarDentroDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const ESCALA_DO_MUNDO = 1; // render/grid.ts
const LADO_DO_TILE = TILE_PX * ESCALA_DO_MUNDO;
const LADO_DA_UNIDADE = LADO_DO_TILE * 0.5; // `LADO_EM_TILES` de render/unidades.ts
// O anel em que o desenho se desloca: raio `(1 - 0.5) / 2` tile, e corda entre vizinhos IGUAL
// ao raio (6 posicoes). E o minimo que o aceite afirma entre dois centros desenhados.
const RAIO_DO_ANEL = LADO_DO_TILE * 0.25;
const FOLGA = 1e-6; // ponto flutuante: cos/sin nao fecham exato

const ALVO_DA_PILHA = 6;
const PASSOS_DE_ZOOM = 6; // o bastante para bater no maior nivel de `data/terrain.json`
const TETO = 600;
const BLOCO = 5;

const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Onde a unidade foi DESENHADA, em px de mundo: centro do tile + o deslocamento do id. */
const pixelDe = (u) => ({
  x: u.gxDesenhado * LADO_DO_TILE + LADO_DO_TILE / 2 + u.deslocamentoPx.x,
  y: u.gyDesenhado * LADO_DO_TILE + LADO_DO_TILE / 2 + u.deslocamentoPx.y,
});

/** A maior pilha do quadro: unidades na MESMA posicao de tick (o que a sim diz). */
function maiorPilha(unidades) {
  const grupos = new Map();
  for (const u of unidades) {
    const chave = `${u.gxDesenhado.toFixed(3)},${u.gyDesenhado.toFixed(3)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), u]);
  }
  let maior = { onde: null, unidades: [] };
  for (const [onde, us] of grupos) if (us.length > maior.unidades.length) maior = { onde, unidades: us };
  return maior;
}

/** Menor distancia entre dois centros DESENHADOS do grupo, em px. */
function menorDistancia(unidades) {
  let menor = Infinity;
  let par = null;
  for (let i = 0; i < unidades.length; i += 1) {
    for (let j = i + 1; j < unidades.length; j += 1) {
      const a = pixelDe(unidades[i]);
      const b = pixelDe(unidades[j]);
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < menor) { menor = d; par = `${unidades[i].id}/${unidades[j].id}`; }
    }
  }
  return { menor, par };
}

async function roteiro(ctx) {
  const { page, estado, afirmar, capturar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const esperarFrame = () => page.waitForTimeout(100);

  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    return {
      x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
      y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
    };
  }

  // ---- 1. o cenario onde a pilha foi medida --------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu, altQu] = defDe('quarry').tamanho;
  const yRua = armazem.gy + altAr;
  const pedreira = { gx: escola.gx + largEs + 1, gy: yRua - altQu };
  afirmar(escola.gy + altEs === yRua, 'armazem e escola deveriam ter a porta na mesma linha');

  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await arrastarDentroDoCanvas(page, canvas, [
    await pontoDoTile(armazem.gx, yRua),
    await pontoDoTile(pedreira.gx + largQu - 1, yRua),
  ]);
  await avancar(1);
  await page.keyboard.press('Escape');
  await esperarFrame();

  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  const pPedreira = await pontoDoTile(pedreira.gx, pedreira.gy);
  await page.mouse.click(pPedreira.x, pPedreira.y);
  await avancar(1);
  await page.keyboard.press('Escape');
  await esperarFrame();

  const abertura = await estado();
  afirmar(
    abertura.unidadesRenderizadas.length > 1,
    `o cenario precisa de mais de uma unidade para haver pilha, veio ${abertura.unidadesRenderizadas.length}`,
  );

  // ---- 2. esperar POR CONDICAO ate a pilha existir --------------------------
  // Quantos ticks ate as unidades convergirem depende do caminho e da fila de tarefas; o que
  // o aceite precisa e da PILHA, entao a espera e pela pilha, nunca por um numero chutado.
  let pilha = maiorPilha(abertura.unidadesRenderizadas);
  let tickDaPilha = abertura.tick;
  for (let t = 0; t < TETO && pilha.unidades.length < ALVO_DA_PILHA; t += BLOCO) {
    await avancar(BLOCO);
    await esperarFrame();
    const s = await estado();
    pilha = maiorPilha(s.unidadesRenderizadas);
    tickDaPilha = s.tick;
  }
  const n = pilha.unidades.length;
  afirmar(
    n >= ALVO_DA_PILHA,
    `deveria haver uma pilha de ao menos ${ALVO_DA_PILHA} unidades no mesmo tile em ate ${TETO} ticks; `
      + `a maior no tick ${tickDaPilha} foi de ${n}`,
  );

  // ---- 3. o aceite: N unidades, N centros desenhados distintos --------------
  const centros = new Set(pilha.unidades.map((u) => `${pixelDe(u).x.toFixed(6)},${pixelDe(u).y.toFixed(6)}`));
  afirmar(
    centros.size === n,
    `as ${n} unidades de ${pilha.onde} deveriam ter ${n} centros desenhados distintos, `
      + `vieram ${centros.size} (ids ${JSON.stringify(pilha.unidades.map((u) => u.id))})`,
  );

  const { menor, par } = menorDistancia(pilha.unidades);
  afirmar(
    menor >= RAIO_DO_ANEL - FOLGA,
    `a menor distancia entre dois centros desenhados deveria ser >= o raio do anel `
      + `(${RAIO_DO_ANEL} px), veio ${menor.toFixed(3)} px no par ${par}`,
  );

  // o deslocamento nao pode VAZAR do tile: o quadrado tem lado 32 px e o centro anda ate 16 px,
  // entao a quina fica exatamente na borda. Acima disso a unidade apareceria no tile do vizinho.
  for (const u of pilha.unidades) {
    const raio = Math.hypot(u.deslocamentoPx.x, u.deslocamentoPx.y);
    afirmar(
      raio <= RAIO_DO_ANEL + FOLGA && raio + LADO_DA_UNIDADE / 2 <= LADO_DO_TILE / 2 + FOLGA,
      `${u.id} deveria se deslocar no maximo ${RAIO_DO_ANEL} px sem vazar do tile, veio ${raio.toFixed(3)} px`,
    );
  }

  // ---- a evidencia visual ---------------------------------------------------
  // A foto e do QUADRO da pilha: depois dele as unidades seguem andando. E ela so serve se
  // der para CONTAR os quadrados, entao o ponto da pilha tem de estar DENTRO do canvas —
  // medido, nao suposto (o painel do HUD fica ao lado do canvas, nao em cima dele).
  const [gxDaPilha, gyDaPilha] = pilha.onde.split(',').map(Number);
  const noQuadro = async () => {
    const { camera } = await estado();
    return pontoDoTileNaTela(canvas, { gx: gxDaPilha, gy: gyDaPilha }, camera, TILE_PX);
  };
  const dentroDoCanvas = (ponto) => ponto.x > canvas.left && ponto.x < canvas.right
    && ponto.y > canvas.top && ponto.y < canvas.bottom;

  const ondeCai = await noQuadro();
  afirmar(
    dentroDoCanvas(ondeCai),
    `a pilha de ${pilha.onde} deveria estar visivel no canvas, cairia em `
      + `(${Math.round(ondeCai.x)},${Math.round(ondeCai.y)})`,
  );
  await capturar('pilha-separada');

  // De perto, no maior zoom: em zoom 1 o anel de 16 px cabe em meia unha. O zoom ancora no
  // ponto do mouse (F18b), entao a pilha fica onde esta.
  await page.mouse.move(ondeCai.x, ondeCai.y);
  for (let i = 0; i < PASSOS_DE_ZOOM; i += 1) {
    await page.mouse.wheel(0, -120);
    await esperarFrame();
  }
  const dePerto = await noQuadro();
  const comZoom = await estado();
  afirmar(
    comZoom.camera.zoom > 1 && dentroDoCanvas(dePerto),
    `no zoom ${comZoom.camera.zoom} a pilha deveria seguir no quadro, cairia em `
      + `(${Math.round(dePerto.x)},${Math.round(dePerto.y)})`,
  );
  await capturar('pilha-de-perto');

  // ---- 4. a posicao de JOGO nao mudou, e o deslocamento nao salta -----------
  const mesmaPosicao = pilha.unidades.every(
    (u) => u.gxDesenhado === pilha.unidades[0].gxDesenhado && u.gyDesenhado === pilha.unidades[0].gyDesenhado,
  );
  afirmar(
    mesmaPosicao,
    'as unidades da pilha deveriam seguir no MESMO tile: o deslocamento e de desenho, nao move a unidade',
  );

  const antes = new Map(pilha.unidades.map((u) => [u.id, `${u.deslocamentoPx.x},${u.deslocamentoPx.y}`]));
  await avancar(BLOCO);
  await esperarFrame();
  const depois = await estado();
  const saltaram = depois.unidadesRenderizadas
    .filter((u) => antes.has(u.id) && antes.get(u.id) !== `${u.deslocamentoPx.x},${u.deslocamentoPx.y}`)
    .map((u) => u.id);
  afirmar(
    saltaram.length === 0,
    `o deslocamento vem do id e nao pode mudar de quadro para quadro; saltaram ${JSON.stringify(saltaram)}`,
  );
}

module.exports = { roteiro };
