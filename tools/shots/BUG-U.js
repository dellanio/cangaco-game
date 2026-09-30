'use strict';
// Roteiro do BUG-U, causa A (o quartel sem estrada ate o armazem avisa).
//
// Carrega a partida que `tests/BUG-U-quartel-sem-estrada.test.ts` grava: a vila inicial com
// um Quartel pronto, sem estrada ate o armazem, e machados no armazem. A arma so vem pela
// estrada (`arma-para-quartel`, modo `estrada`); o aviso tem de dizer isso ao jogador.
//   1. o jogo ANDA alguns passos (§8) e o `#alertas` mostra "Sem estrada ate o armazem",
//      com o Quartel contado;
//   2. o Quartel e o unico predio da partida nessa causa: a contagem e 1.
const { readFileSync, existsSync } = require('node:fs');
const tema = require('../../data/theme-sertao.json');

const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);

  const arquivo = 'test-output/BUG-U.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const s = await estado();
  const quartel = s.prediosDoEstado['quartel'];
  afirmar(quartel !== undefined && quartel.tipo === 'barracks', 'a partida deveria ter o Quartel');

  // 1. o jogo andando: o aviso nasce do estado corrente, nao do que veio no save
  await page.keyboard.press('p');
  await page.waitForTimeout(600);
  await page.keyboard.press('p');
  await esperarFrame();

  const avisos = await page.$$eval('#alertas .alerta', (ns) => ns
    .filter((n) => !n.hasAttribute('hidden'))
    .map((n) => ({
      causa: n.dataset.causa,
      rotulo: n.querySelector('.rotulo').textContent,
      contagem: n.querySelector('.contagem').textContent,
    })));
  afirmar(await page.isVisible('#alertas'), 'o aviso deveria estar na tela');
  const semEstrada = avisos.find((a) => a.causa === 'sem-estrada');
  afirmar(semEstrada !== undefined, `deveria haver a linha sem-estrada: ${JSON.stringify(avisos)}`);
  afirmar(semEstrada.rotulo === tema.alertas.causas['sem-estrada'], `o rotulo deveria vir do tema: ${JSON.stringify(semEstrada)}`);
  // 2. so o Quartel
  afirmar(semEstrada.contagem === '1', `a contagem deveria ser 1 (o Quartel): ${JSON.stringify(semEstrada)}`);
  await capturar('aviso');
  console.log(`BUG-U: avisos ${JSON.stringify(avisos)}`);
}

module.exports = { roteiro };
