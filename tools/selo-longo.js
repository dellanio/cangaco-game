#!/usr/bin/env node
'use strict';
// npm run selo:longo -> confere o selo da suite longa (CLAUDE.md §13, decisao do operador de
// 2026-10-01). Sai 0 so se test-output/test-longo.json existe, e verde, foi rodado sozinho, com a
// arvore limpa, e o commit dele e o HEAD de agora. O avaliador roda isto ANTES de comecar e se
// recusa a avaliar se sair diferente de 0.
const { execSync } = require('child_process');
const fs = require('fs');
const { problemasDoSelo } = require('./selo-longo-regra.js');

const ARQUIVO_DO_SELO = 'test-output/test-longo.json';
function lerSelo() {
  try { return JSON.parse(fs.readFileSync(ARQUIVO_DO_SELO, 'utf8')); } catch { return null; }
}
const selo = lerSelo();
const head = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const sujo = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
const problemas = problemasDoSelo(selo, head, sujo);

if (problemas.length > 0) {
  console.error(`selo:longo RECUSADO (${ARQUIVO_DO_SELO}):\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
  console.error('Rode `npm run test:longo` sozinho na maquina, no HEAD de agora, com a arvore limpa.');
  process.exit(1);
}
console.log(`selo:longo OK: commit ${head.slice(0, 7)}, verde, sozinha, ${selo.segundos} s (${selo.quando}).`);
