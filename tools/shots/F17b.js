'use strict';

// Roteiro da F17b — O MATERIAL ENTREGUE VISIVEL NA OBRA.
//
// O que ele existe para provar, e que um screenshot unico NAO provaria: o
// medidor ENCHE. Um medidor que nasce correto e nunca mais muda passa em
// qualquer foto tirada uma vez so — e era esse o risco do desenho (D3 do plano):
// material que chega nao mexe em `estado` nem em `estagio`, que eram a chave
// inteira do diff de `atualizarPredios` ate esta feature. Por isso a medida e
// SEMPRE contra a PRIMEIRA LEITURA, nunca contra zero.
//
// Afirma numero, nunca pixel (§8): os blocos do mapa saem de
// `window.__cangaco.medidoresDeObra` (a leitura do tick desenhado) e o painel
// sai do DOM. As duas fontes sao separadas de proposito, e no fim o roteiro
// confere uma contra a outra — mapa e painel fazem a MESMA conta
// (`render/medidor-obra.ts`), e divergirem seria o defeito que a funcao unica
// existe para impedir.
//
// Geometria: a mesma linha ja validada na F16b — rua na linha de porta do
// armazem, o predio novo a direita da escola. Uma obra so, porque a pergunta
// aqui e "quanto chegou nesta", nao "a vila inteira sobe".
//
// Todo clique no mapa acontece com o painel FECHADO: ele e sobreposicao no
// canto do canvas, e o que esta debaixo dele nao recebe mouse (licao da F16b).

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

const TIPO_DA_OBRA = 'woodcutters';
/** A F17 mediu a primeira obra completa da abertura em 265 ticks; a F16b, a
 *  obra desta mesma geometria em 220. O primeiro material chega muito antes.
 *  1000 e ~4x de folga sobre o marco mais lento — e falhar por teto E FALHAR,
 *  nao motivo para dormir mais. */
