'use strict';

// Roteiro da F17d — O NIVELAMENTO VISIVEL NO CANTEIRO.
//
// O que ele existe para provar, e que um screenshot unico NAO provaria: o
// canteiro ENCHE. Um canteiro que nasce correto e nunca mais muda passa em
// qualquer foto tirada uma vez so — e era esse o risco do desenho: aplainar o
// chao nao mexe em `estado` nem em `estagio`, e a assinatura do medidor da F17b
// tambem nao se mexe enquanto nenhum material chega. Por isso a medida e SEMPRE
// contra a PRIMEIRA LEITURA, feita no tick da planta, nunca contra zero.
//
// Afirma numero, nunca pixel (§8): o canteiro do mapa sai de
// `window.__cangaco.canteirosDeObra` e o painel sai do DOM. As duas fontes sao
// separadas de proposito, e no fim o roteiro confere uma contra a outra — mapa e
// painel fazem a MESMA conta (`render/nivelamento-obra.ts`), e divergirem seria
// o defeito que a funcao unica existe para impedir.
//
// Geometria: a mesma linha ja validada na F16b e na F17b — rua na linha de porta
// do armazem, o predio novo a direita da escola.
//
// Todo clique no mapa acontece com o painel FECHADO: ele e sobreposicao no canto
// do canvas, e o que esta debaixo dele nao recebe mouse (licao da F16b).

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

const TIPO_DA_OBRA = 'woodcutters';
/** Um laborer precisa nascer, achar a tarefa e CAMINHAR ate a obra antes do
 *  primeiro tick de nivelamento. A F17b mediu o primeiro MATERIAL chegando nesta
 *  mesma geometria com folga dentro de 1000 ticks, e o nivelamento acontece
 *  antes do material — 1000 e o mesmo teto, com a mesma folga. Falhar por teto E
 *  FALHAR, nao motivo para dormir mais. */
const TETO = 1000;
/** 10 ticks por tile no dado de hoje (`construcao.ticksNivelamentoPorTile`): um
 *  passo de 10 avanca NO MAXIMO um tile, entao o canteiro nunca pula de vazio
 *  para cheio entre duas leituras. E o que torna a foto do canteiro pela metade
 *  alcancavel, e nao sorte. */
