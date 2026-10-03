#!/usr/bin/env node
'use strict';
// E-ENTREGA-BUILD — roda depois do `vite build` (`npm run build`): lista o dist/, confere pela
// regra de tools/conferir-dist-regra.js e grava o tamanho em test-output/E-ENTREGA-BUILD.json
// (numero da corrida, nunca asercao, CLAUDE.md §8). Sai 1 se o dist/ nao esta limpo.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execSync } = require('node:child_process');
const { conferirDist } = require('./conferir-dist-regra.js');

const RAIZ = path.join(__dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const BASE = path.join(RAIZ, 'assets', 'base');
const SAIDA = path.join(RAIZ, 'test-output', 'E-ENTREGA-BUILD.json');

function listar(dir) {
  if (!fs.existsSync(dir)) return [];
  const saida = [];
  for (const nome of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, nome.name);
    if (nome.isDirectory()) saida.push(...listar(caminho));
    else saida.push(caminho);
  }
  return saida;
}
function descrever(arquivo) {
  const conteudo = fs.readFileSync(arquivo);
  return {
    caminho: path.relative(RAIZ, arquivo).split(path.sep).join('/'),
    sha256: crypto.createHash('sha256').update(conteudo).digest('hex'),
    bytes: conteudo.length,
  };
}

const dist = listar(DIST).map(descrever);
const base = listar(BASE).map(descrever);
function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(arquivo, 'utf8')); } catch { return null; }
}
function commitAtual() {
  try { return execSync('git rev-parse HEAD', { cwd: RAIZ, encoding: 'utf8' }).trim(); } catch { return null; }
}
const manifesto = lerJson(path.join(DIST, '.vite', 'manifest.json'));
const r = conferirDist({ dist, base, manifesto });

const anterior = lerJson(SAIDA) ?? {};
const commit = commitAtual();
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, JSON.stringify({
  ...anterior,
  dist: { commit, arquivos: r.arquivos, bytes: r.bytes, megabytes: Number((r.bytes / 1e6).toFixed(2)), arquivosDaBaseConferidos: base.length, problemas: r.problemas, quando: new Date().toISOString() },
}, null, 2));

if (r.problemas.length > 0) {
  console.error(`conferir-dist: o dist/ NAO esta limpo:\n${r.problemas.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`conferir-dist: ${r.arquivos} arquivos, ${(r.bytes / 1e6).toFixed(2)} MB; nenhum de assets/base/ (${base.length} conferidos), sem pagina de depuracao.`);
