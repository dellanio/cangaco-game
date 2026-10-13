'use strict';
// I-COMBATE-CAMPANHA-JOGADA (aceite 4) — as fases 2 a 10 abrem pela tela: `?campanha=<id>` abre a
// partida com o mapa da fase (a ponte publica o id do mapa e o `fase.id` do estado) e a linha do
// objetivo visivel. Uma captura por fase, e a prancha das nove numa pagina so, capturada no fim.
const { readFileSync } = require('node:fs');
const { URL } = require('node:url');

const IDS = [
  'fase-02-patos', 'fase-03-soledade', 'fase-04-boqueirao', 'fase-05-campina-grande', 'fase-06-areia',
  'fase-07-itabaiana', 'fase-08-santa-rita', 'fase-09-joao-pessoa', 'fase-10-cabedelo',
];
const TIMEOUT_PRONTO_MS = 15_000;

async function roteiro({ page, capturar, afirmar }) {
  const capturas = [];
  const origem = new URL(page.url()).origin;
  // a pagina do shot.js solta o jogo dela (e o WebGL) antes das abas das fases; volta so para a prancha
  await page.goto('about:blank');
  // cada fase numa PAGINA NOVA, fechada no fim: recarregar a mesma pagina acumula contextos WebGL, e a
  // terceira ou quarta fase falhava (net::ERR_INSUFFICIENT_RESOURCES, depois "Framebuffer status:
  // Incomplete Attachment"); cada fase sozinha abre sem erro. A pagina nova nao passa pelo coletor de
  // erros do shot.js: o roteiro junta os dela e afirma que estao vazios
  for (const [i, id] of IDS.entries()) {
    // o shot.js abre a pagina com `browser.newPage` (um contexto so dela): a aba nova vem do navegador
    const aba = await page.context().browser().newPage({ viewport: page.viewportSize() || { width: 1280, height: 720 } });
    const erros = [];
    aba.on('pageerror', (e) => { erros.push(String(e)); });
    aba.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });
    aba.on('response', (r) => { if (r.status() >= 400) erros.push(`${r.status()} ${r.url()}`); });
    const url = new URL(origem);
    url.searchParams.set('pausado', '');
    url.searchParams.set('campanha', id);
    await aba.goto(url.href);
    const pronto = await aba.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS })
      .then(() => true, () => false);
    afirmar(pronto, `${id}: o jogo nao ficou pronto; erros da pagina: ${erros.join(' | ')}`);
    const visto = await aba.evaluate(() => {
      const e = window.document.querySelector('#objetivo-da-fase');
      return {
        mapa: window.__cangacoPartida.mapa().id,
        fase: JSON.parse(window.__cangacoPartida.estadoSerializado()).fase,
        objetivo: e === null ? null : { hidden: e.hidden, texto: (e.textContent || '').trim() },
      };
    });
    afirmar(visto.mapa === id, `${id}: o mapa deveria ser o da fase: ${visto.mapa}`);
    afirmar(visto.fase && visto.fase.id === id, `${id}: o estado deveria ser da fase: ${JSON.stringify(visto.fase)}`);
    afirmar(visto.objetivo !== null && !visto.objetivo.hidden && visto.objetivo.texto.length > 0,
      `${id}: a linha do objetivo deveria aparecer: ${JSON.stringify(visto.objetivo)}`);
    // os dois quadros desenhados antes da imagem, como o capturar do shot.js
    await aba.evaluate(() => new Promise((ok) => window.requestAnimationFrame(() => window.requestAnimationFrame(ok))));
    const arquivo = `screenshots/I-COMBATE-CAMPANHA-JOGADA-fase-${i + 2}-${id}.png`;
    await aba.screenshot({ path: arquivo });
    afirmar(erros.length === 0, `${id}: erro de console ou de pagina: ${erros.join(' | ')}`);
    capturas.push({ id, objetivo: visto.objetivo.texto, arquivo });
    await aba.context().close();
  }

  // a prancha: as nove capturas numa grade 3x3, na mesma pagina
  const celulas = capturas.map((c) => {
    const b64 = readFileSync(c.arquivo).toString('base64');
    return `<figure><img src="data:image/png;base64,${b64}"><figcaption>${c.id} — ${c.objetivo}</figcaption></figure>`;
  }).join('');
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#1d1a16;color:#eee;font:13px sans-serif}
    main{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px}
    figure{margin:0} img{width:100%;display:block} figcaption{padding:2px 4px}
  </style><main>${celulas}</main>`);
  await capturar('prancha');
}

module.exports = { roteiro };
