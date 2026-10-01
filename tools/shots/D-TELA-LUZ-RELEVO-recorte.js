'use strict';

// Roteiro de MEDIDA da D-TELA-LUZ-RELEVO — o recorte do sprite e a encosta mais forte
// (decisoes 19 e 20 do docs/planos/relevo-a.md). Mede e fotografa; reprova so se nao conseguir
// medir.
//
// O recorte (decisao 19): a camada [DST_COLOR, ONE] clareia o chao da encosta de luz, e o
// setTint so escurece o sprite (S1, `tetoDoTintDoSprite` = 1). Na encosta de luz, entao, o chao
// ganha luz e o sprite nao. A medida e o GANHO de luminancia (com relevo / sem relevo) do sprite
// e do chao em volta, no mesmo lugar e com a mesma camera nas duas cargas:
//   - arvore da vila na encosta mais iluminada do quadro: ganho medido nos DOIS, em pixel;
//   - predio (uma pedreira plantada na encosta de luz mais forte com rua ate a vila) e serf: o
//     chao em volta medido em pixel; o sprite pelo tint publicado (min(fator, teto) = 1);
//   - pe da serra: nao ha sprite no mapa ali (nenhuma arvore a 3 tiles da montanha); medido o
//     ganho do chao na faixa mais iluminada, que e o recorte que um sprite teria.
// A encosta mais forte (decisao 20): a janela 12 x 8 com mais tiles no teto de declive, a zoom
// 0,5, com e sem relevo, para ver se le como parede.

