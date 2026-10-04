'use strict';

// Roteiro da I-TELA-AJUDA-DAS-CADEIAS — a aba Cadeias da ajuda, aceite (c).
//
// No jogo livre (`/?pausado`), H abre a ajuda na aba dos controles (a de antes, intocada). Despausado
// (§8), o aperto segurado 150 ms na aba Cadeias a abre: uma linha por receita de
// `data/production.json`, e a serraria, bloqueada no comeco, com o "requer" do menu de construir.
// Captura. A aba Controles volta com os grupos de antes.

const tema = require('../../data/theme-sertao.json');
const producao = require('../../data/production.json');
const { pontoParaApertar } = require('./_canvas');

async function roteiro(ctx) {
  const { page, capturar, afirmar, estado } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  async function segurar(seletor) {
    const p = await pontoParaApertar(page, seletor);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
  }

  await page.keyboard.press('h');
  await esperarFrame();
  afirmar(await page.isVisible('#ajuda'), 'H deveria abrir a ajuda');
  afirmar(await page.isVisible('#ajuda .aba[data-aba="controles"] .grupo'), 'a ajuda deveria abrir na aba dos controles');
  afirmar(await page.isHidden('#ajuda .aba[data-aba="cadeias"]'), 'a aba Cadeias deveria nascer fechada');
  afirmar((await page.textContent('#ajuda [data-aba-da-ajuda="cadeias"]')) === tema.ajuda.abas.cadeias, 'a aba deveria se chamar como o tema diz');

  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o aperto na aba precisa rodar com o laco ANDANDO (§8)');
  await segurar('#ajuda [data-aba-da-ajuda="cadeias"]');
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'P deveria pausar de volta');

  afirmar(await page.isVisible('#ajuda .aba[data-aba="cadeias"]'), 'a aba Cadeias deveria abrir no aperto');
  afirmar(await page.isHidden('#ajuda .aba[data-aba="controles"]'), 'a aba dos controles deveria fechar');
  afirmar((await page.textContent('#ajuda h2')) === tema.ajuda.cadeias.titulo, 'o titulo deveria seguir a aba');
  const naTela = await page.$$eval('#ajuda .cadeia', (ns) => ns.map((n) => n.dataset.predio));
  const noDado = Object.keys(producao.predios);
  afirmar(
    JSON.stringify([...naTela].sort()) === JSON.stringify([...noDado].sort()),
    `a aba deveria ter uma linha por receita do dado: ${naTela.length} na tela, ${noDado.length} no dado`,
  );
  const trava = await page.$eval('#ajuda .cadeia[data-predio="sawmill"] .requer', (n) => (n.hidden ? null : n.textContent));
  const esperada = `${tema.menuBuild.requer} ${tema.predios.woodcutters.nome}`;
  afirmar(trava === esperada, `a serraria bloqueada deveria dizer '${esperada}', veio '${trava}'`);
  const livre = await page.$eval('#ajuda .cadeia[data-predio="woodcutters"] .requer', (n) => n.hidden);
  afirmar(livre, 'a casa do lenhador, liberada, nao deveria mostrar requer');
  await capturar('aba-cadeias');

  await page.click('#ajuda [data-aba-da-ajuda="controles"]');
  await esperarFrame();
  afirmar(await page.isVisible('#ajuda .aba[data-aba="controles"] .grupo'), 'a aba Controles deveria voltar');
  afirmar((await page.textContent('#ajuda h2')) === tema.ajuda.titulo, 'o titulo deveria voltar aos controles');
  await page.keyboard.press('Escape');
  await esperarFrame();
  console.log(`I-TELA-AJUDA-DAS-CADEIAS: ${naTela.length} linhas, uma por receita; serraria '${trava}'`);
}

module.exports = { roteiro };
