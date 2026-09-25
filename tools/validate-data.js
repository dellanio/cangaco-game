#!/usr/bin/env node
'use strict';

// CLI de tools/data-rules.js. Le os nove arquivos do disco, roda
// validarTudo, imprime cada erro com o id da regra, sai 1 se houver erro.
// `--dir <caminho>` aponta para uma copia (usado pelo teste para provar,
// ponta a ponta, que uma copia quebrada reprova de verdade).

const fs = require('node:fs');
const path = require('node:path');
const { validarTudo, validarInterface } = require('./data-rules');
const { ARQUIVOS, ARQUIVOS_DA_INTERFACE } = require('./data-schema');

function lerArgs(argv) {
  const idx = argv.indexOf('--dir');
  const dir = idx !== -1 && argv[idx + 1] ? argv[idx + 1] : 'data';
  return { dir };
}

function carregarDados(dir, lista = ARQUIVOS) {
  const dados = {};
  for (const nome of lista) {
    const caminho = path.join(dir, `${nome}.json`);
    dados[nome] = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  }
  return dados;
}

function main() {
  const { dir } = lerArgs(process.argv.slice(2));
  const dados = carregarDados(dir);
  // Os arquivos de interface (tema, menu) sao validados a parte: sim/ nao os
  // le, mas eles apontam ids de buildings, e id pendurado e erro de dado.
  const interfaceUi = carregarDados(dir, ARQUIVOS_DA_INTERFACE);
  const erros = [...validarTudo(dados), ...validarInterface(dados, interfaceUi)];

  if (erros.length === 0) {
    console.log(`validate:data — ${ARQUIVOS.length + ARQUIVOS_DA_INTERFACE.length} arquivos, 0 erros. OK.`);
    process.exit(0);
  }

  console.error(`validate:data — ${erros.length} erro(s):`);
  for (const erro of erros) console.error(`  - ${erro}`);
  process.exit(1);
}

main();
