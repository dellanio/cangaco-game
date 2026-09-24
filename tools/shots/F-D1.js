'use strict';

// Roteiro da F-D1 — A TELA DE AJUDA, E O LEMBRETE DA PRIMEIRA PARTIDA.
//
// O teste headless prova a corrente que faz a tela nao poder mentir: cada
// atalho declarado FAZ alguma coisa, e o tema cobre o inventario. O que ele nao
// alcanca e o unico elo que mora no DOM — **a tela lista o inventario inteiro,
// sem filtrar e sem inventar**. E isso o passo 2 daqui compara, linha a linha,
// contra `window.__cangaco.atalhos`.
//
// Mais tres coisas que so existem na tela:
//  - o lembrete da primeira partida aparece, some no primeiro `H` e NAO volta
//    depois de recarregar (a marca e `localStorage`, nao `GameState`);
//  - `F1` abre sem a pagina navegar para a ajuda do navegador;
//  - com a ajuda aberta, `Esc` fecha a AJUDA e a planta continua na mao — a
//    precedencia que `input/teclado.ts` escreve em codigo.
//
// CLAUDE.md §8: o passo 5 roda DESPAUSADO. Abrir e fechar painel com o laco
// andando e a condicao do jogador, e foi a que escondeu o BUG-B de todo roteiro.

const tema = require('../../data/theme-sertao.json');

const AJUDA = '#ajuda';
const DICA = '#dica-ajuda';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const teclar = async (k) => {
    await page.keyboard.press(k);
    await esperarFrame();
  };

  /** O que a TELA mostra: uma linha por atalho, na ordem em que estao no DOM. */
  const linhasDaTela = () => page.$$eval('#ajuda .atalho', (ns) => ns.map((n) => ({
    id: n.dataset.atalho,
    tecla: n.querySelector('.tecla').textContent,
    rotulo: n.querySelector('.rotulo').textContent,
  })));

  // ---- 1. a primeira partida traz o lembrete, e a ajuda nasce fechada -------
  afirmar(await page.isHidden(AJUDA), 'a ajuda deveria nascer fechada');
  afirmar(await page.isVisible(DICA), 'a primeira partida deveria trazer o lembrete na barra');
  afirmar(
    (await page.textContent(DICA)).trim() === tema.ajuda.dica,
    `o lembrete deveria ser o texto do tema, veio "${await page.textContent(DICA)}"`,
  );
  await capturar('dica-na-primeira-partida');

  // ---- 2. H abre, e a tela lista EXATAMENTE o inventario --------------------
  await teclar('h');
  afirmar(await page.isVisible(AJUDA), 'H deveria abrir a ajuda');

  const { atalhos } = await estado();
  const naTela = await linhasDaTela();
  const daFonte = [...atalhos.teclado.map((a) => a.id), ...atalhos.gestos];

  afirmar(
    JSON.stringify(naTela.map((l) => l.id)) === JSON.stringify(daFonte),
    `a tela deveria listar o inventario inteiro, na ordem: fonte ${JSON.stringify(daFonte)}, `
      + `tela ${JSON.stringify(naTela.map((l) => l.id))}`,
  );
  // Nenhum rotulo e id neutro: o jogador le o tema, nunca a chave (CLAUDE.md §9).
  for (const linha of naTela) {
    afirmar(
      linha.rotulo === tema.ajuda.rotulos[linha.id],
      `o rotulo de "${linha.id}" deveria vir do tema, veio "${linha.rotulo}"`,
    );
    afirmar(
      linha.tecla.trim().length > 0 && linha.tecla !== linha.id,
      `"${linha.id}" apareceu sem tecla legivel: "${linha.tecla}"`,
    );
  }
  // E a outra ponta, que e a razao de a feature existir: o que o GDD §2.2
  // promete e o codigo nao tem NAO pode estar na tela.
  const textoInteiro = (await page.textContent(AJUDA)).toLowerCase();
  for (const inexistente of ['delete', 'ctrl+', 'wasd']) {
    afirmar(
      !textoInteiro.includes(inexistente),
      `a tela nao pode anunciar "${inexistente}": nao existe no codigo`,
    );
  }
  afirmar(await page.isHidden(DICA), 'aberto o papel uma vez, o lembrete cumpriu o papel dele');
  await capturar('ajuda-aberta');

  // ---- 3. o mesmo H fecha ---------------------------------------------------
  await teclar('h');
  afirmar(await page.isHidden(AJUDA), 'o segundo H deveria fechar a ajuda');

  // ---- 4. F1 abre sem a pagina ir embora ------------------------------------
  const urlAntes = page.url();
  await teclar('F1');
  afirmar(await page.isVisible(AJUDA), 'F1 deveria abrir a ajuda');
  afirmar(page.url() === urlAntes, `F1 nao pode navegar; era ${urlAntes}, virou ${page.url()}`);

  // ---- 5. a precedencia do Esc, COM O LACO ANDANDO -------------------------
  // Despausado de proposito (CLAUDE.md §8): painel exercitado so com o relogio
  // parado nao prova nada sobre o jogo que o jogador tem na frente.
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  afirmar(
    await page.getAttribute('[data-predio="quarry"]', 'aria-pressed') === 'true',
    'a pedreira deveria estar na mao antes do Esc',
  );

  await teclar('p');
  afirmar((await estado()).pausado === false, 'o passo do Esc precisa rodar com o laco ANDANDO');

  afirmar(await page.isVisible(AJUDA), 'a ajuda deveria continuar aberta ao despausar');
  await teclar('Escape');
  afirmar(await page.isHidden(AJUDA), 'com a ajuda aberta, o Esc deveria fechar a AJUDA');
  afirmar(
    await page.getAttribute('[data-predio="quarry"]', 'aria-pressed') === 'true',
    'o Esc que fecha a ajuda nao pode largar a planta que estava na mao',
  );

  // Fechada, o mesmo Esc volta a ser o da F06.
  await teclar('Escape');
  afirmar(
    await page.getAttribute('[data-predio="quarry"]', 'aria-pressed') === 'false',
    'com a ajuda fechada, o Esc deveria largar a planta, como sempre fez',
  );

  // e o H funciona igual com o jogo andando
  await teclar('h');
  afirmar(await page.isVisible(AJUDA), 'com o laco andando, H deveria abrir a ajuda do mesmo jeito');
  await teclar('h');
  afirmar(await page.isHidden(AJUDA), 'com o laco andando, o segundo H deveria fechar');

  await teclar('p');
  afirmar((await estado()).pausado === true, 'o roteiro deveria voltar pausado para o proximo passo');

  // ---- 6. recarregar: o lembrete nao volta ---------------------------------
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
  await esperarFrame();
  afirmar(await page.isHidden(DICA), 'visto uma vez, o lembrete nao volta na partida seguinte');
  afirmar(await page.isHidden(AJUDA), 'e a ajuda continua nascendo fechada');
}

module.exports = { roteiro };
