'use strict';

// Roteiro da F-IA-DIFICULDADE — O NIVEL DO ADVERSARIO SE ESCOLHE NO CONFIGURAR PARTIDA.
//
// O headless (`tests/F-IA-DIFICULDADE.test.ts`) prova os numeros de cada nivel, a ordem do primeiro
// ataque e o save. Aqui, a tela: Novo jogo > Escaramuca mostra o nivel ao lado da paz, uma opcao por
// nivel do dado, com o normal marcado; escolher o dificil e Comecar (segurado 150 ms, como o
// jogador) faz a partida nascer com o nivel no estado (`ia.<lado>.nivel`), lido do estado
// serializado (harness de E-TELA-MENU-INICIAL).

const { URL } = require('node:url');
const tema = require('../../data/theme-sertao.json');
const combate = require('../../data/combat.json');

const BOTAO = (acao) => `#menu-inicial button[data-acao="${acao}"]`;
const NIVEL = '#menu-inicial select[data-campo="nivel"]';
const LADO_DA_IA = 1;

async function roteiro(ctx) {
  const { page, capturar, afirmar } = ctx;
  const base = new URL('/', page.url()).href;
  const niveis = Object.keys(combate.ia.niveis).filter((k) => !k.startsWith('_'));

  await page.goto(`${base}?menu&pausado`);
  await page.waitForSelector('#menu-inicial');
  await page.click(BOTAO('novo'));
  await page.click(BOTAO('escaramuca'));
  afirmar(await page.isVisible(NIVEL), 'Escaramuca deveria mostrar a escolha do adversario');
  const opcoes = await page.$$eval(`${NIVEL} option`, (ns) => ns.map((n) => ({ valor: n.value, texto: n.textContent, marcada: n.selected })));
  afirmar(JSON.stringify(opcoes.map((o) => o.valor)) === JSON.stringify(niveis), `os niveis deveriam ser os do dado: ${JSON.stringify(opcoes)}`);
  afirmar(JSON.stringify(opcoes.filter((o) => o.marcada).map((o) => o.valor)) === '["normal"]', 'o normal deveria vir marcado');
  afirmar(opcoes.find((o) => o.valor === 'dificil').texto === tema.menuInicial.configurar.niveis.dificil, 'o rotulo vem do tema');

  await page.selectOption(NIVEL, 'dificil');
  await capturar('configurar-com-o-nivel');

  const c = await page.$eval(BOTAO('comecar'), (n) => {
    const r = n.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto && window.__cangacoPartida), { timeout: 10_000 });
  const estado = JSON.parse(await page.evaluate(() => window.__cangacoPartida.estadoSerializado()));
  const nivel = estado.ia && estado.ia[String(LADO_DA_IA)] && estado.ia[String(LADO_DA_IA)].nivel;
  afirmar(nivel === 'dificil', `a partida deveria nascer com o nivel dificil, veio ${nivel}`);
  const atacantes = estado.unidades.ordem.filter((id) => estado.unidades.porId[id].lado === LADO_DA_IA).length;
  console.log(`F-IA-DIFICULDADE: nivel ${nivel}, ${atacantes} unidades da IA no tick ${estado.tick}`);
}

module.exports = { roteiro };
