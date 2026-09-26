'use strict';

// Roteiro do aceite da F18i. Afirma ESTADO e MEDICAO, nao pixel.
//
// A mesma ordem que a F18d-2 afirma para a estrada, agora para a terra de plantio:
//   o arrasto DESENHA o canteiro -> o laborer ARA (planejado desce, campo pronto
//   sobe, a soma fecha) -> a BORRACHA derruba o que sobrou do canteiro e NAO toca
//   no que ja foi arado.
//
// A soma `planejados + prontos` e conferida em todo passo do desenho e da aradura:
// e ela que impede um tile de sumir entre os dois conjuntos sem ninguem notar. No
// passo da borracha a soma CAI de proposito — apagar tira tile do mundo —, e o que
// se afirma ali e outra coisa: `prontos` intacto.
//
// §8: o roteiro clica em `#menu-build`, entao o passo da borracha roda DESPAUSADO,
// com `mouse.down` / 150 ms / `mouse.up` de verdade. `page.click()` em pagina
// pausada aperta e solta no mesmo instante e nunca exerce o gesto do jogador.

const { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const { tipos } = require('../../data/resources.json');

const TILE_PX = 64;
const BLOCO_CURTO = 5;
const TETO_DA_ARADURA = 400;
const ESPERA_DO_GESTO = 150;

/** A MESMA regra de `sim/campos.ts: culturasAraveis` — presenca do bloco `aradura`.
 *  Ler a lista aqui, e nao escrever `corn`, e o que faz este roteiro afirmar que a
 *  ferramenta veio do DADO: no dia em que a cana entrar, ele cobra o botao dela. */
const culturasAraveis = Object.keys(tipos).filter((id) => tipos[id].aradura !== undefined);

// Os tres tiles de grama LIVRE ao lado do armazem da vila, medidos na F18h
// (`test-output/F18h.json`, perna (a)): e a mesma faixa que o teste headless ara.
// O roteiro nao confia nelas de graca — antes de soltar o arrasto ele afirma que
// `canPlowField` aceitou o trecho inteiro, pela previa.
const FAIXA = [{ gx: 29, gy: 27 }, { gx: 30, gy: 27 }, { gx: 31, gy: 27 }];

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);

  const esperarFrame = () => page.waitForTimeout(200); // window.__cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function pontoDoTile(tile) {
    const { camera } = await estado();
    const ponto = pontoDoTileNaTela(canvas, tile, camera, TILE_PX);
    afirmar(
      ponto.x > canvas.left && ponto.x < canvas.right && ponto.y > canvas.top && ponto.y < canvas.bottom,
      `o tile (${tile.gx},${tile.gy}) deveria estar visivel no canvas, cairia em (${ponto.x},${ponto.y})`,
    );
    return ponto;
  }

  /** Os dois contadores do mesmo quadro. Com `total`, confere a soma. */
  async function contagem(quando, total) {
    const s = await estado();
    if (total !== undefined) {
      afirmar(
        s.camposPlanejadosRenderizados + s.camposProntosNoEstado === total,
        `${quando}: planejados (${s.camposPlanejadosRenderizados}) + prontos `
        + `(${s.camposProntosNoEstado}) deveria fechar em ${total}`,
      );
    }
    return {
      planejados: s.camposPlanejadosRenderizados,
      prontos: s.camposProntosNoEstado,
      tick: s.tick,
    };
  }

  const pressionado = (seletor) => page.getAttribute(seletor, 'aria-pressed');

  /** Aperta um botao do menu COMO O JOGADOR: apertar, segurar, soltar, com o laco
   *  rodando. E o gesto que o BUG-B mostrou que `page.click()` em pagina pausada
   *  nao exerce (§8). Pausa de volta ao sair. */
  async function apertarDespausado(seletor) {
    const botao = await retanguloDe(page, seletor);
    await page.keyboard.press('p');
    await esperarFrame();
    await page.mouse.move(botao.left + botao.width / 2, botao.top + botao.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(ESPERA_DO_GESTO);
    await page.mouse.up();
    await esperarFrame();
    await page.keyboard.press('p');
    await esperarFrame();
  }

  // 0. abertura: a ferramenta existe, uma por cultura aravel, e o canteiro esta vazio
  afirmar(culturasAraveis.length > 0, 'data/resources.json deveria ter ao menos uma cultura com bloco `aradura`');
  const botoesDeTerra = await page.$$eval(
    '#menu-build [data-ferramenta]',
    (nos) => nos.map((n) => n.dataset.ferramenta),
  );
  for (const cultura of culturasAraveis) {
    afirmar(
      botoesDeTerra.includes(`campo-${cultura}`),
      `o menu deveria ter a ferramenta de terra da cultura '${cultura}', veio [${botoesDeTerra.join(', ')}]`,
    );
  }
  afirmar(
    botoesDeTerra.filter((id) => id.startsWith('campo-')).length === culturasAraveis.length,
    'nao deveria haver ferramenta de terra sem cultura correspondente no dado',
  );
  afirmar(botoesDeTerra.includes('apagar-campo'), 'o menu deveria ter a borracha do campo');
  // 2026-09-26 (operador): duas culturas com o mesmo glifo e confusao real. A cor dos
  // sulcos sai do tema, uma por cultura, e o que se mede e a cor PINTADA, nao a variavel.
  const coresDosSulcos = await page.$$eval(
    '#menu-build [data-ferramenta^="campo-"] .glifo-campo',
    (nos) => nos.map((n) => getComputedStyle(n, '::before').backgroundImage),
  );
  afirmar(
    new Set(coresDosSulcos).size === culturasAraveis.length,
    `cada cultura aravel deveria ter sulcos de cor propria, veio [${coresDosSulcos.join(' | ')}]`,
  );

  const abertura = await contagem('na abertura');
  afirmar(abertura.planejados === 0, `a abertura nao deveria ter canteiro de campo, veio ${abertura.planejados}`);
  const prontosNaAbertura = abertura.prontos;
  const totalDoTracado = prontosNaAbertura + FAIXA.length;

  // 1. o arrasto DESENHA: a previa diz que pode, e soltar poe os tres tiles no canteiro
  const cultura = culturasAraveis[0];
  await page.click(`[data-ferramenta="campo-${cultura}"]`);
  await esperarFrame();
  afirmar(
    (await pressionado(`[data-ferramenta="campo-${cultura}"]`)) === 'true',
    'a ferramenta de terra deveria ficar marcada como ativa ao ser escolhida',
  );

  const pontos = [];
  for (const tile of FAIXA) pontos.push(await pontoDoTile(tile));
  await arrastarDentroDoCanvas(page, canvas, pontos, { soltar: false });
  await esperarFrame();
  const previa = (await estado()).previaDeCampo;
  afirmar(previa !== null, 'o arrasto de terra deveria ter previa');
  afirmar(
    previa.modo === 'campo' && previa.cultura === cultura,
    `a previa deveria ser de arar '${cultura}', veio ${JSON.stringify(previa)}`,
  );
  afirmar(
    previa.valida === true && previa.tiles === FAIXA.length,
    `a previa deveria aceitar os ${FAIXA.length} tiles da faixa, veio ${JSON.stringify(previa)}`,
  );
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();

  const desenhado = await contagem('no tick do comando', totalDoTracado);
  afirmar(
    desenhado.planejados === FAIXA.length && desenhado.prontos === prontosNaAbertura,
    `soltar deveria DESENHAR ${FAIXA.length} tiles sem arar nenhum, veio `
    + `${desenhado.planejados} planejados e ${desenhado.prontos} prontos`,
  );
  afirmar((await estado()).previaDeCampo === null, 'solto o arrasto, a previa deveria sumir');
  await capturar('canteiro-desenhado');

  // 2. o laborer ara: planejado desce, campo pronto sobe, e a soma fecha em todo passo
  let meio = desenhado;
  let gastos = 0;
  while (meio.prontos === prontosNaAbertura && gastos < TETO_DA_ARADURA) {
    await avancar(BLOCO_CURTO);
    gastos += BLOCO_CURTO;
    await esperarFrame();
    meio = await contagem('arando', totalDoTracado);
  }
  afirmar(
    meio.prontos > prontosNaAbertura && meio.planejados > 0,
    `deveria haver um quadro com canteiro e campo pronto na mesma tela; no tick ${meio.tick} veio `
    + `${meio.planejados} planejados e ${meio.prontos} prontos (abertura: ${prontosNaAbertura})`,
  );
  await capturar('meio-arado');

  // 3. a BORRACHA: o gesto de verdade, despausado (§8), e depois o arrasto de apagar
  await apertarDespausado('[data-ferramenta="apagar-campo"]');
  afirmar(
    (await pressionado('[data-ferramenta="apagar-campo"]')) === 'true',
    'a borracha deveria ficar ativa depois do aperto despausado',
  );
  afirmar(
    (await pressionado(`[data-ferramenta="campo-${cultura}"]`)) === 'false',
    'escolher a borracha deveria largar a ferramenta de terra',
  );

  // os poucos ticks do gesto podem ter arado mais um tile: a referencia e o quadro
  // de AGORA, e nao o de antes de apertar o botao.
  const antesDeApagar = await contagem('antes de apagar');
  afirmar(antesDeApagar.planejados > 0, 'ainda deveria haver canteiro para a borracha apagar');

  const pontosDeApagar = [];
  for (const tile of FAIXA) pontosDeApagar.push(await pontoDoTile(tile));
  await arrastarDentroDoCanvas(page, canvas, pontosDeApagar, { soltar: false });
  await esperarFrame();
  const previaDaBorracha = (await estado()).previaDeCampo;
  afirmar(previaDaBorracha !== null, 'o arrasto da borracha deveria ter previa');
  afirmar(
    previaDaBorracha.modo === 'apagar-campo' && previaDaBorracha.cultura === null,
    `a previa deveria ser da borracha, veio ${JSON.stringify(previaDaBorracha)}`,
  );
  // a prova de que a borracha NAO alcanca o campo arado: o arrasto passa por todos
  // os tres tiles, e a previa so conta os que ainda sao canteiro.
  afirmar(
    previaDaBorracha.tiles === antesDeApagar.planejados,
    `a previa da borracha deveria contar so os ${antesDeApagar.planejados} tiles de canteiro `
    + `sob o arrasto de ${FAIXA.length} tiles, veio ${previaDaBorracha.tiles}`,
  );
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();

  const apagado = await contagem('depois da borracha');
  afirmar(
    apagado.planejados === 0,
    `a borracha deveria ter derrubado o canteiro inteiro, sobraram ${apagado.planejados}`,
  );
  afirmar(
    apagado.prontos === antesDeApagar.prontos,
    `a borracha NAO pode mexer no campo ja arado: prontos deveria seguir em `
    + `${antesDeApagar.prontos}, veio ${apagado.prontos}`,
  );
  afirmar(
    apagado.prontos > prontosNaAbertura,
    'o campo arado deveria continuar na tela depois da borracha',
  );
  await capturar('canteiro-apagado');
}

module.exports = { roteiro };
