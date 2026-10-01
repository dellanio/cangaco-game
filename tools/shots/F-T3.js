'use strict';

// Roteiro da F-T3 — O PEDREIRO SAI DO PREDIO, E A TELA MOSTRA.
//
// Ate a F-T2c a pedra aparecia na gaveta com o pedreiro parado na porta. O teste
// headless (`tests/F-T3-*.test.ts`) prova o ciclo na simulacao; o que so a tela
// pode provar e o que a nota de integracao do BUILD_PLAN (CLAUDE.md §10) exige:
// a unidade que a simulacao poe no CAMPO e desenhada no campo, e nao continua
// parada em cima do predio.
//
// Sao duas afirmacoes que nenhum teste de sim alcanca:
//
//   1. o tile DESENHADO do pedreiro sai do footprint da pedreira — medido com
//      `window.__cangaco.unidadesRenderizadas`, que e o que a camada desenhou;
//   2. com ele fora, o painel continua dizendo quem trabalha ali. "Ocupado, mas
//      fora" tem de valer na tela tambem, ou o jogador le abandono onde ha
//      trabalho.
//
// E a terceira, que fecha o ciclo: depois de uma volta, a linha "quanto resta ao
// alcance" (F-TA) BAIXOU. E a prova, na tela, de que a viagem virou pedra — sem
// depender da gaveta `saida`, que o carregador esvazia quase sempre (nota da
// F16b).
//
// Geometria nunca digitada: pedreira ao lado do lajedo pelo molde do F-TA (recua
// ate `caixaLivre`), rua pelo `_recursos`/`_estradas`. Numero esperado sai dos
// mesmos JSON que a sim le.
//
// O passo 6 roda DESPAUSADO, com aperto de 150 ms (CLAUDE.md §8): este roteiro
// clica em `#painel-predio`, e clique instantaneo em painel que se redesenha a
// cada tick passa mesmo quando o evento nunca chega (BUG-B).

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { caixaLivre, ruaComDesvio, arrastosDaRua } = require('./_recursos');
const { erguerRua } = require('./_estradas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');
const producao = require('../../data/production.json');
const recursos = require('../../data/resources.json');
const mapa = require('../../data/maps/sertao-128.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Tetos de ESPERA, nao afirmacoes de desempenho (CLAUDE.md §8): existem para o
 *  roteiro falhar dizendo o tick em que travou, em vez de pendurar. */
const TETO_ATE_COMPLETAR = 600;
const TETO_ATE_OCUPAR = 600;
const TETO_ATE_SAIR = 200;
const TETO_ATE_VOLTAR = 600;
const PASSO_DE_AVANCO = 10;
/** A volta se amostra mais fino: o pedreiro passa pela porta e sai de novo, e o
 *  roteiro precisa VER a passagem, nao so o resultado dela. */
const PASSO_DA_VOLTA = 5;

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

  /** Anda a camera com as setas ate a coluna cair no meio do quadro (molde do F22/F-TA). */
  async function centrarEm(gx) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const alvo = Math.max(0, gx * TILE_PX - (canvas.right - canvas.left) / 2);
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), ['x', alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
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

  const predioDoEstado = async (id) => (await estado()).prediosDoEstado[id] ?? null;
  const idAberto = () => page.getAttribute('#painel-predio', 'data-predio-aberto');
  const temNoPainel = async (seletor) => (await page.$$(`#painel-predio ${seletor}`)).length > 0;

  /** A linha do alcance como o jogador ve (F-TA): numero em `data-`, nunca texto recortado. */
  async function linhaDoAlcance() {
    const n = await page.$('#painel-predio [data-colheita]');
    if (n === null) return null;
    return n.evaluate((el) => ({
      recurso: el.dataset.colheita,
      tiles: Number(el.dataset.tiles),
      unidades: Number(el.dataset.unidades),
    }));
  }

  /** O que a CAMADA desenhou desta unidade neste quadro, ou null. */
  async function desenhada(id) {
    return (await estado()).unidadesRenderizadas.find((u) => u.id === id) ?? null;
  }

  /**
   * Avanca em blocos ate a condicao valer, com o jogo pausado. Devolve os ticks
   * gastos; reprova com o tick e o ultimo estado lido quando o teto estoura —
   * que e o que distingue lentidao de travamento.
   */
  async function esperarAte(condicao, teto, oQue) {
    let gastos = 0;
    while (gastos < teto) {
      if (await condicao()) return gastos;
      await avancar(PASSO_DE_AVANCO);
      gastos += PASSO_DE_AVANCO;
      await esperarFrame();
    }
    afirmar(await condicao(), `${oQue}: nao aconteceu em ${teto} ticks (tick ${(await estado()).tick})`);
    return gastos;
  }

  // ---- geometria, tirada dos JSON -----------------------------------------
  // A pedreira ao LADO do lajedo, nunca em cima (BUG-F): recua de um em um ate a
  // caixa ficar livre. A rua liga a porta dela a porta da escola — e por ela que
  // o ouro do treino anda, e sem ela nao ha cabra para sair do predio.
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu, altQu] = defDe('quarry').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');

  let gxDaPedreira = armazem.gx - largQu - 1;
  while (gxDaPedreira > 0 && !caixaLivre(gxDaPedreira, yRua - altQu, largQu, altQu)) gxDaPedreira -= 1;
  const pedreira = { gx: gxDaPedreira, gy: yRua - altQu };
  const meioDaPedreira = { gx: pedreira.gx + Math.floor(largQu / 2), gy: pedreira.gy };
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  const tilesDaRuaLista = ruaComDesvio(pedreira.gx, escola.gx + largEs - 1, yRua);
  const tilesDaRua = tilesDaRuaLista.length;
  const arrastos = arrastosDaRua(tilesDaRuaLista);
  const civilDaPedreira = defDe('quarry').trabalhador;
  afirmar(
    typeof civilDaPedreira === 'string',
    'a pedreira precisa declarar `trabalhador` no dado; sem isso nao ha ocupante para sair',
  );

  /** Distancia de Chebyshev de um ponto DESENHADO ao footprint da pedreira: 0
   *  dentro, 1 no anel da porta, mais que isso em campo aberto. E a mesma conta
   *  que `tests/F-T3-determinismo.test.ts` faz sobre o estado. */
  const distanciaAoPredio = (gx, gy) => Math.max(
    Math.max(pedreira.gx - gx, 0, gx - (pedreira.gx + largQu - 1)),
    Math.max(pedreira.gy - gy, 0, gy - (pedreira.gy + altQu - 1)),
  );

  // O lajedo ao alcance, contado do mapa: se for zero, o pedreiro nao teria a
  // quem ir, e este roteiro passaria pelo motivo errado (era o BUG-C).
  const alcance = producao.predios.quarry.colheita.alcance_tiles;
  const rochaAoAlcance = mapa.recursos.rock.filter(([gx, gy]) => (
    gx >= pedreira.gx - alcance && gx <= pedreira.gx + largQu - 1 + alcance
    && gy >= pedreira.gy - alcance && gy <= pedreira.gy + altQu - 1 + alcance
  ));
  afirmar(
    rochaAoAlcance.length > 0,
    `a pedreira de (${pedreira.gx},${pedreira.gy}) nao tem rocha ao alcance: o pedreiro nao teria `
      + 'aonde ir, e o roteiro passaria sem exercitar a feature',
  );
  const RENDIMENTO = recursos.tipos.rock.rendimentoPorTile;
  const UNIDADES_NO_COMECO = rochaAoAlcance.length * RENDIMENTO;

  // ---- 1. a rua e a planta da pedreira ------------------------------------
  await centrarEm(pedreira.gx + largQu);
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const { gy, de, ate } of arrastos) {
    await centrarEm(Math.floor((de + ate) / 2));
    const pDe = await pontoDoTile(de, gy);
    const pAte = await pontoDoTile(ate, gy);
    await arrastarDentroDoCanvas(page, canvas, [pDe, pAte]);
    await avancar(1);
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await esperarFrame();
  await erguerRua(ctx, { tiles: tilesDaRua });

  await centrarEm(pedreira.gx + largQu);
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  await clicarNoTile(pedreira.gx, pedreira.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape'); // larga a planta fantasma
  await esperarFrame();

  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  const ID_PEDREIRA = await idAberto();
  afirmar(ID_PEDREIRA !== null, 'clicar na planta recem-posta deveria abrir o painel da obra');
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 2. a obra sobe -----------------------------------------------------
  await esperarAte(
    async () => (await predioDoEstado(ID_PEDREIRA))?.estado === 'completo',
    TETO_ATE_COMPLETAR,
    'a pedreira ficar pronta',
  );

  // ---- 3. a escola treina o cabra, e ele ocupa ----------------------------
  await centrarEm(meioDaEscola.gx);
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  afirmar(
    await temNoPainel(`[data-treinar="${civilDaPedreira}"]`),
    'a escola deveria oferecer o treino do cabra da pedreira',
  );
  await page.click(`#painel-predio [data-treinar="${civilDaPedreira}"]`);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  await esperarAte(
    async () => (await predioDoEstado(ID_PEDREIRA))?.ocupante !== null,
    TETO_ATE_OCUPAR,
    'o cabra treinado ocupar a pedreira',
  );
  const OCUPANTE = (await predioDoEstado(ID_PEDREIRA)).ocupante;

  // ---- 4. o ponto de partida: ele esta DENTRO, e o painel diz quem e ------
  await centrarEm(pedreira.gx);
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  afirmar((await idAberto()) === ID_PEDREIRA, 'o painel deveria abrir na pedreira');
  afirmar(
    (await page.getAttribute('#painel-predio .linha.ocupante', 'data-ocupante')) === OCUPANTE,
    `a linha de ocupante deveria apontar ${OCUPANTE}`,
  );
  const naPorta = await desenhada(OCUPANTE);
  afirmar(naPorta !== null, `a camada deveria estar desenhando o ocupante ${OCUPANTE}`);
  afirmar(
    naPorta.tipo === civilDaPedreira,
    `o desenhado deveria ser um ${civilDaPedreira}, veio ${naPorta.tipo}`,
  );
  afirmar(
    distanciaAoPredio(naPorta.gx, naPorta.gy) <= 1,
    `antes de sair ele deveria estar no predio ou na porta, veio em (${naPorta.gx},${naPorta.gy})`,
  );
  const alcanceNoComeco = await linhaDoAlcance();
  afirmar(
    alcanceNoComeco !== null && alcanceNoComeco.unidades === UNIDADES_NO_COMECO,
    `a linha do alcance deveria comecar com ${UNIDADES_NO_COMECO} unidades, veio `
      + `${JSON.stringify(alcanceNoComeco)}`,
  );

  // ---- 5. ele SAI: o tile desenhado deixa o footprint ----------------------
  // A espera e por CONDICAO — "saiu do footprint e da porta" —, e para cedo na
  // viagem de proposito: os poucos ticks despausados do passo 6 nao podem levar
  // ele ao tile antes da afirmacao.
  const ticksAteSair = await esperarAte(
    async () => {
      const u = await desenhada(OCUPANTE);
      return u !== null && distanciaAoPredio(u.gx, u.gy) > 1;
    },
    TETO_ATE_SAIR,
    'o pedreiro sair do footprint e da porta',
  );
  const noCampo = await desenhada(OCUPANTE);
  afirmar(
    ['indo_colher', 'colhendo', 'voltando'].includes(noCampo.fsm),
    `fora do predio ele deveria estar em um estado de campo, veio '${noCampo.fsm}' `
      + `depois de ${ticksAteSair} ticks`,
  );

  // ---- 6. ACEITE, com o jogo ANDANDO (§8): fora, e ainda ocupante ---------
  // `page.click()` aperta e solta no mesmo instante, e o painel se redesenha a
  // cada tick: so o aperto de 150 ms despausado prova que o evento chega.
  await page.keyboard.press('Escape');
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo 6 so vale com o laco ANDANDO');

  const pAperto = await pontoDoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  await page.mouse.move(pAperto.x, pAperto.y);
  await page.mouse.down();
  await page.waitForTimeout(150); // o tempo de uma mao, e varios ticks do laco
  await page.mouse.up();
  await esperarFrame();

  afirmar(
    (await idAberto()) === ID_PEDREIRA,
    'com o jogo andando, apertar a pedreira deveria abrir o painel dela',
  );
  const andando = await desenhada(OCUPANTE);
  afirmar(
    andando !== null && distanciaAoPredio(andando.gx, andando.gy) > 1,
    `com o laco andando o pedreiro deveria continuar em campo, veio ${JSON.stringify(andando)}`,
  );
  // E ESTA e a nota de integracao provada na tela: fora do predio, e o painel
  // continua dizendo que ele trabalha ali. Tela que dissesse "sem trabalhador"
  // aqui estaria mentindo sobre a simulacao.
  afirmar(
    (await page.getAttribute('#painel-predio .linha.ocupante', 'data-ocupante')) === OCUPANTE,
    'com o ocupante no campo o painel deveria continuar apontando ele',
  );
  afirmar(
    (await page.textContent('#painel-predio')).includes(tema.civis[civilDaPedreira].nome),
    'o ocupante deveria continuar aparecendo pelo NOME no sertao, mesmo em campo',
  );
  await capturar('pedreiro-no-campo');

  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro deveria voltar a pausar depois do passo 6');

  // ---- 7. a volta: ele torna ao predio, e o alcance BAIXOU ----------------
  // A espera e pelo VEIO baixar, com o painel aberto o tempo todo: e o unico
  // evento da volta que dura. `trabalhando` dura UM tick — ele deposita ao
  // chegar e sai de novo no tick seguinte —, entao esperar por aquele rotulo
  // seria amostrar um alvo de um tick e falhar por sorte. Que ele chegou a
  // ENCOSTAR no predio se afirma pela menor distancia vista no caminho.
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  afirmar((await idAberto()) === ID_PEDREIRA, 'o painel deveria reabrir na MESMA pedreira');
  let menorDistancia = Infinity;
  let gastosNaVolta = 0;
  let alcanceNoFim = await linhaDoAlcance();
  while (gastosNaVolta < TETO_ATE_VOLTAR && alcanceNoFim.unidades >= alcanceNoComeco.unidades) {
    await avancar(PASSO_DA_VOLTA);
    gastosNaVolta += PASSO_DA_VOLTA;
    await esperarFrame();
    const u = await desenhada(OCUPANTE);
    if (u !== null) menorDistancia = Math.min(menorDistancia, distanciaAoPredio(u.gx, u.gy));
    alcanceNoFim = await linhaDoAlcance();
  }
  afirmar(
    menorDistancia <= 1,
    `para depositar ele tem de voltar a porta: a menor distancia vista na volta foi ${menorDistancia}`,
  );
  afirmar(
    alcanceNoFim !== null && alcanceNoFim.unidades < alcanceNoComeco.unidades,
    `depois de uma volta o alcance deveria ter baixado de ${alcanceNoComeco.unidades}, veio `
      + `${JSON.stringify(alcanceNoFim)}`,
  );
  afirmar(
    alcanceNoFim.tiles === alcanceNoComeco.tiles,
    `um ciclo nao esgota o tile inteiro: a contagem de tiles deveria seguir ${alcanceNoComeco.tiles}, `
      + `veio ${alcanceNoFim.tiles}`,
  );
  await capturar('pedreiro-de-volta');
}

module.exports = { roteiro };
