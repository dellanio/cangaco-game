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
    '#painel-escola [data-slot][data-motivo]', (ns) => ns.map((n) => n.dataset.motivo),
  );
  const slotsNaTela = () => page.$$eval(
    '#painel-escola [data-slot]', (ns) => ns.map((n) => ({ estado: n.dataset.estado, motivo: n.dataset.motivo ?? null })),
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
  afirmar(await page.isHidden('#painel-escola'), 'o painel deveria nascer fechado');

  // 2. clicar no MEIO do footprint (nao no canto) abre o painel: prova `predioNoTile`
  const pEscola = await pontoDoTile(meioDaEscola);
  await page.mouse.click(pEscola.x, pEscola.y);
  await esperarFrame();
  afirmar(await page.isVisible('#painel-escola'), 'clicar no meio da escola deveria abrir o painel');
  afirmar(
    (await page.$$('#painel-escola [data-slot]')).length === SLOTS,
    `o painel deveria mostrar os ${SLOTS} slots do dado`,
  );
  afirmar(
    (await page.textContent('#painel-escola h2')) === tema.painelEscola.titulo,
    'o titulo deveria vir do tema',
  );
  afirmar((await filaNoEstado()).length === 0, 'a fila deveria comecar vazia no estado');

  // 3. enfileirar por CLIQUE ate encher, e conferir a fila NO ESTADO
  const tipo = unidades.civis.tipos[0].id;
  for (let i = 0; i < SLOTS; i++) {
    await page.click(`#painel-escola [data-treinar="${tipo}"]`);
    await avancar(1); // o clique so ENFILEIRA o comando (F11a); o passo o aplica
    await esperarFrame();
  }
  const fila = await filaNoEstado();
  afirmar(fila.length === SLOTS, `a fila no estado deveria ter ${SLOTS} itens, veio ${fila.length}`);
  afirmar(fila.every((i) => i.unidade === tipo), `a fila deveria ser toda de ${tipo}, veio ${JSON.stringify(fila.map((i) => i.unidade))}`);
  afirmar(
    await page.getAttribute(`#painel-escola [data-treinar="${tipo}"]`, 'aria-disabled') === 'true',
    'com a fila cheia o botao de treinar deveria ficar aria-disabled',
  );
  afirmar(
    (await page.textContent('#painel-escola')).includes(tema.painelEscola.filaCheia),
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
    (await page.textContent('#painel-escola')).includes(tema.painelEscola.semEstrada),
    'o painel deveria mostrar o rotulo do tema, nunca o id do motivo',
  );

  await capturar('fila-cheia'); // ACEITE: o painel com a fila cheia

  // 5. cancelar um item pelo X: a fila encolhe NO ESTADO
  await page.click(`#painel-escola [data-cancelar="${fila[SLOTS - 1].id}"]`);
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await filaNoEstado()).length === SLOTS - 1,
    `cancelar deveria deixar ${SLOTS - 1} itens na fila do estado`,
  );

  // 6. `Esc` fecha o painel (e larga a ferramenta, no mesmo ouvinte)
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar(await page.isHidden('#painel-escola'), 'o Esc deveria fechar o painel');

  // 7. puxar a rua da porta do armazem ate a porta da escola. O painel esta
  //    fechado: ele sobrepoe o canvas e roubaria o mouse do canto de baixo.
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pEsq = await pontoDoTile(pontaEsquerda);
  const pDir = await pontoDoTile(pontaDireita);
  await arrastarDentroDoCanvas(page, canvas, [pEsq, pDir]);
  await avancar(1);
  await esperarFrame();
  const comRua = await estado();
  afirmar(
    comRua.estradasRenderizadas === tilesDaRua,
    `a rua deveria ter ${tilesDaRua} tiles (x ${terreno.estrada.custoStonePorTile} de pedra), veio ${comRua.estradasRenderizadas}`,
  );

  // 8. reabrir o painel: com rua e ouro no armazem o motivo vira `a-caminho`
  await page.keyboard.press('Escape'); // larga a ferramenta de estrada
  await esperarFrame();
  await page.mouse.click(pEscola.x, pEscola.y);
  await avancar(2); // o quadro de tarefas ganha o `ouro-para-escola` no proximo passo
  await esperarFrame();
  afirmar(await page.isVisible('#painel-escola'), 'clicar na escola de novo deveria reabrir o painel');
  const depoisDaRua = await motivosNaTela();
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
    (await page.textContent('#painel-escola')).includes(tema.painelEscola.treinando),
    'o slot que treina deveria mostrar o rotulo do tema com o progresso',
  );

  await capturar('treinando'); // o motivo mudando: treinando + dinheiro a caminho

  // 10. clicar num tile vazio fecha o painel (nada selecionado). O tile e ACIMA
  //     dos predios: o painel ocupa o canto de baixo do canvas e roubaria o clique.
  const vazio = await pontoDoTile({ gx: armazem.gx, gy: armazem.gy - 3 });
  const caixaDoPainel = await retanguloDe(page, '#painel-escola');
  afirmar(
    vazio.x < caixaDoPainel.left || vazio.x > caixaDoPainel.right
      || vazio.y < caixaDoPainel.top || vazio.y > caixaDoPainel.bottom,
    'o tile vazio nao pode cair sob o painel: o clique nao chegaria ao canvas',
  );
  await page.mouse.click(vazio.x, vazio.y);
  await avancar(1); // sem isto, um comando emitido por engano ficaria na fila
  await esperarFrame();
  afirmar(await page.isHidden('#painel-escola'), 'clicar fora de um predio deveria fechar o painel');
}

module.exports = { roteiro };
