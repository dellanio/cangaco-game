#!/usr/bin/env node
'use strict';
// npm run test:longo -> este script. Roda a suite longa nas duas configuracoes (normal e
// transladada) e grava o SELO em test-output/test-longo.json: o commit testado, se a arvore
// estava limpa, se havia outro teste rodando na maquina, e o resultado (CLAUDE.md §13, decisao do
// operador de 2026-10-01). O avaliador confere o selo com `npm run selo:longo` antes de comecar.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');

const ARQUIVO_DO_SELO = 'test-output/test-longo.json';
const CONFIGS = ['vitest.longo.config.mts', 'vitest.longo.transladado.config.mts'];

const git = (args) => execSync(`git ${args}`, { encoding: 'utf8' }).trim();

/** Outros processos de teste na maquina (vitest, roteiro de tela, Playwright), alem deste. So no
 *  Windows, onde a sessao roda; fora dele devolve null ("nao medido"), e o selo diz isso. */
function outrosTestesRodando() {
  if (process.platform !== 'win32') return null;
  const ps = [
    '$p = Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'";',
    `$p | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.ParentProcessId -ne ${process.pid}`,
    "-and $_.CommandLine -match 'vitest|tools[\\\\/]shot\\.js|playwright test' } |",
    'ForEach-Object { $_.CommandLine }',
  ].join(' ');
  const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

const commit = git('rev-parse HEAD');
const arvoreLimpa = git('status --porcelain') === '';
const outrosNoInicio = outrosTestesRodando();
const inicio = Date.now();
const corridas = CONFIGS.map((config) => {
  const t0 = Date.now();
  const r = spawnSync('npx', ['vitest', 'run', '-c', config], { stdio: 'inherit', shell: true });
  return { config, saida: r.status, segundos: Math.round((Date.now() - t0) / 1000) };
});
const outrosNoFim = outrosTestesRodando();
const verde = corridas.every((c) => c.saida === 0);
// "sozinha" so vale medida: com a medida indisponivel, o selo diz null, e nao true
const sozinha = outrosNoInicio === null || outrosNoFim === null
  ? null
  : outrosNoInicio.length === 0 && outrosNoFim.length === 0;

const selo = {
  commit, arvoreLimpa, verde, sozinha,
  outrosTestes: { noInicio: outrosNoInicio, noFim: outrosNoFim },
  segundos: Math.round((Date.now() - inicio) / 1000),
  corridas,
  quando: new Date().toISOString(),
};
fs.mkdirSync('test-output', { recursive: true });
fs.writeFileSync(ARQUIVO_DO_SELO, JSON.stringify(selo, null, 2));
console.log(`\ntest:longo: ${verde ? 'VERDE' : 'VERMELHO'} em ${selo.segundos} s, commit ${commit.slice(0, 7)}`
  + `${arvoreLimpa ? '' : ' (ARVORE SUJA: o selo nao vale)'}`
  + `${sozinha === false ? ' (OUTRO TESTE RODANDO: o selo nao vale)' : ''}. Selo em ${ARQUIVO_DO_SELO}.`);
process.exit(verde ? 0 : 1);
