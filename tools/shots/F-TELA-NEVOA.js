'use strict';
// Roteiro da F-TELA-NEVOA — a nevoa na tela, no painel e no minimapa (aceite no BUILD_PLAN, Fase F).
//   (a) a escaramuca no tick 0: a vila clara, o resto escuro; depois a tropa marcha (o clique
//       direito num tile no escuro e marcha) e o caminho fica descoberto, a tropa inimiga so
//       onde se ve;
//   (b) o minimapa nao desenha predio inimigo fora da vista (`data-predios-inimigos`);
//   (c) clicar onde ha um predio inimigo fora da vista nao abre o painel dele: DESPAUSADO, com
//       mouse.down / 150 ms / mouse.up (§8);
//   (d) o custo da camada nova no quadro, pelos contadores da D-TELA-CUSTO-DO-QUADRO: pausado e
//       com a camera parada, 0 tiles repintados por quadro (eixo deterministico); o ms vai para
//       `test-output/F-TELA-NEVOA.json` como numero da corrida, nunca asserção.
// O px sai do debug (`unidadesRenderizadas`, `prediosDoEstado`), nunca de pixel da captura.
const fs = require('node:fs');
const path = require('node:path');
const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const escaramuca = require('../../data/escaramuca.json');

const TILE_PX = terreno.tile_px;
const LADO_DO_JOGADOR = 0;
const LADO_DA_IA = 1;