const PASSO_DE_AVANCO = 10;

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

  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  /** O canteiro que a CENA desenhou para esta obra, no tick desenhado. */
  async function canteiroNoMapa(id) {
    const c = (await estado()).canteirosDeObra[id];
    afirmar(
      c !== undefined && c !== null && typeof c.tilesProntos === 'number',
      `a cena deveria publicar o canteiro da obra ${id}, veio ${JSON.stringify(c)}`,
    );
    return c;
  }

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largObra, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const TILES_DA_OBRA = largObra * altObra;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const obra = { gx: escola.gx + largEs + 1, gy: yRua - altObra }; // uma coluna livre entre as duas
  const meioDaObra = { gx: obra.gx + Math.floor(largObra / 2), gy: obra.gy };
  const pontaEsquerda = { gx: armazem.gx, gy: yRua };
  const pontaDireita = { gx: obra.gx + largObra - 1, gy: yRua };
  const tilesDaRua = pontaDireita.gx - pontaEsquerda.gx + 1;

  // ---- 1. a rua ------------------------------------------------------------
  // Sem rede o laborer nunca chega e o canteiro ficaria em 0 pelo motivo errado —
  // o roteiro reprovaria por teto sem dizer o porque.
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pEsq = await pontoDoTile(pontaEsquerda.gx, pontaEsquerda.gy);
  const pDir = await pontoDoTile(pontaDireita.gx, pontaDireita.gy);
  await arrastarDentroDoCanvas(page, canvas, [pEsq, pDir]);
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await estado()).estradasRenderizadas === tilesDaRua,
    `a rua deveria ter ${tilesDaRua} tiles, veio ${(await estado()).estradasRenderizadas}`,
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 2. a obra, recem-plantada: o canteiro nasce VAZIO --------------------
  await page.click(`[data-predio="${TIPO_DA_OBRA}"]`);
  await esperarFrame();
  await clicarNoTile(obra.gx, obra.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape'); // larga a planta fantasma
  await esperarFrame();

  // O id nao e previsivel: acha-se pelo CANTO, que e a coordenada escolhida aqui.
  const doEstado = (await estado()).prediosDoEstado;
  const achado = Object.entries(doEstado).find(([, p]) => p.gx === obra.gx && p.gy === obra.gy);
  afirmar(achado !== undefined, `deveria existir um predio plantado em (${obra.gx},${obra.gy})`);
  const ID_DA_OBRA = achado[0];
  afirmar(achado[1].estado === 'obra', 'o predio recem-plantado deveria estar em obra');

  // A PRIMEIRA LEITURA, no tick da planta. E contra ela que tudo se mede.
  const PRIMEIRA = await canteiroNoMapa(ID_DA_OBRA);
  afirmar(
    PRIMEIRA.tilesProntos === 0 && PRIMEIRA.nivelada === false,
    `obra recem-plantada nao tem tile aplainado nenhum, veio ${JSON.stringify(PRIMEIRA)}`,
  );
  afirmar(
    PRIMEIRA.tilesTotais === TILES_DA_OBRA,
    `o canteiro deveria ter os ${TILES_DA_OBRA} tiles do footprint do dado, veio ${PRIMEIRA.tilesTotais}`,
  );

  // ---- 3. ACEITE: o canteiro ENCHE -----------------------------------------
  let canteiro = PRIMEIRA;
  let ticks = 0;
  while (canteiro.tilesProntos <= PRIMEIRA.tilesProntos && ticks < TETO) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
    // a obra pode ter ficado pronta: ai ela sai de `canteirosDeObra` e a janela
    // do teste se fechou — e isso e falha, nao sucesso.
    const publicado = (await estado()).canteirosDeObra[ID_DA_OBRA];
    afirmar(
      publicado !== undefined,
      `a obra sumiu do canteiro no tick ~${ticks} sem que nenhum tile tivesse sido aplainado`,
    );
    canteiro = publicado;
  }
  // contra a PRIMEIRA LEITURA, e nao contra 0: e o que separa "o canteiro
  // acompanha" de "o canteiro nasceu com um numero e congelou".
  afirmar(
    canteiro.tilesProntos > PRIMEIRA.tilesProntos,
    `em ${TETO} ticks nenhum tile foi aplainado: `
      + `${JSON.stringify(PRIMEIRA)} -> ${JSON.stringify(canteiro)}`,
  );
  afirmar(
    canteiro.tilesProntos <= canteiro.tilesTotais,
    `o canteiro nunca passa do footprint, veio ${JSON.stringify(canteiro)}`,
  );

  // ---- 4. o painel diz o mesmo numero, DURANTE o nivelamento ----------------
  await clicarNoTile(meioDaObra.gx, meioDaObra.gy);
  afirmar(
    (await page.getAttribute('#painel-predio', 'data-predio-aberto')) === ID_DA_OBRA,
    'o clique deveria abrir o painel da obra que o roteiro plantou',
  );
  const noPainel = await page.$eval('#painel-predio .linha.nivelamento', (n) => ({
    prontos: Number(n.dataset.tilesProntos),
    totais: Number(n.dataset.tilesTotais),
    texto: n.textContent,
  }));
  // GUARDA: o painel contra o MAPA, nao contra numero digitado aqui. Os dois
  // chamam `canteiroDaObra`; divergirem seria o que a funcao unica impede.
  const noMapa = await canteiroNoMapa(ID_DA_OBRA);
  afirmar(
    noPainel.prontos === noMapa.tilesProntos && noPainel.totais === noMapa.tilesTotais,
    `painel e mapa deveriam dizer o mesmo: ${JSON.stringify(noPainel)} vs ${JSON.stringify(noMapa)}`,
  );
  afirmar(
    noPainel.texto.includes(tema.painelPredio.nivelando),
    `o rotulo deveria vir do tema ("${tema.painelPredio.nivelando}"), veio ${JSON.stringify(noPainel.texto)}`,
  );
  // O DEFEITO DA F16b que a correcao desta sessao tirou: durante o nivelamento o
  // painel NAO pode mais escrever "Em obra 0%" — as duas linhas sao exclusivas.
  afirmar(
    (await page.$('#painel-predio .linha.obra')) === null,
    'durante o nivelamento o painel nao deveria escrever "Em obra 0%" (defeito da F16b)',
  );
  await page.keyboard.press('Escape'); // fecha o painel antes da foto do mapa
  await esperarFrame();

  // ---- 5. FOTO 1: o canteiro pela metade -----------------------------------
  const METADE = Math.ceil(TILES_DA_OBRA / 2);
  while (canteiro.tilesProntos < METADE && !canteiro.nivelada && ticks < TETO * 2) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
    const publicado = (await estado()).canteirosDeObra[ID_DA_OBRA];
    afirmar(publicado !== undefined, `a obra sumiu do canteiro no tick ~${ticks}`);
    canteiro = publicado;
  }
  afirmar(
    canteiro.tilesProntos >= METADE && !canteiro.nivelada,
    `a foto 1 precisa do canteiro PELA METADE (>= ${METADE} e < ${TILES_DA_OBRA}), `
      + `veio ${JSON.stringify(canteiro)}`,
  );
  await capturar('nivelando'); // F17d-1-nivelando.png

  // ---- 6. FOTO 2: o canteiro plano, com o medidor de material aceso --------
  while (!canteiro.nivelada && ticks < TETO * 3) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
    const publicado = (await estado()).canteirosDeObra[ID_DA_OBRA];
    afirmar(
      publicado !== undefined,
      `a obra ficou PRONTA antes de o roteiro fotografar o canteiro plano (tick ~${ticks})`,
    );
    canteiro = publicado;
  }
  afirmar(
    canteiro.nivelada && canteiro.tilesProntos === canteiro.tilesTotais,
    `no fim o canteiro deveria estar plano, veio ${JSON.stringify(canteiro)}`,
  );
  // o medidor de material continua publicado e com a MESMA forma: nivelar nao
  // esconde nada, so esmaece — e agora ele esta aceso.
  const medidor = (await estado()).medidoresDeObra[ID_DA_OBRA];
  afirmar(
    Array.isArray(medidor) && medidor.length > 0 && medidor.every((l) => l.total > 0),
    `o medidor de material deveria continuar publicado e com denominador, veio ${JSON.stringify(medidor)}`,
  );
  await capturar('nivelada'); // F17d-2-nivelada.png
}

module.exports = { roteiro };
