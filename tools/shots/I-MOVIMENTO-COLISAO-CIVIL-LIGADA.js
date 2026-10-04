'use strict';
// Roteiro da I-MOVIMENTO-COLISAO-CIVIL-LIGADA, aceite (e): a estrada da pedreira com os serfs em
// tiles distintos (o relato do BUG-CIVIS-EMPILHADOS era "tres serfs desenhados quase no mesmo lugar,
// na estrada em frente a pedreira").
//
// Carrega a vila pronta do operador (`saves/teste-operador-vila-pronta.txt`, como o roteiro da
// D-SAVE-VILA-PRONTA), poe a camera na porta da pedreira e anda o relogio. A cada 10 ticks afirma,
// pelo estado que a tela desenhou, que nenhum par de civis DESENHADOS (fora de casa) fica junto
// (empilhado). Para no primeiro tick com 3 ou mais civis perto da porta e nenhum par junto, e captura.
const { readFileSync } = require('node:fs');
const terreno = require('../../data/terrain.json');
const unidades = require('../../data/units.json');

const CHAVE_DO_SAVE = 'cangaco:partida';
const URL_DO_SAVE = '/saves/teste-operador-vila-pronta.txt';
const TILE_PX = terreno.tile_px;
const CIVIS = new Set(unidades.civis.tipos.map((t) => t.id));
/** Quantos civis perto da porta fazem a cena do relato (tres serfs na estrada). */
const PERTO_QUE_BASTA = 3;
const RAIO_DA_PORTA = 5;
const PASSO = 10;
const LIMITE = 1500;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const esperado = JSON.parse(readFileSync(`.${URL_DO_SAVE}`, 'utf8')).estado;

  await page.evaluate(async ([chave, url]) => {
    const texto = await (await window.fetch(url)).text();
    window.localStorage.setItem(chave, texto);
  }, [CHAVE_DO_SAVE, URL_DO_SAVE]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  afirmar(s.tick === esperado.tick, `a partida carregada deveria estar no tick ${esperado.tick}, esta em ${s.tick}`);
  const pedreira = Object.values(s.prediosDoEstado).find((p) => p.tipo === 'quarry');
  afirmar(pedreira !== undefined, 'a vila pronta deveria ter a pedreira');
  const porta = { gx: pedreira.gx + 1, gy: pedreira.gy + 2 };
  const canvas = await page.evaluate(() => {
    const r = window.document.querySelector('#jogo canvas').getBoundingClientRect();
    return { width: r.width, height: r.height };
  });
  await page.evaluate(([x, y]) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }),
    [porta.gx * TILE_PX - canvas.width / 2, porta.gy * TILE_PX - canvas.height / 2]);
  await esperarFrame();

  const civisDesenhados = (st) => st.unidadesRenderizadas.filter((u) => CIVIS.has(u.tipo) && u.visivel);
  // `gx/gy` da ponte e a posicao do tick, FRACIONARIA no meio do passo. Dois civis que se cruzam
  // de frente sao desenhados no mesmo ponto no tick do cruzamento (medido: 33,40.8 no tick 100,
  // trocando de tile no 101), e na sim estao em tiles distintos o tempo todo (o aceite (a) prova
  // tick a tick). Empilhar e ficar JUNTO: o mesmo par a menos de meio tile em duas checagens
  // seguintes (PASSO ticks), que um cruzamento nao dura.
  const pertoDemais = (civis) => {
    const pares = new Set();
    for (let i = 0; i < civis.length; i += 1) {
      for (let j = i + 1; j < civis.length; j += 1) {
        const [a, b] = [civis[i], civis[j]];
        if (Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy)) < 0.5) pares.add([a.id, b.id].sort().join('+'));
      }
    }
    return pares;
  };
  let maisPerto = 0;
  let checagens = 0;
  let cruzamentos = 0;
  let paresAntes = new Set();
  let perto = [];
  for (let t = 0; t < LIMITE; t += PASSO) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO);
    await esperarFrame();
    s = await estado();
    const civis = civisDesenhados(s);
    const pares = pertoDemais(civis);
    const juntos = [...pares].filter((par) => paresAntes.has(par));
    cruzamentos += pares.size;
    checagens += 1;
    afirmar(juntos.length === 0, `tick ${s.tick}: civis desenhados juntos em duas checagens seguintes (empilhados): ${JSON.stringify(juntos)}`);
    paresAntes = pares;
    perto = civis.filter((u) => Math.max(Math.abs(u.gx - porta.gx), Math.abs(u.gy - porta.gy)) <= RAIO_DA_PORTA);
    maisPerto = Math.max(maisPerto, perto.length);
    if (perto.length >= PERTO_QUE_BASTA && pares.size === 0) break;
  }
  // a camera no meio dos civis perto da pedreira, para a captura mostrar a cena do relato
  if (perto.length > 0) {
    const cx = perto.reduce((n, u) => n + u.gx, 0) / perto.length;
    const cy = perto.reduce((n, u) => n + u.gy, 0) / perto.length;
    await page.evaluate(([x, y]) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }),
      [cx * TILE_PX - canvas.width / 2, cy * TILE_PX - canvas.height / 2]);
    await esperarFrame();
  }
  afirmar(maisPerto >= PERTO_QUE_BASTA, `deveria haver ${PERTO_QUE_BASTA} civis perto da porta da pedreira em algum tick, o maximo foi ${maisPerto}`);
  await capturar('estrada-da-pedreira');
  console.log(`I-MOVIMENTO-COLISAO-CIVIL-LIGADA: tick ${s.tick}, ${maisPerto} civis perto da porta, ${checagens} checagens sem empilhamento, ${cruzamentos} cruzamentos de um instante`);
}

module.exports = { roteiro };
