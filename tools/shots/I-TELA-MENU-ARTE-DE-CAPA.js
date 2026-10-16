'use strict';
// Roteiro da I-TELA-MENU-ARTE-DE-CAPA — a capa da tela inicial em seis resolucoes.
//   (3) em cada resolucao: a capa carregou e cobre a janela; a caixa cabe inteira; cada botao da tela
//       principal esta visivel e e o elemento do ponto central dele; a pagina nao rola. Uma captura cada.
//   (4) em 1280x720, a tela Novo jogo e a da Campanha: a caixa cabe na janela (rola por dentro, se preciso).
const { URL } = require('node:url');

const TIMEOUT_MENU_MS = 10_000;
const RESOLUCOES = [[1024, 768], [1280, 720], [1366, 768], [1920, 1080], [2560, 1440], [3440, 1440]];

async function roteiro({ page, capturar, afirmar }) {
  const base = new URL('/', page.url()).href;

  async function abrirMenu() {
    await page.goto(base);
    await page.evaluate(() => window.localStorage.clear());
    await page.goto(base);
    await page.waitForSelector('#menu-inicial .caixa', { timeout: TIMEOUT_MENU_MS });
    await page.waitForTimeout(200);
  }

  /** A caixa inteira dentro da janela, e a pagina sem rolagem. */
  const medirCaixa = () => page.evaluate(() => {
    const r = window.document.querySelector('#menu-inicial .caixa').getBoundingClientRect();
    const d = window.document.documentElement;
    return {
      caixa: { x: r.left, y: r.top, d: r.right, b: r.bottom },
      janela: { l: window.innerWidth, a: window.innerHeight },
      rolaPagina: d.scrollHeight > d.clientHeight || d.scrollWidth > d.clientWidth,
    };
  });
  const cabe = (m) => m.caixa.x >= 0 && m.caixa.y >= 0 && m.caixa.d <= m.janela.l && m.caixa.b <= m.janela.a;

  // a capa: o arquivo carrega, e o fundo e `cover`
  const capa = await page.evaluate(async (url) => {
    const img = new window.Image();
    img.src = url;
    try { await img.decode(); } catch { return { largura: 0 }; }
    return { largura: img.naturalWidth, altura: img.naturalHeight };
  }, new URL('/assets/sprites/ui/menu/capa.jpg', base).href);
  afirmar(capa.largura > 0, `a capa carrega: ${JSON.stringify(capa)}`);

  const medidas = [];
  for (const [l, a] of RESOLUCOES) {
    await page.setViewportSize({ width: l, height: a });
    await abrirMenu();
    const fundo = await page.evaluate(() => {
      const el = window.document.querySelector('#menu-inicial');
      const cs = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { imagem: cs.backgroundImage, tamanho: cs.backgroundSize, area: { l: r.width, a: r.height } };
    });
    afirmar(fundo.imagem.includes('capa.jpg') && fundo.tamanho.includes('cover'), `${l}x${a}: o fundo e a capa em cover: ${JSON.stringify(fundo)}`);
    afirmar(Math.round(fundo.area.l) === l && Math.round(fundo.area.a) === a, `${l}x${a}: o menu cobre a janela inteira: ${JSON.stringify(fundo.area)}`);
    const m = await medirCaixa();
    afirmar(cabe(m), `${l}x${a}: a caixa cabe na janela: ${JSON.stringify(m)}`);
    afirmar(!m.rolaPagina, `${l}x${a}: a pagina nao rola`);
    const botoes = await page.$$eval('#menu-inicial .opcoes:not([hidden]) button', (bs) => bs.map((b) => {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const noPonto = window.document.elementFromPoint(cx, cy);
      return { acao: b.dataset.acao, visivel: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight, alcancado: noPonto === b || b.contains(noPonto) };
    }));
    afirmar(botoes.length >= 5, `${l}x${a}: os botoes da tela principal: ${JSON.stringify(botoes)}`);
    for (const b of botoes) afirmar(b.visivel && b.alcancado, `${l}x${a}: o botao '${b.acao}' visivel e alcancavel: ${JSON.stringify(b)}`);
    medidas.push({ resolucao: `${l}x${a}`, caixa: m.caixa, botoes: botoes.map((b) => b.acao) });
    await capturar(`${l}x${a}`);
  }

  // (4) as telas internas em 1280x720
  await page.setViewportSize({ width: 1280, height: 720 });
  await abrirMenu();
  await page.click('#menu-inicial button[data-acao="novo"]');
  await page.waitForTimeout(150);
  const mNovo = await medirCaixa();
  afirmar(cabe(mNovo) && !mNovo.rolaPagina, `Novo jogo em 1280x720 cabe: ${JSON.stringify(mNovo)}`);
  await capturar('novo-jogo');
  await page.click('#menu-inicial button[data-acao="campanha"]');
  await page.waitForSelector('#menu-inicial [data-tela="campanha"]:not([hidden])');
  await page.waitForTimeout(150);
  const mCamp = await medirCaixa();
  afirmar(cabe(mCamp) && !mCamp.rolaPagina, `Campanha em 1280x720 cabe: ${JSON.stringify(mCamp)}`);
  await capturar('campanha');

  console.log(`[I-TELA-MENU-ARTE-DE-CAPA] capa ${capa.largura}x${capa.altura}; ${JSON.stringify(medidas)}`);
}

module.exports = { roteiro };
