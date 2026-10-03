'use strict';
const { readFileSync, writeFileSync } = require('node:fs');
const { URL } = require('node:url');
const { retanguloDoCanvas, pontoParaApertar } = require('./_canvas');

async function roteiro({ page, estado, afirmar, capturar }) {
  let liberar;
  let pedidos = 0;
  let espera = new Promise(resolve => { liberar = resolve; });
  await page.route('**/assets/depuracao/militia/militia.png*', async route => {
    if (new URL(route.request().url()).searchParams.has('import')) {
      await route.continue();
      return;
    }
    pedidos++;
    await espera;
    await route.continue();
  });
  try {
    await page.goto(new URL('/?pausado&depuracao=militia', page.url()).href);
    await page.waitForFunction(() => window.__cangaco?.pronto);
    afirmar(pedidos === 0, 'militia ausente nao deve carregar PNG na abertura');
    const carregar = async () => {
      await page.evaluate(texto => window.localStorage.setItem('cangaco:partida', texto), readFileSync('test-output/D-TELA-05d-inicio.save.txt', 'utf8'));
      await page.keyboard.press('h');
      await page.click('#ajuda [data-acao="carregar"]');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !!window.__cangaco.prediosDoEstado['quartel-carga']);
    };
    await carregar();
    afirmar(pedidos === 0, 'load sem militar tambem nao carrega militia');
    let s = await estado();
    const q = s.prediosDoEstado['quartel-carga'];
    const canvas = await retanguloDoCanvas(page);
    await page.evaluate(cam => window.__cangaco.fixarCamera(cam), { scrollX: (q.gx + 1) * 64 - canvas.width / 2, scrollY: (q.gy + 1) * 64 - canvas.height / 2 });
    await page.waitForTimeout(100);
    s = await estado();
    await page.mouse.click(canvas.left + (q.gx + 1) * 64 - s.camera.scrollX, canvas.top + (q.gy + 1) * 64 - s.camera.scrollY);
    await page.waitForSelector('#painel-predio button.formar[data-tipo="militia"]');
    const ponto = await pontoParaApertar(page, '#painel-predio button.formar[data-tipo="militia"]');
    await page.keyboard.press('p');
    await page.mouse.move(ponto.x, ponto.y); await page.mouse.down();
    await page.waitForTimeout(150); await page.mouse.up();
    await page.waitForFunction(() => window.__cangaco.unidadesRenderizadas.some(u => u.tipo === 'militia'));
    await page.keyboard.press('p');
    await page.waitForTimeout(150);
    await page.waitForFunction(() => Object.entries(window.__cangaco.cargasDeUnidade)
      .every(([chave, carga]) => chave === 'unidade:militia:atlas' || carga.estado !== 'em-curso'));
    s = await estado();
    const antes = s.memoriaDeTexturas;
    const tick = s.tick;
    afirmar(pedidos === 1, 'treino deve pedir PNG exatamente uma vez');
    afirmar(s.cargasDeUnidade['unidade:militia:atlas']?.estado === 'em-curso', 'PNG deve estar em curso');
    afirmar(!s.unidadesRenderizadas.find(u => u.tipo === 'militia').frame, 'militar deve usar fallback enquanto atlas espera');
    await capturar('placeholder-durante-carga');
    liberar();
    await page.waitForFunction(() => window.__cangaco.unidadesRenderizadas.some(u => u.tipo === 'militia' && u.frame));
    s = await estado();
    afirmar(s.tick === tick, 'conclusao invalida render no mesmo tick pausado');
    afirmar(s.cargasDeUnidade['unidade:militia:atlas']?.estado === 'carregada', 'atlas pronto');
    afirmar(pedidos === 1, 'nao repetir requisicao');
    const png = readFileSync('assets/depuracao/militia/militia.png');
    const bytesEsperados = png.readUInt32BE(16) * png.readUInt32BE(20) * 4;
    afirmar(s.memoriaDeTexturas - antes === bytesEsperados, 'delta RGBA8 corresponde ao atlas carregado');
    await capturar('atlas-pronto-pausado');
    const depois = s.memoriaDeTexturas;
    await carregar();
    await page.waitForFunction(() => !window.__cangaco.unidadesRenderizadas.some(u => u.tipo === 'militia'));
    afirmar(pedidos === 1, 'load reaproveita textura sem recriar soldado');
    espera = new Promise(resolve => { liberar = resolve; });
    await page.goto(new URL('/?pausado&depuracao=militia', page.url()).href);
    await page.waitForFunction(() => window.__cangaco?.pronto);
    await page.evaluate(texto => window.localStorage.setItem('cangaco:partida', texto), readFileSync('test-output/D-TELA-05d-treino.save.txt', 'utf8'));
    await page.keyboard.press('h'); await page.click('#ajuda [data-acao="carregar"]'); await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__cangaco.cargasDeUnidade['unidade:militia:atlas']?.estado === 'em-curso');
    await carregar();
    await page.waitForFunction(() => !window.__cangaco.unidadesRenderizadas.some(u => u.tipo === 'militia'));
    liberar();
    await page.waitForFunction(() => window.__cangaco.cargasDeUnidade['unidade:militia:atlas']?.estado === 'carregada');
    afirmar(!(await estado()).unidadesRenderizadas.some(u => u.tipo === 'militia'), 'resposta da partida anterior nao ressuscita unidade');
    afirmar(pedidos === 2, 'segunda cena faz uma unica nova carga');
    writeFileSync('test-output/D-TELA-05d-roteiro.json', JSON.stringify({ pedidos, tick, antes, depois, bytesEsperados, carga: s.cargasDeUnidade, respostaObsoleta: 'nao recriou unidade' }, null, 2));
  } finally { liberar(); }
}
module.exports = { roteiro };
