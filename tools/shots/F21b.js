'use strict';

// Roteiro da F21b — O VEIO NA SERRA, E A MINA QUE O ALCANCA DE FORA.
//
// O teste headless (`tests/F21b-mina-esgota.test.ts`) prova o ciclo: a mina tira
// do TILE, o veio baixa, zera, sai de `state.recursos` e o alerta avisa. O que
// so a tela prova e o que vem ANTES do primeiro balde:
//
//   1. o minerio esta DESENHADO no chao da serra. Ate a F21b o carvao, o ferro
//      e o ouro nasciam do nada dentro do predio, e nao havia o que olhar; agora
//      ha tres tipos novos na camada de marcadores, cada um com a sua cor de
//      tema, e `recursosVisiveis` diz que a camera esta em cima deles;
//   2. a previa da planta fantasma (F-TP) conta o veio ANTES do clique — com o
//      nome do sertao, nunca o id neutro. E o retorno que faz o jogador escolher
//      a encosta em vez de plantar a mina em qualquer lugar;
//   3. sobre o veio a planta RECUSA. A mina nunca fica em cima do minerio: a
//      montanha e intransponivel e `canPlace` para em `terreno` antes de olhar
//      recurso (decisao do operador, 2026-09-25) — e por isso a mina colhe so o
//      que alcanca EM VOLTA.
//
// Nenhuma coordenada digitada: o veio sai de `data/maps/sertao-128.json`, o
// mesmo arquivo que a sim le; o ponto da mina sai da leitura, em dado, das
// recusas de `sim/placement.ts` e do alcance de `sim/aproximacao.ts`; a arvore
// de desbloqueio sai de `desbloqueadoPor` em `data/buildings.json`. Trocar a
// semente do gerador move os alvos, nao quebra o roteiro.
//
// CLAUDE.md §8: este roteiro pega a ferramenta em `#menu-build`, entao esse
// gesto acontece DESPAUSADO, com `mouse.down` / `waitForTimeout(150)` /
// `mouse.up` — nunca `page.click()`, que aperta e solta no mesmo instante.

const { retanguloDoCanvas, pontoDoTileNaTela, pontoParaApertar } = require('./_canvas');
const { caixaLivre } = require('./_recursos');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');
const mapa = require('../../data/maps/sertao-128.json');
const { predios } = require('../../data/buildings.json');
const producao = require('../../data/production.json');
const recursos = require('../../data/resources.json');
const economia = require('../../data/economy.json');

const TILE_PX = terreno.tile_px;

/** O oficio que a F21b poe no veio. Os predios da mina sao os do mineiro, e sao
 *  eles que `data/buildings.json` declara — a lista nao esta digitada aqui, e
 *  uma quarta mina entraria sozinha. */
const OFICIO_DA_MINA = 'miner';

/** Teto de ESPERA, nao afirmacao de desempenho (CLAUDE.md §8): existe para o
 *  roteiro falhar dizendo o tick em que travou, em vez de pendurar. */
const TETO_ATE_COMPLETAR = 900;
const PASSO_DE_AVANCO = 10;

// ---- o chao, lido do mesmo mapa que a sim le ------------------------------
const INTRANSPONIVEL = new Set(terreno.intransponivel);
const terrenoDe = (gx, gy) => mapa.legenda[mapa.linhas[gy][gx]];
const dentroDoMapa = (gx, gy) => gx >= 0 && gy >= 0 && gx < mapa.largura && gy < mapa.altura;
const pisavel = (gx, gy) => dentroDoMapa(gx, gy) && !INTRANSPONIVEL.has(terrenoDe(gx, gy));

