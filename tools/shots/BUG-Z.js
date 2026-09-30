'use strict';
// Roteiro do BUG-Z (nome de unidade coberto pelas unidades da frente) — aceite 2 e 3 do BUGS.md.
//
// Carrega a partida da F-VIVO-h (a escola anima), onde a captura mostrou o "Carregador" cortado
// em "rrega". Mede pela ponte, com o relogio correndo (§8): em toda leitura cada unidade visivel
// tem o nome na camada dos nomes, acima do corpo mais alto; o nome acende e apaga com o corpo
// (BUG-X, especialista dentro); e o texto e o do tema. Nao clica em painel.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const ZOOM = 2;
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX / 2) return;
      const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 60);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
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

  for (const arquivo of ['test-output/F-VIVO-h.save.txt', 'test-output/F-VIVO-h.partida.json']) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  }
  const plano = JSON.parse(readFileSync('test-output/F-VIVO-h.partida.json', 'utf8'));
  const tema = require('../../data/theme-sertao.json');
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync('test-output/F-VIVO-h.save.txt', 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  let s = await estado();
  afirmar(s.tick === plano.tick, `a partida carregada deveria estar no tick ${plano.tick}, veio ${s.tick}`);

  await zoomPara(ZOOM);
  await centrarNoEixo(plano.centro.gx, 'x');
  await centrarNoEixo(plano.centro.gy, 'y');

  const nomesDoTema = new Set(Object.values(tema.civis).map((c) => c.nome).concat(Object.values(tema.militares ?? {}).map((c) => c.nome)));
  function conferir(e) {
    const us = e.unidadesRenderizadas;
    afirmar(us.length > 0, 'deveria haver unidades desenhadas');
    const corpoMaisAlto = Math.max(...us.map((u) => u.profundidadeDoCorpo));
    for (const u of us) {
      afirmar(u.nomeVisivel === u.visivel, `tick ${e.tick}: o nome de ${u.id} deveria acender junto com o corpo (${u.visivel})`);
      if (!u.visivel) continue;
      afirmar(u.profundidadeDoNome > corpoMaisAlto,
        `tick ${e.tick}: o nome de ${u.id} (${u.profundidadeDoNome}) deveria ficar acima de todo corpo (${corpoMaisAlto})`);
      afirmar(nomesDoTema.has(u.nome), `tick ${e.tick}: o nome de ${u.id} ("${u.nome}") deveria vir do tema`);
    }
  }
  conferir(s);

  // relogio andando (§8), ate o meio do treino, como a captura da F-VIVO-h
  const meio = plano.comeca + Math.floor((plano.sai - plano.comeca) / 2);
  let leituras = 0;
  let escondidas = 0;
  await page.keyboard.press('p');
  for (let i = 0; i < 400 && s.tick < meio; i += 1) {
    await page.waitForTimeout(150);
    s = await estado();
    conferir(s);
    leituras += 1;
    escondidas += s.unidadesRenderizadas.filter((u) => !u.visivel).length;
  }
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado, 'o roteiro deveria ter pausado de volta');
  afirmar(leituras > 5, `poucas leituras: ${leituras}`);
  conferir(s);
  const carregadores = s.unidadesRenderizadas.filter((u) => u.visivel && u.nome === tema.civis.serf.nome);
  afirmar(carregadores.length > 0, `a captura deveria ter um "${tema.civis.serf.nome}" visivel`);

  const b = await page.evaluate(() => {
    const r = window.document.querySelector('#barra').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(b.x, b.y);
  await esperarFrame();
  afirmar((await estado()).tileSobMouse === null, 'com o mouse na barra, nenhum tile deveria estar sob ele');
  await capturar('nomes-por-cima');
  return { leituras, escondidas };
}

module.exports = { roteiro };
