'use strict';
// I-TELA-PARTIDA-NAS-OPCOES (aceite 2) — o bloco Partida na aba Opcoes; o Salvar abre o popup com 3 gavetas e guarda
// na escolhida; o Carregar retoma e fecha o popup; o Reiniciar fase, numa fase da campanha, volta ao tick 0 dela; a
// caixa do H sem a secao Partida. Um passo despausado, segurando o botao (CLAUDE.md §8).
const { writeFileSync } = require('node:fs');
const { URL } = require('node:url');

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperar = () => page.waitForTimeout(200);
  const segurar = async (seletor) => {
    const b = await page.locator(seletor).boundingBox();
    afirmar(b !== null, `o botao existe: ${seletor}`);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up();
    await esperar();
  };
  const url = new URL(page.url());
  url.search = '?pausado&campanha=fase-01-pianco';
  await page.goto(url.href);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
  await page.evaluate(() => window.localStorage.clear());

  // a caixa do H nao tem mais a secao Partida
  await page.keyboard.press('h'); await esperar();
  afirmar(await page.isVisible('#ajuda') && (await page.$('#ajuda .arquivo')) === null, 'a caixa do H sem a secao Partida');
  await page.keyboard.press('Escape'); await esperar();

  // o bloco Partida na aba Opcoes
  await page.click('#abas [data-aba="opcoes"]'); await esperar();
  const acoes = await page.$$eval('#opcoes .arquivo button', (ns) => ns.map((n) => n.dataset.acao));
  for (const a of ['abrir-salvar', 'abrir-carregar', 'reiniciar', 'opcoes-de-som', 'menu']) afirmar(acoes.includes(a), `o bloco Partida tem ${a}: ${acoes}`);
  await capturar('aba-opcoes');

  // o jogo anda e o Salvar guarda na gaveta 2
  await page.evaluate(() => window.__cangaco.avancar(30)); await esperar();
  const tickSalvo = (await estado()).tick;
  await page.click('#opcoes [data-acao="abrir-salvar"]'); await esperar();
  afirmar(await page.isVisible('#gavetas') && (await page.$$('#gavetas .gaveta')).length === 3, 'o Salvar abre o popup com as 3 gavetas');
  afirmar(!(await page.isVisible('#gavetas button[data-acao="carregar"]')), 'no Salvar, so os botoes de guardar');
  await page.click('#gavetas button[data-acao="salvar"][data-gaveta="2"]'); await esperar();
  const linha2 = await page.textContent('#gavetas .gaveta[data-gaveta="2"] [data-campo="gaveta"]');
  afirmar(linha2.includes(`tick ${tickSalvo}`), `a gaveta 2 guardou o tick ${tickSalvo}: ${linha2}`);
  await capturar('popup-salvar');
  await page.click('#gavetas button[data-acao="fechar"]'); await esperar();

  // o jogo anda mais, e o Carregar (despausado, segurando o botao) volta ao salvo e fecha o popup
  await page.evaluate(() => window.__cangaco.avancar(40)); await esperar();
  await page.click('#opcoes [data-acao="abrir-carregar"]'); await esperar();
  await page.keyboard.press('p');
  await segurar('#gavetas button[data-acao="carregar"][data-gaveta="2"]');
  await page.keyboard.press('p'); await esperar();
  const depois = await estado();
  afirmar(await page.isHidden('#gavetas'), 'o Retomar que deu certo fecha o popup');
  afirmar(depois.tick >= tickSalvo && depois.tick < tickSalvo + 30, `retomou do tick ${tickSalvo}: ${depois.tick}`);

  // o Reiniciar fase: o primeiro clique arma, o segundo volta ao tick 0 da fase
  await page.evaluate(() => window.__cangaco.avancar(200)); await esperar();
  const antesDoReinicio = (await estado()).tick;
  await page.click('#opcoes [data-acao="reiniciar"]'); await esperar();
  afirmar((await page.getAttribute('#opcoes [data-acao="reiniciar"]', 'data-armado')) === 'true', 'o primeiro clique arma');
  await capturar('reiniciar-armado');
  await Promise.all([page.waitForNavigation(), page.click('#opcoes [data-acao="reiniciar"]')]);
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
  const busca = await page.evaluate(() => window.location.search);
  afirmar(busca === '?campanha=fase-01-pianco', `a pagina da mesma fase: ${busca}`);
  const zero = await estado();
  // a pagina nova nao tem o `?pausado` do roteiro: o relogio ja anda; o que se afirma e que a partida e outra, do comeco
  afirmar(zero.tick < antesDoReinicio && zero.tick < 100, `a fase recomecou do comeco: tick ${antesDoReinicio} -> ${zero.tick}`);
  writeFileSync('test-output/I-TELA-PARTIDA-NAS-OPCOES.json', JSON.stringify({ acoes, tickSalvo, tickRetomado: depois.tick, busca, antesDoReinicio, tickReiniciado: zero.tick }, null, 2));
}

module.exports = { roteiro };
