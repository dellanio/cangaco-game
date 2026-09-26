'use strict';

// Roteiro da F16b — o painel de selecao de predio NA TELA.
//
// Afirma DOM e ESTADO, nunca pixel: o que o painel escreve sai do DOM; o que o
// jogo acha disso sai de `window.__cangaco.prediosDoEstado`, a leitura crua do
// tick desenhado. As duas fontes sao separadas de proposito — afirmar o painel
// contra o painel nao provaria nada.
//
// O que este roteiro existe para provar:
//  - o mesmo painel serve TRES casos e mostra coisas diferentes em cada um:
//    armazem (sem ocupante, sem pausar), obra (progresso e o que falta chegar),
//    pedreira ocupada (ocupante, gavetas e o botao de pausar);
//  - pausar manda o VALOR e nao um toggle: parar e voltar sao dois cliques com
//    `data-pausar` opostos, e o estado acompanha;
//  - demolir e um clique e o painel se FECHA sozinho, porque o predio saiu do
//    estado — nao porque alguem mandou fechar.
//
// De quebra, a cadeia inteira do aceite da Fase A acontece aqui pelo caminho do
// jogador: rua -> planta -> obra que sobe -> escola treina o cabra -> ele ocupa
// a pedreira -> ela PRODUZ. A espera e por condicao, com teto, nunca por numero de
// ticks: a geometria mudou (2026-09-26) e um numero fixo mudaria junto.
//
// A pedreira fica ao lado do lajedo (`_pedreira.js`). Antes ela ficava a direita
// da escola, sem rocha ao alcance, e este roteiro retratava uma vila que nao
// produz. A pedra na saida e fugaz (o carregador a leva logo), por isso se espera
// por ela em passo fino, e o PAINEL nao afirma o conteudo da gaveta `saida`.
//
// Todo clique no mapa acontece com o painel FECHADO: ele e sobreposicao no canto
// do canvas, e o que esta debaixo dele nao recebe mouse.

const { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { arrastosDaRua } = require('./_recursos');
const { pedreiraNoLajedo, esperarPedraNaSaida } = require('./_pedreira');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);
/** Teto da espera pelo cabra ocupar, o mesmo da F-VIVO-a (mesma geometria).
 *  Falhar por teto e falhar. */
