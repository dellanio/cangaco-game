'use strict';
// Roteiro da F-VIVO-d1 — AS CAMADAS A 0,75.
//
// Mede, na tela, o tamanho de cada camada do predio vivo com a camera a 0,75, e grava
// em `test-output/F-VIVO-d.json`. E esse numero que troca a "hipotese ate medir" da
// regra do zoom em docs/BRIEF-ARTE.md.
//
// Os cinco casos nao cabem num quadro do mapa real (docs/planos/2026-09-28-6-F-VIVO-d.md):
// cada um e medido na cadeia onde mora, carregada pelo botao "carregar" (F23b) a partir
// do save que `tests/F-VIVO-d-aldeia.test.ts` grava no instante em que os alvos estao
// ativos. carne = guarda + criacao + dentro; ouro = luz + dentro; pedreira = transforma.
//
// O px vem de `window.__cangaco.camadasEmPx` (px de MUNDO, da mesma geometria do
// desenho) vezes `camera.zoom`: nunca de pixel da captura (§8).
const { readFileSync, existsSync, writeFileSync, mkdirSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const ZOOM_MEDIDO = 0.75;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts
/** A menor camada que o brief chama de legivel (docs/BRIEF-ARTE.md, pilha "~12 px"). */
const LEGIVEL_PX = 12;
const CADEIAS = [
  { nome: 'carne', alvos: ['f1', 'sf1', 'bu1'] },
  { nome: 'ouro', alvos: ['go1', 'co1', 'me1'] },
  { nome: 'pedreira', alvos: ['q1'] },
];

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 120);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }

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

  const medidas = {};
  for (const [n, c] of CADEIAS.entries()) {
    const arquivo = `test-output/F-VIVO-d-${c.nome}.save.txt`;
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
    await page.keyboard.press('h');
    await esperarFrame();
    await page.click('#ajuda [data-acao="carregar"]');
    await esperarFrame();
    await page.keyboard.press('Escape');
    await esperarFrame();

    let s = await estado();
    const predios = c.alvos.map((id) => s.prediosDoEstado[id]);
    afirmar(predios.every((p) => p !== undefined), `${c.nome}: a partida carregada deveria ter ${c.alvos}`);
    const gx = (Math.min(...predios.map((p) => p.gx)) + Math.max(...predios.map((p) => p.gx)) + 3) / 2;
    const gy = (Math.min(...predios.map((p) => p.gy)) + Math.max(...predios.map((p) => p.gy)) + 3) / 2;
    await zoomPara(terreno.zoom.inicial);
    await centrarNoEixo(gx, 'x');
    await centrarNoEixo(gy, 'y');
    await zoomPara(ZOOM_MEDIDO);
    await esperarFrame();
    s = await estado();
    const zoom = s.camera.zoom;

    const porPredio = {};
    for (const id of c.alvos) {
      const cam = s.camadasEmPx[id];
      afirmar(cam !== undefined, `${c.nome}: '${id}' deveria publicar camadas`);
      const ativa = cam.caso === 'guarda' ? cam.pilha !== null
        : cam.caso === 'criacao' ? cam.animais !== null
          : cam.trabalho !== null;
      afirmar(ativa, `${c.nome}: o caso '${cam.caso}' de '${id}' deveria estar ativo no save, veio ${JSON.stringify(cam)}`);
      const naTela = (v) => Math.round(v * zoom * 10) / 10;
      porPredio[id] = {
        tipo: cam.tipo, caso: cam.caso,
        corpo: cam.corpo.map(naTela),
        trabalho: cam.trabalho === null ? null : cam.trabalho.map(naTela),
        pilha: cam.pilha === null ? null : naTela(cam.pilha),
        animais: cam.animais === null ? null : cam.animais.map(naTela),
        sprite: s.spritesDePredio?.[id] ?? null,
      };
    }
    await capturar(`${n + 1}-${c.nome}`);
    medidas[c.nome] = { tick: s.tick, zoom, predios: porPredio };
  }

  const casos = new Set(Object.values(medidas).flatMap((m) => Object.values(m.predios).map((p) => p.caso)));
  afirmar(casos.size === 5, `os cinco casos deveriam ser medidos, vieram ${[...casos]}`);

  // o resumo que o brief cita: menor px de cada camada, na tela a 0,75
  const todas = Object.values(medidas).flatMap((m) => Object.values(m.predios));
  const menor = (xs) => (xs.length === 0 ? null : Math.min(...xs));
  const resumo = {
    zoom: ZOOM_MEDIDO,
    legivelPx: LEGIVEL_PX,
    pilhaPx: menor(todas.flatMap((p) => (p.pilha === null ? [] : [p.pilha]))),
    animalPx: {
      menor: menor(todas.flatMap((p) => p.animais ?? [])),
      maior: Math.max(...todas.flatMap((p) => p.animais ?? [0])),
    },
    trabalhoPx: Object.fromEntries(todas.filter((p) => p.trabalho !== null).map((p) => [p.tipo, p.trabalho])),
    corpoPx: Object.fromEntries(todas.map((p) => [p.tipo, p.corpo])),
    fumaca: 'nao medida: nenhum predio declara ancoras.trabalho.fumaca no manifesto',
  };
  mkdirSync('test-output', { recursive: true });
  writeFileSync('test-output/F-VIVO-d.json', JSON.stringify({ resumo, medidas }, null, 2));
  console.log(`F-VIVO-d: ${JSON.stringify(resumo)}`);
}

module.exports = { roteiro };
