'use strict';
// Roteiro da D-SAVE-VILA-PRONTA, o save de teste do operador (`saves/teste-operador-vila-pronta.txt`, gerado e provado
// por `tests/D-SAVE-VILA-PRONTA.test.ts`). Faz pela tela o que o operador vai fazer: o dev server
// serve o arquivo em `/saves/...`, o console o poe na gaveta do jogo (`localStorage`, a chave do
// save) e o painel H carrega. Afirma que a partida carregada e a do save (tick e predios) e captura.
const { readFileSync } = require('node:fs');

const CHAVE_DO_SAVE = 'cangaco:partida';
const URL_DO_SAVE = '/saves/teste-operador-vila-pronta.txt';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const esperado = JSON.parse(readFileSync(`.${URL_DO_SAVE}`, 'utf8')).estado;

  // a linha que o operador cola no console
  const servido = await page.evaluate(async ([chave, url]) => {
    const texto = await (await window.fetch(url)).text();
    window.localStorage.setItem(chave, texto);
    return texto.length;
  }, [CHAVE_DO_SAVE, URL_DO_SAVE]);
  afirmar(servido === readFileSync(`.${URL_DO_SAVE}`, 'utf8').length, `o dev server deveria servir o save inteiro (${servido} caracteres)`);

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const s = await estado();
  afirmar(s.tick === esperado.tick, `a partida carregada deveria estar no tick ${esperado.tick}, esta em ${s.tick}`);
  for (const id of ['casa-de-armas', 'quartel', 'bodega', 'moinho', 'padaria', 'roca-de-milho', 'canavial']) {
    afirmar(s.prediosDoEstado[id] !== undefined, `a partida carregada deveria ter '${id}'`);
  }
  await capturar('vila-pronta-carregada');
}

module.exports = { roteiro };
