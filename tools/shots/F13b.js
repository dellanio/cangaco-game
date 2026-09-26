'use strict';

// Roteiro da F13b. Afirma ESTADO e DOM, nunca pixel: a fila sai de
// `window.__cangaco.filaDeTreino` (o `GameState.treino` do tick desenhado) e o
// motivo sai do `data-motivo` do slot. Todo numero esperado vem do JSON —
// slots, custo e tipos de civil nao sao digitados aqui.
//
// O que este roteiro existe para provar NA TELA:
//  - clicar no MEIO do footprint da escola abre o painel (nao so no canto);
//  - enfileirar por CLIQUE enche a fila NO ESTADO, e com ela cheia os botoes
//    ficam `aria-disabled` (o clique chega e e ignorado, como no menu da F06);
//  - sem estrada ate o armazem o item diz `sem-estrada` — e NAO `sem-ouro`, que
//    e o outro caso e pede acao oposta do jogador (D2 do plano). O cenario so
//    prova isso porque o armazem COMECA com ouro;
//  - puxada a rua, o mesmo item passa a `a-caminho` e depois a `treinando`.
//
// Todo clique no mapa acontece com o painel FECHADO: ele e sobreposicao no canto
// do canvas, e o que esta debaixo dele nao recebe mouse.

const { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { erguerRua } = require('./_estradas');
const economia = require('../../data/economy.json');
const unidades = require('../../data/units.json');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);
const SLOTS = economia.schoolhouse.slotsDeFila;
/** Medido (probe desta sessao, estrada de fixture): o serf entrega o ouro e o
 *  primeiro item comeca a treinar ~24 ticks depois. 40 e a folga do roteiro. */
const TICKS_ATE_TREINAR = 40;
/** Teto da espera do passo 8, em ticks de 1 em 1. Medido depois da F18g: a escola se
 *  liga no tick 87 do roteiro. 300 e o caso de nunca ligar, nao um prazo. */
