'use strict';

// Roteiro da F-VIVO-b — O TRABALHO.
//
// Afirma o que a cena publicou (`window.__cangaco.quadrosDeTrabalho`), nunca pixel
// (§8). Qual quadro sai de qual progresso e `render/trabalho.ts`, testado em Node
// (tests/F-VIVO-b-trabalho.test.ts); aqui se prova que a cena chama a funcao com o
// relogio CORRENDO, pelo caminho do jogador:
//  1. a pedreira ocupada anima: 3 s despausado, amostra a cada 250 ms, >= 2 quadros;
//  2. a mesma pedreira pausada pelo painel (`data-pausar`) nao anima: 3 s
//     despausado, nenhum quadro publicado;
// e que predio sem receita (armazem, escola) nao publica quadro nunca.
//
// A pedreira e o caso 2: o relogio do ciclo anda com o cabra NO LAJEDO (`colhendo`).
// Por isso a espera antes da janela e por CONDICAO — ja ha quadro e sobra ciclo para
// os 3 s —, nunca por numero chutado.
//
// O clique no painel (treino e pausa) e despausado e segurando 150 ms (§8).

const { retanguloDoCanvas, arrastarDentroDoCanvas, pontoParaApertar } = require('./_canvas');
const { arrastosDaRua } = require('./_recursos');
const { erguerRua } = require('./_estradas');
const { pedreiraNoLajedo } = require('./_pedreira');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

