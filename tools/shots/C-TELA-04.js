'use strict';
// Roteiro da C-TELA-04 — botao direito sobre um militar inimigo, com a tropa na mao, e ataque.
//   1. H -> "Nova escaramuca"; o relogio corre (avancar, pausado) ate a paz acabar;
//   2. caixa em volta dos 18 cabras;
//   3. DESPAUSADO e com o botao seguro (§8), botao direito sobre um cabra da IA na posicao
//      "frente": os 18 saem para lutar (`indo_lutar` ou `lutando`), sem marca de destino;
//   4. depois de correr, a tropa chega e trava a luta (`lutando`). O debug nao expoe HP de
//      unidade; o dano do golpe e da F28a (corpo a corpo), provado headless.
// O px sai do debug (`unidadesRenderizadas`, `camera`), nunca de pixel da captura.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const escaramuca = require('../../data/escaramuca.json');

const TILE_PX = terreno.tile_px;
const LADO_DO_JOGADOR = 0;
const LUTA = new Set(['indo_lutar', 'lutando']);

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const pazNaTela = () => page.$eval('#minimapa [data-campo="paz"]', (n) => (n.hidden ? null : n.textContent));

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // 1. a paz acaba
  for (let i = 0; i < 20 && (await pazNaTela()) !== null; i += 1) await avancar(500);
  afirmar((await pazNaTela()) === null, 'a paz deveria ter acabado');
  await esperarFrame();

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

  // 2. a caixa em volta dos 18
  let s = await estado();
  const minha = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
  afirmar(minha.length === 18, `o jogador deveria ter 18 cabras, tem ${minha.length}`);
  const meio = {
    gx: Math.round(minha.reduce((n, u) => n + u.gx, 0) / minha.length),
    gy: Math.round(minha.reduce((n, u) => n + u.gy, 0) / minha.length),
  };
  await centrar(meio);
  s = await estado();
  const pontos = minha.map((u) => pontoDoTile(u.gx, u.gy, s.camera));
  await page.mouse.move(Math.min(...pontos.map((p) => p.x)), Math.min(...pontos.map((p) => p.y)));
  await page.mouse.down();
  await page.mouse.move(Math.max(...pontos.map((p) => p.x)), Math.max(...pontos.map((p) => p.y)), { steps: 8 });
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  afirmar(s.selecaoMilitar.length === 18, `a caixa deveria pegar os 18, veio ${s.selecaoMilitar.length}`);

  // 3. o alvo: o cabra da IA mais perto do ponto da "frente"
  const frente = escaramuca.posicoes.find((p) => p.id === 'frente').ponto;
  const dist = (u) => Math.abs(u.gx - frente.gx) + Math.abs(u.gy - frente.gy);
  const alvo = s.unidadesRenderizadas.filter((u) => u.lado !== LADO_DO_JOGADOR && u.tipo === 'militia')
    .sort((a, b) => dist(a) - dist(b))[0];
  afirmar(alvo !== undefined, 'a IA deveria ter um cabra na frente');
  await centrar(alvo);
  s = await estado();
  // mira o MEIO DO CORPO desenhado, como a mao faz: o pe (centro do tile + desvio) menos
  // metade da altura da imagem. Sem sprite, o proprio pe.
  const naTela = s.unidadesRenderizadas.find((u) => u.id === alvo.id);
  const pe = pontoDoTile(naTela.gxDesenhado, naTela.gyDesenhado, s.camera);
  const k = naTela.corpoPx;
  const p = {
    x: pe.x + naTela.deslocamentoPx.x + (k === null ? 0 : (k.x0 + k.x1) / 2),
    y: pe.y + naTela.deslocamentoPx.y + (k === null ? 0 : (k.y0 + k.y1) / 2),
  };
  afirmar(k !== null, 'o cabra da IA deveria estar desenhado com sprite (corpoPx)');
  await page.keyboard.press('p');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(150);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  s = await estado();
  const lutando = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia' && LUTA.has(u.fsm)).length;
  const marca = s.marcadorDeDestino;

  // 4. corre ate a tropa chegar e travar a luta
  let travaram = 0;
  for (let i = 0; i < 40 && travaram === 0; i += 1) {
    await avancar(100);
    s = await estado();
    travaram = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.fsm === 'lutando').length;
  }
  const naLuta = s.unidadesRenderizadas.find((u) => u.lado === LADO_DO_JOGADOR && u.fsm === 'lutando');
  if (naLuta !== undefined) await centrar(naLuta);
  await capturar('a-tropa-no-alvo');

  console.log(`C-TELA-04: ${JSON.stringify({ alvo: alvo.id, lutando, marca, travaram, tick: s.tick })}`);
  afirmar(lutando === 18, `os 18 deveriam sair para lutar, sairam ${lutando}`);
  afirmar(marca === null, `ataque nao marca destino, veio ${JSON.stringify(marca)}`);
  afirmar(travaram > 0, 'a tropa deveria chegar e travar a luta')
}

module.exports = { roteiro };
