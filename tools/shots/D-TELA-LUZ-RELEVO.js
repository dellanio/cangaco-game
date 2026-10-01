'use strict';

// Roteiro da D-TELA-LUZ-RELEVO — A LUZ DO RELEVO, LIGADA (docs/planos/relevo-a.md, Tarefa 4).
//
// O relevo nasce desligado (`data/relevo.json`, `ligado: false`); este roteiro o liga pela URL
// (`?relevo`) e prova, sobre o quadro da vila a zoom 0,5:
//
//  1. o CHAO PLANO e igual pixel a pixel com o relevo ligado e desligado (decisao 7: as duas
//     camadas sao neutras exatas no plano). Para provar que a comparacao acusa, uma encosta do
//     mesmo quadro tem de DIFERIR;
//  2. as duas geometrias lado a lado (decisao 9): 8 px por degrau (o dado) e 12,8 (`?relevoPx`);
//  3. a saturacao da areia clara nas encostas de luz, medida (decisao 10): quantos pixels passam a
//     ter canal em 255 por causa da luz. E medida para o operador, nao reprova;
//  4. o tint: arvore e rocha do quadro tingidas ao nascer; a pedreira plantada numa encosta de
//     SOMBRA, com fator < 1, e tingida de novo cada vez que o container da obra e recriado;
//  5. o tint do serf segue a posicao do pe (decisao 6; por tile, o salto chegava a 61 niveis de
//     cinza no pe da serra): a serie de trocas vai para test-output/, e o quadro de antes e o de
//     depois de uma troca vao para screenshots/.
//
// Tudo que e lugar sai do dado (mapa, altura emitida, economy.json) e do estado publicado;
// nenhuma coordenada de paisagem esta digitada aqui. Um clique em menu e despausado e segurado
// 150 ms (CLAUDE.md §8).

