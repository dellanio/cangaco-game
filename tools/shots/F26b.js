'use strict';
// Roteiro da F26b — SELECIONAR E COMANDAR O GRUPO PELA TELA.
//
// Carrega a partida que `tests/F26b-selecao.test.ts` grava: a vila, tres milicianos do
// jogador (sold1 e sold2 no MESMO tile) e uma escola inimiga. Tudo pelo mouse:
//   1. clique no centro DESENHADO de sold1, depois no de sold2 — o mesmo tile, pontos
//      diferentes (`deslocamentoDaUnidade`, nota da F18f): cada clique pega o seu;
//   2. shift + clique soma ao grupo;
//   3. arrasto em caixa pega os tres;
//   4. botao direito no chao: com o jogo DESPAUSADO, os tres marcham e param perto;
//   5. botao direito na escola inimiga: o grupo sai para atacar e o hp cai.
// O px sai do debug (`unidadesRenderizadas`: tile desenhado + desvio), nunca de pixel da
// captura. Os passos que dependem da sim rodam despausados, com mouse.down/up (§8).
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts
const SOLDADOS = ['sold1', 'sold2', 'sold3'];

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/F26b.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  afirmar(SOLDADOS.every((id) => s.unidadesRenderizadas.some((u) => u.id === id)), 'a partida deveria ter os tres soldados desenhados');
  afirmar(s.camera.zoom === 1, `o roteiro mede a zoom 1, a camera esta a ${s.camera.zoom}`);

  // centra a camera nos soldados, pelas setas (F-D2)
  const s1 = s.unidadesRenderizadas.find((u) => u.id === 'sold1');
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
  await centrarNoEixo(s1.gx, 'x');
  await centrarNoEixo(s1.gy, 'y');

  /** O ponto de PAGINA do centro desenhado da unidade (zoom 1: tela = mundo - scroll). */
  async function pontoDaUnidade(id) {
    const agora = await estado();
    const u = agora.unidadesRenderizadas.find((x) => x.id === id);
    return {
      x: canvas.left + u.gxDesenhado * TILE_PX + TILE_PX / 2 + u.deslocamentoPx.x - agora.camera.scrollX,
      y: canvas.top + u.gyDesenhado * TILE_PX + TILE_PX / 2 + u.deslocamentoPx.y - agora.camera.scrollY,
    };
  }
  const pontoDoTile = (gx, gy, camera) => ({
    x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
    y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
  });
  async function apertar(p, opcoes = {}) {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down(opcoes);
    await page.waitForTimeout(150);
    await page.mouse.up(opcoes);
    await esperarFrame();
  }

  // 1. o mesmo tile, pontos diferentes
  s = await estado();
  const u1 = s.unidadesRenderizadas.find((u) => u.id === 'sold1');
  const u2 = s.unidadesRenderizadas.find((u) => u.id === 'sold2');
  afirmar(u1.gx === u2.gx && u1.gy === u2.gy, 'sold1 e sold2 deveriam estar no MESMO tile');
  afirmar(u1.deslocamentoPx.x !== u2.deslocamentoPx.x || u1.deslocamentoPx.y !== u2.deslocamentoPx.y,
    'sold1 e sold2 deveriam ser desenhados em pontos diferentes');
  await apertar(await pontoDaUnidade('sold1'));
  afirmar(JSON.stringify((await estado()).selecaoMilitar) === '["sold1"]', `o clique em sold1 deveria seleciona-lo, veio ${JSON.stringify((await estado()).selecaoMilitar)}`);
  await apertar(await pontoDaUnidade('sold2'));
  afirmar(JSON.stringify((await estado()).selecaoMilitar) === '["sold2"]', `o clique em sold2 (mesmo tile) deveria seleciona-lo, veio ${JSON.stringify((await estado()).selecaoMilitar)}`);
  await capturar('um-soldado-no-tile-cheio');

  // 2. shift soma
  await page.keyboard.down('Shift');
  await apertar(await pontoDaUnidade('sold1'));
  await page.keyboard.up('Shift');
  const somados = (await estado()).selecaoMilitar;
  afirmar(somados.length === 2 && somados.includes('sold1') && somados.includes('sold2'), `shift deveria somar, veio ${JSON.stringify(somados)}`);

  // 3. a caixa em volta dos tres, de um canto vazio ao outro
  const pontos = await Promise.all(SOLDADOS.map((id) => pontoDaUnidade(id)));
  const margem = TILE_PX;
  const a = { x: Math.min(...pontos.map((p) => p.x)) - margem, y: Math.min(...pontos.map((p) => p.y)) - margem };
  const b = { x: Math.max(...pontos.map((p) => p.x)) + margem, y: Math.max(...pontos.map((p) => p.y)) + margem };
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await esperarFrame();
  afirmar((await estado()).caixaDeSelecao !== null, 'a caixa deveria estar desenhada durante o arrasto');
  await capturar('caixa-em-curso');
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  afirmar(SOLDADOS.every((id) => s.selecaoMilitar.includes(id)) && s.selecaoMilitar.length === 3,
    `a caixa deveria pegar os tres, veio ${JSON.stringify(s.selecaoMilitar)}`);
  await capturar('grupo-selecionado');

  // 4. botao direito no chao, com o jogo andando
  const destino = { gx: u1.gx, gy: u1.gy + 4 };
  await apertar(pontoDoTile(destino.gx, destino.gy, s.camera), { button: 'right' });
  await page.keyboard.press('p');
  let chegaram = false;
  for (let i = 0; i < 60 && !chegaram; i += 1) {
    await page.waitForTimeout(250);
    const agora = await estado();
    chegaram = SOLDADOS.every((id) => {
      const u = agora.unidadesRenderizadas.find((x) => x.id === id);
      return u.fsm === 'ocioso' && Math.max(Math.abs(u.gx - destino.gx), Math.abs(u.gy - destino.gy)) <= 1;
    });
  }
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar(chegaram, `o grupo deveria marchar ate perto de ${destino.gx},${destino.gy} e parar`);
  s = await estado();
  const tilesDoGrupo = new Set(SOLDADOS.map((id) => {
    const u = s.unidadesRenderizadas.find((x) => x.id === id);
    return `${u.gx},${u.gy}`;
  }));
  afirmar(tilesDoGrupo.size === 3, `cada soldado deveria parar num tile proprio, vieram ${[...tilesDoGrupo]}`);
  await capturar('grupo-marchou');

  // 5. botao direito na escola inimiga
  const escola = s.prediosDoEstado.inimiga;
  afirmar(escola !== undefined && escola.hp === 550, 'a escola inimiga deveria estar inteira');
  await centrarNoEixo(escola.gx + 1, 'x');
  await centrarNoEixo(escola.gy + 1, 'y');
  s = await estado();
  await apertar(pontoDoTile(escola.gx + 1, escola.gy + 1, s.camera), { button: 'right' });
  await page.keyboard.press('p');
  let golpeada = false;
  for (let i = 0; i < 80 && !golpeada; i += 1) {
    await page.waitForTimeout(250);
    golpeada = ((await estado()).prediosDoEstado.inimiga?.hp ?? 550) < 550;
  }
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(golpeada, 'o botao direito na escola inimiga deveria mandar o grupo atacar, e o hp cair');
  afirmar(SOLDADOS.some((id) => s.unidadesRenderizadas.find((x) => x.id === id).fsm === 'atacando'),
    'pelo menos um soldado deveria estar atacando');
  afirmar(s.selecaoMilitar.length === 3, `o anel deveria seguir nos tres, veio ${JSON.stringify(s.selecaoMilitar)}`);
  await capturar('grupo-atacando');
  console.log(`F26b: hp da escola ${s.prediosDoEstado.inimiga.hp}, tick ${s.tick}`);
}

module.exports = { roteiro };
