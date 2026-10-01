'use strict';
// Roteiro ARTE-VILA (integracao da arte do Codex, integra-arte-1; substitui os PILOTO-* da branch
// de arte). Carrega a vila pronta (`saves/teste-operador-vila-pronta.txt`, D-SAVE-VILA-PRONTA) e
// captura a vila com a arte nova em zoom 1, depois closes em zoom 2: armazem, padaria, moinho,
// serraria, o pior caso das excecoes de largura provisorias (a Bodega com o canavial e o rocado
// colados e uma unidade atras; a outra Bodega com a padaria colada), o terreno (o acude com a praia)
// e a vegetacao (o mato do nascente). Afirma que cada
// predio do close tem PNG (`spritesDePredio` na ponte), e nao o placeholder. A posicao vem do save e do
// mapa, nunca de coordenada escrita aqui.
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const predios = require('../../data/buildings.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';
const SAVE = 'saves/teste-operador-vila-pronta.txt';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const salvo = JSON.parse(readFileSync(SAVE, 'utf8')).estado;

  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(SAVE, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar((await estado()).tick === salvo.tick, 'a vila pronta deveria estar carregada');

  async function zoomPara(nivel) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 10; i += 1) {
      const { camera } = await estado();
      if (camera.zoom === nivel) return;
      await page.mouse.wheel(0, camera.zoom > nivel ? +200 : -200);
      await esperarFrame();
    }
    afirmar((await estado()).camera.zoom === nivel, `a camera deveria chegar ao zoom ${nivel}`);
  }
  // com a origem da camera no meio do canvas, centrar em (gx, gy) e o mesmo scroll em todo zoom
  async function centrarEm(gx, gy) {
    await page.evaluate((s) => window.__cangaco.fixarCamera(s), {
      scrollX: Math.round(gx * TILE_PX - canvas.width / 2), scrollY: Math.round(gy * TILE_PX - canvas.height / 2),
    });
    await esperarFrame();
  }
  const doTipo = (tipo) => salvo.predios.ordem.map((id) => salvo.predios.porId[id]).find((p) => p.tipo === tipo && p.lado === 0);
  const centroDe = (p) => {
    const [w, h] = predios.predios.find((d) => d.id === p.tipo).tamanho;
    return { gx: p.gx + w / 2, gy: p.gy + h / 2 };
  };

  // 1. a vila, zoom 1, centrada no armazem
  const armazem = doTipo('storehouse');
  await centrarEm(centroDe(armazem).gx, centroDe(armazem).gy);
  await capturar('vila');

  // 2. closes de predio, zoom 2
  await zoomPara(2);
  for (const [tipo, nome] of [['storehouse', 'armazem'], ['bakery', 'padaria'], ['mill', 'moinho'], ['sawmill', 'serraria']]) {
    const p = doTipo(tipo);
    afirmar(p !== undefined, `a vila pronta deveria ter ${tipo}`);
    const c = centroDe(p);
    await centrarEm(c.gx, c.gy - 0.5);
    const s = await estado();
    // F17f: a textura com que o predio foi desenhado, ou null (o placeholder)
    afirmar(typeof s.spritesDePredio[p.id] === 'string', `${tipo} deveria estar com PNG, veio ${JSON.stringify(s.spritesDePredio[p.id])}`);
    await capturar(`close-${nome}`);
  }

  // 2b. pior caso de largura (excecoes provisorias da Bodega, 1,5, e do canavial, 1,303): a Bodega
  // do lado 0 tem o rocado colado a oeste e o canavial a um tile a leste, no proprio save. O close
  // fica entre os dois e espera uma unidade passar ATRAS (ao norte) da Bodega ou do canavial.
  const bodega = doTipo('inn');
  const canavial = doTipo('wineyard');
  afirmar(bodega !== undefined && canavial !== undefined, 'a vila pronta deveria ter Bodega e canavial');
  const tamanho = (p) => predios.predios.find((d) => d.id === p.tipo).tamanho;
  const vizinhos = salvo.predios.ordem.map((id) => salvo.predios.porId[id]).filter((o) => {
    if (o === bodega) return false;
    const [w, h] = tamanho(bodega);
    const [ow, oh] = tamanho(o);
    const dx = Math.max(0, o.gx - (bodega.gx + w), bodega.gx - (o.gx + ow));
    const dy = Math.max(0, o.gy - (bodega.gy + h), bodega.gy - (o.gy + oh));
    return dx + dy <= 1;
  });
  afirmar(vizinhos.some((o) => o.tipo === 'wineyard') && vizinhos.length >= 2,
    `a Bodega deveria ter o canavial e outro vizinho colados: ${vizinhos.map((o) => o.tipo).join(',')}`);
  const atras = (u) => [bodega, canavial].some((p) => {
    const [w] = tamanho(p);
    return u.gy >= p.gy - 2 && u.gy < p.gy && u.gx >= p.gx - 0.5 && u.gx < p.gx + w + 0.5;
  });
  let passante = null;
  for (let t = 0; t < 3000 && passante === null; t += 2) {
    passante = (await estado()).unidadesRenderizadas.find(atras) ?? null;
    if (passante === null) await page.evaluate(() => window.__cangaco.avancar(2));
  }
  afirmar(passante !== null, 'uma unidade deveria passar atras da Bodega ou do canavial em 3000 ticks');
  const [bw] = tamanho(bodega);
  const [cw] = tamanho(canavial);
  await centrarEm((bodega.gx + canavial.gx + cw) / 2, bodega.gy + 0.5);
  {
    const s = await estado();
    afirmar(s.unidadesRenderizadas.some((u) => u.id === passante.id && atras(u)), 'a unidade deveria continuar atras no close');
    for (const p of [bodega, canavial]) {
      afirmar(typeof s.spritesDePredio[p.id] === 'string', `${p.tipo} deveria estar com PNG, veio ${JSON.stringify(s.spritesDePredio[p.id])}`);
    }
  }
  await capturar('close-bodega-canavial-vizinhos');
  // a outra Bodega (lado 1) tem a padaria colada a oeste
  const bodega1 = salvo.predios.ordem.map((id) => salvo.predios.porId[id]).find((p) => p.tipo === 'inn' && p.lado === 1);
  afirmar(bodega1 !== undefined, 'a vila pronta deveria ter a Bodega do lado 1');
  await centrarEm(bodega1.gx + bw / 2 - 1, bodega1.gy + 1);
  afirmar(typeof (await estado()).spritesDePredio[bodega1.id] === 'string', 'a Bodega do lado 1 deveria estar com PNG');
  await capturar('close-bodega-padaria');

  // 3. terreno: o acude da vila (agua e praia) — o tile de agua mais perto do armazem, pelo mapa
  const mapa = require('../../data/maps/sertao-128.json');
  let agua = null;
  mapa.linhas.forEach((linha, gy) => [...linha].forEach((ch, gx) => {
    if (ch !== 'w') return;
    const d = Math.hypot(gx - armazem.gx, gy - armazem.gy);
    if (agua === null || d < agua.d) agua = { gx, gy, d };
  }));
  afirmar(agua !== null, 'o mapa deveria ter agua');
  await centrarEm(agua.gx + 0.5, agua.gy + 0.5);
  await capturar('close-terreno-acude');

  // 4. vegetacao: a arvore mais perto do armazem que ainda esta de pe no save
  let arvore = null;
  for (const [k, r] of Object.entries(salvo.recursos)) {
    if (r.tipo !== 'tree' || r.quantidade <= 0) continue;
    const [gx, gy] = k.split(',').map(Number);
    const d = Math.hypot(gx - armazem.gx, gy - armazem.gy);
    if (arvore === null || d < arvore.d) arvore = { gx, gy, d };
  }
  afirmar(arvore !== null, 'a vila pronta deveria ter arvore');
  await centrarEm(arvore.gx + 0.5, arvore.gy);
  await capturar('close-vegetacao');
  await zoomPara(1);
}

module.exports = { roteiro };
