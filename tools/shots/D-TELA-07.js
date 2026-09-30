'use strict';
// Roteiro da D-TELA-07 — O SINAL DE PAUSADO NO MAPA.
//
// Carrega pelo botao "carregar" (F23b) a partida que o aceite 2 de
// `tests/D-TELA-07-sinal-de-pausado.test.ts` grava: a serraria `s1` pausada e a `s2` sem
// insumo, lado a lado, as duas com o ocioso aceso. Passo 0 mede pela ponte, com o relogio
// parado: so a `s1` tem placa, com o texto do tema, dentro da largura do corpo e na metade de
// cima. Depois despausa (§8) e le seis vezes. Captura. Por fim retoma a `s1` pelo painel,
// com o relogio correndo e o botao segurado 150 ms (§8), e a placa some.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas, pontoParaApertar } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = terreno.tile_px;
const ZOOM = 2;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX / 2) return;
      const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 60);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  async function zoomPara(nivel) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 10; i += 1) {
      const { camera } = await estado();
      if (camera.zoom === nivel) return;
      await page.mouse.wheel(0, camera.zoom > nivel ? +200 : -200);
      await esperarFrame();
    }
    afirmar((await estado()).camera.zoom === nivel, `a camera deveria chegar a ${nivel}`);
  }
  /** O ponto do tile no canvas, com a camera em zoom 1 (molde da F16b). */
  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    afirmar(camera.zoom === 1, 'pontoDoTile assume zoom 1');
    const x = canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }
  const sinais = (s) => Object.keys(s.sinaisDePausado).sort();
  /** O mouse vai para a barra: sem tile sob ele, o realce apaga e a captura mostra o jogo
   *  (o mesmo cuidado do roteiro da F-VIVO-h). */
  async function tirarOMouseDoMapa() {
    const b = await page.evaluate(() => {
      const r = window.document.querySelector('#barra').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(b.x, b.y);
    await esperarFrame();
    afirmar((await estado()).tileSobMouse === null, 'com o mouse na barra, nenhum tile deveria estar sob ele');
  }

  for (const arquivo of ['test-output/D-TELA-07.save.txt', 'test-output/D-TELA-07.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/D-TELA-07.partida.json', 'utf8'));
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/D-TELA-07.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // passo 0: a medida, com o relogio parado
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);
  afirmar(s.quadrosOciosos[plano.pausado] !== undefined && s.quadrosOciosos[plano.semInsumo] !== undefined,
    'a pausada e a sem insumo deveriam mostrar o mesmo ocioso (a ambiguidade do pedido)');
  afirmar(JSON.stringify(sinais(s)) === JSON.stringify([plano.pausado]),
    `so a ${plano.pausado} deveria ter placa, veio ${JSON.stringify(sinais(s))}`);
  const sinal = s.sinaisDePausado[plano.pausado];
  afirmar(sinal.texto === tema.painelPredio.pausar,
    `a placa deveria dizer "${tema.painelPredio.pausar}" (painelPredio.pausar), veio "${sinal.texto}"`);
  const { placa, corpo } = sinal;
  afirmar(placa.x >= corpo.x && placa.x + placa.w <= corpo.x + corpo.w,
    `a placa deveria caber na largura do corpo: placa ${JSON.stringify(placa)}, corpo ${JSON.stringify(corpo)}`);
  afirmar(placa.y >= corpo.y && placa.y + placa.h <= corpo.y + corpo.h / 2,
    `a placa deveria ficar na metade de cima do corpo: placa ${JSON.stringify(placa)}, corpo ${JSON.stringify(corpo)}`);

  await zoomPara(ZOOM);
  await centrarNoEixo(plano.centro.gx, 'x');
  await centrarNoEixo(plano.centro.gy, 'y');

  // a placa em px de TELA (a camera zoomeia pelo centro do canvas, como `centrarNoEixo`
  // assume) fica na parte do canvas que a barra lateral nao cobre
  {
    const { camera } = await estado();
    const naTela = (x, y) => ({
      x: canvas.left + (x - camera.scrollX - canvas.width / 2) * camera.zoom + canvas.width / 2,
      y: canvas.top + (y - camera.scrollY - canvas.height / 2) * camera.zoom + canvas.height / 2,
    });
    const a = naTela(placa.x, placa.y);
    const b = naTela(placa.x + placa.w, placa.y + placa.h);
    const barra = await page.evaluate(() => window.document.querySelector('#barra').getBoundingClientRect().right);
    afirmar(a.x >= barra && b.x <= canvas.right && a.y >= canvas.top && b.y <= canvas.bottom,
      `a placa deveria estar inteira fora da barra (${barra}) e dentro do canvas: (${a.x},${a.y})-(${b.x},${b.y})`);
  }

  // relogio andando (§8): a placa fica so na pausada
  await page.keyboard.press('p');
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    afirmar(JSON.stringify(sinais(s)) === JSON.stringify([plano.pausado]),
      `com o relogio andando, as placas viraram ${JSON.stringify(sinais(s))} no tick ${s.tick}`);
    afirmar(s.quadrosOciosos[plano.semInsumo] !== undefined, `a ${plano.semInsumo} perdeu o ocioso no tick ${s.tick}`);
  }
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado, 'o roteiro deveria ter pausado de volta');
  afirmar(s.tick > plano.tick, 'o relogio deveria ter andado');
  await tirarOMouseDoMapa();
  await capturar('pausada-e-sem-insumo');

  // a placa diz a MESMA palavra do botao de pausar do painel de uma serraria nao pausada
  await zoomPara(1);
  await centrarNoEixo(plano.meioDaSemInsumo.gx, 'x');
  await centrarNoEixo(plano.meioDaSemInsumo.gy, 'y');
  const q = await pontoDoTile(plano.meioDaSemInsumo.gx, plano.meioDaSemInsumo.gy);
  await page.mouse.click(q.x, q.y);
  await esperarFrame();
  afirmar((await page.getAttribute('#painel-predio', 'data-predio-aberto')) === plano.semInsumo,
    `o clique deveria abrir o painel da ${plano.semInsumo}`);
  afirmar((await page.getAttribute('#painel-predio [data-pausar]', 'data-pausar')) === 'true',
    `a ${plano.semInsumo} nao pausada deveria mostrar o botao de pausar (data-pausar="true")`);
  const textoDoBotao = (await page.textContent('#painel-predio [data-pausar]')).trim();
  afirmar(textoDoBotao === sinal.texto,
    `a placa ("${sinal.texto}") deveria dizer o mesmo que o botao de pausar do painel ("${textoDoBotao}")`);
  await page.keyboard.press('Escape');
  await esperarFrame();

  // retomar pelo painel: o gesto do jogador, relogio correndo, botao segurado (§8)
  await centrarNoEixo(plano.meioDaPausada.gx, 'x');
  await centrarNoEixo(plano.meioDaPausada.gy, 'y');
  const p = await pontoDoTile(plano.meioDaPausada.gx, plano.meioDaPausada.gy);
  await page.mouse.click(p.x, p.y);
  await esperarFrame();
  afirmar((await page.getAttribute('#painel-predio', 'data-predio-aberto')) === plano.pausado,
    `o clique deveria abrir o painel da ${plano.pausado}`);
  afirmar((await page.getAttribute('#painel-predio [data-pausar]', 'data-pausar')) === 'false',
    'pausada, o botao do painel deveria ser o de retomar (data-pausar="false")');
  const botao = await pontoParaApertar(page, '#painel-predio [data-pausar]');
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'o clique de retomar precisa do relogio correndo');
  await page.mouse.move(botao.x, botao.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado, 'o roteiro deveria ter pausado de volta');
  afirmar(s.prediosDoEstado[plano.pausado].pausado === false, `a ${plano.pausado} deveria ter voltado ao trabalho`);
  afirmar(sinais(s).length === 0, `retomada, a placa deveria sumir, veio ${JSON.stringify(sinais(s))}`);
  await page.keyboard.press('Escape');
  await esperarFrame();
  await tirarOMouseDoMapa();
  await capturar('retomada-sem-placa');
}

module.exports = { roteiro };
