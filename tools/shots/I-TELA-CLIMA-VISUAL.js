'use strict';
// I-TELA-CLIMA-VISUAL e I-TELA-RELOGIO-DO-SOL: o mesmo trecho da vila no inverno (a chuva e o veu
// esverdeado) e na seca (o calor e o veu ocre). O relogio do sol acompanha a estacao do estado, e o
// jornal traz a noticia "A seca vem aí". Os ticks das fases saem do dado (data/clima.json), divididos
// pela escala como faz o carregador.
const clima = require('../../data/clima.json');
const tempo = require('../../data/time.json');
const tema = require('../../data/theme-sertao.json');

const tickHz = tempo.tickHz;
const escala = tempo.escalas[clima.escala];
const ticksDe = (i) => Math.round((clima.ciclo[i].duracao_segundos_base / escala) * tickHz);
const inicioDe = (i) => clima.ciclo.slice(0, i).reduce((s, _f, k) => s + ticksDe(k), 0);

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperar = (ms = 400) => page.waitForTimeout(ms);
  const relogio = () => page.$eval('#relogio-do-sol', (n) => ({ hidden: n.hidden, estacao: n.dataset.estacao, angulo: Number(n.dataset.angulo), legenda: n.querySelector('.legenda')?.textContent ?? '' }));
  const tickAgora = () => page.evaluate(() => window.__cangaco.tick);
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

  // a seca
  await avancarAte(inicioDe(2) + Math.floor(ticksDe(2) / 2));
  await esperar();
  s = await estado();
  r = await relogio();
  afirmar(r.estacao === 'seca' && r.angulo > 180 && r.angulo < 270, `o relogio deveria dizer seca, no terceiro setor: ${JSON.stringify(r)}`);
  afirmar(s.clima && s.clima.estacao === 'seca' && s.clima.gotas === 0 && s.clima.calor > 0, `na seca nao chove e o calor sobe: ${JSON.stringify(s.clima)}`);
  // o jornal avisou a seca
  const manchetes = await page.evaluate(() => {
    window.document.getElementById('jornal-icone').click();
    return [...window.document.querySelectorAll('#jornal h2')].map((h) => h.textContent);
  });
  afirmar(manchetes.includes(tema.jornal.noticias['estacao:transicaoSeca'].manchete) && manchetes.includes(tema.jornal.noticias['estacao:seca'].manchete),
    `o jornal deveria ter as noticias da seca: ${JSON.stringify(manchetes)}`);
  await page.evaluate(() => window.document.querySelector('#jornal .fechar').click());
  await esperar();
  console.log(`I-TELA-CLIMA-VISUAL — seca no tick ${await tickAgora()}: ${JSON.stringify(s.clima)}; relogio ${JSON.stringify(r)}`);
  await capturar('seca');
}
module.exports = { roteiro };
