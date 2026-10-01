'use strict';
// Roteiro da D-PRODUCAO-03b — A ENCOMENDA DA OFICINA NA TELA.
//
// Carrega a partida que `tests/D-PRODUCAO-03b-painel-encomenda.test.ts` grava: a cadeia do
// ferro com a ferraria de armas (`ws1`) no fim de um ciclo encomendado — a espada em curso,
// a encomenda toda em zero, ~3 s de jogo para o deposito.
//   1. abre o painel com o jogo ANDANDO (mouse.down/up, §8): tres linhas de encomenda, todas
//      em zero, a espada "fazendo";
//   2. o jogo anda ate o deposito: o aviso "Encomenda cumprida" aparece sobre o mapa, e o
//      painel diz "sem encomenda";
//   3. o + da lanca com o jogo andando: a lanca pedida (falta 1, ou 0 e em curso se o ciclo
//      ja comecou).
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';
const OFICINA = 'ws1';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/D-PRODUCAO-03b.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const oficina = s.prediosDoEstado[OFICINA];
  afirmar(oficina !== undefined && oficina.tipo === 'weapon_smithy', 'a partida deveria ter a ferraria de armas');

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
  await centrarNoEixo(oficina.gx + 1, 'x');
  await centrarNoEixo(oficina.gy + 1, 'y');
  s = await estado();

  // o painel se redesenha a 10 Hz com o jogo andando: as linhas se leem numa avaliacao so
  const linhas = () => page.evaluate(() => [...window.document.querySelectorAll('#painel-predio .linha.encomenda-saida')].map((l) => ({
    mercadoria: l.dataset.encomenda, falta: Number(l.dataset.falta), emCurso: l.dataset.emCurso === 'true',
  })));
  const semEncomenda = () => page.evaluate(() => window.document.querySelector('#painel-predio [data-sem-encomenda]') !== null);
  const aviso = () => page.$eval('#aviso-de-ordem', (n) => (n.hidden ? null : n.textContent));

  // 1. o painel, aberto com o jogo andando; pausa logo depois, para o deposito nao passar
  const noCanvas = {
    x: canvas.left + (oficina.gx + 1) * TILE_PX - s.camera.scrollX,
    y: canvas.top + (oficina.gy + 1) * TILE_PX - s.camera.scrollY,
  };
  await page.keyboard.press('p');
  await page.mouse.move(noCanvas.x, noCanvas.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.keyboard.press('p');
  await esperarFrame();

  let lista = await linhas();
  afirmar(JSON.stringify(lista.map((l) => l.mercadoria)) === '["sword","pike","crossbow"]',
    `deveriam ser tres linhas (espada, lanca, besta), vieram ${JSON.stringify(lista)}`);
  afirmar(lista.every((l) => l.falta === 0), `a encomenda deveria estar toda em zero: ${JSON.stringify(lista)}`);
  afirmar(JSON.stringify(lista.filter((l) => l.emCurso).map((l) => l.mercadoria)) === '["sword"]',
    `so a espada deveria estar em curso: ${JSON.stringify(lista)}`);
  afirmar(!(await semEncomenda()), 'com a espada em curso, nao e "sem encomenda"');
  const menosDaEspada = await page.evaluate(() => window.document
    .querySelector('#painel-predio .linha.encomenda-saida[data-encomenda="sword"] button[data-feira-controle="menos"]')?.disabled ?? null);
  afirmar(menosDaEspada === true, 'o − no zero deveria estar desabilitado');
  await capturar('espada-em-curso');

  // 2. anda ate o deposito: o aviso aparece e o painel diz "sem encomenda"
  await page.keyboard.press('p');
  let texto = null;
  for (let i = 0; i < 40 && texto === null; i += 1) {
    await page.waitForTimeout(250);
    texto = await aviso();
  }
  await page.keyboard.press('p');
  await esperarFrame();
  const esperado = tema.ordem.encomendaCumprida.replace('{predio}', tema.predios.weapon_smithy.nome);
  afirmar(texto === esperado, `o aviso deveria dizer "${esperado}", diz ${JSON.stringify(texto)}`);
  afirmar(await semEncomenda(), 'cumprida, o painel deveria dizer "sem encomenda"');
  lista = await linhas();
  afirmar(lista.every((l) => l.falta === 0 && !l.emCurso), `cumprida, nada em curso: ${JSON.stringify(lista)}`);
  await capturar('encomenda-cumprida');

  // 3. o + da lanca com o jogo andando
  const caixa = await page.evaluate(() => {
    const b = window.document.querySelector('#painel-predio .linha.encomenda-saida[data-encomenda="pike"] button[data-feira-controle="mais"]');
    if (b === null) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  afirmar(caixa !== null, 'o + da lanca deveria estar na tela');
  await page.keyboard.press('p');
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.keyboard.press('p');
  await esperarFrame();
  lista = await linhas();
  const lanca = lista.find((l) => l.mercadoria === 'pike');
  afirmar(lanca !== undefined && lanca.falta + (lanca.emCurso ? 1 : 0) === 1,
    `a lanca deveria estar pedida uma vez (falta 1, ou 0 e em curso): ${JSON.stringify(lanca)}`);
  afirmar(!(await semEncomenda()), 'com a lanca pedida, nao e mais "sem encomenda"');
  await capturar('lanca-encomendada');
  console.log(`D-PRODUCAO-03: aviso "${texto}", lanca ${JSON.stringify(lanca)}`);
}

module.exports = { roteiro };
