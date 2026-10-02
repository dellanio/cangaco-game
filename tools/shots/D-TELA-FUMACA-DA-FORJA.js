'use strict';
const { readFileSync } = require('node:fs');
const config = require('../../data/fumaca.json');
const { retanguloDoCanvas, pontoDoTileNaTela, pontoParaApertar } = require('./_canvas');

async function roteiro({ page, estado, afirmar, capturar }) {
  const frame = () => page.waitForTimeout(150);
  await page.evaluate((texto) => window.localStorage.setItem('cangaco:partida', texto),
    readFileSync('test-output/D-TELA-FUMACA-DA-FORJA-save.txt', 'utf8'));
  await page.keyboard.press('h');
  await frame();
  await page.click('#ajuda [data-acao="carregar"]');
  await frame();
  await page.keyboard.press('Escape');
  const canvas = await retanguloDoCanvas(page);
  let s = await estado();
  const forja = s.prediosDoEstado.forja;
  const fundicao = s.prediosDoEstado.fundicao;
  afirmar(forja?.tipo === 'iron_smithy' && fundicao?.tipo === 'metallurgists', 'O save da sim precisa ter as duas oficinas.');
  const camera = { scrollX: ((forja.gx + fundicao.gx) / 2 + 2) * 64 - canvas.width / 2,
    scrollY: ((forja.gy + fundicao.gy) / 2 + 1) * 64 - canvas.height / 2, zoom: 1 };
  await page.evaluate((c) => window.__cangaco.fixarCamera(c), camera);
  await frame();
  for (let n = 0; n < 50; n += 1) {
    await page.evaluate(() => window.__cangaco.avancar(1));
    await frame();
    s = await estado();
    if (s.fumacaPorPredio.forja?.length >= 8 && s.fumacaPorPredio.fundicao?.length >= 8
      && s.fagulhaPorPredio.forja?.length > 0) break;
  }
  afirmar(s.fumacaPorPredio.forja?.length > 0, 'A forja trabalhando precisa de fumaca.');
  afirmar(s.fumacaPorPredio.fundicao?.length > 0, 'A fundicao trabalhando precisa de fumaca.');
  afirmar(s.fagulhaPorPredio.forja?.length > 0, 'A forja trabalhando precisa de fagulha em pulso.');
  afirmar(s.fagulhaPorPredio.fundicao === undefined, 'A fundicao nao declara fogo para fagulha.');
  const contagens = { forja: s.fumacaPorPredio.forja.length, fundicao: s.fumacaPorPredio.fundicao.length,
    fagulha: s.fagulhaPorPredio.forja.length };
  const pools = [s.poolDaFumaca, s.poolDaFagulha];
  await page.mouse.move(canvas.left + 5, canvas.top + 5);
  await frame();
  afirmar((await estado()).particulasCalculadasNesteQuadro === 0, 'Pausa e camera parada precisam de zero calculos por quadro.');
  await capturar('oficinas-trabalhando');
  // Mesma animacao, afastada da vista: nem calculo de particula.
  await page.evaluate(() => window.__cangaco.fixarCamera({ scrollX: 0, scrollY: 0, zoom: 2 }));
  await page.evaluate(() => window.__cangaco.avancar(1));
  await frame();
  s = await estado();
  afirmar(Object.values(s.fumacaPorPredio).every((p) => p.length === 0)
    && Object.values(s.fagulhaPorPredio).every((p) => p.length === 0), 'Fora da vista nao se desenham particulas.');
  await page.evaluate((c) => window.__cangaco.fixarCamera(c), camera);
  await frame();
  s = await estado();
  const ponto = pontoDoTileNaTela(canvas, { gx: forja.gx + 1, gy: forja.gy + 1 }, s.camera, 64);
  await page.mouse.click(ponto.x, ponto.y);
  await frame();
  afirmar(await page.getAttribute('#painel-predio', 'data-predio-aberto') === 'forja', 'O painel deve ser o da forja.');
  const botao = await pontoParaApertar(page, '#painel-predio [data-pausar="true"]');
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'O gesto do painel deve estar despausado.');
  await page.mouse.move(botao.x, botao.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await frame();
  await page.keyboard.press('p');
  await frame();
  s = await estado();
  afirmar(s.pausado && s.prediosDoEstado.forja.pausado, 'O painel precisa pausar a forja.');
  await page.keyboard.press('Escape');
  await page.evaluate((n) => window.__cangaco.avancar(n), config.vidaTicks);
  await frame();
  s = await estado();
  afirmar(s.fumacaPorPredio.forja?.length === 0 && s.fagulhaPorPredio.forja?.length === 0,
    'Apos a vida, fumaca e fagulha da forja devem estar em zero.');
  afirmar(s.fumacaPorPredio.fundicao?.length > 0, 'A fundicao continua trabalhando.');
  afirmar(s.poolDaFumaca === pools[0] && s.poolDaFagulha === pools[1], 'Os pools devem permanecer constantes.');
  await page.mouse.move(canvas.left + 5, canvas.top + 5);
  await frame();
  afirmar((await estado()).particulasCalculadasNesteQuadro === 0, 'Quadro repetido nao recalcula particulas.');
  await capturar('forja-pausada');
  console.log(JSON.stringify({ trabalho: contagens, forjaPausada: { fumaca: 0, fagulha: 0 }, pools,
    vidaFumaca: config.vidaTicks, vidaFagulha: config.fagulha.vidaTicks, calculosPausado: 0 }));
}

module.exports = { roteiro };