const TETO_ATE_LIGAR = 300;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function pontoDoTile(tile) {
    const { camera } = await estado();
    const x = canvas.left + tile.gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + tile.gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${tile.gx},${tile.gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  const motivosNaTela = () => page.$$eval(
    '#painel-predio [data-slot][data-motivo]', (ns) => ns.map((n) => n.dataset.motivo),
  );
  const slotsNaTela = () => page.$$eval(
    '#painel-predio [data-slot]', (ns) => ns.map((n) => ({ estado: n.dataset.estado, motivo: n.dataset.motivo ?? null })),
  );
  async function filaNoEstado() {
    const s = await estado();
    const escolas = Object.keys(s.filaDeTreino);
    afirmar(escolas.length <= 1, `so a escola do cenario deveria ter fila, veio ${JSON.stringify(escolas)}`);
    return escolas.length === 0 ? [] : s.filaDeTreino[escolas[0]];
  }

  // geometria, tirada dos JSON: a rua reta que liga a porta do armazem a porta da escola
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largAr, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume os dois predios na mesma linha de porta');
  const pontaEsquerda = { gx: armazem.gx, gy: yRua };
  const pontaDireita = { gx: escola.gx + largEs - 1, gy: yRua };
  const tilesDaRua = pontaDireita.gx - pontaEsquerda.gx + 1;
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  afirmar(largAr > 1 && largEs > 1, 'o teste do "meio do footprint" so vale se o predio for maior que 1x1');

  // 1. o painel nasce fechado
  afirmar(await page.isHidden('#painel-predio'), 'o painel deveria nascer fechado');

  // 2. clicar no MEIO do footprint (nao no canto) abre o painel: prova `predioNoTile`
  const pEscola = await pontoDoTile(meioDaEscola);
  await page.mouse.click(pEscola.x, pEscola.y);
  await esperarFrame();
  afirmar(await page.isVisible('#painel-predio'), 'clicar no meio da escola deveria abrir o painel');
  afirmar(
    (await page.$$('#painel-predio [data-slot]')).length === SLOTS,
    `o painel deveria mostrar os ${SLOTS} slots do dado`,
  );
  afirmar(
    // F16b: o titulo do painel e o NOME DO PREDIO, nao um rotulo proprio da
    // escola. A fonte mudou de lugar (predios.schoolhouse.nome); o que a F13b
    // afirma — titulo vindo do tema, nunca do id neutro — segue de pe.
    (await page.textContent('#painel-predio h2')) === tema.predios.schoolhouse.nome,
    'o titulo deveria ser o nome do predio, vindo do tema',
  );
  afirmar((await filaNoEstado()).length === 0, 'a fila deveria comecar vazia no estado');

  // 3. enfileirar por CLIQUE ate encher, e conferir a fila NO ESTADO
  const tipo = unidades.civis.tipos[0].id;
  for (let i = 0; i < SLOTS; i++) {
    await page.click(`#painel-predio [data-treinar="${tipo}"]`);
    await avancar(1); // o clique so ENFILEIRA o comando (F11a); o passo o aplica
    await esperarFrame();
  }
  const fila = await filaNoEstado();
  afirmar(fila.length === SLOTS, `a fila no estado deveria ter ${SLOTS} itens, veio ${fila.length}`);
  afirmar(fila.every((i) => i.unidade === tipo), `a fila deveria ser toda de ${tipo}, veio ${JSON.stringify(fila.map((i) => i.unidade))}`);
  afirmar(
    await page.getAttribute(`#painel-predio [data-treinar="${tipo}"]`, 'aria-disabled') === 'true',
    'com a fila cheia o botao de treinar deveria ficar aria-disabled',
  );
  afirmar(
    (await page.textContent('#painel-predio')).includes(tema.painelEscola.filaCheia),
    'o painel deveria dizer que a fila esta cheia, com o texto do tema',
  );

  // 4. sem rua ate o armazem o motivo e `sem-estrada`, NAO `sem-ouro`: o armazem
  //    comeca COM ouro, entao os dois casos so coincidiriam se a separacao falhasse.
  afirmar(
    economia.estadoInicial.estoque.gold > 0,
    'este passo so prova a separacao das causas se o armazem TIVER ouro no inicio',
  );
  const motivos = await motivosNaTela();
  afirmar(
    motivos.length === SLOTS && motivos.every((m) => m === 'sem-estrada'),
    `sem rua todos os itens deveriam dizer sem-estrada, veio ${JSON.stringify(motivos)}`,
  );
  afirmar(
    (await page.textContent('#painel-predio')).includes(tema.painelEscola.semEstrada),
    'o painel deveria mostrar o rotulo do tema, nunca o id do motivo',
  );

  await capturar('fila-cheia'); // ACEITE: o painel com a fila cheia

  // 5. cancelar um item pelo X: a fila encolhe NO ESTADO
  await page.click(`#painel-predio [data-cancelar="${fila[SLOTS - 1].id}"]`);
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await filaNoEstado()).length === SLOTS - 1,
    `cancelar deveria deixar ${SLOTS - 1} itens na fila do estado`,
  );

  // 6. `Esc` fecha o painel (e larga a ferramenta, no mesmo ouvinte)
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar(await page.isHidden('#painel-predio'), 'o Esc deveria fechar o painel');

  // 7. puxar a rua da porta do armazem ate a porta da escola. O painel esta
  //    fechado: ele sobrepoe o canvas e roubaria o mouse do canto de baixo.
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pEsq = await pontoDoTile(pontaEsquerda);
  const pDir = await pontoDoTile(pontaDireita);
  await arrastarDentroDoCanvas(page, canvas, [pEsq, pDir]);
  await avancar(1);
  await esperarFrame();
  const desenhada = await estado();
  afirmar(
    desenhada.estradasPlanejadasRenderizadas === tilesDaRua && desenhada.estradasRenderizadas === 0,
    `o arrasto deveria DESENHAR ${tilesDaRua} tiles e erguer 0, veio `
      + `${desenhada.estradasPlanejadasRenderizadas} e ${desenhada.estradasRenderizadas}`,
  );
  // 8. reabrir o painel ANTES de a rua subir, e ver o motivo virar `a-caminho`. O ouro so
  //    anda por rua DE PE (o nivel dele e `estrada`), e quem ergue e o laborer. A escola se
  //    liga antes de o canteiro esvaziar — medido depois da F18g: com 5 de 8 tiles de pe
  //    (os que ficam alem das portas nao fazem falta), e o `a-caminho` dura ~28 ticks. Por
  //    isso o roteiro anda de 1 em 1 tick com o painel aberto: esperar o canteiro vazio
  //    (`erguerRua`) chegava com o item ja treinando (BUG-I, 2026-09-26).
  await page.keyboard.press('Escape'); // larga a ferramenta de estrada
  await esperarFrame();
  await page.mouse.click(pEscola.x, pEscola.y);
  await esperarFrame();
  afirmar(await page.isVisible('#painel-predio'), 'clicar na escola de novo deveria reabrir o painel');
  let depoisDaRua = await motivosNaTela();
  for (let i = 0; i < TETO_ATE_LIGAR && !depoisDaRua.includes('a-caminho'); i++) {
    await avancar(1);
    await esperarFrame();
    depoisDaRua = await motivosNaTela();
    afirmar(
      depoisDaRua.every((m) => m === 'sem-estrada' || m === 'a-caminho'),
      `enquanto a rua sobe o motivo e sem-estrada ou a-caminho, nunca outro; veio ${JSON.stringify(depoisDaRua)}`,
    );
  }
  afirmar(
    depoisDaRua.includes('a-caminho') && !depoisDaRua.includes('sem-estrada'),
    `com a rua puxada o motivo deveria virar a-caminho, veio ${JSON.stringify(depoisDaRua)}`,
  );

  // 9. o ouro chega e o primeiro item comeca a treinar
  await avancar(TICKS_ATE_TREINAR);
  await esperarFrame();
  const slots = await slotsNaTela();
  afirmar(
    slots.some((s) => s.estado === 'treinando'),
    `em ${TICKS_ATE_TREINAR} ticks algum item deveria estar treinando, veio ${JSON.stringify(slots)}`,
  );
  afirmar(
    (await page.textContent('#painel-predio')).includes(tema.painelEscola.treinando),
    'o slot que treina deveria mostrar o rotulo do tema com o progresso',
  );

  // 9a. o resto do canteiro sobe: a rua inteira de pe, como o arrasto desenhou
  await erguerRua(ctx, { tiles: tilesDaRua });
  const comRua = await estado();
  afirmar(
    comRua.estradasRenderizadas === tilesDaRua && comRua.estradasPlanejadasRenderizadas === 0,
    `a rua deveria ter ${tilesDaRua} tiles de pe (x ${terreno.estrada.custoStonePorTile} de pedra), veio ${comRua.estradasRenderizadas}`,
  );

  // 9b. BUG-B — o mesmo cancelamento COM O LACO ANDANDO, e com o aperto de uma
  // mao humana. Este passo existe porque os passos 1-9 rodam todos pausados (o
  // runner abre `/?pausado`) e por isso nunca tocaram no defeito: com o jogo
  // andando, o painel se redesenhava inteiro 10 vezes por segundo e destruia o
  // botao entre o `mousedown` e o `mouseup`, de modo que o `click` nao nascia.
  //
  // Um `page.click()` NAO serve de guarda aqui: ele aperta e solta no mesmo
  // instante e passava mesmo com o bug de pe. O que prova e o intervalo.
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo 9b so vale com o laco ANDANDO');
  const antesDoAperto = await filaNoEstado();
  afirmar(antesDoAperto.length > 0, 'deveria haver item na fila para o passo 9b');
  const alvoDoAperto = antesDoAperto[antesDoAperto.length - 1].id;
  const caixaDoX = await retanguloDe(page, `#painel-predio [data-cancelar="${alvoDoAperto}"]`);
  await page.mouse.move(caixaDoX.left + caixaDoX.width / 2, caixaDoX.top + caixaDoX.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150); // o tempo de uma mao, e varios ticks do laco
  await page.mouse.up();
  await esperarFrame();
  afirmar(
    !(await filaNoEstado()).some((i) => i.id === alvoDoAperto),
    `com o jogo andando, apertar o x deveria remover '${alvoDoAperto}' da fila`,
  );
  await page.keyboard.press('p'); // volta a pausar: os passos seguintes contam ticks
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro deveria voltar a pausar depois do 9b');

  await capturar('treinando'); // o motivo mudando: treinando + dinheiro a caminho

  // 10. clicar num tile vazio fecha o painel (nada selecionado). O tile e ACIMA
  //     dos predios: o painel ocupa o canto de baixo do canvas e roubaria o clique.
  const vazio = await pontoDoTile({ gx: armazem.gx, gy: armazem.gy - 3 });
  const caixaDoPainel = await retanguloDe(page, '#painel-predio');
  afirmar(
    vazio.x < caixaDoPainel.left || vazio.x > caixaDoPainel.right
      || vazio.y < caixaDoPainel.top || vazio.y > caixaDoPainel.bottom,
    'o tile vazio nao pode cair sob o painel: o clique nao chegaria ao canvas',
  );
  await page.mouse.click(vazio.x, vazio.y);
  await avancar(1); // sem isto, um comando emitido por engano ficaria na fila
  await esperarFrame();
  afirmar(await page.isHidden('#painel-predio'), 'clicar fora de um predio deveria fechar o painel');
}

module.exports = { roteiro };
