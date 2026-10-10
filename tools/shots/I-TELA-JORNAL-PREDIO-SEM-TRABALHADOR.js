'use strict';
// I-TELA-DICAS-REVISADAS (aceite 3) e I-TELA-JORNAL-PREDIO-SEM-TRABALHADOR: carrega a partida que o teste
// grava (uma serraria vaga, no comeco de uma fase longa do clima, para nenhuma outra noticia sair no
// meio). O jornal comeca a contar no primeiro passo que ele ve. Um passo antes dos 5 min, o icone continua
// escondido; nos 5 min, ele aparece, e a folha traz a serraria e o carpinteiro.
const { readFileSync, existsSync } = require('node:fs');
const tema = require('../../data/theme-sertao.json');
const jornal = require('../../data/jornal.json');
const tempo = require('../../data/time.json');

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperar = (ms = 250) => page.waitForTimeout(ms);
  const arquivo = 'test-output/I-TELA-JORNAL-PREDIO-SEM-TRABALHADOR.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode o teste antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), ['cangaco:partida', readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperar();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperar();
  await page.keyboard.press('Escape');
  await esperar();

  const tickMs = 1000 / tempo.tickHz;
  const limite = Math.round((jornal.predioSemTrabalhador.minutos * 60 * 1000) / tickMs);
  const icone = () => page.$eval('#jornal-icone', (n) => n.hidden);
  const inicio = (await estado()).tick;
  afirmar(await icone(), 'logo depois de carregar, o icone do jornal deveria estar escondido');

  // o jornal conta do primeiro passo que ve (inicio + 1); o aviso sai em inicio + 1 + limite
  await page.evaluate((k) => window.__cangaco.avancar(k), limite);
  await esperar();
  const antes = await estado();
  afirmar(antes.tick === inicio + limite, `o relogio deveria estar em ${inicio + limite}, esta em ${antes.tick}`);
  afirmar(await icone(), `um passo antes dos ${jornal.predioSemTrabalhador.minutos} min, o icone deveria continuar escondido`);
  await page.evaluate(() => window.__cangaco.avancar(1));
  await esperar();
  afirmar(!(await icone()), `nos ${jornal.predioSemTrabalhador.minutos} min, o icone do jornal deveria aparecer`);

  await page.click('#jornal-icone');
  await esperar();
  const manchetes = await page.$$eval('#jornal h2', (hs) => hs.map((h) => h.textContent));
  const serraria = tema.predios.sawmill.nome;
  const carpinteiro = tema.civis.carpenter.nome;
  afirmar(manchetes.length === 1 && manchetes[0].includes(serraria) && manchetes[0].includes(carpinteiro),
    `a manchete deveria citar ${serraria} e ${carpinteiro}: ${JSON.stringify(manchetes)}`);
  console.log(`I-TELA-JORNAL-PREDIO-SEM-TRABALHADOR — carregado no tick ${inicio}, aviso no ${inicio + 1 + limite}: ${manchetes[0]}`);
  await capturar('aviso-do-predio-vago');
}
module.exports = { roteiro };
