'use strict';
// Chamado por `.githooks/pre-push`. So le o selo: nao roda teste nenhum (aceite 3).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { decidirPush, lerRefs } = require('./pre-push-regra.js');

const raiz = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const caminho = path.join(raiz, '.verify-ok');
const selo = fs.existsSync(caminho) ? fs.readFileSync(caminho, 'utf8') : null;
const decisao = decidirPush(selo, lerRefs(fs.readFileSync(0, 'utf8')));
if (!decisao.ok) {
  console.error(`pre-push: RECUSADO — ${decisao.motivo}.`);
  process.exit(1);
}
console.error(`pre-push: ok (${decisao.motivo}).`);
