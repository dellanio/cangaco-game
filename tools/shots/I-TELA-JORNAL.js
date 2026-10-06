'use strict';
// I-TELA-JORNAL: o jornal das noticias importantes. Na escaramuca, o relogio anda ate a tropa do
// jogador entrar em alerta de fome (a sonda da sessao: a paz acaba no tick 6 000 e a fome chega no
// 11 700). O icone aparece no canto inferior esquerdo da area do jogo, com a marca de nao lida. Com
// o jogo ANDANDO (§8), o roteiro aperta o icone (down, 150 ms, up): o jornal abre no meio, so com a
// manchete da fome (I-TELA-JORNAL-SO-A-ULTIMA). O X fecha, e o icone some.
const tema = require('../../data/theme-sertao.json');

const TETO = 14000;
const PASSO = 500;

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperarFrame = () => page.waitForTimeout(200);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const lerIcone = () => page.$eval('#jornal-icone', (n) => {
    const r = n.getBoundingClientRect();
    return { hidden: n.hidden, naoLidas: Number(n.dataset.naoLidas ?? '0'), classe: n.className, x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const comFome = () => page.$$eval('#jornal .noticia', (ns) => ns.map((n) => n.dataset.chave));
  afirmar((await lerIcone()).hidden, 'sem noticia, o icone do jornal nao aparece');

  // o relogio ate a fome da tropa: a noticia so entra na lista quando o jornal ve o evento
  let ticks = 0;
  let icone = await lerIcone();
  const manchete = tema.jornal.noticias.tropaComFome.manchete;
  while (ticks < TETO) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    ticks += PASSO;
    await esperarFrame();
    icone = await lerIcone();
    if (!icone.hidden && icone.naoLidas >= 2) break;
  }
  afirmar(!icone.hidden && icone.naoLidas >= 2 && icone.classe.includes('nao-lida'),
    `o icone deveria aparecer com duas noticias nao lidas (com as estacoes, nem sempre a paz e a fome) ate ${TETO} ticks: ${JSON.stringify(icone)}`);

  // o icone fica no canto inferior esquerdo da area do jogo
  const canvas = await page.$eval('#jogo canvas', (c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  afirmar(icone.x - canvas.x <= 30 && canvas.y + canvas.h - (icone.y + icone.h) <= 30,
    `o icone deveria estar no canto inferior esquerdo do jogo: ${JSON.stringify({ icone, canvas })}`);
  await capturar('icone');

  // o aperto com o jogo ANDANDO (§8)
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o aperto do icone vale com o laco ANDANDO');
  const meio = { x: icone.x + icone.w / 2, y: icone.y + icone.h / 2 };
  await page.mouse.move(meio.x, meio.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro segue pausado depois do passo despausado');

  const folha = await page.$eval('#jornal', (n) => {
    const p = n.querySelector('.papel');
    const r = p ? p.getBoundingClientRect() : null;
    return { hidden: n.hidden, caixa: r && { x: r.x, y: r.y, w: r.width, h: r.height }, manchetes: [...n.querySelectorAll('h2')].map((h) => h.textContent) };
  });
  afirmar(!folha.hidden && folha.caixa !== null, `o jornal deveria abrir: ${JSON.stringify(folha)}`);
  // I-TELA-JORNAL-SO-A-ULTIMA: so a ultima noticia (a da fome); a do fim da paz saiu
  // (com as estacoes, a ultima pode ser a da estacao: a fome e a ultima so se chegou depois dela)
  const chaves = await comFome();
  afirmar(chaves.length === 1 && folha.manchetes.length === 1, `o jornal deveria mostrar so a ultima noticia: ${JSON.stringify(chaves)}`);
  void manchete;
  const vista = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const centro = { x: folha.caixa.x + folha.caixa.w / 2, y: folha.caixa.y + folha.caixa.h / 2 };
  afirmar(Math.abs(centro.x - vista.w / 2) <= 40 && Math.abs(centro.y - vista.h / 2) <= 40,
    `o jornal deveria estar no meio da tela: ${JSON.stringify({ centro, vista })}`);
  const depoisDeAbrir = await lerIcone();
  afirmar(depoisDeAbrir.naoLidas === 0 && !depoisDeAbrir.classe.includes('nao-lida'), `abrir marca tudo como lido: ${JSON.stringify(depoisDeAbrir)}`);
  console.log(`I-TELA-JORNAL — duas noticias no tick ~${ticks}; manchetes ${JSON.stringify(folha.manchetes)}; papel ${JSON.stringify(folha.caixa)}`);
  await capturar('jornal-aberto');

  // o X fecha
  const x = await page.$eval('#jornal .fechar', (b) => { const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(x.x, x.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  afirmar(await page.$eval('#jornal', (n) => n.hidden), 'o X deveria fechar o jornal');
  // I-TELA-JORNAL-SO-A-ULTIMA: fechado, o icone some do canto
  afirmar((await lerIcone()).hidden, 'ao fechar o jornal, o icone deveria sumir');
  await capturar('jornal-fechado');

  // a noticia seguinte traz o icone de volta, e o jornal continua com uma so, a nova
  const horaDaPrimeira = await page.$eval('#jornal .hora', (n) => n.textContent);
  let voltou = false;
  for (let k = 0; k < 40 && !voltou; k++) {
    await page.evaluate((n) => window.__cangaco.avancar(n), PASSO);
    await esperarFrame();
    voltou = !(await lerIcone()).hidden;
  }
  afirmar(voltou, 'uma noticia nova deveria trazer o icone de volta');
  await page.click('#jornal-icone');
  await esperarFrame();
  const segunda = await page.$$eval('#jornal .noticia .hora', (ns) => ns.map((n) => n.textContent));
  afirmar(segunda.length === 1 && segunda[0] !== horaDaPrimeira, `o jornal deveria trocar a noticia pela nova: ${JSON.stringify({ horaDaPrimeira, segunda })}`);
}
module.exports = { roteiro };
