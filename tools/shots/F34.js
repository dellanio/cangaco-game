'use strict';
// Roteiro da F34 — O FIM DA ESCARAMUCA NA TELA.
//
// Carrega as duas partidas que `tests/F34-fim.test.ts` grava:
//  - VITORIA: o inimigo ja sem armazem, escola, quartel e tropa. Um passo despausado e a
//    sim grava o fim; o aviso aparece com o texto do tema;
//  - DERROTA: o jogador sem armazem e escola (e sem quartel nem tropa). Idem.
// So le `#fim-de-partida` (data-fim e texto) e o estado; nao clica em painel.
const { readFileSync, existsSync } = require('node:fs');
const tema = require('../../data/theme-sertao.json');

const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);

  async function carregar(arquivo) {
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
    await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
    await page.keyboard.press('h');
    await esperarFrame();
    await page.click('#ajuda [data-acao="carregar"]');
    await esperarFrame();
    await page.keyboard.press('Escape');
    await esperarFrame();
  }

  async function esperarFim(esperado) {
    afirmar(await page.isHidden('#fim-de-partida'), 'o aviso deveria estar escondido antes do passo');
    await page.keyboard.press('p');
    let fim = '';
    for (let i = 0; i < 40 && fim !== esperado; i += 1) {
      await page.waitForTimeout(100);
      fim = (await page.getAttribute('#fim-de-partida', 'data-fim')) ?? '';
    }
    await page.keyboard.press('p');
    await esperarFrame();
    afirmar(fim === esperado, `o aviso deveria dizer ${esperado}, veio "${fim}"`);
    afirmar(await page.isVisible('#fim-de-partida'), 'o aviso deveria estar visivel');
    const titulo = (await page.textContent('#fim-de-partida h2')) ?? '';
    afirmar(titulo === tema.partida[esperado], `o titulo deveria ser o do tema, veio "${titulo}"`);
    // C9: acabou, o jogo PARA — apertar P nao o retoma, e o tick nao anda
    const tickNoFim = (await ctx.estado()).tick;
    await page.keyboard.press('p');
    await page.waitForTimeout(800);
    const tickDepois = (await ctx.estado()).tick;
    afirmar(tickDepois === tickNoFim, `depois do fim o tick nao deveria andar (${tickNoFim} -> ${tickDepois})`);
    afirmar(await page.isVisible('#fim-de-partida'), 'o aviso deveria continuar na tela');
  }

  await carregar('test-output/F34-vitoria.save.txt');
  await esperarFim('vitoria');
  await capturar('vitoria');

  await carregar('test-output/F34-derrota.save.txt');
  await esperarFim('derrota');
  await capturar('derrota');
}

module.exports = { roteiro };
