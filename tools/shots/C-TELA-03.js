'use strict';
// Roteiro da C-TELA-03 — pegar a tropa inteira pela caixa e mover os 18.
//   1. H -> "Nova escaramuca"; camera na tropa;
//   2. caixas do jeito que a mao faz, todas DESPAUSADAS e com o botao seguro (§8):
//      a) comecando EM CIMA de um cabra (o canto superior esquerdo da tropa);
//      b) de baixo-direita para cima-esquerda;
//      c) com a camera afastada (roda do mouse), que muda px de tela contra px de mundo;
//   3. botao direito dentro da cerca da paz: os 18 recebem a ordem (marcham, ou ja estao na
//      vaga da formacao, C-COMBATE-01a), e param em 18 tiles distintos; quem marchou saiu
//      do tile em que nasceu.
// O px sai do debug (`unidadesRenderizadas`, `camera`), nunca de pixel da captura.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const TROPA = require('../../data/escaramuca.json').tropaDoJogador.quantidade; // dado do cenario (I-COMBATE-ESCARAMUCA-GANHAVEL: 18 -> 24)

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
  const cabras = (st) => st.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
  const minha = cabras(s);
  afirmar(minha.length === TROPA, `o jogador deveria nascer com ${TROPA} cabras, veio ${minha.length}`);

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
  const meio = {
    gx: Math.round(minha.reduce((n, u) => n + u.gx, 0) / minha.length),
    gy: Math.round(minha.reduce((n, u) => n + u.gy, 0) / minha.length),
  };
  await centrarNoEixo(meio.gx, 'x');
  await centrarNoEixo(meio.gy, 'y');

  // px de PAGINA de um ponto de MUNDO, em qualquer zoom (a camera do Phaser amplia a partir
  // do centro do canvas: tela = (mundo - scroll - meio) * zoom + meio)
  const naPagina = (x, y, cam) => ({
    x: canvas.left + (x - cam.scrollX - canvas.width / 2) * cam.zoom + canvas.width / 2,
    y: canvas.top + (y - cam.scrollY - canvas.height / 2) * cam.zoom + canvas.height / 2,
  });
  const centro = (u) => ({ x: (u.gx + 0.5) * TILE_PX, y: (u.gy + 0.5) * TILE_PX });
  async function arrastar(de, ate) {
    await page.mouse.move(de.x, de.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.move(ate.x, ate.y, { steps: 12 });
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
  async function limpar() {
    await page.keyboard.press('Escape');
    await esperarFrame();
  }
  const cantos = (st) => {
    const c = cabras(st).map(centro);
    return {
      x0: Math.min(...c.map((p) => p.x)), y0: Math.min(...c.map((p) => p.y)),
      x1: Math.max(...c.map((p) => p.x)), y1: Math.max(...c.map((p) => p.y)),
    };
  };

  const resultado = {};
  await page.keyboard.press('p'); // despausado: o laco redesenha entre o down e o up (§8)

  // a) comecando em cima do cabra do canto
  s = await estado();
  let k = cantos(s);
  await arrastar(naPagina(k.x0, k.y0, s.camera), naPagina(k.x1 + TILE_PX / 2, k.y1 + TILE_PX / 2, s.camera));
  s = await estado();
  resultado.emCimaDoCabra = s.selecaoMilitar.length;
  await capturar('caixa-em-cima-do-cabra');
  await limpar();

  // b) de baixo-direita para cima-esquerda
  s = await estado();
  k = cantos(s);
  await arrastar(naPagina(k.x1 + TILE_PX, k.y1 + TILE_PX, s.camera), naPagina(k.x0 - TILE_PX, k.y0 - TILE_PX, s.camera));
  s = await estado();
  resultado.aoContrario = s.selecaoMilitar.length;
  await limpar();

  // c) camera afastada
  const zoomAntes = s.camera.zoom;
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  await page.mouse.wheel(0, 200);
  await esperarFrame();
  s = await estado();
  resultado.zoom = s.camera.zoom;
  k = cantos(s);
  await arrastar(naPagina(k.x0 - TILE_PX, k.y0 - TILE_PX, s.camera), naPagina(k.x1 + TILE_PX, k.y1 + TILE_PX, s.camera));
  s = await estado();
  resultado.afastado = s.selecaoMilitar.length;

  // 3. a ordem leva os 18
  const nasceram = new Map(cabras(s).map((u) => [u.id, `${u.gx},${u.gy}`]));
  const destino = { x: (meio.gx + 0.5) * TILE_PX, y: (meio.gy - 4 + 0.5) * TILE_PX };
  const pd = naPagina(destino.x, destino.y, s.camera);
  await page.mouse.move(pd.x, pd.y);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(150);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(400);
  s = await estado();
  // C-COMBATE-01a (formação): a ordem poe os 18 em fileiras de ceil(sqrt(18)) = 5, de frente
  // para onde o lider anda, com a primeira no destino. Quem ja esta em cima da propria vaga fica
  // (ocioso, no tile em que nasceu); todo o resto marcha.
  const noLugar = (u) => u.fsm === 'ocioso' && nasceram.get(u.id) === `${u.gx},${u.gy}`;
  resultado.marchando = cabras(s).filter((u) => u.fsm === 'marchando').length;
  resultado.jaNaVaga = cabras(s).filter(noLugar).length;
  for (let i = 0; i < 40 && cabras(s).some((u) => u.fsm !== 'ocioso'); i += 1) {
    await page.waitForTimeout(250);
    s = await estado();
  }
  resultado.sairamDoLugar = cabras(s).filter((u) => nasceram.get(u.id) !== `${u.gx},${u.gy}`).length;
  // o desenho da formacao (direcao, colunas) e da sim e tem teste la
  // (tests/C-COMBATE-01a-formacao.test.ts); aqui, que os 18 param, cada um no seu tile
  resultado.pararam = cabras(s).filter((u) => u.fsm === 'ocioso').length;
  resultado.tilesDistintos = new Set(cabras(s).map((u) => `${u.gx},${u.gy}`)).size;
  await capturar('os-18-andaram');
  await page.keyboard.press('p');

  console.log(`C-TELA-03: ${JSON.stringify({ zoomAntes, ...resultado })}`);
  afirmar(resultado.emCimaDoCabra === TROPA, `caixa comecando em cima do cabra deveria pegar ${TROPA}, pegou ${resultado.emCimaDoCabra}`);
  afirmar(resultado.aoContrario === TROPA, `caixa ao contrario deveria pegar ${TROPA}, pegou ${resultado.aoContrario}`);
  afirmar(resultado.zoom !== zoomAntes, `a roda deveria ter mudado o zoom (${zoomAntes})`);
  afirmar(resultado.afastado === TROPA, `caixa com a camera afastada deveria pegar ${TROPA}, pegou ${resultado.afastado}`);
  afirmar(resultado.marchando + resultado.jaNaVaga === TROPA,
    `os ${TROPA} deveriam receber a ordem (marchando ou ja na vaga), vieram ${resultado.marchando} + ${resultado.jaNaVaga}`);
  afirmar(resultado.marchando > 0 && resultado.sairamDoLugar === resultado.marchando,
    `quem marchou deveria sair do lugar: marcharam ${resultado.marchando}, sairam ${resultado.sairamDoLugar}`);
  afirmar(resultado.pararam === TROPA, `os ${TROPA} deveriam parar na formacao, pararam ${resultado.pararam}`);
  afirmar(resultado.tilesDistintos === TROPA, `os ${TROPA} deveriam parar em tiles distintos, ${resultado.tilesDistintos}`);
}

module.exports = { roteiro };
