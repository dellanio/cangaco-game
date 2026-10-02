'use strict';
// Chamado por `.githooks/pre-push`. So le os selos (o completo ou o rapido): nao roda teste nenhum.
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { decidirPush, lerRefs } = require('./pre-push-regra.js');

const raiz = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const ler = (nome) => { const c = path.join(raiz, nome); return fs.existsSync(c) ? fs.readFileSync(c, 'utf8') : null; };
const roda = (args) => spawnSync('git', args, { cwd: raiz, encoding: 'utf8' });
const git = {
  ehAncestral: (a, b) => roda(['merge-base', '--is-ancestor', a, b]).status === 0,
  emRefRemota: (a) => (roda(['branch', '-r', '--contains', a]).stdout ?? '').trim() !== '',
};
const decisao = decidirPush(ler('.verify-ok'), lerRefs(fs.readFileSync(0, 'utf8')), ler('.verify-rapido-ok'), git);
if (!decisao.ok) {
  console.error(`pre-push: RECUSADO — ${decisao.motivo}.`);
  process.exit(1);
}
console.error(`pre-push: ok (${decisao.motivo}).`);
