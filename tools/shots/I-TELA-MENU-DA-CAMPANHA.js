'use strict';
// I-TELA-MENU-DA-CAMPANHA (e o aceite 4 do I-OBRA-FASE-LIBERA) — a campanha pela tela:
//   1. `/` sem progresso: Novo jogo > Campanha (o icone medido) > a lista com a fase 1 aberta e a 2 com
//      cadeado > a fase 1 mostra a narrativa > Comecar, com o jogo ANDANDO e o gesto segurado 150 ms
//      (CLAUDE.md §8); o roteiro pausa de volta.
//   2. A partida abre com o mapa da fase 1: o id do mapa, um tile que difere do sertao com o terreno do
//      dado da fase, a linha do objetivo, e o menu Build com a fazenda no cadeado da campanha.
//   3. A partida que `tests/I-TELA-MENU-DA-CAMPANHA.test.ts` grava (a fase 1 a um tick da vitoria), pela
//      gaveta (`?gaveta=1`): abre com o mapa da fase, vence, mostra Proxima fase; o progresso grava a 1.
//   4. Proxima fase abre a fase 2; e o menu, de volta, tem a fase 2 aberta.
const { readFileSync, existsSync } = require('node:fs');
const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');
const sertao = require('../../data/maps/sertao-128.json');
const fase1 = require('../../data/campanha/fase-01-pianco.json');

const MENU = (acao) => `#menu-inicial button[data-acao="${acao}"]`;
const TIMEOUT_PRONTO_MS = 15_000;

/** O primeiro tile em que o terreno da fase 1 difere do sertao (o tile que prova o mapa da fase). */
function tileQueDifere() {
  for (let gy = 0; gy < fase1.mapa.altura; gy++) {
    for (let gx = 0; gx < fase1.mapa.largura; gx++) {
      const daFase = fase1.mapa.legenda[fase1.mapa.linhas[gy][gx]];
      const doSertao = sertao.legenda[sertao.linhas[gy][gx]];
      if (daFase !== doSertao) return { gx, gy, terreno: daFase };
    }
  }
  return null;
}