const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const { retanguloDoCanvas, arrastarDentroDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const { bloqueiaConstrucao, caixaLivre, arrastosDaRede } = require('./_recursos');
const { erguerRua } = require('./_estradas');
const economia = require('../../data/economy.json');
const relevoDado = require('../../data/relevo.json');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const altura = require('../../data/maps/sertao-128.relevo.json');
const { predios } = require('../../data/buildings.json');
const manifesto = require('../../assets/manifest.json');

const FEATURE = 'D-TELA-LUZ-RELEVO';
const TILE_PX = terreno.tile_px;
/** O quadro: a vila inteira, o acude com a areia, o lajedo e as primeiras arvores. */
const ZOOM = 0.5;
/** A geometria alternativa da decisao 9 (norte ~0,71). A do dado e `relevoDado.pxDeMundoPorDegrau`. */
const PX_ALTERNATIVO = 12.8;
const TETO_PRONTO_MS = 10_000;
const TETO_ATE_RETINGIR_OBRA = 1500;
const TETO_ATE_SERF_CRUZAR = 600;
const DIGITOS = '0123456789abcdefghijklmnopqrstuvwxyz';

const h = (vx, vy) => DIGITOS.indexOf(altura.linhas[vy][vx]);
const tipoDo = (gx, gy) => mapa.legenda[mapa.linhas[gy][gx]];
const tamanhoDe = (id) => predios.find((p) => p.id === id).tamanho;
const ehChaoLivre = (t) => t === 'grama' || t === 'areia' || t === 'campoArado';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const base = page.url().split('?')[0];
  const medidas = { quadro: { zoom: ZOOM } };

  async function abrir(busca) {
    await page.goto(`${base}?pausado${busca}`);
    await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), { timeout: TETO_PRONTO_MS });
    const s = await estado();
    afirmar(s.tick === 0, `a pagina ${busca || '(sem relevo)'} deveria nascer no tick 0, veio ${s.tick}`);
  }

  /** A roda no centro do canvas ate o zoom do quadro: passos discretos, entao o mesmo gesto da a
   *  mesma camera em toda carga da pagina — e isso que deixa comparar pixel entre cargas. */
  async function aoZoomDoQuadro(canvas) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 6 && (await estado()).camera.zoom > ZOOM; i += 1) {
      await page.mouse.wheel(0, 100);
      await esperarFrame();
    }
    const { camera } = await estado();
    afirmar(camera.zoom === ZOOM, `o quadro deveria estar a zoom ${ZOOM}, veio ${camera.zoom}`);
    return camera;
  }

  const foto = async () => (await page.screenshot({ type: 'png' })).toString('base64');

  // ---- 0. a referencia, sem relevo ----------------------------------------------------------
  const canvas = await retanguloDoCanvas(page);
  const camera = await aoZoomDoQuadro(canvas);
  const inicio = await estado();
  afirmar(inicio.relevo === undefined, `sem ?relevo o debug nao deveria ter o campo relevo, veio ${JSON.stringify(inicio.relevo)}`);
  const fotoSem = await foto();
  await capturar('sem-relevo');

  // O mundo visivel, so o miolo do quadro (o HUD cobre as bordas), em tiles inteiros.
  const meioX = canvas.width / 2;
  const meioY = canvas.height / 2;
  const mundo = {
    x0: camera.scrollX + meioX - (meioX / ZOOM) * 0.6,
    x1: camera.scrollX + meioX + (meioX / ZOOM) * 0.6,
    y0: camera.scrollY + meioY - (meioY / ZOOM) * 0.6,
    y1: camera.scrollY + meioY + (meioY / ZOOM) * 0.6,
  };
  const tiles = {
    gx0: Math.ceil(mundo.x0 / TILE_PX), gx1: Math.floor(mundo.x1 / TILE_PX) - 1,
    gy0: Math.ceil(mundo.y0 / TILE_PX), gy1: Math.floor(mundo.y1 / TILE_PX) - 1,
  };
  medidas.quadro.tiles = tiles;
  const noMiolo = (gx, gy) => gx >= tiles.gx0 && gx <= tiles.gx1 && gy >= tiles.gy0 && gy <= tiles.gy1;
  // O quadro visivel inteiro, para a saturacao: o HUD e igual nas duas fotos e nao soma.
  const visivel = {
    gx0: Math.ceil((camera.scrollX + meioX - meioX / ZOOM) / TILE_PX),
    gx1: Math.floor((camera.scrollX + meioX + meioX / ZOOM) / TILE_PX) - 1,
    gy0: Math.ceil((camera.scrollY + meioY - meioY / ZOOM) / TILE_PX),
    gy1: Math.floor((camera.scrollY + meioY + meioY / ZOOM) / TILE_PX) - 1,
  };
  medidas.quadro.visivel = visivel;

  // Tile ocupado por desenho em pe: predio, unidade, ou recurso que vira sprite. O sprite sobe a
  // partir do pe, entao a sombra de desenho vai ate 3 tiles acima e um para cada lado.
  const ocupados = new Set();
  const marcar = (gx, gy) => {
    for (let y = gy - 3; y <= gy; y += 1) for (let x = gx - 1; x <= gx + 1; x += 1) ocupados.add(`${x},${y}`);
  };
  // So o recurso que o manifesto desenha EM PE (`tipo: "vegetacao"`): o resto (peixe, minerio) e
  // marcador de chao, abaixo das camadas de luz, e recebe a luz junto com o chao.
  const emPe = new Set(Object.values(manifesto).flat().filter((a) => a && a.tipo === 'vegetacao').map((a) => a.id));
  for (const tipo of emPe) for (const [gx, gy] of mapa.recursos[tipo] ?? []) marcar(gx, gy);
  for (const p of Object.values(inicio.prediosDoEstado)) {
    const [w, a] = tamanhoDe(p.tipo);
    for (let y = p.gy; y < p.gy + a; y += 1) for (let x = p.gx; x < p.gx + w; x += 1) marcar(x, y);
  }
  for (const u of inicio.unidadesRenderizadas) marcar(Math.floor(u.gx), Math.floor(u.gy));
  const livre = (gx, gy) => !ocupados.has(`${gx},${gy}`);

  /** O retangulo de tela (px da pagina) de um bloco de tiles, para dentro em px inteiros. */
  const retDeTiles = (gx, gy, w, a) => {
    const tela = (mx, my) => ({
      x: canvas.left + (mx - camera.scrollX - meioX) * ZOOM + meioX,
      y: canvas.top + (my - camera.scrollY - meioY) * ZOOM + meioY,
    });
    const p0 = tela(gx * TILE_PX, gy * TILE_PX);
    const p1 = tela((gx + w) * TILE_PX, (gy + a) * TILE_PX);
    const x = Math.ceil(p0.x) + 1;
    const y = Math.ceil(p0.y) + 1;
    return { x, y, w: Math.floor(p1.x) - 1 - x, h: Math.floor(p1.y) - 1 - y };
  };

  /** O retangulo esta sobre o canvas do jogo, sem HUD por cima? Debaixo do HUD a comparacao
   *  passaria por igual sem medir nada: conferido no navegador, nos cantos e no centro. */
  const descoberto = (r) => page.evaluate((ret) => {
    const jogo = window.document.querySelector('#jogo canvas');
    const pontos = [[ret.x, ret.y], [ret.x + ret.w, ret.y], [ret.x, ret.y + ret.h], [ret.x + ret.w, ret.y + ret.h],
      [ret.x + ret.w / 2, ret.y + ret.h / 2]];
    return pontos.every(([x, y]) => window.document.elementFromPoint(x, y) === jogo);
  }, r);

  // O chao plano: um tile de grama com todo vertice que a luz dele le (a moldura de um vertice em
  // volta, pela diferenca central) na mesma altura, nada em pe por perto e sem HUD por cima.
  let plano = null;
  for (let gy = visivel.gy0 + 1; gy <= visivel.gy1 - 1 && plano === null; gy += 1) {
    for (let gx = visivel.gx0 + 1; gx <= visivel.gx1 - 1 && plano === null; gx += 1) {
      const alvo = h(gx, gy);
      let ok = tipoDo(gx, gy) === 'grama' && livre(gx, gy);
      for (let vy = gy - 1; vy <= gy + 2 && ok; vy += 1) for (let vx = gx - 1; vx <= gx + 2 && ok; vx += 1) ok = h(vx, vy) === alvo;
      if (ok && await descoberto(retDeTiles(gx, gy, 1, 1))) plano = { gx, gy };
    }
  }
  afirmar(plano !== null, 'o quadro da vila deveria ter um tile de grama plana, livre e sem HUD por cima');

  // A encosta de controle: um tile de chao livre cuja vizinhanca de vertices nao e plana.
  let encosta = null;
  for (let gy = tiles.gy0 + 1; gy <= tiles.gy1 - 1 && encosta === null; gy += 1) {
    for (let gx = tiles.gx0 + 1; gx <= tiles.gx1 - 1 && encosta === null; gx += 1) {
      if (!ehChaoLivre(tipoDo(gx, gy)) || !livre(gx, gy)) continue;
      const v = [h(gx, gy), h(gx + 1, gy), h(gx, gy + 1), h(gx + 1, gy + 1)];
      if (Math.max(...v) - Math.min(...v) >= 1 && await descoberto(retDeTiles(gx, gy, 1, 1))) encosta = { gx, gy };
    }
  }
  afirmar(encosta !== null, 'o quadro da vila deveria ter uma encosta de chao livre');

  // A areia nas encostas de LUZ: a altura cai para o sul nos cantos do tile.
  const areiaDeLuz = [];
  for (let gy = visivel.gy0; gy <= visivel.gy1; gy += 1) {
    for (let gx = visivel.gx0; gx <= visivel.gx1; gx += 1) {
      if (tipoDo(gx, gy) !== 'areia' || !livre(gx, gy)) continue;
      let g = 0;
      for (const [vx, vy] of [[gx, gy], [gx + 1, gy], [gx, gy + 1], [gx + 1, gy + 1]]) g += h(vx, vy + 1) - h(vx, vy - 1);
      if (g < 0) areiaDeLuz.push({ gx, gy });
    }
  }
  medidas.regioes = { plano, encosta, areiaDeLuz: areiaDeLuz.length };

  /** Decodifica as duas fotos NO NAVEGADOR (sem dependencia nova) e compara cada retangulo. */
  async function comparar(a, b, rets) {
    return page.evaluate(async ({ a, b, rets }) => {
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
      const ga = await ler(a);
      const gb = await ler(b);
      return rets.map((r) => {
        const da = ga.getImageData(r.x, r.y, r.w, r.h).data;
        const db = gb.getImageData(r.x, r.y, r.w, r.h).data;
        let diferentes = 0;
        let saturaram = 0;
        for (let i = 0; i < da.length; i += 4) {
          if (da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2]) diferentes += 1;
          let novo = false;
          for (let k = 0; k < 3; k += 1) if (db[i + k] === 255 && da[i + k] < 255) novo = true;
          if (novo) saturaram += 1;
        }
        return { pixels: da.length / 4, diferentes, saturaram };
      });
    }, { a, b, rets });
  }

  // ---- 1 e 2. relevo ligado, as duas geometrias ---------------------------------------------
  const relevoNaPagina = async (px) => {
    const s = await estado();
    afirmar(s.relevo !== undefined && s.relevo.ativo === true, `com ?relevo o debug deveria publicar relevo.ativo, veio ${JSON.stringify(s.relevo)}`);
    afirmar(s.renderizador.tipo === s.renderizador.webgl, 'o relevo precisa do WebGL (D-TELA-06)');
    afirmar(
      s.relevo.vertices[0] === altura.largura && s.relevo.vertices[1] === altura.altura,
      `a grade de vertices deveria ser ${altura.largura}x${altura.altura}, veio ${JSON.stringify(s.relevo.vertices)}`,
    );
    afirmar(s.relevo.pxDeMundoPorDegrau === px, `o px por degrau deveria ser ${px}, veio ${s.relevo.pxDeMundoPorDegrau}`);
    return s;
  };

  const retPlano = retDeTiles(plano.gx, plano.gy, 1, 1);
  const retEncosta = retDeTiles(encosta.gx, encosta.gy, 1, 1);
  const retsAreia = areiaDeLuz.map(({ gx, gy }) => retDeTiles(gx, gy, 1, 1));
  const geometrias = {};
  for (const [nome, busca, px] of [
    ['relevo-8px', '&relevo', relevoDado.pxDeMundoPorDegrau],
    ['relevo-12_8px', `&relevo&relevoPx=${PX_ALTERNATIVO}`, PX_ALTERNATIVO],
  ]) {
    await abrir(busca);
    const cam = await aoZoomDoQuadro(canvas);
    afirmar(cam.scrollX === camera.scrollX && cam.scrollY === camera.scrollY, `a camera de ${nome} deveria ser a da referencia`);
    const s = await relevoNaPagina(px);
    const f = await foto();
    await capturar(nome);
    const [cPlano, cEncosta, ...cAreia] = await comparar(fotoSem, f, [retPlano, retEncosta, ...retsAreia]);
    afirmar(cPlano.pixels > 0 && cPlano.diferentes === 0, `${nome}: o chao plano deveria ser igual pixel a pixel ao sem relevo, ${JSON.stringify(cPlano)}`);
    afirmar(cEncosta.diferentes > 0, `${nome}: a encosta deveria mudar com o relevo (prova de que a comparacao acusa), ${JSON.stringify(cEncosta)}`);
    const areia = cAreia.reduce((t, c) => ({ pixels: t.pixels + c.pixels, saturaram: t.saturaram + c.saturaram }), { pixels: 0, saturaram: 0 });
    geometrias[nome] = { px, faixa: s.relevo.faixa, plano: cPlano, encosta: cEncosta, areiaDeLuz: { ...areia, fracao: areia.pixels === 0 ? 0 : areia.saturaram / areia.pixels } };
  }
  medidas.geometrias = geometrias;

  // ---- 4. o tint: arvore e rocha ao nascer --------------------------------------------------
  await abrir('&relevo');
  await aoZoomDoQuadro(canvas);
  let s = await relevoNaPagina(relevoDado.pxDeMundoPorDegrau);
  const [fMin, fMax] = s.relevo.faixa;
  const dentro = (f) => f >= fMin - 1e-6 && f <= fMax + 1e-6;
  const doTipo = (tipo) => (mapa.recursos[tipo] ?? []).filter(([gx, gy]) => noMiolo(gx, gy)).map(([gx, gy]) => `vegetacao:${gx},${gy}`);
  for (const tipo of ['tree', 'rock']) {
    const chaves = doTipo(tipo).filter((k) => s.relevo.fatores[k] !== undefined);
    afirmar(chaves.length > 0, `o quadro deveria ter ${tipo} tingido ao nascer; fatores: ${Object.keys(s.relevo.fatores).length}`);
    afirmar(chaves.every((k) => dentro(s.relevo.fatores[k])), `${tipo}: fator fora da faixa do mapa`);
    medidas[`fatores_${tipo}`] = Object.fromEntries(chaves.slice(0, 8).map((k) => [k, s.relevo.fatores[k]]));
  }

  // ---- 4. a pedreira numa encosta de SOMBRA, ligada a vila por rua em L ---------------------
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const ocupadoPorPredio = new Set();
  for (const p of Object.values(s.prediosDoEstado)) {
    const [w, a] = tamanhoDe(p.tipo);
    for (let y = p.gy; y < p.gy + a; y += 1) for (let x = p.gx; x < p.gx + w; x += 1) ocupadoPorPredio.add(`${x},${y}`);
  }
  const [largQu, altQu] = tamanhoDe('quarry');
  const yVila = armazem.gy + tamanhoDe('storehouse')[1];
  const transitavel = (gx, gy) => ehChaoLivre(tipoDo(gx, gy)) && !bloqueiaConstrucao(gx, gy);
  let escolha = null;
  for (let gy = tiles.gy0; gy + altQu < yVila; gy += 1) {
    for (let gx = tiles.gx0; gx + largQu - 1 <= tiles.gx1; gx += 1) {
      const pe = { vx: gx + Math.floor(largQu / 2), vy: gy + altQu };
      const sombra = h(pe.vx, pe.vy + 1) - h(pe.vx, pe.vy - 1); // > 0: sobe para o sul, encosta virada ao norte
      if (sombra <= 0 || !caixaLivre(gx, gy, largQu, altQu)) continue;
      let ok = true;
      for (let y = gy; y < gy + altQu && ok; y += 1) for (let x = gx; x < gx + largQu && ok; x += 1) ok = transitavel(x, y) && !ocupadoPorPredio.has(`${x},${y}`);
      const col = gx + largQu - 1;
      const yPorta = gy + altQu;
      const rua = [];
      for (let x = gx; x <= col; x += 1) rua.push({ gx: x, gy: yPorta });
      for (let y = yPorta + 1; y <= yVila; y += 1) rua.push({ gx: col, gy: y });
      const ruaDaVila = [];
      for (let x = armazem.gx; x < col; x += 1) ruaDaVila.push({ gx: x, gy: yVila });
      ok = ok && [...rua, ...ruaDaVila].every((t) => transitavel(t.gx, t.gy) && !ocupadoPorPredio.has(`${t.gx},${t.gy}`));
      if (!ok) continue;
      // A sombra mais forte no pe primeiro; a rua mais curta desempata.
      const custo = rua.length + ruaDaVila.length;
      const melhor = escolha === null || sombra > escolha.sombra || (sombra === escolha.sombra && custo < escolha.custo);
      if (melhor) escolha = { gx, gy, sombra, custo, rua, ruaDaVila };
    }
  }
  afirmar(escolha !== null, 'o quadro deveria ter uma encosta de sombra onde a pedreira cabe, com rua ate a vila');
  medidas.pedreira = { gx: escolha.gx, gy: escolha.gy, sombraNoPe: escolha.sombra };

  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const cam = (await estado()).camera;
  for (const trecho of [...arrastosDaRede(escolha.rua), ...arrastosDaRede(escolha.ruaDaVila)]) {
    await arrastarDentroDoCanvas(page, canvas, [
      pontoDoTileNaTela(canvas, trecho.de, cam, TILE_PX), pontoDoTileNaTela(canvas, trecho.ate, cam, TILE_PX),
    ]);
    await avancar(1);
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await esperarFrame();
  await erguerRua(ctx, { tiles: escolha.rua.length + escolha.ruaDaVila.length });

  // O menu, despausado e segurado 150 ms (§8): o caso que o page.click instantaneo nao exerce.
  const botao = await page.$('[data-predio="quarry"]');
  afirmar(botao !== null, 'o menu Construir deveria ter a pedreira');
  const caixaDoBotao = await botao.boundingBox();
  await page.keyboard.press('p');
  await page.mouse.move(caixaDoBotao.x + caixaDoBotao.width / 2, caixaDoBotao.y + caixaDoBotao.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.keyboard.press('p');
  await esperarFrame();
  const pontoDaPedreira = pontoDoTileNaTela(canvas, { gx: escolha.gx, gy: escolha.gy }, (await estado()).camera, TILE_PX);
  await page.mouse.click(pontoDaPedreira.x, pontoDaPedreira.y);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  s = await estado();
  const achado = Object.entries(s.prediosDoEstado).find(([, p]) => p.tipo === 'quarry' && p.gx === escolha.gx && p.gy === escolha.gy);
  afirmar(achado !== undefined, `a pedreira deveria estar plantada em (${escolha.gx},${escolha.gy})`);
  const rotuloDaPedreira = `predio:${achado[0]}`;
  const fPedreira = s.relevo.fatores[rotuloDaPedreira];
  afirmar(fPedreira !== undefined && fPedreira < 1, `a pedreira na encosta de sombra deveria ter fator < 1, veio ${fPedreira}`);
  const tintagens0 = s.relevo.tintagens[rotuloDaPedreira];

  // O container da obra e recriado quando chega material ou sobe o hp: o tint tem de ir junto, e
  // so vale quando a obra ja tem sprite (a "marcacao no chao" e retangulo e texto, sem Image).
  const retingidaComSprite = (e) => (e.relevo.tintagens[rotuloDaPedreira] ?? 0) > tintagens0
    && (e.relevo.imagens[rotuloDaPedreira] ?? 0) > 0;
  let gastos = 0;
  while (!retingidaComSprite(s) && gastos < TETO_ATE_RETINGIR_OBRA) {
    await avancar(25);
    gastos += 25;
    await esperarFrame();
    s = await estado();
  }
  afirmar(
    retingidaComSprite(s),
    `a obra recriada, ja com sprite, deveria ser tingida de novo em ${TETO_ATE_RETINGIR_OBRA} ticks `
    + `(tick ${s.tick}, hp ${s.prediosDoEstado[achado[0]]?.hp}, imagens ${s.relevo.imagens[rotuloDaPedreira]})`,
  );
  afirmar(s.relevo.fatores[rotuloDaPedreira] === fPedreira, 'a obra recriada e tingida pelo mesmo pe, com o mesmo fator');
  medidas.pedreira = {
    ...medidas.pedreira, fator: fPedreira, tintagens: s.relevo.tintagens[rotuloDaPedreira],
    imagensTingidas: s.relevo.imagens[rotuloDaPedreira], tick: s.tick,
  };
  await capturar('encosta-com-obra');

  // ---- 5. o tint do serf andando: a serie e os dois quadros ---------------------------------
  const unidadesTingidas = () => Object.keys(s.relevo.tintagens).filter((k) => k.startsWith('unidade:'));
  afirmar(unidadesTingidas().length > 0, 'as unidades com sprite deveriam ter tint');
  const serie = [];
  let cruzou = null;
  for (let t = 0; t < TETO_ATE_SERF_CRUZAR && cruzou === null; t += 1) {
    const anterior = s;
    const antes = await page.screenshot({ type: 'png' });
    await avancar(1);
    await esperarFrame();
    s = await estado();
    for (const u of s.unidadesRenderizadas) {
      if (u.tipo !== 'serf') continue;
      const k = `unidade:${u.id}`;
      const n0 = anterior.relevo.tintagens[k] ?? 0;
      const n1 = s.relevo.tintagens[k] ?? 0;
      if (n1 > n0 && n0 > 0) {
        const f0 = anterior.relevo.fatores[k];
        const f1 = s.relevo.fatores[k];
        serie.push({ tick: s.tick, id: u.id, tile: [Math.floor(u.gx), Math.floor(u.gy)], de: f0, para: f1, salto: Math.abs(f1 - f0) });
        if (cruzou === null && Math.abs(f1 - f0) > 0 && noMiolo(Math.floor(u.gx), Math.floor(u.gy))) {
          cruzou = { u, antes, depois: await page.screenshot({ type: 'png' }) };
        }
      }
    }
  }
  afirmar(serie.length > 0, `algum serf andando deveria ter o tint trocado em ${TETO_ATE_SERF_CRUZAR} ticks`);
  if (cruzou !== null) {
    const centro = pontoDoTileNaTela(canvas, { gx: Math.floor(cruzou.u.gx), gy: Math.floor(cruzou.u.gy) }, s.camera, TILE_PX);
    const lado = 6 * TILE_PX * ZOOM;
    const clip = { x: Math.max(0, centro.x - lado / 2), y: Math.max(0, centro.y - lado / 2), width: lado, height: lado };
    const recortar = async (png) => page.evaluate(async ({ b64, clip }) => {
      const img = new window.Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = window.document.createElement('canvas');
      c.width = clip.width * 3;
      c.height = clip.height * 3;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, clip.x, clip.y, clip.width, clip.height, 0, 0, c.width, c.height);
      return c.toDataURL('image/png').split(',')[1];
    }, { b64: png.toString('base64'), clip });
    fs.mkdirSync('screenshots', { recursive: true });
    fs.writeFileSync(`screenshots/${FEATURE}-serf-antes-da-troca.png`, Buffer.from(await recortar(cruzou.antes), 'base64'));
    fs.writeFileSync(`screenshots/${FEATURE}-serf-depois-da-troca.png`, Buffer.from(await recortar(cruzou.depois), 'base64'));
  }
  const saltos = serie.map((p) => p.salto);
  medidas.tintDaUnidade = {
    trocas: serie.length,
    maiorSalto: Math.max(...saltos),
    saltoMedio: saltos.reduce((a, b) => a + b, 0) / saltos.length,
    maiorSaltoEmCinza: Math.round(Math.max(...saltos) * 255),
    recorte: cruzou === null ? null : { id: cruzou.u.id },
  };
  fs.mkdirSync('test-output', { recursive: true });
  fs.writeFileSync(`test-output/${FEATURE}-tint-da-unidade.json`, JSON.stringify(serie, null, 2));
  fs.writeFileSync(`test-output/${FEATURE}-medidas.json`, JSON.stringify(medidas, null, 2));
}

module.exports = { roteiro };
