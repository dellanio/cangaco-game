'use strict';
// F-TR-a — textura por tipo e transicao, no mapa real (docs/planos/2026-09-28-7-F-TR.md).
//
// Agua (y 24..53) e serra (y 84..119) nao cabem num quadro nem a 0,5: sao dois quadros,
// e o quadro unico e a F-TR-b. Em cada quadro o roteiro afirma:
//   1. tipos diferentes desenham texturas diferentes (nenhuma fonte dividida);
//   2. a floresta (vegetacao `tree`) esta na tela;
//   3. todo tile de transicao desenhado tem a mascara que o mapa manda, e todo tile
//      de fronteira da janela exigida foi desenhado — nem falta, nem sobra.
// A janela sai do proprio mapa; o roteiro nao tem coordenada literal.
const { writeFileSync, mkdirSync, readFileSync, existsSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { retanguloDoCanvas } = require('./_canvas');
const terrenoJson = require('../../data/terrain.json');

const ZOOM_DO_QUADRO = 0.5;
/** Tiles de folga em cada lado entre a janela exigida e a borda da vista. */
const FOLGA = 2;
const QUADROS = [
  { nome: 'acude', tipos: ['agua', 'areia', 'grama'], familias: ['agua', 'areia-grama'] },
  { nome: 'serra', tipos: ['montanha', 'rocha', 'areia', 'grama'], familias: ['rocha-grama', 'areia-grama'] },
];
const CARDINAIS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]; // N=1 L=2 S=4 O=8

/** A regra de cada familia, reescrita do lado do roteiro (WorldScene `criarCamadaDaBorda*`):
 *  o tipo do tile que recebe a borda e o vizinho que liga o bit. */
const REGRA = {
  agua: { tile: 'agua', liga: (v) => v !== 'agua' },
  'areia-grama': { tile: 'areia', liga: (v) => v === 'grama' },
  'rocha-grama': { tile: 'rocha', liga: (v) => v === 'grama' },
};

function lerMapa() {
  const m = require('../../data/maps/sertao-128.json'); // o mesmo que src/sim/data/raw.ts importa
  const tipo = (x, y) => (x < 0 || y < 0 || x >= m.largura || y >= m.altura
    ? null : m.legenda[m.linhas[y][x]]);
  const arvores = new Set(m.recursos.tree.map(([x, y]) => `${x},${y}`));
  return { m, tipo, arvores };
}

function mascaraEsperada({ tipo }, familia, x, y) {
  const r = REGRA[familia];
  if (tipo(x, y) !== r.tile) return 0;
  let mascara = 0;
  for (const [dx, dy, bit] of CARDINAIS) {
    const v = tipo(x + dx, y + dy);
    // fora do mapa a camada da agua conta como "nao e agua"; as de grama nao ligam
    if (v === null ? familia === 'agua' : r.liga(v)) mascara |= bit;
  }
  return mascara;
}

/** O conteudo da fonte: hash do PNG que o manifesto declara (`assets/<estado>`), ou a
 *  propria cor do placeholder. Dois caminhos para o mesmo desenho dariam o mesmo hash. */
function conteudoDaFonte(fonte) {
  if (fonte.startsWith('cor:')) return fonte;
  const caminho = `assets/${fonte}`;
  if (!existsSync(caminho)) return `sem-arquivo:${fonte}`;
  return createHash('sha1').update(readFileSync(caminho)).digest('hex');
}

/** A janela W x H com o maior minimo das contagens exigidas. */
function acharJanela(mapa, quadro, W, H) {
  let melhor = null;
  for (let y0 = 0; y0 + H <= mapa.m.altura; y0 += 1) {
    for (let x0 = 0; x0 + W <= mapa.m.largura; x0 += 1) {
      const c = { tree: 0 };
      for (const t of quadro.tipos) c[t] = 0;
      for (const f of quadro.familias) c[`f:${f}`] = 0;
      for (let y = y0; y < y0 + H; y += 1) {
        for (let x = x0; x < x0 + W; x += 1) {
          const t = mapa.tipo(x, y);
          if (c[t] !== undefined) c[t] += 1;
          if (mapa.arvores.has(`${x},${y}`)) c.tree += 1;
          for (const f of quadro.familias) if (mascaraEsperada(mapa, f, x, y) !== 0) c[`f:${f}`] += 1;
        }
      }
      const nota = Math.min(...Object.values(c));
      if (nota > 0 && (melhor === null || nota > melhor.nota)) melhor = { x0, y0, nota, c };
    }
  }
  return melhor;
}

