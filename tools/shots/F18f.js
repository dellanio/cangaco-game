'use strict';

// F18f — unidade empilhada nao some.
//
// I-MOVIMENTO-COLISAO-CIVIL-LIGADA (decisao do operador, 2026-10-04): civis COLIDEM, um por tile.
// A pilha que este roteiro esperava (6 unidades no mesmo tile, a regra da F03) era o defeito que
// a colisao elimina, e o operador relatou (BUG-CIVIS-EMPILHADOS). O roteiro monta o MESMO cenario
// onde a pilha foi medida (rua do armazem ate a pedreira + pedreira plantada, a geometria do F22)
// e passa a afirmar o contrario, mais estrito: em 600 ticks nenhuma pilha de 3 ou mais unidades
// no mesmo ponto (a de 6 era o defeito). Pilha de 2 ainda acontece, e a F18f continua valendo
// para ela: N unidades, N centros desenhados distintos. Medido: o serf ocioso parado no tile em
// que o obreiro martela ou nivela a obra (estado "dentro", que nao ocupa tile; PROGRESS,
// Perguntas em aberto), e os cruzamentos de frente de um instante. O deslocamento pelo id
// continua sem saltar.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
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

const TETO = 600;
const BLOCO = 5;

const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

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

  // ---- 2. a pilha nao se forma -----------------------------------------------
  const visiveis = (st) => st.unidadesRenderizadas.filter((u) => u.visivel);
  /** Onde a unidade foi DESENHADA, em px de mundo: centro do tile + o deslocamento do id. */
  const pixelDe = (u) => `${(u.gxDesenhado * LADO_DO_TILE + u.deslocamentoPx.x).toFixed(6)},${(u.gyDesenhado * LADO_DO_TILE + u.deslocamentoPx.y).toFixed(6)}`;
  let maior = 1;
  let pilhasDeDois = 0;
  let ultimo = abertura;
  for (let t = 0; t < TETO; t += BLOCO) {
    await avancar(BLOCO);
    await esperarFrame();
    ultimo = await estado();
    const pilhaDoQuadro = maiorPilha(visiveis(ultimo));
    const n = pilhaDoQuadro.unidades.length;
    maior = Math.max(maior, n);
    if (n < 2) continue;
    pilhasDeDois += 1;
    const centros = new Set(pilhaDoQuadro.unidades.map(pixelDe));
    afirmar(centros.size === n, `tick ${ultimo.tick}: as ${n} unidades de ${pilhaDoQuadro.onde} deveriam ter ${n} centros desenhados distintos, vieram ${centros.size}`);
  }
  afirmar(maior < 3, `com a colisao civil, nenhuma pilha de 3 ou mais deveria se formar em ${TETO} ticks; a maior foi de ${maior}`);
  console.log(`F18f: ${TETO} ticks, maior pilha ${maior}, ${pilhasDeDois} quadros com pilha de 2 (centros distintos)`);
  await capturar('sem-pilha');
  const pilha = { unidades: visiveis(ultimo) };
  // o deslocamento nao pode VAZAR do tile: o quadrado tem lado 32 px e o centro anda ate 16 px
  for (const u of pilha.unidades) {
    const raio = Math.hypot(u.deslocamentoPx.x, u.deslocamentoPx.y);
    afirmar(
      raio <= RAIO_DO_ANEL + FOLGA && raio + LADO_DA_UNIDADE / 2 <= LADO_DO_TILE / 2 + FOLGA,
      `${u.id} deveria se deslocar no maximo ${RAIO_DO_ANEL} px sem vazar do tile, veio ${raio.toFixed(3)} px`,
    );
  }

  // ---- 3. o deslocamento vem do id e nao salta -----------------------------
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
