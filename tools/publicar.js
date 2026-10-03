#!/usr/bin/env node
'use strict';
// E-ENTREGA-PUBLICACAO — `npm run publicar`: envia o dist/ ao itch.io pelo `butler`, no canal html5,
// com a tag `teste-jogo-<n>` do HEAD como versao. QUEM PUBLICA E O OPERADOR: a chave do butler e dele
// (`butler login`), e fica fora do repositorio. A sessao prepara e testa este comando, e nao o roda.
//
//   CANGACO_ITCH_ALVO   <usuario>/<jogo> da pagina no itch.io (obrigatorio para enviar)
//   CANGACO_BUTLER      o executavel do butler (padrao `butler`); um `.js` roda pelo node (o teste
//                       usa um butler falso)
//   --ensaio            confere tudo e mostra o comando, sem chamar o butler
//
// Nada e enviado se a regra (tools/publicar-regra.js) recusar.
const fs = require('node:fs');
const path = require('node:path');
const { execSync, spawnSync } = require('node:child_process');
const { podePublicar, argumentosDoButler } = require('./publicar-regra.js');

const RAIZ = process.cwd();
const ensaio = process.argv.slice(2).includes('--ensaio');

function git(args) {
  try { return execSync(`git ${args}`, { cwd: RAIZ, encoding: 'utf8' }).trim(); } catch { return ''; }
}
function lerJson(arquivo) {
  try { return JSON.parse(fs.readFileSync(path.join(RAIZ, arquivo), 'utf8')); } catch { return null; }
}

const head = git('rev-parse HEAD');
const fatos = {
  head,
  tags: git('tag --points-at HEAD').split(/\r?\n/).filter(Boolean),
  arvoreLimpa: git('status --porcelain') === '',
  selo: lerJson('.verify-ok'),
  build: lerJson('dist/build.json'),
};
const r = podePublicar(fatos);
if (!r.ok) {
  console.error(`publicar: RECUSADO, nada foi enviado:\n${r.problemas.map((p) => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
const alvo = process.env.CANGACO_ITCH_ALVO;
if (!alvo) {
  console.error('publicar: falta CANGACO_ITCH_ALVO (<usuario>/<jogo> da pagina no itch.io); nada foi enviado.');
  process.exit(1);
}
const args = argumentosDoButler('dist', alvo, r.versao);
const butler = process.env.CANGACO_BUTLER || 'butler';
console.log(`publicar: ${r.versao} (${head.slice(0, 7)}) -> ${alvo}: ${butler} ${args.join(' ')}`);
if (ensaio) {
  console.log('publicar: --ensaio, o butler nao foi chamado.');
  process.exit(0);
}
const [comando, ...antes] = butler.endsWith('.js') ? [process.execPath, butler] : [butler];
const saida = spawnSync(comando, [...antes, ...args], { cwd: RAIZ, stdio: 'inherit', shell: !butler.endsWith('.js') && process.platform === 'win32' });
if (saida.error) {
  console.error(`publicar: o butler nao rodou (${saida.error.message}). Instale-o e rode \`butler login\`.`);
  process.exit(1);
}
process.exit(saida.status ?? 1);
