'use strict';

// Roteiro da F22 — O AVISO DE PREDIO PARADO, NA TELA.
//
// O teste headless prova a DERIVACAO: dado um estado, quais alertas saem. Ele
// nao prova nada do que esta feature existe para resolver, que e o jogador
// DESCOBRIR que uma pedreira parou sem clicar nela. Isso e o que se mede aqui:
//
//  - o jogo abre SEM aviso nenhum (a vila inicial so tem prédios que nao pedem
//    trabalhador) e o aviso continua ausente enquanto a pedreira e obra;
//  - a pedreira fica pronta sem cabra treinado e o aviso APARECE sozinho, com o
//    texto do tema e a contagem;
//  - PAUSAR pelo painel apaga o aviso — a prova da Nota da F16c, e a unica das
//    tres que so se ve na tela: no headless "sumiu" e uma lista vazia;
//  - cortar a estrada acrescenta o segundo aviso, sem tirar o primeiro.
//
// O layout e MEDIDO, nao descrito (§8): o passo 0 pega os retangulos de
// `#alertas`, `#painel-predio` e do canvas e afirma que o aviso cabe na celula
// do canvas e nao intersecta o painel. "Esta atras do painel" ja errou duas
// vezes nesta base, nas duas por descricao em vez de medida.
//
// Texto afirmado vem de `data/theme-sertao.json`, nunca digitado aqui; a
// geometria vem de `economy.json` e `buildings.json`, como no F16b.

const { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Medido no F16b, mesma geometria: a obra da pedreira fecha no tick 220. O teto
 *  e aquele numero com folga — e o roteiro PARA no marco, nao no teto. */
const TETO_ATE_COMPLETAR = 600;
const PASSO_DE_AVANCO = 50; // um `avancar` seco e grande estoura o frame (F16b)

const ROTULO = tema.alertas.causas;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
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

  /** Clica no mapa de mao vazia. Sempre com o painel FECHADO: ele e sobreposicao
   *  no canto do canvas, e o que esta debaixo dele nao recebe mouse (F16b). */
  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  const predioDoEstado = async (id) => (await estado()).prediosDoEstado[id] ?? null;
  const idAberto = () => page.getAttribute('#painel-predio', 'data-predio-aberto');

  /** O que o aviso mostra AGORA: uma entrada por causa visivel, com a contagem.
   *  Le o DOM, que e o que o jogador ve — nao o seletor, que e o que esta sendo
   *  provado. */
  async function avisosNaTela() {
    return page.$$eval('#alertas .alerta', (ns) => ns
      .filter((n) => !n.hasAttribute('hidden'))
      .map((n) => ({
        causa: n.dataset.causa,
        rotulo: n.querySelector('.rotulo').textContent,
        contagem: n.querySelector('.contagem').textContent,
      })));
  }
  const resumo = async () => JSON.stringify(await avisosNaTela());

  // ---- geometria, tirada dos JSON (a mesma do F16b) -------------------------
  // A pedreira entra a DIREITA da escola, com a borda sul na linha de porta do
  // armazem: uma rua so serve os tres.
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu, altQu] = defDe('quarry').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const pedreira = { gx: escola.gx + largEs + 1, gy: yRua - altQu };
  const meioDaPedreira = { gx: pedreira.gx + Math.floor(largQu / 2), gy: pedreira.gy };
  const pontaEsquerda = { gx: armazem.gx, gy: yRua };
  const pontaDireita = { gx: pedreira.gx + largQu - 1, gy: yRua };
  const tilesDaRua = pontaDireita.gx - pontaEsquerda.gx + 1;
  // O corte fica ENTRE a escola e a pedreira: parte a rede em dois pedacos, um
  // com o armazem e outro com a pedreira, sem encostar na porta de ninguem.
  const corte = { gx: escola.gx + largEs, gy: yRua };
  afirmar(
    corte.gx > pontaEsquerda.gx && corte.gx < pedreira.gx,
    `o corte (${corte.gx}) precisa cair na rua, entre o armazem e a pedreira`,
  );

  // ---- 1. o jogo abre SEM aviso --------------------------------------------
  // A vila inicial e armazem e Casa do Coronel, e `buildings.json` da
  // `trabalhador: null` nos dois. Um jogo que abrisse reclamando seria o
  // defeito que esta feature introduziria.
  afirmar(await page.isHidden('#alertas'), 'o jogo deveria abrir sem aviso nenhum');
  await capturar('abertura-sem-aviso');

  // ---- 2. a rua e a planta da pedreira -------------------------------------
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

  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  await clicarNoTile(pedreira.gx, pedreira.gy);
  await avancar(1);
  await page.keyboard.press('Escape'); // larga a planta fantasma
  await esperarFrame();
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  const ID_PEDREIRA = await idAberto();
  afirmar(ID_PEDREIRA !== null, 'clicar na planta recem-posta deveria abrir o painel da obra');
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).estado === 'obra',
    'o predio aberto deveria estar em obra no ESTADO, nao so no texto do painel',
  );
  await page.keyboard.press('Escape'); // o painel sobrepoe o canto do canvas
  await esperarFrame();
  afirmar(
    await page.isHidden('#alertas'),
    `obra nao alerta: nao ha trabalhador a esperar antes de o predio existir, veio ${await resumo()}`,
  );

  // ---- 3. a pedreira fica pronta, e o aviso aparece SOZINHO -----------------
  // Nenhum cabra foi treinado de proposito: a escola nunca recebeu pedido. E
  // essa a situacao que o jogador nao tinha como perceber sem clicar.
  let ticks = 0;
  while (ticks < TETO_ATE_COMPLETAR && (await predioDoEstado(ID_PEDREIRA)).estado !== 'completo') {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
  }
  const pronta = await predioDoEstado(ID_PEDREIRA);
  afirmar(
    pronta.estado === 'completo',
    `a pedreira deveria ficar pronta em ate ${TETO_ATE_COMPLETAR} ticks, veio ${pronta.estado}`,
  );
  afirmar(
    pronta.ocupante === null,
    'o aviso so vale se a pedreira estiver mesmo VAGA no estado; veio com ocupante',
  );
  afirmar(await page.isVisible('#alertas'), `o aviso deveria ter aparecido sozinho em ${ticks} ticks`);
  afirmar(
    (await resumo()) === JSON.stringify([
      { causa: 'sem-trabalhador', rotulo: ROTULO['sem-trabalhador'], contagem: '1' },
    ]),
    `o aviso deveria ser so "sem-trabalhador", com o texto do tema e contagem 1, veio ${await resumo()}`,
  );
  await capturar('sem-trabalhador');

  // ---- 4. o LAYOUT, medido ---------------------------------------------------
  // Com o painel ABERTO, que e o caso em que os dois disputam a celula do canvas.
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  afirmar((await idAberto()) === ID_PEDREIRA, 'o painel deveria abrir na pedreira');
  const rAviso = await retanguloDe(page, '#alertas');
  const rPainel = await retanguloDe(page, '#painel-predio');
  const rMenu = await retanguloDe(page, '#menu-build');
  afirmar(
    rAviso.width > 0 && rAviso.height > 0,
    `o aviso deveria ter area na tela, veio ${JSON.stringify(rAviso)}`,
  );
  afirmar(
    rAviso.left >= canvas.left && rAviso.right <= canvas.right
      && rAviso.top >= canvas.top && rAviso.bottom <= canvas.bottom,
    `o aviso deveria caber na celula do canvas ${JSON.stringify(canvas)}, veio ${JSON.stringify(rAviso)}`,
  );
  const cruzam = rAviso.left < rPainel.right && rAviso.right > rPainel.left
    && rAviso.top < rPainel.bottom && rAviso.bottom > rPainel.top;
  afirmar(
    !cruzam,
    `aviso e painel nao podem se cobrir: aviso ${JSON.stringify(rAviso)}, painel ${JSON.stringify(rPainel)}`,
  );
  // O canvas nao pode ter encolhido: o aviso e SOBREPOSICAO, nao coluna nova —
  // e a invariante que o roteiro da F06 afirma do outro lado.
  afirmar(
    canvas.right <= rMenu.left,
    `o canvas deveria continuar a esquerda do menu, veio ${canvas.right} contra ${rMenu.left}`,
  );

  // ---- 5. PAUSA DELIBERADA cala o aviso -------------------------------------
  // Prédio que o jogador desligou nao e problema (Nota da F16c). E a unica das
  // tres provas que so se ve aqui: no headless "sumiu" e uma lista vazia.
  afirmar(
    (await page.getAttribute('#painel-predio [data-pausar]', 'data-pausar')) === 'true',
    'trabalhando, o botao deveria mandar pausado=true — e o VALOR que vai no comando',
  );
  await page.click('#painel-predio [data-pausar]');
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).pausado === true,
    'a pausa deveria ter pegado no ESTADO, nao so no texto do painel',
  );
  afirmar(
    await page.isHidden('#alertas'),
    `pausado pelo jogador, o aviso deveria sumir INTEIRO, veio ${await resumo()}`,
  );
  await capturar('pausado-sem-aviso');

  // ---- 6. retomar, e cortar a estrada: o segundo aviso ----------------------
  await page.click('#painel-predio [data-pausar]');
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).pausado === false,
    'voltar ao trabalho deveria despausar no estado',
  );
  afirmar(
    await page.isVisible('#alertas'),
    'pausa nao apaga a causa, so cala o aviso: retomando, ele volta',
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  await page.click('[data-ferramenta="demolir-estrada"]');
  await esperarFrame();
  const pCorte = await pontoDoTile(corte.gx, corte.gy);
  await page.mouse.click(pCorte.x, pCorte.y);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar(
    (await estado()).estradasRenderizadas === tilesDaRua - 1,
    `a rua deveria ter perdido um tile, veio ${(await estado()).estradasRenderizadas}`,
  );
  afirmar(
    (await resumo()) === JSON.stringify([
      { causa: 'sem-trabalhador', rotulo: ROTULO['sem-trabalhador'], contagem: '1' },
      { causa: 'sem-estrada', rotulo: ROTULO['sem-estrada'], contagem: '1' },
    ]),
    `cortada a rua, os DOIS avisos deveriam aparecer, nesta ordem, veio ${await resumo()}`,
  );
  await capturar('sem-trabalhador-e-sem-estrada');
}

module.exports = { roteiro };