async function quadrosDoTerreno({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const TILE = terrenoJson.tile_px;
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const mapa = lerMapa();

  /** A roda, com o cursor no meio do canvas: o centro da vista nao anda. */
  async function zoomPara(nivel) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 10; i += 1) {
      const { camera } = await estado();
      if (camera.zoom === nivel) return;
      await page.mouse.wheel(0, camera.zoom > nivel ? +200 : -200);
      await esperarFrame();
    }
    afirmar((await estado()).camera.zoom === nivel, `a camera deveria chegar a ${nivel}`);
  }
  async function centrarNoEixo(alvoEmTiles, eixo) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const vao = eixo === 'x' ? canvas.width : canvas.height;
      const alvo = alvoEmTiles * TILE - vao / 2;
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), [eixo, alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE / 2) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE ? 400 : 60);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }

  const passo = TILE * ZOOM_DO_QUADRO;
  const W = Math.floor(canvas.width / passo) - 2 * FOLGA;
  const H = Math.floor(canvas.height / passo) - 2 * FOLGA;
  const relatorio = {};
  for (const [n, quadro] of QUADROS.entries()) {
    const janela = acharJanela(mapa, quadro, W, H);
    afirmar(janela !== null, `${quadro.nome}: o mapa deveria ter janela ${W}x${H} com ${quadro.tipos}, arvore e ${quadro.familias}`);
    await zoomPara(terrenoJson.zoom.inicial);
    await centrarNoEixo(janela.x0 + W / 2, 'x');
    await centrarNoEixo(janela.y0 + H / 2, 'y');
    await zoomPara(ZOOM_DO_QUADRO);
    await esperarFrame();
    const s = await estado();

    // 1. tipos diferentes, texturas diferentes
    const visiveis = Object.keys(s.terrenoVisivel).filter((t) => s.terrenoVisivel[t] > 0);
    for (const t of quadro.tipos) {
      afirmar(visiveis.includes(t), `${quadro.nome}: '${t}' deveria estar na tela, veio ${JSON.stringify(s.terrenoVisivel)}`);
    }
    const dono = new Map();
    for (const t of visiveis) {
      const fontes = s.texturaDoTerreno[t] ?? [];
      afirmar(fontes.length > 0, `${quadro.nome}: '${t}' deveria publicar a fonte da textura`);
      for (const f of fontes) {
        const conteudo = conteudoDaFonte(f);
        afirmar(!conteudo.startsWith('sem-arquivo:'), `${quadro.nome}: a fonte de '${t}' nao foi achada no repo: ${f}`);
        afirmar(!dono.has(conteudo) || dono.get(conteudo) === t, `${quadro.nome}: '${t}' e '${dono.get(conteudo)}' dividem a textura ${f}`);
        dono.set(conteudo, t);
      }
    }

    // 2. a floresta e vegetacao, nao tipo de terreno: presenca na tela
    afirmar(s.recursosVisiveis.tree > 0, `${quadro.nome}: a floresta deveria estar na tela`);

    // 3. a fronteira usa o tile de transicao, com a mascara que o mapa manda
    const porFamilia = {};
    for (const familia of quadro.familias) {
      const publicadas = s.transicoesVisiveis[familia] ?? {};
      for (const [chave, mascara] of Object.entries(publicadas)) {
        const [x, y] = chave.split(',').map(Number);
        const esperada = mascaraEsperada(mapa, familia, x, y);
        afirmar(mascara === esperada, `${quadro.nome}/${familia} ${chave}: desenhou ${mascara}, o mapa manda ${esperada}`);
      }
      let exigidas = 0;
      for (let y = janela.y0; y < janela.y0 + H; y += 1) {
        for (let x = janela.x0; x < janela.x0 + W; x += 1) {
          const esperada = mascaraEsperada(mapa, familia, x, y);
          if (esperada === 0) continue;
          exigidas += 1;
          afirmar(publicadas[`${x},${y}`] === esperada, `${quadro.nome}/${familia} ${x},${y}: faltou a transicao ${esperada}`);
        }
      }
      afirmar(exigidas > 0, `${quadro.nome}/${familia}: a janela deveria ter fronteira`);
      porFamilia[familia] = { publicadas: Object.keys(publicadas).length, exigidasNaJanela: exigidas };
    }
    await capturar(`terreno-${n + 1}-${quadro.nome}`);
    relatorio[quadro.nome] = {
      janela: { x0: janela.x0, y0: janela.y0, W, H },
      camera: s.camera,
      terrenoVisivel: s.terrenoVisivel,
      arvores: s.recursosVisiveis.tree,
      familias: porFamilia,
      fontes: Object.fromEntries(visiveis.map((t) => [t, s.texturaDoTerreno[t]])),
    };
  }
  mkdirSync('test-output', { recursive: true });
  writeFileSync('test-output/F-TR-terreno.json', JSON.stringify(relatorio, null, 2));
  console.log(`F-TR terreno: ${JSON.stringify(Object.fromEntries(Object.entries(relatorio).map(([k, v]) => [k, v.familias])))}`);
}

module.exports = { quadrosDoTerreno };