const defDe = (id) => {
  const def = predios.find((p) => p.id === id);
  if (!def) throw new Error(`F21b: '${id}' nao esta em buildings.json`);
  return def;
};
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Os tiles que os predios da abertura ja ocupam. */
const OCUPADO = new Set(economia.estadoInicial.predios.flatMap((p) => {
  const [larg, alt] = defDe(p.id).tamanho;
  const celulas = [];
  for (let gy = p.gy; gy < p.gy + alt; gy += 1) {
    for (let gx = p.gx; gx < p.gx + larg; gx += 1) celulas.push(`${gx},${gy}`);
  }
  return celulas;
}));
const ocupado = (gx, gy) => OCUPADO.has(`${gx},${gy}`);
const livreParaObra = (gx, gy) => pisavel(gx, gy) && !ocupado(gx, gy) && caixaLivre(gx, gy, 1, 1);

/**
 * Este retangulo aceita uma planta, e a porta dele tem saida?
 * E a leitura, em dado, das mesmas recusas de `sim/placement.ts`: fora-do-mapa,
 * terreno, recurso, sobreposicao e porta-sem-saida. Nenhuma estrada existe
 * quando isto roda, entao o motivo `estrada` nao entra.
 */
function podeErguer(gx0, gy0, largura, altura) {
  for (let gy = gy0; gy < gy0 + altura; gy += 1) {
    for (let gx = gx0; gx < gx0 + largura; gx += 1) {
      if (!dentroDoMapa(gx, gy) || !livreParaObra(gx, gy)) return false;
    }
  }
  for (let gx = gx0; gx < gx0 + largura; gx += 1) {
    if (!pisavel(gx, gy0 + altura) || ocupado(gx, gy0 + altura)) return false;
  }
  return true;
}

/**
 * Alguem CHEGA neste tile para colher? E a leitura, em dado, de
 * `sim/aproximacao.ts`: o tile do veio nunca se pisa (montanha), entao o que
 * conta e ter pelo menos um dos 8 vizinhos pisavel e livre de predio. Veio no
 * meio da serra existe no mapa e nao rende nada — e a diferenca entre "ha
 * minerio" e "ha minerio que da trabalho".
 */
function alcancavelParaColheita(gx, gy) {
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      if (dx === 0 && dy === 0) continue;
      if (pisavel(gx + dx, gy + dy) && !ocupado(gx + dx, gy + dy)) return true;
    }
  }
  return false;
}

const cheb = (a, b) => Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

/** As minas: os predios do mineiro que colhem do mapa. */
function minas() {
  const lista = predios
    .filter((p) => p.trabalhador === OFICIO_DA_MINA && producao.predios[p.id]
      && producao.predios[p.id].colheita)
    .map((p) => ({
      id: p.id,
      largura: p.tamanho[0],
      altura: p.tamanho[1],
      colheita: producao.predios[p.id].colheita,
    }));
  if (lista.length === 0) throw new Error('F21b: nenhum predio do mineiro colhe do mapa');
  return lista;
}

/**
 * Onde o jogador plantaria esta mina: o ponto legal que alcanca MAIS tiles de
 * veio aproveitaveis. Empate pelo mais perto da vila (a captura tem de caber
 * numa viagem de camera) e depois por gx/gy, para a escolha nao depender da
 * ordem de varredura.
 */
function pontoDaMina(mina, vila) {
  const { recurso, alcance_tiles: alcance } = mina.colheita;
  const veio = (mapa.recursos[recurso] ?? []).map(([gx, gy]) => ({ gx, gy }));
  let melhor = null;
  for (const t of veio) {
    for (let gy = t.gy - alcance - mina.altura; gy <= t.gy + alcance; gy += 1) {
      for (let gx = t.gx - alcance - mina.largura; gx <= t.gx + alcance; gx += 1) {
        if (!podeErguer(gx, gy, mina.largura, mina.altura)) continue;
        const aoAlcance = veio.filter((v) => (
          v.gx >= gx - alcance && v.gx <= gx + mina.largura - 1 + alcance
          && v.gy >= gy - alcance && v.gy <= gy + mina.altura - 1 + alcance
          && alcancavelParaColheita(v.gx, v.gy)
        ));
        if (aoAlcance.length === 0) continue;
        const cand = { gx, gy, tiles: aoAlcance.length, daVila: cheb({ gx, gy }, vila) };
        const melhorQue = melhor === null
          || cand.tiles > melhor.tiles
          || (cand.tiles === melhor.tiles && cand.daVila < melhor.daVila)
          || (cand.tiles === melhor.tiles && cand.daVila === melhor.daVila
            && (cand.gx < melhor.gx || (cand.gx === melhor.gx && cand.gy < melhor.gy)));
        if (melhorQue) melhor = cand;
      }
    }
  }
  return melhor === null ? null : { ...melhor, veio };
}

