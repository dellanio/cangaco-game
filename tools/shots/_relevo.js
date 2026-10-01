'use strict';
// D-TELA-LUZ-RELEVO — o que os roteiros do relevo precisam para medir PIXEL com e sem a luz.
//
// Comparar duas cargas da pagina so vale com a MESMA camera nas duas: o zoom anda em passos
// discretos pela roda, e o clique no minimapa centra num tile (D-TELA-02). Os dois gestos sao
// deterministicos, entao a mesma sequencia da a mesma camera. A luminancia e lida no navegador,
// decodificando a captura (sem dependencia nova).

const altura = require('../../data/maps/sertao-128.relevo.json');
const mapa = require('../../data/maps/sertao-128.json');

const DIGITOS = '0123456789abcdefghijklmnopqrstuvwxyz';
const TETO_PRONTO_MS = 10_000;

/** A altura do vertice, presa na borda. */
const h = (vx, vy) => DIGITOS.indexOf(
  altura.linhas[Math.max(0, Math.min(altura.altura - 1, vy))][Math.max(0, Math.min(altura.largura - 1, vx))],
);
const tipoDo = (gx, gy) => mapa.legenda[mapa.linhas[gy][gx]];

/** Quanto o tile desce para o sul nos 4 cantos: > 0 e encosta de LUZ, < 0 de sombra. */
const descidaParaOSul = (gx, gy) => {
  let g = 0;
  for (const [vx, vy] of [[gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1]]) g += h(vx, vy - 1) - h(vx, vy + 1);
  return g;
};

/** Recarrega com `?pausado` + a busca e espera a cena. */
async function abrir({ page, estado, afirmar }, busca) {
  const base = page.url().split('?')[0];
  await page.goto(`${base}?pausado${busca}`);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TETO_PRONTO_MS });
  const s = await estado();
  afirmar(s.tick === 0, `a pagina ${busca || '(sem relevo)'} deveria nascer no tick 0, veio ${s.tick}`);
}

/** A roda no centro do canvas ate o zoom pedido (so afasta). */
async function aoZoom({ page, estado, afirmar }, canvas, zoom) {
  await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
  for (let i = 0; i < 6 && (await estado()).camera.zoom > zoom; i += 1) {
    await page.mouse.wheel(0, 100);
    await page.waitForTimeout(200);
  }
  const { camera } = await estado();
  afirmar(camera.zoom === zoom, `a camera deveria estar a zoom ${zoom}, veio ${camera.zoom}`);
  return camera;
}

/** Centra a camera no tile pelo minimapa: despausado e segurado 150 ms (§8), como no D-TELA-02. */
async function irAoTile({ page, estado }, tile) {
  const mm = await page.evaluate(() => {
    const c = window.document.querySelector('#minimapa canvas.mapa');
    const r = c.getBoundingClientRect();
    return { left: r.left, top: r.top, pxPorTile: Number(c.dataset.pxPorTile), x0: Number(c.dataset.x0), y0: Number(c.dataset.y0) };
  });
  const x = mm.left + 2 + mm.x0 + (tile.gx + 0.5) * mm.pxPorTile;
  const y = mm.top + 2 + mm.y0 + (tile.gy + 0.5) * mm.pxPorTile;
  await page.keyboard.press('p');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  return (await estado()).camera;
}

/** O retangulo de TELA (px da pagina) de um retangulo de MUNDO, para dentro em px inteiros. */
function retDoMundo(canvas, camera, x0, y0, x1, y1) {
  const meioX = canvas.width / 2;
  const meioY = canvas.height / 2;
  const tela = (mx, my) => ({
    x: canvas.left + (mx - camera.scrollX - meioX) * camera.zoom + meioX,
    y: canvas.top + (my - camera.scrollY - meioY) * camera.zoom + meioY,
  });
  const a = tela(x0, y0);
  const b = tela(x1, y1);
  const x = Math.ceil(a.x) + 1;
  const y = Math.ceil(a.y) + 1;
  return { x, y, w: Math.floor(b.x) - 1 - x, h: Math.floor(b.y) - 1 - y };
}

const foto = async (page) => (await page.screenshot({ type: 'png' })).toString('base64');

/** A luminancia media (Rec. 709, 0-255) de cada retangulo em cada foto: `[foto][ret]`. */
async function luminancias(page, fotos, rets) {
  return page.evaluate(async ({ fotos, rets }) => {
    const ler = async (b64) => {
      const img = new window.Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = window.document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      return g;
    };
    const saida = [];
    for (const b64 of fotos) {
      const g = await ler(b64);
      saida.push(rets.map((r) => {
        const d = g.getImageData(r.x, r.y, Math.max(1, r.w), Math.max(1, r.h)).data;
        let soma = 0;
        for (let i = 0; i < d.length; i += 4) soma += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        return soma / (d.length / 4);
      }));
    }
    return saida;
  }, { fotos, rets });
}

/** O retangulo esta sobre o canvas do jogo, sem HUD por cima? */
const descoberto = (page, r) => page.evaluate((ret) => {
  const jogo = window.document.querySelector('#jogo canvas');
  const pontos = [[ret.x, ret.y], [ret.x + ret.w, ret.y], [ret.x, ret.y + ret.h], [ret.x + ret.w, ret.y + ret.h],
    [ret.x + ret.w / 2, ret.y + ret.h / 2]];
  return pontos.every(([x, y]) => window.document.elementFromPoint(x, y) === jogo);
}, r);

module.exports = { h, tipoDo, descidaParaOSul, abrir, aoZoom, irAoTile, retDoMundo, foto, luminancias, descoberto };
