'use strict';
// Roteiro da C-TELA-01 — a mensagem da ordem recusada, pela tela, como o jogador:
//   1. H -> "Nova escaramuca"; caixa em volta dos 18 cabras;
//   2. DESPAUSADO (§8), botao direito longe da vila: C-COMBATE-02b tirou a cerca da paz, e
//      a tropa marcha sem aviso;
//   3. a tropa marcha ate ver o armazem da IA (ele nasce na nevoa), e o botao direito nele:
//      "Em paz — faltam m:ss";
//   4. a mensagem some sozinha.
// O px sai do debug (`unidadesRenderizadas`, `prediosDoEstado`), nunca de pixel da captura.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const LADO_DO_JOGADOR = 0;
const LADO_DA_IA = 1;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const aviso = () => page.$eval('#aviso-de-ordem', (n) => (n.hidden ? null : n.textContent));

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  let s = await estado();
  const minha = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
  afirmar(minha.length === 18, `o jogador deveria nascer com 18 cabras, veio ${minha.length}`);
  afirmar((await aviso()) === null, 'o aviso de ordem nao deveria existir antes de ordem nenhuma');

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
  afirmar(s.selecaoMilitar.length === 18, `a caixa deveria pegar os 18, veio ${s.selecaoMilitar.length}`);

  // 2. longe da vila (onde a cerca antiga, de 12 tiles, recusava): em paz, a tropa anda
  const LONGE_TILES = 16;
  const longe = { gx: meio.gx, gy: meio.gy + LONGE_TILES };
  await centrar(longe);
  s = await estado();
  await page.keyboard.press('p');
  await direito(pontoDoTile(longe.gx, longe.gy, s.camera));
  await page.waitForTimeout(400);
  await page.keyboard.press('p');
  await esperarFrame();
  const textoLonge = await aviso();
  afirmar(textoLonge === null, `a marcha em paz nao deveria ter aviso, veio ${textoLonge}`);
  s = await estado();
  const moveram = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia' && u.fsm !== 'ocioso');
  afirmar(moveram.length > 0, 'em paz, longe da vila, a tropa deveria marchar');
  await capturar('marcha-em-paz');

  // 3. o armazem da IA: ataque em paz
  const [idDoArmazem, armazem] = Object.entries(s.prediosDoEstado).find(([, p]) => p.lado === LADO_DA_IA && p.tipo === 'storehouse');
  const alvo = { gx: armazem.gx + 1, gy: armazem.gy + 1 };
  // F-COMBATE-ALVO-NA-VISTA / F-TELA-NEVOA: o armazem da IA nasce no escuro, e o clique nele no
  // escuro e marcha, nao ataque. A tropa ganha a vista pelo caminho do jogo: marcha (em paz
  // pode) ate perto dele, e o relogio corre ate ele aparecer.
  const perto = { gx: armazem.gx - 6, gy: armazem.gy + 1 };
  await centrar(perto);
  s = await estado();
  await direito(pontoDoTile(perto.gx, perto.gy, s.camera));
  for (let i = 0; i < 40 && !(await estado()).prediosDoEstado[idDoArmazem].naVista; i += 1) {
    await page.evaluate(() => window.__cangaco.avancar(25));
    await esperarFrame();
  }
  afirmar((await estado()).prediosDoEstado[idDoArmazem].naVista, 'a tropa deveria ter chegado a ver o armazem da IA');
  await centrar(alvo);
  s = await estado();
  await direito(pontoDoTile(alvo.gx, alvo.gy, s.camera));
  await page.evaluate(() => window.__cangaco.avancar(1));
  await esperarFrame();
  const textoPaz = await aviso();
  afirmar(textoPaz !== null && /^Em paz — faltam \d+:\d\d$/.test(textoPaz), `deveria mostrar "Em paz — faltam m:ss", veio ${textoPaz}`);
  await capturar('em-paz');

  // 4. some sozinha
  await page.waitForTimeout(tema.ordem.segundosNaTela * 1000 + 300);
  afirmar((await aviso()) === null, 'o aviso deveria sumir sozinho');
  console.log(`C-TELA-01: "${textoLonge}" e "${textoPaz}"`);
}

module.exports = { roteiro };