/** A cadeia de desbloqueio que falta erguer ate `id`, da raiz para a folha.
 *  Sai de `desbloqueadoPor`; para no que ja esta de pe na abertura. */
function cadeiaDeDesbloqueio(id) {
  const jaDePe = new Set(economia.estadoInicial.predios.map((p) => p.id));
  const fila = [];
  let atual = defDe(id).desbloqueadoPor;
  while (typeof atual === 'string' && !jaDePe.has(atual)) {
    if (fila.includes(atual)) throw new Error(`F21b: ciclo em desbloqueadoPor de '${id}'`);
    fila.unshift(atual);
    atual = defDe(atual).desbloqueadoPor;
  }
  return fila;
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const meio = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };

  // ---- geometria, tirada dos JSON -----------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs] = defDe('schoolhouse').tamanho;
  const yRua = armazem.gy + altAr;
  const vila = { gx: armazem.gx + 1, gy: armazem.gy + 1 };

  // A mina que este roteiro mostra: a que tem ponto legal mais PERTO da vila,
  // para a viagem de camera ser uma so.
  const TODAS = minas().map((m) => ({ ...m, ponto: pontoDaMina(m, vila) }));
  for (const m of TODAS) {
    afirmar(
      (mapa.recursos[m.colheita.recurso] ?? []).length > 0,
      `o mapa precisa semear '${m.colheita.recurso}' para a F21b existir`,
    );
    afirmar(
      m.ponto !== null,
      `'${m.id}' nao tem um so ponto legal que alcance veio aproveitavel; a mina nasceria `
        + 'parada e este roteiro nao teria o que mostrar',
    );
  }
  const MINA = [...TODAS].sort((a, b) => (a.ponto.daVila - b.ponto.daVila))[0];
  const RECURSO = MINA.colheita.recurso;
  const RENDIMENTO = recursos.tipos[RECURSO].rendimentoPorTile;
  const PONTO = { gx: MINA.ponto.gx, gy: MINA.ponto.gy };
  const TILES_ESPERADOS = MINA.ponto.tiles;
  const NOME_NO_SERTAO = tema.plantaFantasma.recursos[RECURSO];
  afirmar(
    typeof NOME_NO_SERTAO === 'string' && NOME_NO_SERTAO.length > 0,
    `o tema precisa nomear '${RECURSO}'; sem isso a previa fala por id neutro`,
  );

  // O tile de veio mais perto do ponto da mina: e nele que a planta vai recusar.
  const VEIO = [...MINA.ponto.veio]
    .filter((v) => alcancavelParaColheita(v.gx, v.gy))
    .sort((a, b) => (cheb(a, PONTO) - cheb(b, PONTO)) || (a.gx - b.gx) || (a.gy - b.gy))[0];
  afirmar(
    !pisavel(VEIO.gx, VEIO.gy),
    `o veio deveria estar em terreno que nao se pisa, veio '${terrenoDe(VEIO.gx, VEIO.gy)}' em `
      + `(${VEIO.gx},${VEIO.gy}) — sem isso a recusa do passo 6 provaria outra coisa`,
  );

  // A cadeia que falta erguer para a mina aparecer no menu, e onde por cada uma:
  // a leste da escola, na linha de porta da vila, como no roteiro da F-T4a.
  const CADEIA = cadeiaDeDesbloqueio(MINA.id);
  afirmar(CADEIA.length > 0, `'${MINA.id}' ja nasceria liberado; a arvore de desbloqueio sumiu`);
  let proximoX = escola.gx + largEs + 1;
  const OBRAS = CADEIA.map((id) => {
    const [larg, alt] = defDe(id).tamanho;
    let gx = proximoX;
    while (gx < mapa.largura - larg && !podeErguer(gx, yRua - alt, larg, alt)) gx += 1;
    proximoX = gx + larg + 1;
    return { id, gx, gy: yRua - alt };
  });

  // ---- helpers de tela -----------------------------------------------------
  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    const p = pontoDoTileNaTela(canvas, { gx, gy }, camera, TILE_PX);
    afirmar(
      p.x > canvas.left && p.x < canvas.right && p.y > canvas.top && p.y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${p.x},${p.y})`,
    );
    return p;
  }

  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  /** Anda a camera com as setas ate a coluna (ou a linha) cair no meio do
   *  quadro. Molde do F-T3/F-T4a; so vale em zoom 1. */
  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = Math.max(0, alvoEmTiles * TILE_PX - vao / 2);
    const teclas = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 30; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      const tecla = delta > 0 ? teclas[0] : teclas[1];
      await page.keyboard.down(tecla);
      await page.waitForTimeout(120);
      await page.keyboard.up(tecla);
      await esperarFrame();
    }
  }

  /** Leva a camera ate por `alvo` no meio do quadro, em etapas (a serra fica a
   *  meio mapa da vila). Botao do MEIO: o esquerdo e arrasto de estrada. Molde
   *  do F-TP; so vale em zoom 1. */
  async function irPara(alvo) {
    let s = await estado();
    const destino = {
      x: alvo.gx * TILE_PX + TILE_PX / 2 - canvas.width / 2,
      y: alvo.gy * TILE_PX + TILE_PX / 2 - canvas.height / 2,
    };
    const margem = 40;
    for (let tentativa = 0; tentativa < 40; tentativa += 1) {
      const faltaX = destino.x - s.camera.scrollX;
      const faltaY = destino.y - s.camera.scrollY;
      if (Math.abs(faltaX) < 1 && Math.abs(faltaY) < 1) break;
      const passoX = Math.max(Math.min(faltaX, canvas.width / 2 - margem), -(canvas.width / 2 - margem));
      const passoY = Math.max(Math.min(faltaY, canvas.height / 2 - margem), -(canvas.height / 2 - margem));
      await page.mouse.move(meio.x, meio.y);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(meio.x - passoX, meio.y - passoY, { steps: 10 });
      await page.mouse.up({ button: 'middle' });
      await esperarFrame();
      s = await estado();
    }
    return s;
  }

  /** A cena so reamostra `plantaFantasma` no pointermove. Dois moves porque o
   *  Phaser ignora move para o mesmo pixel. */
  const reamostrar = async (ponto) => {
    await page.mouse.move(ponto.x + 3, ponto.y + 3);
    await page.mouse.move(ponto.x, ponto.y);
    await esperarFrame();
    return estado();
  };

  /** O gesto do jogador num botao do menu: aperta, o laco redesenha por baixo
   *  do dedo, solta. E a §8 escrita em codigo. */
  async function apertarESoltar(seletor) {
    // a grade rola: a mina fica longe do topo. UI-barra-a: e reprova se coberto.
    const ponto = await pontoParaApertar(page, seletor);
    await page.mouse.move(ponto.x, ponto.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await esperarFrame();
  }

  const predioDoEstado = async (id) => (await estado()).prediosDoEstado[id] ?? null;

  /** O botao do tipo esta LIBERADO no menu? Nao e "existe o botao": desde a F12
   *  o item bloqueado continua na lista, com `aria-disabled`. */
  async function liberadoNoMenu(tipo) {
    const botao = await page.$(`[data-predio="${tipo}"]`);
    afirmar(botao !== null, `o menu deveria listar '${tipo}', bloqueado ou nao`);
    return (await botao.getAttribute('aria-disabled')) === 'false';
  }

  /** Avanca em blocos ate a condicao valer, com o jogo pausado. Reprova com o
   *  tick quando o teto estoura — que e o que distingue lentidao de travamento. */
  async function esperarAte(condicao, teto, oQue, bloco = PASSO_DE_AVANCO) {
    let gastos = 0;
    while (gastos < teto) {
      if (await condicao()) return gastos;
      await avancar(bloco);
      gastos += bloco;
      await esperarFrame();
    }
    afirmar(await condicao(), `${oQue}: nao aconteceu em ${teto} ticks (tick ${(await estado()).tick})`);
    return gastos;
  }

  /** Ergue uma planta ja desbloqueada e espera a obra fechar. Devolve o id dela. */
  async function erguerPredio(tipo, gx, gy) {
    await centrarNoEixo(gx + 1, 'x');
    afirmar(await liberadoNoMenu(tipo), `o menu deveria oferecer '${tipo}' neste ponto da arvore`);
    await page.click(`[data-predio="${tipo}"]`);
    await esperarFrame();
    await clicarNoTile(gx, gy);
    await avancar(1);
    await esperarFrame();
    await page.keyboard.press('Escape'); // larga a planta fantasma
    await esperarFrame();
    const achado = Object.entries((await estado()).prediosDoEstado)
      .find(([, p]) => p.tipo === tipo && p.gx === gx && p.gy === gy);
    afirmar(achado !== undefined, `a obra de '${tipo}' deveria existir em (${gx},${gy}) depois do clique`);
    return esperarAte(
      async () => (await predioDoEstado(achado[0]))?.estado === 'completo',
      TETO_ATE_COMPLETAR,
      `a obra de '${tipo}' ficar pronta`,
    );
  }

  // ---- 1. a abertura: sem ferramenta, e sem mina no menu -------------------
  let s = await estado();
  afirmar(s.pausado === true, 'o roteiro comeca pausado (?pausado), como todo shot');
  afirmar(s.plantaFantasma === null, `sem ferramenta nao ha planta, veio ${JSON.stringify(s.plantaFantasma)}`);
  for (const m of TODAS) {
    afirmar(
      !(await liberadoNoMenu(m.id)),
      `na abertura '${m.id}' NAO pode estar liberada: ela vem depois de ${JSON.stringify(CADEIA)}`,
    );
  }

  // ---- 2. a arvore, erguida ate a mina aparecer ----------------------------
  for (const obra of OBRAS) {
    await erguerPredio(obra.id, obra.gx, obra.gy);
  }
  afirmar(
    await liberadoNoMenu(MINA.id),
    `com ${JSON.stringify(CADEIA)} de pe, '${MINA.id}' deveria ficar liberada no menu`,
  );

  // ---- 3. a serra, com o veio DESENHADO no chao ----------------------------
  await irPara(PONTO);
  s = await estado();
  const visiveis = s.recursosVisiveis ?? {};
  afirmar(
    (visiveis[RECURSO] ?? 0) > 0,
    `com a camera na encosta a camada deveria desenhar '${RECURSO}', veio ${JSON.stringify(visiveis)}`,
  );
  await capturar('o-veio-na-serra');

  // ---- 4. DESPAUSADO (§8): a ferramenta se pega com o laco vivo ------------
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo da ferramenta so vale com o laco ANDANDO');
  await apertarESoltar(`[data-predio="${MINA.id}"]`);
  s = await estado();
  afirmar(
    s.ferramentaAtiva === MINA.id,
    `a ferramenta deveria ficar com '${MINA.id}' depois do aperta-e-solta, veio `
      + `${JSON.stringify(s.ferramentaAtiva)}`,
  );
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'depois do gesto o roteiro volta a pausar');

  // ---- 5. a previa conta o veio, antes do clique ---------------------------
  // Afasta a camera: com alcance 6 a moldura mede mais de 13 tiles de lado e o
  // contorno dela ficaria fora do quadro em zoom 1. `pontoDoTileNaTela` converte
  // com zoom, entao daqui em diante a conta continua exata.
  await page.mouse.move(meio.x, meio.y);
  await page.mouse.wheel(0, 120);
  await esperarFrame();
  await page.mouse.wheel(0, 120);
  await esperarFrame();
  s = await estado();
  afirmar(s.camera.zoom < 1, `a camera deveria ter afastado, veio zoom ${s.camera.zoom}`);

  s = await reamostrar(pontoDoTileNaTela(canvas, PONTO, s.camera, TILE_PX));
  afirmar(
    s.tileSobMouse !== null && s.tileSobMouse.gx === PONTO.gx && s.tileSobMouse.gy === PONTO.gy,
    `o ponteiro deveria estar em ${JSON.stringify(PONTO)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  afirmar(
    s.plantaFantasma !== null && s.plantaFantasma.alcance !== null,
    `a fantasma da mina na encosta deveria trazer alcance, veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  const previa = s.plantaFantasma.alcance;
  afirmar(
    previa.recurso === RECURSO,
    `o recurso da previa deveria ser '${RECURSO}', veio ${JSON.stringify(previa.recurso)}`,
  );
  afirmar(
    previa.tiles === TILES_ESPERADOS,
    `a previa deveria contar os ${TILES_ESPERADOS} tiles de veio que o dado poe ao alcance de `
      + `${JSON.stringify(PONTO)}, veio ${JSON.stringify(previa)}`,
  );
  afirmar(
    previa.unidades === previa.tiles * RENDIMENTO,
    `${previa.tiles} tiles x ${RENDIMENTO} por tile deveria dar ${previa.tiles * RENDIMENTO}, `
      + `veio ${previa.unidades}`,
  );
  afirmar(
    previa.rotulo.includes(NOME_NO_SERTAO) && previa.rotulo.includes(String(previa.tiles))
      && !previa.rotulo.includes(RECURSO),
    `o rotulo deveria trazer a contagem e o nome do TEMA ('${NOME_NO_SERTAO}'), nunca o id `
      + `neutro, veio ${JSON.stringify(previa.rotulo)}`,
  );
  afirmar(
    s.plantaFantasma.valida === true,
    `na encosta o clique nao pode ser recusado, veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  await capturar('a-previa-conta-o-veio');

  // ---- 6. sobre o veio, a recusa ------------------------------------------
  // O nucleo da F21b na tela: a mina nunca fica EM CIMA do minerio. O tile do
  // veio e montanha, e `canPlace` para em `terreno` antes de olhar recurso — e
  // por isso que a mina colhe o que alcanca em volta.
  s = await reamostrar(pontoDoTileNaTela(canvas, VEIO, s.camera, TILE_PX));
  afirmar(
    s.tileSobMouse !== null && s.tileSobMouse.gx === VEIO.gx && s.tileSobMouse.gy === VEIO.gy,
    `o ponteiro deveria estar no veio ${JSON.stringify(VEIO)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  afirmar(
    s.plantaFantasma !== null && s.plantaFantasma.valida === false,
    `sobre o veio, em '${terrenoDe(VEIO.gx, VEIO.gy)}', a planta deveria RECUSAR, veio `
      + `${JSON.stringify(s.plantaFantasma)}`,
  );
  afirmar(
    s.plantaFantasma.motivo === 'terreno',
    'a recusa sobre o veio e do TERRENO (montanha intransponivel), nao do recurso, veio '
      + `${JSON.stringify(s.plantaFantasma.motivo)}`,
  );
  await capturar('sobre-o-veio-a-planta-recusa');

  // ---- 7. termina pausado, como comecou ------------------------------------
  await page.keyboard.press('Escape');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado === true, 'o roteiro termina pausado, como comecou');
  afirmar(s.plantaFantasma === null, `Esc deveria largar a planta, veio ${JSON.stringify(s.plantaFantasma)}`);
}

module.exports = { roteiro };
