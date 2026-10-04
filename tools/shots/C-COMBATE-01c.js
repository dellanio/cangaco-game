'use strict';
// Roteiro da C-COMBATE-01c — os controles de formacao pela tela (plano em
// docs/planos/2026-09-29-C-COMBATE-01c-controles-de-formacao.md):
//   1. H -> "Nova escaramuca"; camera na tropa; a caixa pega os 18;
//   2. "+" duas vezes no painel do grupo: o painel diz 7 por fileira, e os 18 param em fileiras
//      de 7 (a tropa olha para o sul: a fileira e uma linha de gy);
//   3. botao direito arrastado para o LESTE: os 18 param virados para o leste (a fileira vira
//      uma linha de gx, com 7);
//   4. Investida em paz: o aviso da paz aparece e ninguem carrega;
//   5. a paz acaba (avancar, pausado); Investida de novo: os 18 entram em carga.
// Todo aperto no painel e no mapa e DESPAUSADO, com mouse.down / 150 ms / mouse.up (§8).
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
  const texto = (seletor) => page.$eval(seletor, (n) => (n.hidden ? null : n.textContent));
  const avancar = async (n) => {
    await page.evaluate((k) => window.__cangaco.avancar(k), n);
    await esperarFrame();
  };

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

  const naPagina = (x, y, cam) => ({
    x: canvas.left + (x - cam.scrollX - canvas.width / 2) * cam.zoom + canvas.width / 2,
    y: canvas.top + (y - cam.scrollY - canvas.height / 2) * cam.zoom + canvas.height / 2,
  });
  const centro = (u) => ({ x: (u.gx + 0.5) * TILE_PX, y: (u.gy + 0.5) * TILE_PX });
  async function segurar(p, botao = 'left') {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: botao });
    await page.waitForTimeout(150);
    await page.mouse.up({ button: botao });
    await page.waitForTimeout(100);
  }
  async function apertarNoPainel(acao) {
    const caixa = await page.$eval(`#painel-grupo [data-acao="${acao}"]`, (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await segurar(caixa);
  }
  async function pararem() {
    let st = await estado();
    for (let i = 0; i < 160 && cabras(st).some((u) => u.fsm !== 'ocioso'); i += 1) {
      await page.waitForTimeout(250);
      st = await estado();
    }
    return st;
  }
  /** homens por fileira: quantos dividem o mesmo gy (ou gx), o maior e quantas linhas */
  const linhas = (st, eixo) => {
    const conta = new Map();
    for (const u of cabras(st)) conta.set(u[eixo], (conta.get(u[eixo]) ?? 0) + 1);
    return { maior: Math.max(...conta.values()), linhas: conta.size };
  };

  const resultado = {};
  await page.keyboard.press('p'); // despausado (§8)

  // 1. a caixa pega os 18
  s = await estado();
  const c = cabras(s).map(centro);
  const a = naPagina(Math.min(...c.map((p) => p.x)) - TILE_PX, Math.min(...c.map((p) => p.y)) - TILE_PX, s.camera);
  const b = naPagina(Math.max(...c.map((p) => p.x)) + TILE_PX, Math.max(...c.map((p) => p.y)) + TILE_PX, s.camera);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  resultado.selecionados = s.selecaoMilitar.length;
  resultado.colunasAntes = await texto('#painel-grupo [data-grupo="colunas"] span');

  // 2. + duas vezes
  await apertarNoPainel('mais-colunas');
  await esperarFrame();
  await apertarNoPainel('mais-colunas');
  await esperarFrame();
  resultado.colunasDepois = await texto('#painel-grupo [data-grupo="colunas"] span');
  s = await pararem();
  resultado.fileirasDe7 = linhas(s, 'gy');
  await capturar('fileiras-de-7');

  // 3. direito arrastado para o leste, 2 tiles ao norte do meio: ali o desenho de 7 ao leste cabe
  // inteiro no terreno (4 ao norte, uma vaga cai em mata e o desenho a desloca: 8 numa linha)
  s = await estado();
  const destino = naPagina((meio.gx + 0.5) * TILE_PX, (meio.gy - 2 + 0.5) * TILE_PX, s.camera);
  await page.mouse.move(destino.x, destino.y);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(150);
  await page.mouse.move(destino.x + 3 * TILE_PX * s.camera.zoom, destino.y, { steps: 8 });
  await page.waitForTimeout(150);
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(300);
  s = await pararem();
  resultado.viradosAoLeste = linhas(s, 'gx');
  resultado.pararam = cabras(s).filter((u) => u.fsm === 'ocioso').length;
  resultado.naoPararam = cabras(s).filter((u) => u.fsm !== 'ocioso').map((u) => `${u.id}@${u.gx},${u.gy}:${u.fsm}`);
  await capturar('virados-ao-leste');

  // 4. Investida em paz: o aviso, e ninguem carrega
  await apertarNoPainel('investida');
  await esperarFrame();
  s = await estado();
  resultado.avisoEmPaz = await texto('#aviso-de-ordem');
  resultado.emCargaNaPaz = cabras(s).filter((u) => u.fsm === 'em_carga').length;
  await capturar('investida-em-paz');

  // 5. a paz acaba (pausado, avancar); a Investida despausada
  await page.keyboard.press('p');
  for (let i = 0; i < 20 && (await texto('#minimapa [data-campo="paz"]')) !== null; i += 1) await avancar(500);
  resultado.pazAcabou = (await texto('#minimapa [data-campo="paz"]')) === null;
  await page.keyboard.press('p');
  resultado.investidaHabilitada = await page.$eval('#painel-grupo [data-acao="investida"]', (n) => !n.disabled);
  await apertarNoPainel('investida');
  await page.waitForTimeout(100);
  s = await estado();
  resultado.emCarga = cabras(s).filter((u) => u.fsm === 'em_carga').length;
  resultado.colunasNaCarga = await texto('#painel-grupo [data-grupo="colunas"] span');
  resultado.maisNaCarga = await page.$eval('#painel-grupo [data-acao="mais-colunas"]', (n) => n.disabled);
  await capturar('investida');
  await page.keyboard.press('p');

  console.log(`C-COMBATE-01c: ${JSON.stringify(resultado)}`);
  afirmar(resultado.selecionados === TROPA, `a caixa deveria pegar ${TROPA}, pegou ${resultado.selecionados}`);
  afirmar(resultado.colunasAntes === '5 por fileira', `o painel deveria partir de 5 por fileira, veio ${resultado.colunasAntes}`);
  afirmar(resultado.colunasDepois === '7 por fileira', `dois "+" deveriam dar 7 por fileira, veio ${resultado.colunasDepois}`);
  afirmar(resultado.fileirasDe7.maior === 7 && resultado.fileirasDe7.linhas === Math.ceil(TROPA / 7),
    `os ${TROPA} deveriam parar em ${Math.ceil(TROPA / 7)} fileiras de ate 7 (linhas de gy), veio ${JSON.stringify(resultado.fileirasDe7)}`);
  afirmar(resultado.pararam === TROPA, `os ${TROPA} deveriam parar, pararam ${resultado.pararam}`);
  afirmar(resultado.viradosAoLeste.maior === 7 && resultado.viradosAoLeste.linhas === Math.ceil(TROPA / 7),
    `virados ao leste, a fileira e uma linha de gx com 7, veio ${JSON.stringify(resultado.viradosAoLeste)}`);
  afirmar(typeof resultado.avisoEmPaz === 'string' && resultado.avisoEmPaz.startsWith('Em paz'),
    `a Investida em paz deveria dar o aviso da paz, veio ${resultado.avisoEmPaz}`);
  afirmar(resultado.emCargaNaPaz === 0, `em paz ninguem deveria carregar, vieram ${resultado.emCargaNaPaz}`);
  afirmar(resultado.pazAcabou, 'a paz deveria acabar');
  afirmar(resultado.investidaHabilitada, `a Investida deveria estar habilitada com ${TROPA} de corpo a corpo`);
  afirmar(resultado.emCarga === TROPA, `depois da paz, os ${TROPA} deveriam entrar em carga, vieram ${resultado.emCarga}`);
  afirmar(resultado.colunasNaCarga === '7 por fileira' && resultado.maisNaCarga,
    `em carga o painel segue com 7 por fileira e o +/− desabilitado, veio ${resultado.colunasNaCarga} / ${resultado.maisNaCarga}`);
}

module.exports = { roteiro };
