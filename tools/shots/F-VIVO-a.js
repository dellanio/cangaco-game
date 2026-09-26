'use strict';

// Roteiro da F-VIVO-a — A PILHA.
//
// Afirma a LISTA que a cena desenhou (`window.__cangaco.pilhasDesenhadas`), nunca
// pixel (§8). Quem escolhe o que vai em cada pilha e `render/pilhas.ts`, testado em
// Node (tests/F-VIVO-a-pilhas.test.ts); aqui se prova que a cena chama a funcao para
// os tres casos do aceite, pelo caminho do jogador, e que o que ela publica tem a
// forma certa: 1 a 5 unidades, sem PNG (o placeholder colorido).
//
// Os tres casos:
//  - o armazem, com o estoque inicial: 4 pilhas desde o tick 0;
//  - uma obra com material entregue e ainda nao pregado: a pedreira enquanto sobe;
//  - uma pedreira com saida: a mesma pedreira, ocupada, com pedra na gaveta.
//
// As duas pilhas da pedreira sao fugazes, e por isso o passo fino e a espera por
// CONDICAO, nunca por numero chutado. Sonda da sessao (vila da calibracao, 3000
// ticks, apagada): a obra tem pilha em ~30 % dos ticks, em rajadas; a saida da
// pedreira, em ~20 %, porque o carregador leva a pedra logo.
//
// Geometria da F-T3: a pedreira ao LADO do lajedo, rua ate a escola. A da F16b (a
// direita da escola) nao tem rocha ao alcance — a sonda desta sessao mediu a
// pedreira ocupada no 363 e `progresso` 0 ate o tick 2600 —, e a saida nunca encheria.
//
// Um clique em painel (o treino na escola): despausado e segurando 150 ms (§8).

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { caixaLivre, ruaComDesvio, arrastosDaRua } = require('./_recursos');
const { erguerRua } = require('./_estradas');
const economia = require('../../data/economy.json');
const producao = require('../../data/production.json');
const mapa = require('../../data/maps/sertao-128.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const TETO_DA_PILHA = 5; // src/render/pilhas.ts; o teste headless afirma o mesmo numero
const PONTOS_DO_ARMAZEM = 4; // src/render/manifesto-camadas.ts
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Tetos com folga sobre o que a F-T3 e a F16b mediram; falhar por teto e falhar. */
const TETO_ATE_PILHA_NA_OBRA = 600;
const TETO_ATE_OCUPAR = 900;
const TETO_ATE_SAIDA = 1500;
const PASSO_DE_AVANCO = 50; // um `avancar` seco e grande estoura o frame (F16b)
const PASSO_FINO = 5; // as pilhas da pedreira vem em rajadas: passo curto para ve-las

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

  /** Anda de `passo` em `passo` ate `condicao(estado)` valer, ou reprova no teto. */
  async function andarAte(condicao, teto, passo, oQue) {
    let s = await estado();
    let gastos = 0;
    while (!condicao(s) && gastos < teto) {
      await avancar(passo);
      gastos += passo;
      await esperarFrame();
      s = await estado();
    }
    afirmar(condicao(s), `${oQue}: nao aconteceu em ${teto} ticks (tick ${s.tick}; predios ${JSON.stringify(s.prediosDoEstado)})`);
    return s;
  }

  /** A forma de toda pilha publicada: 1..5 unidades, sem PNG, mercadoria do dado. */
  function conferirForma(id, pilhas) {
    for (const p of pilhas) {
      afirmar(
        Number.isInteger(p.n) && p.n >= 1 && p.n <= TETO_DA_PILHA,
        `${id}: pilha de ${p.mercadoria} com n=${p.n}, fora de 1..${TETO_DA_PILHA}`,
      );
      afirmar(p.sprite === false, `${id}: sem PNG de pilha no manifesto, ${p.mercadoria} deveria ser placeholder`);
      afirmar(economia.mercadorias.includes(p.mercadoria), `${id}: '${p.mercadoria}' nao e mercadoria do dado`);
    }
  }

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largAr, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu, altQu] = defDe('quarry').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  let gxDaPedreira = armazem.gx - largQu - 1;
  while (gxDaPedreira > 0 && !caixaLivre(gxDaPedreira, yRua - altQu, largQu, altQu)) gxDaPedreira -= 1;
  const pedreira = { gx: gxDaPedreira, gy: yRua - altQu };
  const alcance = producao.predios.quarry.colheita.alcance_tiles;
  const rochaAoAlcance = mapa.recursos.rock.filter(([gx, gy]) => (
    gx >= pedreira.gx - alcance && gx <= pedreira.gx + largQu - 1 + alcance
    && gy >= pedreira.gy - alcance && gy <= pedreira.gy + altQu - 1 + alcance
  ));
  afirmar(rochaAoAlcance.length > 0, `a pedreira de (${pedreira.gx},${pedreira.gy}) nao tem rocha ao alcance: a saida nunca encheria`);
  const tilesDaRua = ruaComDesvio(pedreira.gx, escola.gx + largEs - 1, yRua);
  const civil = defDe('quarry').trabalhador;
  afirmar(typeof civil === 'string', 'a pedreira precisa declarar `trabalhador` no dado');

  // ---- 1. o armazem: quatro pilhas do estoque inicial -------------------------
  const inicio = await estado();
  const idDo = (tipo) => Object.entries(inicio.prediosDoEstado).find(([, p]) => p.tipo === tipo)?.[0];
  const ID_ARMAZEM = idDo('storehouse');
  const ID_ESCOLA = idDo('schoolhouse');
  afirmar(ID_ARMAZEM !== undefined && ID_ESCOLA !== undefined, 'armazem e escola deveriam estar no estado inicial');
  const doArmazem = inicio.pilhasDesenhadas[ID_ARMAZEM] ?? [];
  afirmar(
    doArmazem.length === PONTOS_DO_ARMAZEM,
    `o estoque inicial tem mais de ${PONTOS_DO_ARMAZEM} mercadorias: o armazem deveria desenhar ${PONTOS_DO_ARMAZEM} pilhas, veio ${JSON.stringify(doArmazem)}`,
  );
  afirmar(
    new Set(doArmazem.map((p) => p.mercadoria)).size === doArmazem.length,
    `as pilhas do armazem deveriam ser de mercadorias distintas, veio ${JSON.stringify(doArmazem)}`,
  );
  conferirForma(ID_ARMAZEM, doArmazem);
  afirmar(
    inicio.pilhasDesenhadas[ID_ESCOLA] === undefined,
    `a escola nao tem receita: nao deveria publicar pilha, veio ${JSON.stringify(inicio.pilhasDesenhadas[ID_ESCOLA])}`,
  );
  await capturar('armazem');

  // ---- 2. a rua, e a pedreira ganha pilha de obra ---------------------------
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const { gy, de, ate } of arrastosDaRua(tilesDaRua)) {
    await centrarEm(Math.floor((de + ate) / 2));
    await arrastarDentroDoCanvas(page, canvas, [await pontoDoTile(de, gy), await pontoDoTile(ate, gy)]);
    await avancar(1);
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await esperarFrame();
  await erguerRua(ctx, { tiles: tilesDaRua.length });

  await centrarEm(pedreira.gx + largQu);
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  await clicarNoTile(pedreira.gx, pedreira.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  const achado = Object.entries((await estado()).prediosDoEstado)
    .find(([, p]) => p.gx === pedreira.gx && p.gy === pedreira.gy);
  afirmar(achado !== undefined, `deveria existir a pedreira plantada em (${pedreira.gx},${pedreira.gy})`);
  const ID_PEDREIRA = achado[0];
  afirmar(
    ((await estado()).pilhasDesenhadas[ID_PEDREIRA] ?? []).length === 0,
    'a obra recem-plantada nao tem material: nao deveria desenhar pilha',
  );

  // A obra pronta antes da pilha ser vista e falha, nao espera: ai a leitura
  // pulou a janela, e o roteiro diz em que tick.
  const comPilha = await andarAte(
    (s) => {
      afirmar(s.prediosDoEstado[ID_PEDREIRA]?.estado === 'obra', `a pedreira ficou pronta no tick ${s.tick} sem a pilha de obra ter sido vista`);
      return (s.pilhasDesenhadas[ID_PEDREIRA] ?? []).some((p) => p.gaveta === 'obra');
    },
    TETO_ATE_PILHA_NA_OBRA, PASSO_FINO, 'material na obra da pedreira',
  );
  const naObra = comPilha.pilhasDesenhadas[ID_PEDREIRA];
  afirmar(naObra.every((p) => p.gaveta === 'obra'), `obra so desenha a gaveta 'obra', veio ${JSON.stringify(naObra)}`);
  afirmar(
    naObra.every((p) => p.mercadoria === 'timber' || p.mercadoria === 'stone'),
    `obra so empilha tabua e pedra, veio ${JSON.stringify(naObra)}`,
  );
  conferirForma(ID_PEDREIRA, naObra);
  await capturar('obra');

  // ---- 3. a escola treina o cabra da pedreira --------------------------------
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  await centrarEm(meioDaEscola.gx);
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  const botao = await page.$eval(`#painel-predio [data-treinar="${civil}"]`, (n) => {
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
    (await page.$$('#painel-predio [data-slot][data-unidade]')).length > 0,
    'o pedido de treino deveria ter entrado na fila da escola',
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 4. a pedreira ocupada, com pedra na saida, ao lado do armazem ---------
  await andarAte(
    (s) => s.prediosDoEstado[ID_PEDREIRA]?.ocupante != null,
    TETO_ATE_OCUPAR, PASSO_DE_AVANCO, 'pedreira ocupada',
  );
  await centrarEm(Math.floor((pedreira.gx + armazem.gx + largAr) / 2));
  const comSaida = await andarAte(
    (s) => (s.pilhasDesenhadas[ID_PEDREIRA] ?? []).some((p) => p.gaveta === 'saida' && p.mercadoria === 'stone'),
    TETO_ATE_SAIDA, PASSO_FINO, 'pedra na saida da pedreira',
  );
  const naSaida = comSaida.pilhasDesenhadas[ID_PEDREIRA];
  afirmar(
    naSaida.every((p) => p.gaveta === 'saida'),
    `a pedreira nao tem entrada: so a gaveta 'saida', veio ${JSON.stringify(naSaida)}`,
  );
  conferirForma(ID_PEDREIRA, naSaida);
  const armazemAgora = comSaida.pilhasDesenhadas[ID_ARMAZEM] ?? [];
  afirmar(armazemAgora.length === PONTOS_DO_ARMAZEM, `o armazem deveria seguir com 4 pilhas, veio ${JSON.stringify(armazemAgora)}`);
  conferirForma(ID_ARMAZEM, armazemAgora);
  await capturar('pedreira');
}

module.exports = { roteiro };