const TETO_ATE_OCUPAR = 900;
const TETO_ATE_QUADRO = 1500;
const PASSO_DE_AVANCO = 50;
const PASSO_FINO = 2;
const JANELA_MS = 3000;
const AMOSTRA_MS = 250;

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

  async function andarAte(condicao, teto, passo, oQue) {
    let s = await estado();
    let gastos = 0;
    while (!condicao(s) && gastos < teto) {
      await avancar(passo);
      gastos += passo;
      await esperarFrame();
      s = await estado();
    }
    afirmar(condicao(s), `${oQue}: nao aconteceu em ${teto} ticks (tick ${s.tick})`);
    return s;
  }

  /** Aperta um botao do painel com o relogio correndo, segurando 150 ms (§8). */
  async function apertarDespausado(seletor) {
    // UI-barra-a: o engajar rola no corpo da barra; o aperto cru nao rola sozinho.
    const alvo = await pontoParaApertar(page, seletor);
    await page.keyboard.press('p');
    afirmar(!(await estado()).pausado, `o clique em ${seletor} precisa do relogio correndo`);
    await page.mouse.move(alvo.x, alvo.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await esperarFrame();
    await page.keyboard.press('p');
    await esperarFrame();
    afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
  }

  /** `JANELA_MS` despausado, amostrando o quadro publicado do predio `id`. */
  async function janelaDespausada(id) {
    const amostras = [];
    await page.keyboard.press('p');
    afirmar(!(await estado()).pausado, 'a janela precisa do relogio correndo');
    for (let t = 0; t < JANELA_MS; t += AMOSTRA_MS) {
      await page.waitForTimeout(AMOSTRA_MS);
      const s = await estado();
      const q = s.quadrosDeTrabalho[id];
      amostras.push({ tick: s.tick, quadro: q === undefined ? null : `${q.laco}_${q.n}`, sprite: q?.sprite ?? null });
    }
    await page.keyboard.press('p');
    await esperarFrame();
    afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
    afirmar(
      amostras[amostras.length - 1].tick > amostras[0].tick,
      `o relogio deveria ter andado na janela, veio ${JSON.stringify(amostras)}`,
    );
    return amostras;
  }

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu] = defDe('quarry').tamanho;
  const { pedreira, tilesDaRua } = pedreiraNoLajedo({
    armazem, escola, tamanhoDe: (id) => defDe(id).tamanho, afirmar,
  });
  const civil = defDe('quarry').trabalhador;
  afirmar(typeof civil === 'string', 'a pedreira precisa declarar `trabalhador` no dado');

  const inicio = await estado();
  afirmar(
    inicio.quadrosDeTrabalho !== undefined && Object.keys(inicio.quadrosDeTrabalho).length === 0,
    `no tick 0 nenhum predio trabalha: nenhum quadro, veio ${JSON.stringify(inicio.quadrosDeTrabalho)}`,
  );

  // ---- 1. a rua, a pedreira, o treino ----------------------------------------
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

  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  await centrarEm(meioDaEscola.gx);
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  await apertarDespausado(`#painel-predio [data-treinar="${civil}"]`);
  afirmar(
    (await page.$$('#painel-predio [data-slot][data-unidade]')).length > 0,
    'o pedido de treino deveria ter entrado na fila da escola',
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 2. a pedreira ocupada anima com o relogio correndo --------------------
  await andarAte(
    (s) => s.prediosDoEstado[ID_PEDREIRA]?.ocupante != null,
    TETO_ATE_OCUPAR, PASSO_DE_AVANCO, 'pedreira ocupada',
  );
  await centrarEm(Math.floor((pedreira.gx + armazem.gx + largAr) / 2));
  // ha quadro, no comeco do ciclo: o terco `inicio` (55 ticks) cobre os 3 s
  const comQuadro = await andarAte(
    (s) => {
      const q = s.quadrosDeTrabalho[ID_PEDREIRA];
      return q !== undefined && q.laco === 'inicio' && q.n <= 3;
    },
    TETO_ATE_QUADRO, PASSO_FINO, 'quadro de trabalho na pedreira ocupada',
  );
  // G-ARTE-TRABALHO-DENTRO-DO-PREDIO (2026-10-04): a pedreira ganhou os quadros de trabalho no
  // manifesto, e o quadro sai com a textura; antes era o placeholder
  const temArte = Object.keys(require('../../assets/manifest.json').assets
    .find((a) => a.tipo === 'trabalho' && a.id === 'quarry')?.estados ?? {}).length > 0;
  afirmar(
    comQuadro.quadrosDeTrabalho[ID_PEDREIRA].sprite === temArte,
    `o quadro deveria ser ${temArte ? 'a textura do manifesto' : 'placeholder'}, veio sprite=${comQuadro.quadrosDeTrabalho[ID_PEDREIRA].sprite}`,
  );
  const animando = await janelaDespausada(ID_PEDREIRA);
  const distintos = new Set(animando.map((a) => a.quadro).filter((q) => q !== null));
  afirmar(
    distintos.size >= 2,
    `a pedreira ocupada deveria ter avancado o quadro em ${JANELA_MS} ms despausado, veio ${JSON.stringify(animando)}`,
  );
  const semReceita = [idDe(inicio, 'storehouse'), idDe(inicio, 'schoolhouse')];
  for (const id of semReceita) {
    afirmar((await estado()).quadrosDeTrabalho[id] === undefined, `'${id}' nao tem receita: nao deveria publicar quadro`);
  }
  await capturar('animando');

  // ---- 3. pausada pelo painel, a mesma pedreira nao anima --------------------
  await clicarNoTile(pedreira.gx, pedreira.gy);
  afirmar(
    (await page.getAttribute('#painel-predio [data-pausar]', 'data-pausar')) === 'true',
    'com a pedreira rodando o botao deveria mandar pausado=true',
  );
  await apertarDespausado('#painel-predio [data-pausar]');
  afirmar((await estado()).prediosDoEstado[ID_PEDREIRA].pausado === true, 'o clique deveria ter parado a pedreira NO ESTADO');
  const parada = await janelaDespausada(ID_PEDREIRA);
  afirmar(
    parada.every((a) => a.quadro === null),
    `a pedreira pausada nao deveria publicar quadro em ${JANELA_MS} ms despausado, veio ${JSON.stringify(parada)}`,
  );
  await page.keyboard.press('Escape');
  await esperarFrame();
  await capturar('pausada');
}

function idDe(s, tipo) {
  return Object.entries(s.prediosDoEstado).find(([, p]) => p.tipo === tipo)?.[0];
}

module.exports = { roteiro };
