'use strict';
// Roteiro da C-TELA-02 — o marcador de destino, pela tela:
//   1. H -> "Nova escaramuca"; caixa em volta dos 18 cabras;
//   2. DESPAUSADO (§8), botao direito 3 tiles acima da tropa: a marca aparece NO tile
//      clicado; captura; some sozinha depois de `segundosDoMarcador`;
//   3. botao direito longe (onde a cerca antiga recusava; C-COMBATE-02b a tirou): a marca
//      nasce no clique e a recusa nao chega — ela so some pelo tempo.
// O px sai do debug (`unidadesRenderizadas`, `marcadorDeDestino`), nunca de pixel da captura.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const TROPA = require('../../data/escaramuca.json').tropaDoJogador.quantidade; // dado do cenario (I-COMBATE-ESCARAMUCA-GANHAVEL: 18 -> 24)
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const LADO_DO_JOGADOR = 0;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  let s = await estado();
  const minha = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
  afirmar(minha.length === TROPA, `o jogador deveria nascer com ${TROPA} cabras, veio ${minha.length}`);
  afirmar(s.marcadorDeDestino === null, 'sem ordem, sem marca');

  async function centrarNoEixo(alvoEmTiles, eixo) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const vao = eixo === 'x' ? canvas.width : canvas.height;
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), [eixo, alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 300 : 80);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  const centrar = async (t) => {
    await centrarNoEixo(t.gx, 'x');
    await centrarNoEixo(t.gy, 'y');
  };
  const pontoDoTile = (gx, gy, camera) => ({
    x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
    y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
  });
  async function direito(p) {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(150);
    await page.mouse.up({ button: 'right' });
  }

  // 1. a caixa em volta dos 18
  const meio = {
    gx: Math.round(minha.reduce((n, u) => n + u.gx, 0) / minha.length),
    gy: Math.round(minha.reduce((n, u) => n + u.gy, 0) / minha.length),
  };
  await centrar(meio);
  s = await estado();
  const pontos = minha.map((u) => pontoDoTile(u.gx, u.gy, s.camera));
  await page.mouse.move(Math.min(...pontos.map((p) => p.x)) - TILE_PX / 2, Math.min(...pontos.map((p) => p.y)) - TILE_PX / 2);
  await page.mouse.down();
  await page.mouse.move(Math.max(...pontos.map((p) => p.x)) + TILE_PX / 2, Math.max(...pontos.map((p) => p.y)) + TILE_PX / 2, { steps: 8 });
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  afirmar(s.selecaoMilitar.length === TROPA, `a caixa deveria pegar os ${TROPA}, veio ${s.selecaoMilitar.length}`);

  // 2. dentro da cerca, DESPAUSADO: a marca no tile clicado
  const destino = { gx: meio.gx, gy: meio.gy - 3 };
  await page.keyboard.press('p');
  await direito(pontoDoTile(destino.gx, destino.gy, s.camera));
  await page.waitForTimeout(60);
  s = await estado();
  const marcaDentro = s.marcadorDeDestino;
  await capturar('marca-no-destino');
  await page.keyboard.press('p');
  afirmar(marcaDentro !== null && marcaDentro.gx === destino.gx && marcaDentro.gy === destino.gy,
    `a marca deveria estar em ${destino.gx},${destino.gy}, veio ${JSON.stringify(marcaDentro)}`);
  await page.waitForTimeout(tema.ordem.segundosDoMarcador * 1000 + 400);
  s = await estado();
  afirmar(s.marcadorDeDestino === null, `a marca deveria sumir sozinha, veio ${JSON.stringify(s.marcadorDeDestino)}`);
  const andando = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia' && u.fsm !== 'ocioso').length;
  afirmar(andando > 0, 'a tropa deveria ter recebido a ordem');

  // 3. longe: a marca nasce no clique, e nenhuma recusa a apaga no tick seguinte
  const LONGE_TILES = 16;
  const longe = { gx: meio.gx, gy: meio.gy + LONGE_TILES };
  await centrar(longe);
  s = await estado();
  await direito(pontoDoTile(longe.gx, longe.gy, s.camera));
  await page.waitForTimeout(60);
  s = await estado();
  const marcaLonge = s.marcadorDeDestino;
  afirmar(marcaLonge !== null && marcaLonge.gx === longe.gx && marcaLonge.gy === longe.gy, `a marca deveria nascer no clique, veio ${JSON.stringify(marcaLonge)}`);
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.waitForTimeout(60);
  s = await estado();
  afirmar(s.marcadorDeDestino !== null, 'sem recusa, a marca de longe deveria continuar no tick seguinte');
  console.log(`C-TELA-02: marca em ${JSON.stringify(marcaDentro)} (${andando} andando); longe ${JSON.stringify(marcaLonge)} aceita, a marca fica`);
}

module.exports = { roteiro };
