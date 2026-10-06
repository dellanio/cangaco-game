'use strict';
// I-TELA-TRILHA-SONORA: a trilha sonora tocando em jogo, e o player da aba Opcoes. Com o gesto do
// jogador (o navegador so libera som depois dele) e o jogo ANDANDO (CLAUDE.md §8), confere:
// - a primeira faixa da playlist toca (o elemento dela nao pausado, o tempo andando);
// - passar troca o nome e a faixa que toca;
// - pausar deixa o audio da trilha pausado, e continuar o retoma;
// - o deslizador do volume da musica muda o volume do audio da trilha.
const som = require('../../data/som.json');
const tema = require('../../data/theme-sertao.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperar = (ms = 300) => page.waitForTimeout(ms);
  const trilha = () => page.evaluate(() => window.__cangacoSom.trilha());
  const doPlayer = () => page.evaluate(() => ({
    nome: window.document.querySelector('#player-da-trilha .faixa')?.textContent ?? '',
    faixa: window.document.querySelector('#player-da-trilha .faixa')?.dataset.faixa ?? '',
    pausa: window.document.querySelector('#player-da-trilha [data-trilha="pausa"]')?.getAttribute('aria-pressed'),
  }));
  const apertar = async (seletor) => {
    const r = await page.$eval(seletor, (n) => { const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(r.x, r.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await esperar();
  };

  // o gesto, a aba Opcoes, e o jogo andando
  await page.mouse.click(700, 400);
  await page.click('#abas [data-aba="opcoes"]');
  await page.keyboard.press('p');
  await esperar(1500);
  afirmar((await estado()).pausado === false, 'o player se exerce com o laco ANDANDO');

  const [primeira, segunda] = som.musica.playlist;
  let t = await trilha();
  afirmar(t[primeira]?.tocando === true, `a primeira faixa (${primeira}) deveria estar tocando: ${JSON.stringify(t)}`);
  const tempo0 = t[primeira].tempo;
  await esperar(1000);
  t = await trilha();
  afirmar(t[primeira].tempo > tempo0, `o tempo da faixa deveria andar: ${tempo0} -> ${t[primeira].tempo}`);
  let p = await doPlayer();
  afirmar(p.faixa === primeira && p.nome.includes(tema.trilha.faixas[primeira]), `o player deveria mostrar a primeira faixa: ${JSON.stringify(p)}`);
  await capturar('player');

  // passar
  await apertar('#player-da-trilha [data-trilha="passar"]');
  await esperar(500);
  t = await trilha();
  p = await doPlayer();
  afirmar(p.faixa === segunda && t[segunda]?.tocando === true && t[primeira]?.tocando === false,
    `passar deveria tocar a segunda e parar a primeira: ${JSON.stringify({ p, t })}`);

  // pausar e continuar
  await apertar('#player-da-trilha [data-trilha="pausa"]');
  await esperar(500);
  t = await trilha();
  afirmar(t[segunda].tocando === false && (await doPlayer()).pausa === 'true', `pausar deveria parar a faixa: ${JSON.stringify(t)}`);
  const pontoDaPausa = t[segunda].tempo;
  await apertar('#player-da-trilha [data-trilha="pausa"]');
  await esperar(800);
  t = await trilha();
  afirmar(t[segunda].tocando === true && t[segunda].tempo >= pontoDaPausa, `continuar deveria retomar do ponto: ${JSON.stringify(t)}`);

  // o volume da musica
  const volumeAntes = t[segunda].volume;
  await page.$eval('#player-da-trilha input[data-volume="musica"]', (e) => { e.value = '10'; e.dispatchEvent(new window.Event('input', { bubbles: true })); });
  await esperar(500);
  t = await trilha();
  afirmar(t[segunda].volume < volumeAntes, `o deslizador da musica deveria baixar o volume da faixa: ${volumeAntes} -> ${t[segunda].volume}`);
  await page.$eval('#player-da-trilha input[data-volume="musica"]', (e) => { e.value = '50'; e.dispatchEvent(new window.Event('input', { bubbles: true })); });

  await page.keyboard.press('p');
  await esperar();
  console.log(`I-TELA-TRILHA-SONORA — ${JSON.stringify(await trilha())}`);
  await capturar('player-segunda-faixa');
}
module.exports = { roteiro };