const TETO_ATE_OCUPAR = 900;
const PASSO_DE_AVANCO = 50; // avanca em blocos: um `avancar(300)` seco estoura o frame

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

  /** Clica no mapa com o painel fechado e a mao vazia. */
  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  const painel = () => page.textContent('#painel-predio');
  const temNoPainel = async (seletor) => (await page.$$(`#painel-predio ${seletor}`)).length > 0;
  async function predioDoEstado(id) {
    return (await estado()).prediosDoEstado[id] ?? null;
  }
  /** O id do predio que o painel tem aberto agora. Nunca digitado: a obra que
   *  acabou de nascer nao tem id previsivel. */
  const idAberto = () => page.getAttribute('#painel-predio', 'data-predio-aberto');

  // ---- geometria, tirada dos JSON ------------------------------------------
  // A pedreira entra ao lado do lajedo, com a borda sul na mesma linha de porta
  // do armazem: uma rua so serve os tres.
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largAr, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu] = defDe('quarry').tamanho;
  const { pedreira, tilesDaRua: rua } = pedreiraNoLajedo({ armazem, escola, tamanhoDe: (id) => defDe(id).tamanho, afirmar });
  const meioDaPedreira = { gx: pedreira.gx + Math.floor(largQu / 2), gy: pedreira.gy };
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  const meioDoArmazem = { gx: armazem.gx + Math.floor(largAr / 2), gy: armazem.gy + Math.floor(altAr / 2) };
  const tilesDaRua = rua.length;
  const civilDaPedreira = defDe('quarry').trabalhador;
  afirmar(
    typeof civilDaPedreira === 'string',
    'a pedreira precisa declarar `trabalhador` no dado; sem isso nao ha ocupante para provar',
  );

  // ---- 1. um predio SEM producao: o armazem --------------------------------
  afirmar(await page.isHidden('#painel-predio'), 'o painel deveria nascer fechado');
  const alcaFechada = await retanguloDe(page, '#balcao'); // so a alca: nada escolhido
  await clicarNoTile(meioDoArmazem.gx, meioDoArmazem.gy);
  afirmar(await page.isVisible('#painel-predio'), 'clicar no armazem deveria abrir o painel');
  afirmar(
    (await page.textContent('#painel-predio h2')) === tema.predios.storehouse.nome,
    'o titulo deveria ser o nome tematico do predio, nunca o id neutro',
  );
  afirmar(
    !(await temNoPainel('[data-pausar]')),
    'o armazem nao produz: o botao de pausar nao deveria existir (nota da F16c)',
  );
  afirmar(
    !(await temNoPainel('[data-ocupante]')),
    'o armazem nao pede trabalhador: a linha de ocupante nao deveria existir — dizer "sem trabalhador" acusaria falta onde nao cabe ninguem',
  );
  const mercadoriasNoArmazem = await page.$$eval(
    '#painel-predio [data-gaveta="saida"] .item', (ns) => ns.map((n) => n.dataset.mercadoria),
  );
  afirmar(
    mercadoriasNoArmazem.length > 1,
    `o armazem deveria listar o estoque inicial, veio ${JSON.stringify(mercadoriasNoArmazem)}`,
  );
  // GUARDA ESTRUTURAL: a ordem esperada e DERIVADA do dado (economy.json), nao
  // uma lista digitada aqui — que passaria a valer mesmo se a fonte da ordem
  // mudasse de lugar.
  afirmar(
    JSON.stringify(mercadoriasNoArmazem)
      === JSON.stringify(economia.mercadorias.filter((m) => mercadoriasNoArmazem.includes(m))),
    `as gavetas deveriam sair na ordem de economia.mercadorias, veio ${JSON.stringify(mercadoriasNoArmazem)}`,
  );
  afirmar(await temNoPainel('[data-demolir]'), 'todo predio deveria ter o botao de derrubar');

  // ---- 1b. Layout 2 (estilo-ui): o balcao ABRE com a selecao ----------------
  // O painel mora na faixa do rodape, que e linha da grade: o canvas encolhe
  // ate ela (Scale.RESIZE confere o pai a cada 500 ms) e nunca fica por baixo.
  await page.waitForTimeout(700);
  const balcaoAberto = await retanguloDe(page, '#balcao');
  const canvasComBalcao = await retanguloDoCanvas(page);
  afirmar(
    (await page.evaluate(() => window.document.body.dataset.balcao)) === 'aberto',
    'com um predio escolhido o balcao deveria estar aberto',
  );
  afirmar(
    balcaoAberto.height > alcaFechada.height && canvasComBalcao.height < canvas.height,
    `o balcao aberto deveria ser mais alto que a alca (${alcaFechada.height}) e encolher o canvas (${canvas.height}), veio ${balcaoAberto.height} e ${canvasComBalcao.height}`,
  );
  afirmar(
    canvasComBalcao.bottom <= balcaoAberto.top + 0.5,
    `canvas.bottom (${canvasComBalcao.bottom}) deveria ser <= balcao.top (${balcaoAberto.top})`,
  );
  await capturar('armazem'); // o painel de um predio sem producao, no balcao
  // a alca RECOLHE sem perder a selecao, e reabre
  await page.click('[data-alca="balcao"]');
  await esperarFrame();
  afirmar(
    await page.isHidden('#painel-predio') && (await idAberto()) !== null,
    'recolhido a mao, o balcao esconde o painel mas a selecao fica',
  );
  await page.click('[data-alca="balcao"]');
  await esperarFrame();
  afirmar(await page.isVisible('#painel-predio'), 'a alca deveria reabrir o balcao');

  // ---- 2. a rua, e a planta da pedreira ------------------------------------
  await page.keyboard.press('Escape'); // fecha o painel: ele sobrepoe o canto do canvas
  await esperarFrame();
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const { gy, de, ate } of arrastosDaRua(rua)) {
    await centrarEm(Math.floor((de + ate) / 2));
    await arrastarDentroDoCanvas(page, canvas, [await pontoDoTile(de, gy), await pontoDoTile(ate, gy)]);
    await avancar(1);
    await esperarFrame();
  }
  // F18d-1b: o arrasto DESENHA; quem ergue e o laborer, durante o passo 5. O ouro da
  // escola so anda por rua de pe, entao a rua erguida e precondicao do "cabra ocupou" —
  // e e la que ela e conferida, ja de pe.
  const canteiro = await estado();
  afirmar(
    canteiro.estradasPlanejadasRenderizadas === tilesDaRua && canteiro.estradasRenderizadas === 0,
    `o arrasto deveria desenhar ${tilesDaRua} tiles e erguer 0, veio `
      + `${canteiro.estradasPlanejadasRenderizadas} e ${canteiro.estradasRenderizadas}`,
  );

  await page.keyboard.press('Escape');
  await esperarFrame();
  await centrarEm(pedreira.gx + largQu);
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  await clicarNoTile(pedreira.gx, pedreira.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape'); // larga a planta fantasma

  // ---- 3. o painel de uma OBRA ---------------------------------------------
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  const ID_PEDREIRA = await idAberto();
  afirmar(ID_PEDREIRA !== null, 'clicar na planta recem-posta deveria abrir o painel da obra');
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).estado === 'obra',
    'o predio aberto deveria estar em obra no ESTADO, nao so no texto do painel',
  );
  afirmar(
    (await page.getAttribute('#painel-predio', 'data-estado-do-predio')) === 'obra',
    'o painel deveria marcar que o predio esta em obra',
  );
  // A obra recem-posta ainda esta com o chao sendo aplainado, e desde a correcao
  // do defeito da F16b (achado ao planejar a F17d) e ISSO que o painel escreve:
  // "Em obra 0%" dizia a mesma coisa aqui e numa obra que ja esperou o
  // nivelamento inteiro, porque `progresso` e `hp / hpTotal` e `hp` so sobe com o
  // martelo. O criterio da F16b continua sendo o mesmo — o painel diz, com
  // rotulo do TEMA, em que pe a obra esta —, so mudou qual rotulo cabe aqui.
  afirmar(
    (await painel()).includes(tema.painelPredio.nivelando),
    'a obra recem-posta deveria mostrar o rotulo do tema do nivelamento',
  );
  afirmar(
    !(await painel()).includes(tema.painelPredio.emObra),
    'os dois rotulos sao exclusivos: com o chao sendo aplainado, "Em obra %" nao aparece',
  );
  afirmar(
    await temNoPainel('.linha.nivelamento[data-tiles-totais]'),
    'a linha do nivelamento deveria trazer o total de tiles para o roteiro afirmar',
  );
  // A F17b trocou a gaveta "Falta chegar" pelo medidor `chegou/total`, que
  // responde a mesma pergunta do aceite da F16b ("o que ainda falta chegar")
  // sem perder o material que ja completou — e por cima diz o denominador. O
  // criterio da F16b continua sendo o afirmado aqui; so mudou onde ele se le.
  afirmar(
    await temNoPainel('[data-gaveta="material"] [data-medidor]'),
    'a obra recem-posta deveria listar o material de cada tipo que ainda falta chegar',
  );
  afirmar(
    !(await temNoPainel('[data-pausar]')) && !(await temNoPainel('[data-ocupante]')),
    'obra nao tem producao nem ocupante: nem o botao de pausar nem a linha de ocupante deveriam existir',
  );
  await capturar('obra'); // o painel de um predio que ainda esta subindo

  // ---- 4. a escola treina o cabra da pedreira ------------------------------
  await page.keyboard.press('Escape');
  await esperarFrame();
  await centrarEm(meioDaEscola.gx);
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  afirmar(
    await temNoPainel(`[data-treinar="${civilDaPedreira}"]`),
    'a fila de treino deveria aparecer como SECAO do painel do predio, nao num segundo painel',
  );
  // O clique de painel que roda despausado e segurando 150 ms (§8).
  const botao = await page.$eval(`#painel-predio [data-treinar="${civilDaPedreira}"]`, (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'o clique do treino precisa do relogio correndo');
  await page.mouse.move(botao.x, botao.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
  afirmar(
    await temNoPainel('[data-slot][data-unidade]'),
    'o pedido deveria entrar na fila da escola',
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 5. deixar a vila trabalhar ------------------------------------------
  let depoisDoTrabalho = await estado();
  for (let t = 0; depoisDoTrabalho.prediosDoEstado[ID_PEDREIRA]?.ocupante == null && t < TETO_ATE_OCUPAR; t += PASSO_DE_AVANCO) {
    await avancar(PASSO_DE_AVANCO);
    await esperarFrame();
    depoisDoTrabalho = await estado();
  }
  afirmar(
    depoisDoTrabalho.estradasRenderizadas === tilesDaRua
      && depoisDoTrabalho.estradasPlanejadasRenderizadas === 0,
    `com o cabra na pedreira a rua deveria estar toda de pe (${tilesDaRua} tiles), veio `
      + `${depoisDoTrabalho.estradasRenderizadas} de pe e ${depoisDoTrabalho.estradasPlanejadasRenderizadas} planejados`,
  );
  const noEstado = await predioDoEstado(ID_PEDREIRA);
  afirmar(
    noEstado !== null && noEstado.estado === 'completo',
    `com o cabra na pedreira a obra deveria ter terminado, veio ${JSON.stringify(noEstado)}`,
  );
  afirmar(
    noEstado.ocupante !== null,
    `em ${TETO_ATE_OCUPAR} ticks o cabra treinado deveria ter ocupado a pedreira, veio ${JSON.stringify(noEstado)}`,
  );

  // ---- 5b. a pedreira PRODUZ ------------------------------------------------
  await centrarEm(meioDaPedreira.gx);
  await esperarPedraNaSaida(ctx, ID_PEDREIRA);

  // ---- 6. ACEITE: o painel do predio completo e ocupado --------------------
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  afirmar((await idAberto()) === ID_PEDREIRA, 'o clique deveria reabrir o painel da MESMA pedreira');
  afirmar(
    (await page.textContent('#painel-predio h2')) === tema.predios.quarry.nome,
    'o titulo deveria ser o nome tematico da pedreira',
  );
  afirmar(
    (await page.getAttribute('#painel-predio .linha.ocupante', 'data-ocupante')) === noEstado.ocupante,
    `a linha de ocupante deveria apontar a unidade ${noEstado.ocupante} que esta no estado`,
  );
  afirmar(
    (await painel()).includes(tema.civis[civilDaPedreira].nome),
    'o ocupante deveria aparecer pelo NOME no sertao, nunca pelo id neutro',
  );
  afirmar(
    (await painel()).includes(tema.painelPredio.hp),
    'o predio de pe deveria mostrar a firmeza, e nao o progresso de obra',
  );
  // as duas gavetas existem; o CONTEUDO da saida nao se afirma (ver o cabecalho)
  afirmar(
    (await temNoPainel('[data-gaveta="entrada"]')) && (await temNoPainel('[data-gaveta="saida"]')),
    'um predio de producao deveria mostrar as duas gavetas',
  );
  afirmar(await temNoPainel('[data-pausar]'), 'a pedreira produz: o botao de pausar deveria existir');
  await capturar('completo-ocupado'); // ACEITE

  // ---- 7. pausar manda o VALOR, nao um toggle ------------------------------
  afirmar(
    (await page.getAttribute('#painel-predio [data-pausar]', 'data-pausar')) === 'true',
    'com o predio rodando o botao deveria mandar pausado=true',
  );
  await page.click('#painel-predio [data-pausar]');
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).pausado === true,
    'o clique deveria ter parado a pedreira NO ESTADO',
  );
  afirmar(
    (await page.getAttribute('#painel-predio', 'data-pausado')) === 'true'
      && (await painel()).includes(tema.painelPredio.pausado),
    'o painel deveria dizer que o predio esta parado, com o texto do tema',
  );
  afirmar(
    (await page.getAttribute('#painel-predio [data-pausar]', 'data-pausar')) === 'false',
    'parado, o botao deveria mandar pausado=false — e o VALOR que vai no comando, nao "inverta o que estiver ai"',
  );
  await capturar('pausado');

  await page.click('#painel-predio [data-pausar]');
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).pausado === false,
    'o segundo clique deveria ter voltado a pedreira ao trabalho',
  );

  // ---- 8. demolir: um clique, e o painel se fecha sozinho ------------------
  const prediosAntes = (await estado()).prediosRenderizados;
  await page.click('#painel-predio [data-demolir]');
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)) === null,
    'a pedreira deveria ter saido do estado',
  );
  afirmar(
    (await estado()).prediosRenderizados === prediosAntes - 1,
    'a cena deveria ter um predio a menos desenhado',
  );
  afirmar(
    await page.isHidden('#painel-predio'),
    'o painel deveria se fechar sozinho: o predio que ele mostrava nao existe mais',
  );
  await capturar('depois-de-demolir');
}

module.exports = { roteiro };
