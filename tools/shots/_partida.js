'use strict';
// I-TELA-PARTIDA-NAS-OPCOES — o caminho do jogador para a partida, comum aos roteiros: o bloco Partida da aba Opcoes
// (a engrenagem da barra) e o popup das gavetas. Antes os roteiros apertavam H e clicavam no Retomar da caixa de ajuda.
// Cada ajudante volta a barra para a aba em que estava, para o roteiro seguir de onde parou.

async function abaAtual(page) {
  return page.$eval('#abas [aria-pressed="true"]', (b) => b.dataset.aba).catch(() => 'construir');
}

async function voltarPara(page, aba) {
  if (aba !== 'opcoes') await page.click(`#abas [data-aba="${aba}"]`);
}

/** Abre o popup das gavetas no modo `salvar` ou `carregar`, pela aba Opcoes. */
async function abrirGavetas(page, modo) {
  await page.click('#abas [data-aba="opcoes"]');
  await page.click(`#opcoes [data-acao="abrir-${modo}"]`);
}

/** Retoma a partida da gaveta `n` (o save que o roteiro pos no navegador). */
async function carregarGaveta(page, n = 1) {
  const aba = await abaAtual(page);
  await abrirGavetas(page, 'carregar');
  await page.click(`#gavetas button[data-acao="carregar"][data-gaveta="${n}"]`);
  // o Retomar recusado deixa o popup aberto: fecha, para nao cobrir o mapa
  if (await page.isVisible('#gavetas')) await page.click('#gavetas button[data-acao="fechar"]');
  await voltarPara(page, aba);
}

/** Guarda a partida na gaveta `n`. */
async function salvarGaveta(page, n = 1) {
  const aba = await abaAtual(page);
  await abrirGavetas(page, 'salvar');
  await page.click(`#gavetas button[data-acao="salvar"][data-gaveta="${n}"]`);
  await page.click('#gavetas button[data-acao="fechar"]');
  await voltarPara(page, aba);
}

/** Comeca a escaramuca no lugar da partida em curso. */
async function novaEscaramuca(page) {
  const aba = await abaAtual(page);
  await page.click('#abas [data-aba="opcoes"]');
  await page.click('#opcoes [data-acao="escaramuca"]');
  await voltarPara(page, aba);
}

module.exports = { abrirGavetas, carregarGaveta, salvarGaveta, novaEscaramuca };
