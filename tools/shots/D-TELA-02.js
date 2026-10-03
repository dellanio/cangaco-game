'use strict';
// Roteiro da D-TELA-02 — O MINIMAPA.
//   1. H -> "Nova escaramuca"; a tropa marcha em paz ate ver a vila da IA (ela nasce na nevoa,
//      F-TELA-NEVOA); o minimapa desenha os predios do jogador e os da IA a vista; o pixel no
//      meio de um predio do jogador tem a cor do bando dele, e o de um da IA a do outro
//      (leitura do canvas, `getImageData`, nao da captura);
//   2. DESPAUSADO e com o botao seguro 150 ms (§8), o clique no minimapa sobre a vila da IA
//      leva a camera ate la: o centro da vista fica a menos de 2 tiles do tile clicado, e
//      o retangulo da vista no minimapa acompanha;
//   3. a captura mostra o minimapa com a vista na vila da IA.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const predios = require('../../data/buildings.json');

const TILE_PX = terreno.tile_px;
const LADO_DO_JOGADOR = 0;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // F-TELA-NEVOA: o minimapa so desenha o predio da IA que o jogador ve agora, e a vila da IA nasce
  // na nevoa. A tropa ganha a vista pelo caminho do jogo: caixa nos 18, marcha em paz ate 6 tiles
  // a oeste do maior predio da IA, e o relogio corre ate ele aparecer.
  {
    const fixar = async (t) => {
      await page.evaluate(([x, y]) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), [t.gx * TILE_PX - canvas.width / 2, t.gy * TILE_PX - canvas.height / 2]);
      await esperarFrame();
    };
    const naTela = (t, cam) => ({ x: canvas.left + t.gx * TILE_PX + TILE_PX / 2 - cam.scrollX, y: canvas.top + t.gy * TILE_PX + TILE_PX / 2 - cam.scrollY });
    let s0 = await estado();
    const minha = s0.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
    const meio = { gx: Math.round(minha.reduce((n, u) => n + u.gx, 0) / minha.length), gy: Math.round(minha.reduce((n, u) => n + u.gy, 0) / minha.length) };
    await fixar(meio);
    s0 = await estado();
    const pts = minha.map((u) => naTela(u, s0.camera));
    await page.mouse.move(Math.min(...pts.map((q) => q.x)) - TILE_PX / 2, Math.min(...pts.map((q) => q.y)) - TILE_PX / 2);
    await page.mouse.down();
    await page.mouse.move(Math.max(...pts.map((q) => q.x)) + TILE_PX / 2, Math.max(...pts.map((q) => q.y)) + TILE_PX / 2, { steps: 8 });
    await page.mouse.up();
    await esperarFrame();
    const areaDe = (p) => predios.predios.find((d) => d.id === p.tipo).tamanho.reduce((a, b) => a * b, 1);
    const [idDoMaior, maiorDaIA] = Object.entries(s0.prediosDoEstado).filter(([, p]) => p.lado !== LADO_DO_JOGADOR)
      .sort(([, a], [, b]) => areaDe(b) - areaDe(a))[0];
    const perto = { gx: maiorDaIA.gx - 6, gy: maiorDaIA.gy + 1 };
    await fixar(perto);
    s0 = await estado();
    const q = naTela(perto, s0.camera);
    await page.mouse.move(q.x, q.y);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(150);
    await page.mouse.up({ button: 'right' });
    for (let i = 0; i < 40 && !(await estado()).prediosDoEstado[idDoMaior].naVista; i += 1) {
      await page.evaluate(() => window.__cangaco.avancar(25));
      await esperarFrame();
    }
    afirmar((await estado()).prediosDoEstado[idDoMaior].naVista, 'a tropa deveria ter chegado a ver o maior predio da IA');
    // a camera volta a vila: o retangulo da vista no minimapa nao pode cobrir o predio da IA lido abaixo
    await fixar(meio);
  }

  // 1. os predios, na cor do bando
  const s = await estado();
  // F-TELA-NEVOA: os do jogador e os da IA a vista
  const doEstado = Object.values(s.prediosDoEstado).filter((p) => p.lado === LADO_DO_JOGADOR || p.naVista);
  const mapa = await page.evaluate(() => {
    const c = window.document.querySelector('#minimapa canvas.mapa');
    if (c === null) return null;
    const r = c.getBoundingClientRect();
    return {
      left: r.left, top: r.top, largura: c.width, altura: c.height,
      predios: Number(c.dataset.predios), pxPorTile: Number(c.dataset.pxPorTile),
      x0: Number(c.dataset.x0), y0: Number(c.dataset.y0), vista: c.dataset.vista,
    };
  });
  afirmar(mapa !== null, 'o minimapa deveria ter o canvas');
  afirmar(mapa.largura > 0 && mapa.altura > 0, `o canvas do minimapa deveria ter tamanho, tem ${mapa.largura}x${mapa.altura}`);
  afirmar(mapa.predios === doEstado.length, `o minimapa deveria desenhar ${doEstado.length} predios, desenhou ${mapa.predios}`);

  const centroNoMinimapa = (p) => {
    const def = predios.predios.find((d) => d.id === p.tipo);
    const [w, h] = def.tamanho;
    return { x: mapa.x0 + (p.gx + w / 2) * mapa.pxPorTile, y: mapa.y0 + (p.gy + h / 2) * mapa.pxPorTile };
  };
  const corNoPixel = (pt) => page.evaluate(([x, y]) => {
    const c = window.document.querySelector('#minimapa canvas.mapa');
    const [r, g, b] = c.getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }, [pt.x, pt.y]);
  // o maior predio de cada lado: o pixel do meio dele nao e borda de ninguem
  const area = (p) => predios.predios.find((d) => d.id === p.tipo).tamanho.reduce((a, b) => a * b, 1);
  const maior = (lado) => doEstado.filter((p) => p.lado === lado).sort((a, b) => area(b) - area(a))[0];
  const meu = maior(LADO_DO_JOGADOR);
  const dele = doEstado.find((p) => p.lado !== LADO_DO_JOGADOR) && maior(doEstado.find((p) => p.lado !== LADO_DO_JOGADOR).lado);
  afirmar(meu !== undefined && dele !== undefined, 'a escaramuca deveria ter predios dos dois lados');
  const corMeu = await corNoPixel(centroNoMinimapa(meu));
  const corDele = await corNoPixel(centroNoMinimapa(dele));
  afirmar(corMeu === meu.corDoBando.toLowerCase(), `o predio do jogador deveria ser ${meu.corDoBando}, e ${corMeu}`);
  afirmar(corDele === dele.corDoBando.toLowerCase(), `o predio da IA deveria ser ${dele.corDoBando}, e ${corDele}`);
  afirmar(corMeu !== corDele, 'os dois bandos deveriam ter cores diferentes');

  // 2. o clique leva a camera para a vila da IA
  const vistaAntes = mapa.vista;
  const alvo = centroNoMinimapa(dele);
  const tileAlvo = { gx: Math.floor((alvo.x - mapa.x0) / mapa.pxPorTile), gy: Math.floor((alvo.y - mapa.y0) / mapa.pxPorTile) };
  await page.keyboard.press('p');
  await page.mouse.move(mapa.left + 2 + alvo.x, mapa.top + 2 + alvo.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  await esperarFrame();

  const depois = await estado();
  const cam = depois.camera;
  const centro = {
    gx: (cam.scrollX + canvas.width / 2) / TILE_PX,
    gy: (cam.scrollY + canvas.height / 2) / TILE_PX,
  };
  const erro = Math.max(Math.abs(centro.gx - (tileAlvo.gx + 0.5)), Math.abs(centro.gy - (tileAlvo.gy + 0.5)));
  const vistaDepois = await page.$eval('#minimapa canvas.mapa', (c) => c.dataset.vista);
  const [vx, vy, vw, vh] = vistaDepois.split(',').map(Number);
  const centroDaVista = { x: vx + vw / 2, y: vy + vh / 2 };
  const erroNoMinimapa = Math.max(Math.abs(centroDaVista.x - alvo.x), Math.abs(centroDaVista.y - alvo.y)) / mapa.pxPorTile;
  await capturar('camera-na-vila-da-ia');

  console.log(`D-TELA-02: ${JSON.stringify({
    canvas: [mapa.largura, mapa.altura], pxPorTile: mapa.pxPorTile, predios: mapa.predios, corMeu, corDele,
    tileAlvo, centro, erro, vistaAntes, vistaDepois, erroNoMinimapa,
  })}`);
  afirmar(erro < 2, `a camera deveria centrar a menos de 2 tiles de ${JSON.stringify(tileAlvo)}, ficou em ${JSON.stringify(centro)}`);
  afirmar(vistaDepois !== vistaAntes, 'o retangulo da vista no minimapa deveria ter andado');
  afirmar(erroNoMinimapa < 2, `o retangulo da vista deveria centrar no clique, errou ${erroNoMinimapa} tiles`);
}

module.exports = { roteiro };