const fs = require('node:fs');
const { retanguloDoCanvas, arrastarDentroDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const { bloqueiaConstrucao, caixaLivre, arrastosDaRede } = require('./_recursos');
const { erguerRua } = require('./_estradas');
const {
  h, tipoDo, descidaParaOSul, abrir, aoZoom, irAoTile, retDoMundo, foto, luminancias, descoberto,
} = require('./_relevo');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const relevoDado = require('../../data/relevo.json');
const mapa = require('../../data/maps/sertao-128.json');
const { predios } = require('../../data/buildings.json');

const FEATURE = 'D-TELA-LUZ-RELEVO-recorte';
const T = terreno.tile_px;
const ZOOM = 0.5;
const TETO_ATE_SPRITE_DA_OBRA = 1500;
/** Rua mais longa que isto e lugar longe demais da vila para a medida; o teto de ticks da rua
 *  acompanha (o ajudante tem 600 por padrao, medido para ruas de ~12 tiles). */
const RUA_MAXIMA = 16;
const TETO_DA_RUA = 1500;
const NAO_ANDA = new Set(['agua', 'montanha', 'rocha']);
const SEM_LIMITE = new Set(relevoDado.geracao.tiposSemLimiteDeDeclive);
const tamanhoDe = (id) => predios.find((p) => p.id === id).tamanho;
const anda = (gx, gy) => !NAO_ANDA.has(tipoDo(gx, gy));
const ehChao = (t) => t === 'grama' || t === 'areia' || t === 'campoArado';
const arvores = new Set((mapa.recursos.tree ?? []).map(([x, y]) => `${x},${y}`));
const rochas = new Set((mapa.recursos.rock ?? []).map(([x, y]) => `${x},${y}`));
const temSprite = (gx, gy) => arvores.has(`${gx},${gy}`) || rochas.has(`${gx},${gy}`);
const ganho = (com, sem) => com / sem;
const arred = (v) => Math.round(v * 1000) / 1000;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const esperarFrame = () => page.waitForTimeout(200);
  const canvas = await retanguloDoCanvas(page);
  const medidas = { pxDeMundoPorDegrau: relevoDado.pxDeMundoPorDegrau, zoom: ZOOM };

  /** O miolo de um tile (metade central), em tela. */
  const retDoTile = (cam, gx, gy) => retDoMundo(canvas, cam, (gx + 0.25) * T, (gy + 0.25) * T, (gx + 0.75) * T, (gy + 0.75) * T);

  /** Os tiles de chao livre e descoberto, vizinhos de (gx, gy), na mesma encosta. */
  async function chaoEmVolta(cam, gx, gy, evitar = () => false) {
    const tiles = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [-2, 0], [2, 0], [-1, 1], [1, 1]]) {
      const x = gx + dx;
      const y = gy + dy;
      if (!ehChao(tipoDo(x, y)) || temSprite(x, y) || temSprite(x, y + 1) || evitar(x, y)) continue;
      if (await descoberto(page, retDoTile(cam, x, y))) tiles.push({ gx: x, gy: y });
    }
    return tiles;
  }

  // ---- A. a arvore da vila na encosta mais iluminada ---------------------------------------
  const camVila = await aoZoom(ctx, canvas, ZOOM);
  const fotoSem = await foto(page);
  await abrir(ctx, '&relevo');
  const camVilaCom = await aoZoom(ctx, canvas, ZOOM);
  afirmar(camVilaCom.scrollX === camVila.scrollX && camVilaCom.scrollY === camVila.scrollY, 'a camera da vila deveria repetir');
  const fotoCom = await foto(page);
  let s = await estado();
  afirmar(s.relevo?.ativo === true, 'com ?relevo o debug deveria publicar relevo.ativo');
  afirmar(s.relevo.pxDeMundoPorDegrau === relevoDado.pxDeMundoPorDegrau, `o dado deveria estar em ${relevoDado.pxDeMundoPorDegrau} px por degrau`);
  const candidatas = [];
  for (const k of arvores) {
    const f = s.relevo.fatores[`vegetacao:${k}`];
    if (f === undefined || f <= 1) continue;
    const [gx, gy] = k.split(',').map(Number);
    const caixa = retDoMundo(canvas, camVila, (gx + 0.35) * T, (gy + 0.1) * T, (gx + 0.65) * T, (gy + 0.7) * T);
    if (!(await descoberto(page, caixa))) continue;
    const chao = await chaoEmVolta(camVila, gx, gy);
    if (chao.length > 0) candidatas.push({ gx, gy, f, caixa, chao });
  }
  afirmar(candidatas.length > 0, 'o quadro da vila deveria ter arvore em encosta de luz, descoberta, com chao livre ao lado');
  candidatas.sort((a, b) => b.f - a.f);
  const arv = candidatas[0];
  const retsChao = arv.chao.map(({ gx, gy }) => retDoTile(camVila, gx, gy));
  const [lumSem, lumCom] = await luminancias(page, [fotoSem, fotoCom], [arv.caixa, ...retsChao]);
  const ganhoArvore = ganho(lumCom[0], lumSem[0]);
  const ganhoChaoArvore = retsChao.reduce((t, _r, i) => t + ganho(lumCom[i + 1], lumSem[i + 1]), 0) / retsChao.length;
  medidas.arvoreDaVila = {
    tile: [arv.gx, arv.gy], fatorSobOPe: arred(arv.f), chaoUsado: arv.chao,
    ganhoDoSprite: arred(ganhoArvore), ganhoDoChao: arred(ganhoChaoArvore),
    diferencaPercentual: arred((ganhoChaoArvore - ganhoArvore) * 100),
  };
  await capturar('vila-com-relevo');

  // ---- B. o predio e o serf na encosta de luz mais forte da vila ----------------------------
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const ocupado = new Set();
  for (const p of Object.values(s.prediosDoEstado)) {
    const [w, a] = tamanhoDe(p.tipo);
    for (let y = p.gy; y < p.gy + a; y += 1) for (let x = p.gx; x < p.gx + w; x += 1) ocupado.add(`${x},${y}`);
  }
  const [largQu, altQu] = tamanhoDe('quarry');
  const yVila = armazem.gy + tamanhoDe('storehouse')[1];
  const transitavel = (gx, gy) => ehChao(tipoDo(gx, gy)) && !bloqueiaConstrucao(gx, gy) && !ocupado.has(`${gx},${gy}`);
  const meio = { gx: Math.round((camVila.scrollX + canvas.width / 2) / T), gy: Math.round((camVila.scrollY + canvas.height / 2) / T) };
  let escolha = null;
  for (let gy = meio.gy - 8; gy + altQu < yVila; gy += 1) {
    for (let gx = meio.gx - 12; gx <= meio.gx + 12; gx += 1) {
      const pe = { vx: gx + Math.floor(largQu / 2), vy: gy + altQu };
      const luz = h(pe.vx, pe.vy - 1) - h(pe.vx, pe.vy + 1); // > 0: desce para o sul, encosta de luz
      if (luz <= 0 || !caixaLivre(gx, gy, largQu, altQu)) continue;
      let ok = true;
      for (let y = gy; y < gy + altQu && ok; y += 1) for (let x = gx; x < gx + largQu && ok; x += 1) ok = transitavel(x, y);
      const col = gx + largQu - 1;
      const rua = [];
      for (let x = gx; x <= col; x += 1) rua.push({ gx: x, gy: gy + altQu });
      for (let y = gy + altQu + 1; y <= yVila; y += 1) rua.push({ gx: col, gy: y });
      const ruaDaVila = [];
      for (let x = armazem.gx; x < col; x += 1) ruaDaVila.push({ gx: x, gy: yVila });
      ok = ok && [...rua, ...ruaDaVila].every((t) => transitavel(t.gx, t.gy));
      const custo = rua.length + ruaDaVila.length;
      if (!ok || custo > RUA_MAXIMA) continue;
      if (escolha === null || luz > escolha.luz || (luz === escolha.luz && custo < escolha.custo)) escolha = { gx, gy, luz, custo, rua, ruaDaVila };
    }
  }
  afirmar(escolha !== null, 'a vila deveria ter uma encosta de luz onde a pedreira cabe, com rua ate a vila');
  const ruaToda = new Set([...escolha.rua, ...escolha.ruaDaVila].map((t) => `${t.gx},${t.gy}`));

  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const trecho of [...arrastosDaRede(escolha.rua), ...arrastosDaRede(escolha.ruaDaVila)]) {
    const cam = (await estado()).camera;
    await arrastarDentroDoCanvas(page, canvas, [pontoDoTileNaTela(canvas, trecho.de, cam, T), pontoDoTileNaTela(canvas, trecho.ate, cam, T)]);
    await avancar(1);
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await esperarFrame();
  await erguerRua(ctx, { tiles: ruaToda.size, teto: TETO_DA_RUA });
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  const ponto = pontoDoTileNaTela(canvas, { gx: escolha.gx, gy: escolha.gy }, (await estado()).camera, T);
  await page.mouse.click(ponto.x, ponto.y);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  s = await estado();
  const achado = Object.entries(s.prediosDoEstado).find(([, p]) => p.tipo === 'quarry' && p.gx === escolha.gx && p.gy === escolha.gy);
  afirmar(achado !== undefined, `a pedreira deveria estar plantada em (${escolha.gx},${escolha.gy})`);
  const rotulo = `predio:${achado[0]}`;
  let gastos = 0;
  while ((s.relevo.imagens[rotulo] ?? 0) === 0 && gastos < TETO_ATE_SPRITE_DA_OBRA) {
    await avancar(25);
    gastos += 25;
    await esperarFrame();
    s = await estado();
  }
  afirmar((s.relevo.imagens[rotulo] ?? 0) > 0, `a obra deveria ter sprite em ${TETO_ATE_SPRITE_DA_OBRA} ticks`);
  const fotoObra = await foto(page);
  const unidadesAgora = new Set(s.unidadesRenderizadas.map((u) => `${Math.floor(u.gx)},${Math.floor(u.gy)}`));
  const ocupadoAgora = (x, y) => ruaToda.has(`${x},${y}`) || unidadesAgora.has(`${x},${y}`) || ocupado.has(`${x},${y}`)
    || (x >= escolha.gx && x < escolha.gx + largQu && y >= escolha.gy && y < escolha.gy + altQu);
  const chaoDoPredio = [];
  for (let x = escolha.gx - 1; x <= escolha.gx + largQu; x += 1) {
    for (const y of [escolha.gy + altQu - 1, escolha.gy + altQu]) {
      if (ehChao(tipoDo(x, y)) && !temSprite(x, y) && !ocupadoAgora(x, y) && await descoberto(page, retDoTile(s.camera, x, y))) chaoDoPredio.push({ gx: x, gy: y });
    }
  }
  const fPredio = s.relevo.fatores[rotulo];
  const serfs = s.unidadesRenderizadas.filter((u) => u.tipo === 'serf')
    .map((u) => ({ id: u.id, tile: [Math.floor(u.gx), Math.floor(u.gy)], f: s.relevo.fatores[`unidade:${u.id}`] }))
    .filter((u) => u.f !== undefined)
    .sort((a, b) => b.f - a.f);
  afirmar(serfs.length > 0, 'algum serf deveria estar tingido');
  const serf = serfs[0];
  const chaoDoSerf = (await chaoEmVolta(s.camera, serf.tile[0], serf.tile[1], ocupadoAgora)).slice(0, 3);
  const retsP = chaoDoPredio.map(({ gx, gy }) => retDoTile(s.camera, gx, gy));
  const retsS = chaoDoSerf.map(({ gx, gy }) => retDoTile(s.camera, gx, gy));
  const [semB, comB] = await luminancias(page, [fotoSem, fotoObra], [...retsP, ...retsS]);
  const media = (ini, n) => (n === 0 ? null : Array.from({ length: n }, (_v, i) => ganho(comB[ini + i], semB[ini + i])).reduce((a, b) => a + b, 0) / n);
  const tetoSprite = relevoDado.tetoDoTintDoSprite;
  medidas.predio = {
    tile: [escolha.gx, escolha.gy], descidaNoPe: escolha.luz, fatorSobOPe: arred(fPredio),
    ganhoDoSprite: arred(Math.min(fPredio, tetoSprite)), ganhoDoChao: media(0, retsP.length) === null ? null : arred(media(0, retsP.length)),
    chaoUsado: chaoDoPredio, imagensTingidas: s.relevo.imagens[rotulo], tick: s.tick,
  };
  medidas.serf = {
    id: serf.id, tile: serf.tile, fatorSobOPe: arred(serf.f), ganhoDoSprite: arred(Math.min(serf.f, tetoSprite)),
    ganhoDoChao: media(retsP.length, retsS.length) === null ? null : arred(media(retsP.length, retsS.length)), chaoUsado: chaoDoSerf,
  };
  await capturar('vila-predio-e-serf-na-luz');

  // ---- C e D. o pe da serra e a encosta mais forte: com e sem relevo, mesma camera ----------
  const peDaSerra = (() => {
    let melhor = null;
    for (let gy = 2; gy < mapa.altura - 2; gy += 1) {
      for (let gx = 2; gx < mapa.largura - 2; gx += 1) {
        if (!anda(gx, gy) || !(tipoDo(gx, gy - 1) === 'montanha' || tipoDo(gx, gy - 2) === 'montanha')) continue;
        const luz = descidaParaOSul(gx, gy);
        if (melhor === null || luz > melhor.luz) melhor = { gx, gy, luz };
      }
    }
    return melhor;
  })();
  const encostaForte = (() => {
    let melhor = null;
    for (let y0 = 8; y0 + 8 <= mapa.altura - 8; y0 += 1) {
      for (let x0 = 8; x0 + 12 <= mapa.largura - 8; x0 += 1) {
        let n = 0;
        for (let y = y0; y < y0 + 8; y += 1) {
          for (let x = x0; x < x0 + 12; x += 1) {
            if (SEM_LIMITE.has(tipoDo(x, y))) continue;
            const v = [h(x, y), h(x + 1, y), h(x, y + 1), h(x + 1, y + 1)];
            if (Math.max(...v) - Math.min(...v) >= relevoDado.geracao.decliveMaximoEmDegraus) n += 1;
          }
        }
        if (melhor === null || n > melhor.n) melhor = { gx: x0 + 6, gy: y0 + 4, n };
      }
    }
    return melhor;
  })();
  medidas.lugares = { peDaSerra, encostaForte };

  /** Fotografa o lugar sem e com relevo, com a mesma camera, e devolve as duas fotos. */
  async function semEComRelevo(tile, nome) {
    await abrir(ctx, '');
    await aoZoom(ctx, canvas, ZOOM);
    const camSem = await irAoTile(ctx, tile);
    const sem = await foto(page);
    await capturar(`${nome}-sem-relevo`);
    await abrir(ctx, '&relevo');
    await aoZoom(ctx, canvas, ZOOM);
    const camCom = await irAoTile(ctx, tile);
    afirmar(camCom.scrollX === camSem.scrollX && camCom.scrollY === camSem.scrollY, `${nome}: a camera deveria repetir`);
    const com = await foto(page);
    await capturar(`${nome}-com-relevo`);
    return { sem, com, cam: camCom };
  }

  // O pe da serra: a faixa mais iluminada de chao andavel ao sul da montanha.
  const serra = await semEComRelevo(peDaSerra, 'pe-da-serra');
  const faixa = [];
  for (let gy = peDaSerra.gy - 3; gy <= peDaSerra.gy + 3; gy += 1) {
    for (let gx = peDaSerra.gx - 8; gx <= peDaSerra.gx + 8; gx += 1) {
      if (gx < 0 || gy < 0 || gx >= mapa.largura || gy >= mapa.altura || !ehChao(tipoDo(gx, gy)) || temSprite(gx, gy)) continue;
      const r = retDoTile(serra.cam, gx, gy);
      if (await descoberto(page, r)) faixa.push({ gx, gy, luz: descidaParaOSul(gx, gy), r });
    }
  }
  afirmar(faixa.length > 0, 'o pe da serra deveria ter chao descoberto no quadro');
  const [semC, comC] = await luminancias(page, [serra.sem, serra.com], faixa.map((t) => t.r));
  const ganhos = faixa.map((t, i) => ({ tile: [t.gx, t.gy], descida: t.luz, ganho: arred(ganho(comC[i], semC[i])) })).sort((a, b) => b.ganho - a.ganho);
  medidas.peDaSerra = {
    tilesMedidos: ganhos.length, maiorGanhoDoChao: ganhos[0], cincoMaiores: ganhos.slice(0, 5),
    ganhoQueUmSpriteTeria: Math.min(1, tetoSprite),
    diferencaPercentualMaxima: arred((ganhos[0].ganho - Math.min(1, tetoSprite)) * 100),
  };

  // A encosta mais forte: so a captura e a contagem; quem julga a parede e o olho (Read).
  await semEComRelevo(encostaForte, 'encosta-forte');

  fs.mkdirSync('test-output', { recursive: true });
  fs.writeFileSync(`test-output/${FEATURE}.json`, JSON.stringify(medidas, null, 2));
}

module.exports = { roteiro };