const TETO_ATE_CHEGAR_MATERIAL = 1000;
const PASSO_DE_AVANCO = 50; // um `avancar` seco e grande estoura o frame (F16b)

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

  /** O medidor que a CENA desenhou para esta obra, no tick desenhado. */
  async function medidorNoMapa(id) {
    const linhas = (await estado()).medidoresDeObra[id];
    afirmar(
      Array.isArray(linhas) && linhas.length > 0,
      `a cena deveria publicar o medidor da obra ${id}, veio ${JSON.stringify(linhas)}`,
    );
    return linhas;
  }
  const somaEntregue = (linhas) => linhas.reduce((s, l) => s + l.entregue, 0);

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largAr, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largObra, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const obra = { gx: escola.gx + largEs + 1, gy: yRua - altObra }; // uma coluna livre entre as duas
  const meioDaObra = { gx: obra.gx + Math.floor(largObra / 2), gy: obra.gy };
  const pontaEsquerda = { gx: armazem.gx, gy: yRua };
  const pontaDireita = { gx: obra.gx + largObra - 1, gy: yRua };
  const tilesDaRua = pontaDireita.gx - pontaEsquerda.gx + 1;
  afirmar(largAr > 0, 'o armazem precisa ter footprint no dado');

  // ---- 1. a rua ------------------------------------------------------------
  // Sem rede a obra nunca recebe nada e o medidor ficaria em 0 pelo motivo
  // errado — o roteiro reprovaria por teto sem dizer o porque.
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

  // ---- 2. a obra, recem-plantada: o medidor nasce VAZIO ---------------------
  await page.click(`[data-predio="${TIPO_DA_OBRA}"]`);
  await esperarFrame();
  await clicarNoTile(obra.gx, obra.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape'); // larga a planta fantasma
  await esperarFrame();

  // O id nao e previsivel: a obra que acabou de nascer recebe o proximo numero
  // livre. Acha-se pelo CANTO, que e a coordenada que o roteiro escolheu.
  const doEstado = (await estado()).prediosDoEstado;
  const achado = Object.entries(doEstado).find(([, p]) => p.gx === obra.gx && p.gy === obra.gy);
  afirmar(achado !== undefined, `deveria existir um predio plantado em (${obra.gx},${obra.gy})`);
  const ID_DA_OBRA = achado[0];
  afirmar(achado[1].estado === 'obra', 'o predio recem-plantado deveria estar em obra');

  const primeiraLeitura = await medidorNoMapa(ID_DA_OBRA);
  afirmar(
    primeiraLeitura.every((l) => l.entregue === 0),
    `obra recem-plantada nao tem material nenhum, veio ${JSON.stringify(primeiraLeitura)}`,
  );
  afirmar(
    primeiraLeitura.every((l) => l.total > 0),
    `toda fileira do medidor precisa de um total, veio ${JSON.stringify(primeiraLeitura)}`,
  );
  const SOMA_INICIAL = somaEntregue(primeiraLeitura);
  await capturar('vazio'); // o medidor na hora em que a obra nasce

  // ---- 3. ACEITE: o medidor ENCHE ------------------------------------------
  let linhas = primeiraLeitura;
  let ticks = 0;
  while (somaEntregue(linhas) <= SOMA_INICIAL && ticks < TETO_ATE_CHEGAR_MATERIAL) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
    // a obra pode ter ficado pronta: ai ela sai de `medidoresDeObra` e o teste
    // do medidor enchendo perdeu a janela — e isso e falha, nao sucesso.
    const publicado = (await estado()).medidoresDeObra[ID_DA_OBRA];
    afirmar(
      Array.isArray(publicado),
      `a obra sumiu do medidor no tick ~${ticks} sem que material nenhum tivesse chegado`,
    );
    linhas = publicado;
  }
  afirmar(
    somaEntregue(linhas) > SOMA_INICIAL,
    `em ${TETO_ATE_CHEGAR_MATERIAL} ticks nenhum material chegou a obra: `
      + `${SOMA_INICIAL} -> ${somaEntregue(linhas)} (${JSON.stringify(linhas)})`,
  );
  // contra a PRIMEIRA LEITURA, e nao contra 0: e o que separa "o medidor
  // acompanha" de "o medidor nasceu com um numero e congelou" (D3).
  afirmar(
    linhas.some((l, i) => l.entregue > primeiraLeitura[i].entregue),
    `alguma fileira tinha de ter subido contra a primeira leitura, `
      + `${JSON.stringify(primeiraLeitura)} -> ${JSON.stringify(linhas)}`,
  );
  afirmar(
    linhas.every((l) => l.entregue <= l.total),
    `entregue nunca passa do total, veio ${JSON.stringify(linhas)}`,
  );
  await capturar('cheio'); // ACEITE: os mesmos blocos, agora com material dentro

  // ---- 4. o painel diz o mesmo numero, por escrito --------------------------
  await clicarNoTile(meioDaObra.gx, meioDaObra.gy);
  afirmar(
    (await page.getAttribute('#painel-predio', 'data-predio-aberto')) === ID_DA_OBRA,
    'o clique deveria abrir o painel da obra que o roteiro plantou',
  );
  afirmar(
    (await page.textContent('#painel-predio h2')) === tema.predios[TIPO_DA_OBRA].nome,
    'o titulo deveria ser o nome tematico do predio',
  );
  const noPainel = await page.$$eval('#painel-predio [data-medidor]', (ns) => ns.map((n) => ({
    mercadoria: n.dataset.medidor,
    entregue: Number(n.dataset.entregue),
    total: Number(n.dataset.total),
    texto: n.textContent,
  })));
  // GUARDA: o painel contra o MAPA, nao contra numero digitado aqui. Os dois
  // chamam `medidorDaObra`; divergirem seria exatamente o que a funcao unica
  // existe para impedir.
  const noMapa = await medidorNoMapa(ID_DA_OBRA);
  afirmar(
    JSON.stringify(noPainel.map(({ mercadoria, entregue, total }) => ({ mercadoria, entregue, total })))
      === JSON.stringify(noMapa.map((l) => ({ mercadoria: l.mercadoria, entregue: l.entregue, total: l.total }))),
    `painel e mapa deveriam dizer o mesmo: ${JSON.stringify(noPainel)} vs ${JSON.stringify(noMapa)}`,
  );
  const stone = noPainel.find((l) => l.mercadoria === 'stone');
  afirmar(
    stone !== undefined,
    `o painel deveria trazer a fileira de pedra, veio ${JSON.stringify(noPainel)}`,
  );
  afirmar(
    stone.texto.includes(tema.mercadorias.stone) && stone.texto.includes(`${stone.entregue}/${stone.total}`),
    `a fileira deveria ler o nome do sertao e "chegou/total", veio ${JSON.stringify(stone.texto)}`,
  );
  afirmar(
    (await page.textContent('#painel-predio [data-gaveta="material"] .rotulo')) === tema.painelPredio.material,
    'o rotulo do bloco deveria vir do tema, nunca escrito no codigo',
  );
  await capturar('painel'); // o mesmo numero, por escrito, para quem selecionou
}

module.exports = { roteiro };