async function roteiro({ page, capturar, afirmar }) {
  const base = new URL('/', page.url()).href;
  const esperar = (ms = 300) => page.waitForTimeout(ms);
  const esperarJogo = () => page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS });
  /** O clique segurado 150 ms (§8), no centro do elemento medido agora. */
  async function segurar(seletor) {
    const c = await page.$eval(seletor, (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }

  // ---- 1. o menu, sem progresso ----------------------------------------------------------------
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(base);
  await page.waitForSelector('#menu-inicial');
  await segurar(MENU('novo'));
  await esperar();
  const icone = await page.$eval(MENU('campanha'), (b) => {
    const antes = window.getComputedStyle(b, '::before');
    return { largura: parseFloat(antes.width), altura: parseFloat(antes.height), imagem: antes.backgroundImage, texto: b.textContent };
  });
  afirmar(icone.texto === tema.menuInicial.campanha, `o botao da campanha deveria dizer '${tema.menuInicial.campanha}': ${icone.texto}`);
  afirmar(icone.largura === 48 && icone.altura === 48, `o icone deveria ter 48x48 no botao: ${icone.largura}x${icone.altura}`);
  afirmar(/campanha\.png/.test(icone.imagem), `o icone deveria ser o campanha.png: ${icone.imagem}`);
  const urlDoIcone = /url\("?([^")]+)"?\)/.exec(icone.imagem)?.[1];
  const resposta = urlDoIcone ? await page.request.get(urlDoIcone) : null;
  afirmar(resposta !== null && resposta.status() === 200, `o PNG do icone deveria carregar: ${urlDoIcone} -> ${resposta && resposta.status()}`);
  await capturar('botao');
  await segurar(MENU('campanha'));
  await esperar();
  const lista = await page.$$eval('#menu-inicial [data-tela="campanha"] button[data-acao^="fase-"]', (bs) => bs.map((b) => ({ acao: b.dataset.acao, trancada: b.getAttribute('aria-disabled') === 'true' })));
  afirmar(lista.length === 10, `a lista deveria ter as dez fases: ${lista.length}`);
  afirmar(lista[0] && !lista[0].trancada, 'a fase 1 deveria estar aberta');
  afirmar(lista.slice(1).every((f) => f.trancada), `sem progresso, as fases 2 a 10 deveriam ter cadeado: ${JSON.stringify(lista)}`);
  const motivo = await page.textContent('#menu-inicial [data-motivo="fase-2"]');
  afirmar(motivo === tema.campanha.trancada, `o cadeado da fase 2 deveria dizer '${tema.campanha.trancada}': ${motivo}`);
  await capturar('lista');
  await segurar(MENU('fase-1'));
  await esperar();
  const narrativa = await page.textContent('#menu-inicial [data-tela="fase"] .narrativa');
  afirmar(narrativa === fase1.narrativa, `a fase 1 deveria mostrar a narrativa do dado: ${narrativa}`);
  await capturar('fase');
  // §8: a pagina sem `pausado` nasce andando; o Comecar e segurado, e o roteiro pausa de volta
  await segurar('#menu-inicial [data-tela="fase"] button[data-acao="comecar"]');
  await esperarJogo();
  await esperar(600);
  await page.keyboard.press('p');
  await esperar();

  // ---- 2. a partida da fase 1 ------------------------------------------------------------------
  const mapa = await page.evaluate(() => window.__cangacoPartida.mapa());
  afirmar(mapa.id === fase1.id, `a partida deveria abrir com o mapa da fase 1: ${mapa.id}`);
  const tile = tileQueDifere();
  afirmar(tile !== null, 'a fase 1 deveria ter algum tile diferente do sertao');
  const terreno = await page.evaluate(([gx, gy]) => window.__cangacoPartida.terreno(gx, gy), [tile.gx, tile.gy]);
  afirmar(terreno === tile.terreno, `o tile (${tile.gx},${tile.gy}) deveria ser '${tile.terreno}' (o da fase), veio '${terreno}'`);
  const estado = JSON.parse(await page.evaluate(() => window.__cangacoPartida.estadoSerializado()));
  afirmar(estado.fase && estado.fase.id === fase1.id, `o estado deveria ser da fase 1: ${JSON.stringify(estado.fase)}`);
  const objetivo = await page.evaluate(() => { const e = window.document.querySelector('#objetivo-da-fase'); return { hidden: e.hidden, texto: e.textContent }; });
  afirmar(!objetivo.hidden && objetivo.texto.includes('Cabo Branco'), `a linha do objetivo deveria falar do Cabo Branco: ${JSON.stringify(objetivo)}`);
  await capturar('partida');
  // I-OBRA-FASE-LIBERA, aceite 4: a fazenda no cadeado da campanha (o wrapper abre a sub-aba dela)
  const fazenda = '#menu-build [data-predio="farm"]';
  await page.hover(fazenda);
  await esperar();
  const trancada = await page.getAttribute(fazenda, 'aria-disabled');
  afirmar(trancada === 'true', `a fazenda deveria estar trancada na fase 1: aria-disabled=${trancada}`);
  const cartao = await page.evaluate(() => window.document.querySelector('#menu-build [data-planta="farm"]')?.textContent ?? '');
  afirmar(cartao.includes(tema.menuBuild.trancadoNaCampanha), `o cartao da fazenda deveria dizer '${tema.menuBuild.trancadoNaCampanha}': ${cartao}`);
  await capturar('cadeado');

  // ---- 3. a partida gravada, a um tick da vitoria, pela gaveta ---------------------------------
  const arquivo = 'test-output/I-TELA-MENU-DA-CAMPANHA.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode o teste antes`);
  await page.evaluate(([k, v]) => { window.localStorage.clear(); window.localStorage.setItem(k, v); }, ['cangaco:partida', readFileSync(arquivo, 'utf8')]);
  await page.goto(`${base}?gaveta=1&pausado`);
  await esperarJogo();
  const doSave = await page.evaluate(() => ({ mapa: window.__cangacoPartida.mapa().id, estado: JSON.parse(window.__cangacoPartida.estadoSerializado()) }));
  afirmar(doSave.mapa === fase1.id && doSave.estado.fase && doSave.estado.fase.id === fase1.id, `o save da fase deveria abrir com o mapa dela: ${doSave.mapa}`);
  const terrenoDoSave = await page.evaluate(([gx, gy]) => window.__cangacoPartida.terreno(gx, gy), [tile.gx, tile.gy]);
  afirmar(terrenoDoSave === tile.terreno, `o tile do save deveria ser o da fase: ${terrenoDoSave}`);
  await page.keyboard.press('p');
  await page.waitForSelector('#fim-de-partida:not([hidden])', { timeout: 5_000 });
  await page.keyboard.press('p');
  await esperar();
  const fim = await page.evaluate(() => {
    const e = window.document.querySelector('#fim-de-partida');
    const proxima = e.querySelector('button[data-acao="proxima"]');
    return { fim: e.dataset.fim, titulo: e.querySelector('h2').textContent, proxima: proxima !== null && !proxima.hidden };
  });
  afirmar(fim.fim === 'vitoria' && fim.titulo.includes('Piancó') && fim.proxima, `a fase 1 deveria terminar em vitoria com Proxima fase: ${JSON.stringify(fim)}`);
  const progresso = await page.evaluate(() => window.localStorage.getItem('cangaco.campanha'));
  afirmar(progresso !== null && JSON.parse(progresso).vencidas.includes(1), `a vitoria deveria gravar a fase 1: ${progresso}`);
  await capturar('vitoria');

  // ---- 4. Proxima fase, e o menu com a fase 2 aberta -------------------------------------------
  await segurar('#fim-de-partida button[data-acao="proxima"]');
  await page.waitForURL(/campanha=fase-02-patos/, { timeout: TIMEOUT_PRONTO_MS });
  await esperarJogo();
  const mapa2 = await page.evaluate(() => window.__cangacoPartida.mapa().id);
  afirmar(mapa2 === 'fase-02-patos', `Proxima fase deveria abrir a fase 2: ${mapa2}`);
  await page.keyboard.press('p');
  await page.goto(base);
  await page.waitForSelector('#menu-inicial');
  await segurar(MENU('novo'));
  await esperar();
  await segurar(MENU('campanha'));
  await esperar();
  const depois = await page.$$eval('#menu-inicial [data-tela="campanha"] button[data-acao^="fase-"]', (bs) => bs.map((b) => b.getAttribute('aria-disabled') === 'true'));
  afirmar(depois[1] === false && depois[2] === true, `com a fase 1 vencida, a 2 deveria abrir e a 3 nao: ${JSON.stringify(depois)}`);
  await capturar('lista-depois');
}

module.exports = { roteiro };
