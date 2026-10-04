'use strict';

// Roteiro da I-ENTREGA-PLAYTEST — o relato pela tela, e de volta.
//
// No jogo livre (`/?pausado`), H abre a ajuda. A secao do relato diz o que o arquivo leva (a frase do
// tema, montada da lista de campos). Escrever no campo nao dispara atalho (H, P, R). DESPAUSADO
// (§8), o aperto segurado 150 ms em "Enviar relato" baixa o arquivo: os quatro campos, o commit do
// build do dev server, e o save. O jogo anda mais um pouco; "Abrir relato" com o arquivo baixado
// devolve a partida ao instante do relato, igual ao save de dentro dele.

const { readFileSync } = require('node:fs');
const { execSync } = require('node:child_process');
const tema = require('../../data/theme-sertao.json');
const { pontoParaApertar } = require('./_canvas');

const CAMPOS = ['save', 'commit', 'nivel', 'texto']; // src/relato.ts: CAMPOS_DO_RELATO

async function roteiro(ctx) {
  const { page, capturar, afirmar, estado } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);

  await page.keyboard.press('h');
  await esperarFrame();
  afirmar(await page.isVisible('#ajuda .relato'), 'a ajuda em jogo deveria ter a secao do relato');
  const leva = await page.textContent('#ajuda .relato .leva');
  for (const c of CAMPOS) afirmar(leva.includes(tema.relato.campos[c]), `a tela deveria dizer que o relato leva '${tema.relato.campos[c]}'`);

  // escrever no campo: as letras ficam nele, e nao viram atalho
  const texto = 'parei na serraria, nao sabia o que fazer; o h e o p sao letras';
  await page.click('#ajuda .relato textarea');
  await page.keyboard.type(texto);
  await esperarFrame();
  afirmar((await page.inputValue('#ajuda .relato textarea')) === texto, 'o texto deveria ficar no campo inteiro');
  afirmar(await page.isVisible('#ajuda'), 'o H escrito no campo nao pode fechar a ajuda');
  afirmar((await estado()).pausado === true, 'o P escrito no campo nao pode despausar');
  await capturar('relato-escrito');

  // despausado: o aperto segurado em Enviar relato baixa o arquivo
  await page.evaluate(() => window.document.activeElement?.blur());
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o Enviar precisa rodar com o laco ANDANDO (§8)');
  const ponto = await pontoParaApertar(page, '#ajuda button[data-acao="enviar-relato"]');
  const baixou = page.waitForEvent('download');
  await page.mouse.move(ponto.x, ponto.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  const download = await baixou;
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'P deveria pausar de volta');
  const caminho = await download.path();
  const arquivo = readFileSync(caminho, 'utf8');
  const relato = JSON.parse(arquivo);
  afirmar(JSON.stringify(Object.keys(relato)) === JSON.stringify(CAMPOS), `o relato deveria levar so ${CAMPOS.join(', ')}, levou ${Object.keys(relato).join(', ')}`);
  afirmar(relato.texto === texto, 'o relato deveria levar o texto escrito');
  afirmar(relato.nivel === null, 'o jogo livre nao tem adversario: nivel null');
  const commit = execSync('git describe --always --dirty --abbrev=7', { encoding: 'utf8' }).trim();
  afirmar(relato.commit === commit, `o relato deveria levar o commit do build (${commit}), levou ${relato.commit}`);
  afirmar(download.suggestedFilename().startsWith('relato-'), `o arquivo deveria se chamar relato-..., veio ${download.suggestedFilename()}`);
  const recado = await page.textContent('#ajuda .relato .recado');
  afirmar(recado.includes(download.suggestedFilename()), `o recado deveria dizer o arquivo baixado, veio '${recado}'`);
  const doRelato = JSON.stringify(JSON.parse(relato.save).estado);

  // o jogo anda; Abrir relato devolve o instante do relato
  await page.evaluate(() => window.__cangaco.avancar(50));
  await esperarFrame();
  const andou = (await estado()).tick;
  const escolher = page.waitForEvent('filechooser');
  await page.click('#ajuda button[data-acao="abrir-relato"]');
  const seletor = await escolher;
  await seletor.setFiles(caminho);
  await page.waitForFunction((t) => window.__cangaco.tick !== t, andou, { timeout: 10_000 });
  await esperarFrame();
  const aberto = await page.evaluate(() => window.__cangacoPartida.estadoSerializado());
  afirmar(aberto === doRelato, `Abrir relato deveria devolver o estado do relato (${aberto.length} contra ${doRelato.length} bytes)`);
  await capturar('relato-aberto');
  await page.keyboard.press('Escape');
  console.log(`I-ENTREGA-PLAYTEST: relato de ${arquivo.length} bytes, commit ${relato.commit}; aberto de volta no tick ${JSON.parse(relato.save).estado.tick} (o jogo estava no ${andou})`);
}

module.exports = { roteiro };
