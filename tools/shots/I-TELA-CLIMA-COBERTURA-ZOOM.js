'use strict';
// I-TELA-CLIMA-VISUAL e I-TELA-RELOGIO-DO-SOL: o mesmo trecho da vila no inverno (a chuva e o veu
// esverdeado) e na seca (o calor e o veu ocre). O relogio do sol acompanha a estacao do estado, e o
// jornal traz a noticia "A seca vem aí". Os ticks das fases saem do dado (data/clima.json), divididos
// pela escala como faz o carregador.
const clima = require('../../data/clima.json');
const tempo = require('../../data/time.json');
const tema = require('../../data/theme-sertao.json');
const terreno = require('../../data/terrain.json');

const tickHz = tempo.tickHz;
const escala = tempo.escalas[clima.escala];
const ticksDe = (i) => Math.round((clima.ciclo[i].duracao_segundos_base / escala) * tickHz);
const inicioDe = (i) => clima.ciclo.slice(0, i).reduce((s, _f, k) => s + ticksDe(k), 0);

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperar = (ms = 400) => page.waitForTimeout(ms);
  const relogio = () => page.$eval('#relogio-do-sol', (n) => ({ hidden: n.hidden, estacao: n.dataset.estacao, angulo: Number(n.dataset.angulo), legenda: n.querySelector('.legenda')?.textContent ?? '' }));
  const tickAgora = () => page.evaluate(() => window.__cangaco.tick);
  const conferirNoticia = async (estacao) => {
    afirmar(await page.$eval('#jornal-icone', (n) => !n.hidden), `nova notícia mostra ícone: ${estacao}`);
    await page.locator('#jornal-icone').click();
    const noticias = await page.locator('#jornal .noticia').evaluateAll((ns) => ns.map((n) => ({
      chave: n.dataset.chave, manchete: n.querySelector('h2')?.textContent,
    })));
    afirmar(noticias.length === 1 && noticias[0].chave === `estacao:${estacao}`
      && noticias[0].manchete === tema.jornal.noticias[`estacao:${estacao}`].manchete,
    `jornal mostra só a última notícia, ${estacao}: ${JSON.stringify(noticias)}`);
    await capturar(`jornal-${estacao}`);
    await page.locator('#jornal .fechar').click();
    afirmar(await page.$eval('#jornal-icone', (n) => n.hidden), 'fechar jornal esconde ícone');
  };
  const conferirZooms = async (estacao, rotulo = estacao) => {
    const tickPausado = await tickAgora();
    const canvas = await page.locator('#jogo canvas').boundingBox();
    afirmar(canvas !== null, 'canvas presente');
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    const inicial = await estado();
    await page.evaluate(({ scrollX, scrollY }) => window.__cangaco.fixarCamera({
      scrollX: scrollX + 64, scrollY: scrollY + 64,
    }), inicial.camera);
    for (const zoom of terreno.zoom.niveis) {
      let s = await estado();
      for (let tentativa = 0; s.camera.zoom !== zoom && tentativa < 12; tentativa++) {
        await page.mouse.wheel(0, s.camera.zoom < zoom ? -120 : 120);
        await esperar(150);
        s = await estado();
      }
      afirmar(s.camera.zoom === zoom, `zoom ${zoom}: ${JSON.stringify(s.camera)}`);
      afirmar(await tickAgora() === tickPausado, 'trocar zoom não avança simulação pausada');
      afirmar(s.clima?.estacao === estacao, `estação preservada: ${estacao}`);
      const { limites, vista } = s.clima;
      for (const eixo of ['x', 'y', 'largura', 'altura']) {
        afirmar(Math.abs(limites[eixo] - vista[eixo]) < 0.01,
          `clima cobre ${eixo} no zoom ${zoom}: ${JSON.stringify(s.clima)}`);
      }
      if (zoom !== 1) await capturar(`${rotulo}-zoom-${zoom}`);
    }
  };
  const avancarAte = async (alvo) => {
    let t = await tickAgora();
    afirmar(typeof t === 'number', `a ponte deveria publicar o tick: ${t}`);
    while (t < alvo) {
      await page.evaluate((k) => window.__cangaco.avancar(k), Math.min(500, alvo - t));
      await esperar(150);
      t = await tickAgora();
    }
  };

  // o meio do inverno
  await avancarAte(Math.floor(ticksDe(0) / 2));
  await esperar();
  let s = await estado();
  let r = await relogio();
  afirmar(!r.hidden && r.estacao === 'inverno' && r.legenda.includes(tema.clima.estacoes.inverno), `o relogio deveria dizer inverno: ${JSON.stringify(r)}`);
  afirmar(r.angulo > 0 && r.angulo < 90, `no meio do inverno o ponteiro fica no primeiro setor: ${JSON.stringify(r)} no tick ${await tickAgora()}`);
  afirmar(s.clima && s.clima.estacao === 'inverno' && s.clima.gotas > 0 && s.clima.calor === 0, `no inverno chove: ${JSON.stringify(s.clima)}`);
  await capturar('inverno');
  await conferirZooms('inverno');
  await avancarAte(inicioDe(1));
  await conferirNoticia('transicaoSeca');

  // a seca
  await avancarAte(inicioDe(2) + Math.floor(ticksDe(2) / 2));
  await esperar();
  s = await estado();
  r = await relogio();
  afirmar(r.estacao === 'seca' && r.angulo > 180 && r.angulo < 270, `o relogio deveria dizer seca, no terceiro setor: ${JSON.stringify(r)}`);
  afirmar(s.clima && s.clima.estacao === 'seca' && s.clima.gotas === 0 && s.clima.calor > 0, `na seca nao chove e o calor sobe: ${JSON.stringify(s.clima)}`);
  await conferirZooms('seca');
  // o jornal avisou a seca
  await conferirNoticia('seca');
  await esperar();
  console.log(`I-TELA-CLIMA-VISUAL — seca no tick ${await tickAgora()}: ${JSON.stringify(s.clima)}; relogio ${JSON.stringify(r)}`);
  await capturar('seca');
  await page.setViewportSize({ width: 1024, height: 768 });
  await esperar();
  await conferirZooms('seca','seca-resize');
}
module.exports = { roteiro };
