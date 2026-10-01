#!/usr/bin/env node
'use strict';
// npm run verify:rapido -> este script (camadas de teste, decisao do operador de 2026-10-01; CLAUDE.md
// §13). O portao de CADA COMMIT: typecheck + lint + `vitest related` nos arquivos alterados (staged,
// nao staged e novos). Grava .verify-rapido-ok e NUNCA o .verify-ok: marcar feature em
// test-results.json continua exigindo o `verify` completo.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

const SELO = '.verify-rapido-ok';
try { fs.unlinkSync(SELO); } catch { /* nao havia */ }

/** Os arquivos alterados contra o HEAD, mais os novos nao ignorados, que existem no disco. */
function alterados() {
  const saida = execSync('git status --porcelain --untracked-files=all', { encoding: 'utf8' });
  return saida.split(/\r?\n/).filter((l) => l.length > 3)
    .map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop())
    .filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
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

const arquivos = alterados();
console.log(`\n--- vitest related (${arquivos.length} arquivo(s) alterado(s)) ---`);
let testes = 0;
if (arquivos.length > 0) {
  const relatorio = 'test-output/verify-rapido-vitest.json';
  fs.mkdirSync('test-output', { recursive: true });
  const lista = arquivos.map((f) => `"${f}"`).join(' ');
  const r = spawnSync(`npx vitest related --run --passWithNoTests --reporter=default --reporter=json --outputFile.json=${relatorio} ${lista}`,
    { stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nFALHOU: vitest related. O selo ${SELO} NAO foi criado.`);
    process.exit(1);
  }
  try { testes = JSON.parse(fs.readFileSync(relatorio, 'utf8')).numTotalTests ?? 0; } catch { testes = 0; }
} else {
  console.log('nenhum arquivo alterado: nenhum teste a rodar');
}

const segundos = Math.round((Date.now() - inicio) / 1000);
fs.writeFileSync(SELO, JSON.stringify({ tipo: 'rapido', arquivos: arquivos.length, testes, segundos, quando: new Date().toISOString() }, null, 2));
console.log(`\nverify:rapido OK: ${arquivos.length} arquivo(s) alterado(s), ${testes} teste(s), ${segundos} s. Push e marcar feature pedem o \`npm run verify\` completo.`);