async function roteiro({ page, capturar, estado, afirmar }) {
  const base = page.url().split('?')[0];
  await page.goto(`${base}?pausado&escaramuca`);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto && window.__cangaco.nevoa));
  const canvas = await retanguloDoCanvas(page);
  const quadro = () => page.evaluate(() => new Promise((r) => window.requestAnimationFrame(() => setTimeout(r, 0))));
  const camera = async (t) => {
    await page.evaluate(([x, y]) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }),
      [t.gx * TILE_PX - canvas.width / 2, t.gy * TILE_PX - canvas.height / 2]);
    await quadro();
    await quadro();
  };
  const minimapa = () => page.$eval('canvas[data-campo="minimapa"]', (c) => ({ predios: Number(c.dataset.predios), inimigos: Number(c.dataset.prediosInimigos) }));
  const resultado = {};

  // (a) o tick 0
  let s = await estado();
  afirmar(s.tick === 0, `a escaramuca deveria nascer no tick 0, veio ${s.tick}`);
  const minha = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === escaramuca.tropaDoJogador.tipo);
  afirmar(minha.length === escaramuca.tropaDoJogador.quantidade, `a tropa do jogador deveria ter ${escaramuca.tropaDoJogador.quantidade}, veio ${minha.length}`);
  afirmar(s.nevoa.visiveis > 0 && s.nevoa.escuros > s.nevoa.visiveis && s.nevoa.esmaecidos === 0,
    `no tick 0 a vila e clara e o resto escuro, sem esmaecido: ${JSON.stringify(s.nevoa)}`);
  const daIA = Object.entries(s.prediosDoEstado).filter(([, p]) => p.lado === LADO_DA_IA);
  afirmar(daIA.length === escaramuca.predios.length && daIA.every(([, p]) => !p.naVista), 'os predios da IA estao fora da vista no tick 0');
  afirmar(s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA).every((u) => u.visivel === false), 'nenhuma unidade da IA se desenha no tick 0');
  const mm0 = await minimapa();
  afirmar(mm0.inimigos === 0, `(b) o minimapa nao desenha predio inimigo fora da vista, veio ${mm0.inimigos}`);
  resultado.tick0 = { nevoa: s.nevoa, minimapa: mm0 };
  const meio = {
    gx: Math.round(minha.reduce((n, u) => n + u.gx, 0) / minha.length),
    gy: Math.round(minha.reduce((n, u) => n + u.gy, 0) / minha.length) - 4,
  };
  // a camera na borda leste da vista: a vila de um lado, o escuro do outro
  await camera({ gx: meio.gx + 12, gy: meio.gy });
  await capturar('tick0-vila-clara');

  // (d) o custo, pausado e com a camera parada: nada se repinta
  const custoPausado = await page.evaluate(async () => {
    const ponte = window.__cangaco;
    const q = () => new Promise((r) => window.requestAnimationFrame(() => setTimeout(r, 0)));
    ponte.zerarCusto();
    for (let i = 0; i < 60; i += 1) await q();
    return JSON.parse(JSON.stringify(ponte.custo.nevoa));
  });
  afirmar(custoPausado.chamadas > 0 && custoPausado.itens === 0, `(d) pausado, a nevoa repinta 0 tiles: ${JSON.stringify(custoPausado)}`);

  // (c) o predio inimigo no escuro: o clique despausado nao abre o painel
  const [idDoArmazem, armazemDaIA] = daIA.find(([, p]) => p.tipo === 'storehouse');
  await camera({ gx: armazemDaIA.gx + 1, gy: armazemDaIA.gy + 1 });
  s = await estado();
  const noArmazem = pontoDoTileNaTela(canvas, { gx: armazemDaIA.gx + 1, gy: armazemDaIA.gy + 1 }, s.camera, TILE_PX);
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, '(c) o clique roda despausado');
  await page.mouse.move(noArmazem.x, noArmazem.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await quadro();
  await page.keyboard.press('p');
  await quadro();
  const aberto = await page.getAttribute('#painel-predio', 'data-predio-aberto');
  afirmar(aberto !== idDoArmazem, `(c) o clique no armazem da IA no escuro nao abre o painel dele, abriu ${aberto}`);
  resultado.cliqueNoEscuro = { predio: idDoArmazem, painel: aberto };
  await capturar('vila-da-ia-no-escuro');

  // (a) a marcha: caixa em volta da tropa e botao direito num tile no escuro, perto da defesa da IA
  // a camera no centro da tropa (e nao no `meio`, 4 tiles ao norte): com a tropa do cenario em 3
  // fileiras (24, I-COMBATE-ESCARAMUCA-GANHAVEL) a caixa a partir do `meio` saia do canvas
  await camera({ gx: meio.gx, gy: meio.gy + 4 });
  s = await estado();
  const pontos = minha.map((u) => pontoDoTileNaTela(canvas, { gx: u.gx, gy: u.gy }, s.camera, TILE_PX));
  const caixa = { y0: Math.min(...pontos.map((p) => p.y)) - TILE_PX / 2, y1: Math.max(...pontos.map((p) => p.y)) + TILE_PX / 2 };
  afirmar(caixa.y0 >= canvas.top && caixa.y1 <= canvas.bottom, `a caixa cabe no canvas: ${JSON.stringify(caixa)} em ${canvas.top}..${canvas.bottom}`);
  await page.mouse.move(Math.min(...pontos.map((p) => p.x)) - TILE_PX / 2, Math.min(...pontos.map((p) => p.y)) - TILE_PX / 2);
  await page.mouse.down();
  await page.mouse.move(Math.max(...pontos.map((p) => p.x)) + TILE_PX / 2, Math.max(...pontos.map((p) => p.y)) + TILE_PX / 2, { steps: 8 });
  await page.mouse.up();
  await quadro();
  s = await estado();
  afirmar(s.selecaoMilitar.length === minha.length, `a caixa deveria pegar a tropa, veio ${s.selecaoMilitar.length}`);
  const frente = escaramuca.posicoes.find((p) => p.linha === 'frente').ponto;
  const destino = { gx: frente.gx - 6, gy: frente.gy - 6 };
  await camera(destino);
  s = await estado();
  const noDestino = pontoDoTileNaTela(canvas, destino, s.camera, TILE_PX);
  await page.mouse.move(noDestino.x, noDestino.y);
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(150);
  await page.mouse.up({ button: 'right' });
  await quadro();
  // os ticks pela ponte, contando o custo da nevoa enquanto o estado muda
  const custoAndando = await page.evaluate(async () => {
    const ponte = window.__cangaco;
    const q = () => new Promise((r) => window.requestAnimationFrame(() => setTimeout(r, 0)));
    ponte.zerarCusto();
    for (let i = 0; i < 60; i += 1) { ponte.avancar(1); await q(); }
    return JSON.parse(JSON.stringify(ponte.custo.nevoa));
  });
  for (let i = 0; i < 40; i += 1) {
    await page.evaluate(() => window.__cangaco.avancar(25));
    s = await estado();
    const meus = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === escaramuca.tropaDoJogador.tipo);
    if (meus.every((u) => u.fsm === 'ocioso')) break;
  }
  await quadro();
  s = await estado();
  const meus = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === escaramuca.tropaDoJogador.tipo);
  const meioDaTropa = { gx: Math.round(meus.reduce((n, u) => n + u.gx, 0) / meus.length), gy: Math.round(meus.reduce((n, u) => n + u.gy, 0) / meus.length) };
  afirmar(Math.hypot(meioDaTropa.gx - destino.gx, meioDaTropa.gy - destino.gy) < 6, `a tropa deveria ter marchado ate o escuro, esta em ${meioDaTropa.gx},${meioDaTropa.gy}`);
  afirmar(s.nevoa.esmaecidos > 0, `(a) o caminho da marcha fica descoberto e esmaecido: ${JSON.stringify(s.nevoa)}`);
  const iaVisivel = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA && u.visivel);
  const iaEscondida = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA && !u.visivel);
  afirmar(iaVisivel.length > 0 && iaEscondida.length > 0, `(a) a tropa inimiga so onde se ve: ${iaVisivel.length} a vista, ${iaEscondida.length} no escuro`);
  const mm1 = await minimapa();
  const daIAAVista = Object.values(s.prediosDoEstado).filter((p) => p.lado === LADO_DA_IA && p.naVista).length;
  afirmar(mm1.inimigos === daIAAVista, `(b) o minimapa desenha so os ${daIAAVista} predios inimigos a vista, veio ${mm1.inimigos}`);
  resultado.marcha = { tick: s.tick, nevoa: s.nevoa, iaAVista: iaVisivel.length, iaNoEscuro: iaEscondida.length, minimapa: mm1, prediosDaIAAVista: daIAAVista };
  // a camera entre a tropa e a vila da IA: a defesa a vista, o resto da vila no escuro, e o
  // caminho da marcha esmaecido atras
  await camera({ gx: meioDaTropa.gx + 5, gy: meioDaTropa.gy + 3 });
  await capturar('marcha-caminho-descoberto');
  // o meio do trajeto, ja fora da vista de todos: descoberto e esmaecido, sem o preto do nunca visto
  await camera({ gx: Math.round((meio.gx + meioDaTropa.gx) / 2), gy: Math.round((meio.gy + meioDaTropa.gy) / 2) });
  await capturar('caminho-esmaecido');

  resultado.custo = {
    pausado: { ...custoPausado, itensPorQuadro: custoPausado.itens / custoPausado.chamadas, msPorQuadro: custoPausado.ms / custoPausado.chamadas },
    andando: { ...custoAndando, itensPorQuadro: custoAndando.itens / custoAndando.chamadas, msPorQuadro: custoAndando.ms / custoAndando.chamadas },
  };
  afirmar(custoAndando.itens > 0, `(d) andando, a nevoa repinta: ${JSON.stringify(custoAndando)}`);
  fs.mkdirSync(path.join(__dirname, '..', '..', 'test-output'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', '..', 'test-output', 'F-TELA-NEVOA.json'), JSON.stringify(resultado, null, 2));
  console.log(`F-TELA-NEVOA: ${JSON.stringify(resultado.custo)}`);
}

module.exports = { roteiro };
