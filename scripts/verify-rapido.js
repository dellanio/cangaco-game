#!/usr/bin/env node
'use strict';
// npm run verify:rapido -> este script (camadas de teste, decisao do operador de 2026-10-01; CLAUDE.md
// §13). O portao de CADA COMMIT: typecheck + lint + validate:data + `vitest related` nos arquivos alterados (staged,
// nao staged e novos, mais os commits que ainda nao subiram). Grava .verify-rapido-ok com o commit e a
// base, que o pre-push aceita; NUNCA o .verify-ok: marcar feature em test-results.json continua
// exigindo o `verify` completo.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { testesQueLeemDado } = require('../tools/testes-que-leem-dado.js');
const { comandoDoVitest, corridaDoVitest } = require('../tools/vitest-do-rapido.js');

function fontesDosTestes(dir = 'tests') {
  if (!fs.existsSync(dir)) return {};
  const fontes = {};
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const arquivo = path.posix.join(dir, entrada.name);
    if (entrada.isDirectory()) Object.assign(fontes, fontesDosTestes(arquivo));
    else if (/\.test\.[cm]?[jt]sx?$/.test(entrada.name)) fontes[arquivo] = fs.readFileSync(arquivo, 'utf8');
  }
  return fontes;
}

const SELO = '.verify-rapido-ok';
try { fs.unlinkSync(SELO); } catch { /* nao havia */ }

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** O HEAD e a base do que ainda nao subiu: o merge-base com o upstream, ou o HEAD sem upstream
 *  (verify-rapido-no-push, CLAUDE.md §13). */
function commitEBase() {
  const commit = git('rev-parse HEAD');
  let base = commit;
  try { base = git('merge-base HEAD @{upstream}'); } catch { /* sem upstream: so a arvore */ }
  return { commit, base };
}

/** Os arquivos alterados contra o HEAD, mais os novos nao ignorados, mais os que mudaram de `base`
 *  ate o HEAD, que existem no disco. */
function alterados(base, commit) {
  const saida = execSync('git status --porcelain --untracked-files=all', { encoding: 'utf8' });
  const naArvore = saida.split(/\r?\n/).filter((l) => l.length > 3)
    .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop());
  const nosCommits = base === commit ? [] : git(`diff --name-only ${base} ${commit}`).split(/\r?\n/).filter((f) => f !== '');
  return [...new Set([...naArvore, ...nosCommits])].filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
}

function etapa(nome, comando) {
  console.log(`\n--- ${nome} ---`);
  const r = spawnSync(comando, { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nFALHOU: ${nome}. O selo ${SELO} NAO foi criado.`);
    process.exit(1);
  }
}

const inicio = Date.now();
etapa('typecheck', 'npm run typecheck');
etapa('lint', 'npm run lint');
// o dado tambem a cada commit (decisao do operador, 2026-10-01): ~1 s, e commit que mexe em data/*.json
// nao fica esperando o verify completo para descobrir que o schema reprova
etapa('validate:data', 'npm run validate:data');

const { commit, base } = commitEBase();
const arquivos = alterados(base, commit);
console.log(`\n--- vitest related (${arquivos.length} arquivo(s) alterado(s)) ---`);
let testes = 0;
let corrida = null;
if (arquivos.length > 0) {
  const relatorio = 'test-output/verify-rapido-vitest.json';
  fs.mkdirSync('test-output', { recursive: true });
  const leitores = testesQueLeemDado(arquivos, fontesDosTestes());
  const lista = [...new Set([...arquivos, ...leitores])];
  console.log(`testes que leem dado alterado: ${leitores.length}`);
  // CANGACO_VITEST troca o comando (o teste dos portoes usa um vitest falso; padrao: o node no vitest.mjs).
  // Sem shell (BUG-VERIFY-RAPIDO-LINHA-LONGA): o cmd.exe corta a linha em ~8 191 caracteres.
  const programa = comandoDoVitest(process.env.CANGACO_VITEST, process.execPath, path.resolve('node_modules/vitest/vitest.mjs'));
  corrida = corridaDoVitest(programa, lista, relatorio);
  if (corrida.modo !== 'related') console.log(`suite inteira: ${corrida.motivo}`);
  const r = spawnSync(corrida.argv[0], corrida.argv.slice(1), { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\nFALHOU: vitest related. O selo ${SELO} NAO foi criado.`);
    process.exit(1);
  }
  try { testes = JSON.parse(fs.readFileSync(relatorio, 'utf8')).numTotalTests ?? 0; } catch { testes = 0; }
} else {
  console.log('nenhum arquivo alterado: nenhum teste a rodar');
}

const segundos = Math.round((Date.now() - inicio) / 1000);
fs.writeFileSync(SELO, JSON.stringify({ tipo: 'rapido', commit, base, arquivos: arquivos.length, testes, segundos, quando: new Date().toISOString(),
  ...(corrida && corrida.modo !== 'related' ? { modo: corrida.modo, motivo: corrida.motivo } : {}) }, null, 2));
console.log(`\nverify:rapido OK: ${arquivos.length} arquivo(s) alterado(s), ${testes} teste(s), ${segundos} s. Selo do ${commit.slice(0, 7)} desde ${base.slice(0, 7)}; marcar feature pede o \`npm run verify\` completo.`);
