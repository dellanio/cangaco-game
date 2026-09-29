'use strict';
// Roteiro da C-TELA-03 — pegar a tropa inteira pela caixa e mover os 18.
//   1. H -> "Nova escaramuca"; camera na tropa;
//   2. caixas do jeito que a mao faz, todas DESPAUSADAS e com o botao seguro (§8):
//      a) comecando EM CIMA de um cabra (o canto superior esquerdo da tropa);
//      b) de baixo-direita para cima-esquerda;
//      c) com a camera afastada (roda do mouse), que muda px de tela contra px de mundo;
//   3. botao direito dentro da cerca da paz: os 18 marcham, e depois de andar os 18 sairam
//      do tile de onde nasceram.
// O px sai do debug (`unidadesRenderizadas`, `camera`), nunca de pixel da captura.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

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
  afirmar(minha.length === 18, `o jogador deveria nascer com 18 cabras, veio ${minha.length}`);

  async function centrarNoEixo(alvoEmTiles, eixo) {
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
  resultado.marchando = cabras(s).filter((u) => u.fsm === 'marchando').length;
  await page.waitForTimeout(4000);
  s = await estado();
  resultado.sairamDoLugar = cabras(s).filter((u) => nasceram.get(u.id) !== `${u.gx},${u.gy}`).length;
  await capturar('os-18-andaram');
  await page.keyboard.press('p');

  console.log(`C-TELA-03: ${JSON.stringify({ zoomAntes, ...resultado })}`);
  afirmar(resultado.emCimaDoCabra === 18, `caixa comecando em cima do cabra deveria pegar 18, pegou ${resultado.emCimaDoCabra}`);
  afirmar(resultado.aoContrario === 18, `caixa ao contrario deveria pegar 18, pegou ${resultado.aoContrario}`);
  afirmar(resultado.zoom !== zoomAntes, `a roda deveria ter mudado o zoom (${zoomAntes})`);
  afirmar(resultado.afastado === 18, `caixa com a camera afastada deveria pegar 18, pegou ${resultado.afastado}`);
  afirmar(resultado.marchando === 18, `os 18 deveriam marchar, marcham ${resultado.marchando}`);
  afirmar(resultado.sairamDoLugar === 18, `os 18 deveriam ter saido do lugar, sairam ${resultado.sairamDoLugar}`);
}

module.exports = { roteiro };
