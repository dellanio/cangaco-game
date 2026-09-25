'use strict';

// Roteiro da F-TA — O PAINEL DIZ QUANTO RESTA AO ALCANCE.
//
// Pedido do operador: sem esse numero na tela ele nao sabe se a pedreira vai
// durar cinco minutos ou uma hora. O teste headless
// (`tests/F-TA-painel-alcance.test.ts`) prova que o seletor e a previa dizem o
// mesmo par; aqui se prova o que so a tela pode provar: a linha EXISTE no painel
// da pedreira, com os dois numeros, e NAO existe no armazem.
//
// Afirma DOM e dado, nunca pixel: os numeros esperados saem de
// `data/maps/sertao-128.json` + `data/production.json` + `data/resources.json`,
// e os observados saem de `#painel-predio [data-colheita]`. Nenhuma coordenada e
// digitada aqui; a geometria e a mesma do F22, derivada com `_recursos.js`.
//
// O passo 4 roda DESPAUSADO e com aperto de 150 ms (CLAUDE.md §8): o painel se
// redesenha a cada tick, e clique instantaneo em painel que se redesenha passa
// mesmo com o defeito de pe — foi assim que o BUG-B escapou de todo roteiro.

const { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { erguerRua } = require('./_estradas');
const { caixaLivre, ruaComDesvio, arrastosDaRua } = require('./_recursos');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');
const producao = require('../../data/production.json');
const recursos = require('../../data/resources.json');
const mapa = require('../../data/maps/sertao-128.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Medido no F16b e reusado no F22, mesma geometria: a obra fecha no tick 220. */
const TETO_ATE_COMPLETAR = 600;
const PASSO_DE_AVANCO = 50;

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

  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  /** Anda a camera com as setas ate a coluna cair no meio do quadro (F22). */
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

  const predioDoEstado = async (id) => (await estado()).prediosDoEstado[id] ?? null;
  const idAberto = () => page.getAttribute('#painel-predio', 'data-predio-aberto');

  /** A linha do alcance como o jogador a ve: os dois numeros em `data-`, para
   *  afirmar numero em vez de recortar texto, e o texto para a legenda. */
  async function linhaDoAlcance() {
    const n = await page.$('#painel-predio [data-colheita]');
    if (n === null) return null;
    return n.evaluate((el) => ({
      recurso: el.dataset.colheita,
      tiles: Number(el.dataset.tiles),
      unidades: Number(el.dataset.unidades),
      texto: el.textContent,
    }));
  }

  // ---- geometria, tirada dos JSON (a mesma do F22) --------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu, altQu] = defDe('quarry').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  // A pedreira ao LADO do lajedo, nunca em cima (BUG-F): recua de um em um ate a
  // caixa ficar livre, como o F22.
  let gxDaPedreira = armazem.gx - largQu - 1;
  while (gxDaPedreira > 0 && !caixaLivre(gxDaPedreira, yRua - altQu, largQu, altQu)) gxDaPedreira -= 1;
  const pedreira = { gx: gxDaPedreira, gy: yRua - altQu };
  const meioDaPedreira = { gx: pedreira.gx + Math.floor(largQu / 2), gy: pedreira.gy };
  const tilesDaRuaLista = ruaComDesvio(pedreira.gx, escola.gx + largEs - 1, yRua);
  const tilesDaRua = tilesDaRuaLista.length;
  const arrastos = arrastosDaRua(tilesDaRuaLista);

  // O QUE A LINHA TEM DE DIZER, contado do dado: os tiles de rocha dentro do
  // alcance (Chebyshev a partir do footprint) e a soma deles. Nenhum numero
  // digitado — se a geografia ou o rendimento mudarem, o esperado muda junto.
  const alcance = producao.predios.quarry.colheita.alcance_tiles;
  const rendimento = recursos.tipos.rock.rendimentoPorTile;
  const rochaAoAlcance = mapa.recursos.rock.filter(([gx, gy]) => (
    gx >= pedreira.gx - alcance && gx <= pedreira.gx + largQu - 1 + alcance
    && gy >= pedreira.gy - alcance && gy <= pedreira.gy + altQu - 1 + alcance
  ));
  const TILES_ESPERADOS = rochaAoAlcance.length;
  const UNIDADES_ESPERADAS = TILES_ESPERADOS * rendimento;
  afirmar(
    TILES_ESPERADOS > 0,
    `a pedreira de (${pedreira.gx},${pedreira.gy}) nao tem rocha ao alcance: a linha que este `
      + 'roteiro mede sairia zerada pelo motivo errado (era o BUG-C)',
  );

  // ---- 1. o armazem NAO tem a linha ----------------------------------------
  // "Nao se aplica" nao e "zero": o armazem nao colhe tile nenhum, e escrever
  // "0 ao alcance" nele seria a tela acusando falta onde nao cabe colheita.
  await clicarNoTile(armazem.gx, armazem.gy);
  afirmar((await idAberto()) !== null, 'clicar no armazem deveria abrir o painel');
  afirmar(
    (await linhaDoAlcance()) === null,
    `o armazem nao colhe tile: nao pode ter linha de alcance, veio ${JSON.stringify(await linhaDoAlcance())}`,
  );
  await capturar('armazem-sem-linha');
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 2. a rua e a pedreira ------------------------------------------------
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
  const desenhada = await estado();
  afirmar(
    desenhada.estradasPlanejadasRenderizadas === tilesDaRua,
    `o arrasto deveria desenhar ${tilesDaRua} tiles, veio ${desenhada.estradasPlanejadasRenderizadas}`,
  );
  await erguerRua(ctx, { tiles: tilesDaRua });
  await page.keyboard.press('Escape');
  await esperarFrame();

  await centrarEm(pedreira.gx + largQu);
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
  // Obra nao colhe: quem lavra e o predio de pe. Mesma distincao do seletor.
  afirmar(
    (await linhaDoAlcance()) === null,
    `obra nao pode ter linha de alcance, veio ${JSON.stringify(await linhaDoAlcance())}`,
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 3. a pedreira fica pronta e a linha aparece --------------------------
  let ticks = 0;
  while (ticks < TETO_ATE_COMPLETAR && (await predioDoEstado(ID_PEDREIRA)).estado !== 'completo') {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
  }
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).estado === 'completo',
    `a pedreira deveria ficar pronta em ate ${TETO_ATE_COMPLETAR} ticks`,
  );
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  afirmar((await idAberto()) === ID_PEDREIRA, 'o painel deveria abrir na pedreira');
  const linha = await linhaDoAlcance();
  afirmar(linha !== null, 'a pedreira completa deveria ter a linha de alcance no painel');
  afirmar(
    linha.recurso === 'rock'
      && linha.tiles === TILES_ESPERADOS && linha.unidades === UNIDADES_ESPERADAS,
    `a linha deveria dizer ${TILES_ESPERADOS} tiles e ${UNIDADES_ESPERADAS} unidades `
      + `(contados do mapa e do rendimento do dado), veio ${JSON.stringify(linha)}`,
  );
  // O texto e o do TEMA, com os dois numeros dentro — e o que o jogador le.
  const molde = tema.plantaFantasma.alcance
    .replace('{recurso}', tema.plantaFantasma.recursos.rock)
    .replace('{n}', String(TILES_ESPERADOS))
    .replace('{u}', String(UNIDADES_ESPERADAS));
  afirmar(
    linha.texto === molde,
    `o texto deveria ser o molde do tema ("${molde}"), veio "${linha.texto}"`,
  );
  // E ela tem de estar VISIVEL, nao apenas presente no DOM: linha com area zero
  // e a mesma coisa que linha nenhuma para quem esta jogando.
  const rLinha = await retanguloDe(page, '#painel-predio [data-colheita]');
  const rPainel = await retanguloDe(page, '#painel-predio');
  afirmar(
    rLinha.width > 0 && rLinha.height > 0,
    `a linha deveria ter area na tela, veio ${JSON.stringify(rLinha)}`,
  );
  afirmar(
    rLinha.left >= rPainel.left && rLinha.right <= rPainel.right
      && rLinha.top >= rPainel.top && rLinha.bottom <= rPainel.bottom,
    `a linha deveria caber dentro do painel ${JSON.stringify(rPainel)}, veio ${JSON.stringify(rLinha)}`,
  );
  await capturar('pedreira-com-alcance');

  // ---- 4. o MESMO painel com o laco andando (CLAUDE.md §8) -----------------
  // `page.click()` aperta e solta no mesmo instante: com o painel se redesenhando
  // a cada tick, ele passaria mesmo se o clique nunca chegasse. O que prova e o
  // aperto de 150 ms com o jogo despausado.
  await page.keyboard.press('Escape');
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo 4 so vale com o laco ANDANDO');
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
  const andando = await linhaDoAlcance();
  afirmar(
    andando !== null && andando.recurso === 'rock' && andando.tiles === TILES_ESPERADOS,
    `com o laco andando a linha deveria continuar de pe com ${TILES_ESPERADOS} tiles, `
      + `veio ${JSON.stringify(andando)}`,
  );
  // Sem ocupante o veio nao baixa: a soma tem de ser a MESMA de antes. Se
  // baixasse aqui, seria a tela ou a sim colhendo sem quem colher.
  afirmar(
    andando.unidades === UNIDADES_ESPERADAS,
    `sem ocupante nada foi lavrado: a soma deveria continuar ${UNIDADES_ESPERADAS}, `
      + `veio ${andando.unidades}`,
  );
  await capturar('alcance-com-o-laco-andando');
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro deveria voltar a pausar no fim');
}

module.exports = { roteiro };
