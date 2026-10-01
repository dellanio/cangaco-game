#!/usr/bin/env node
'use strict';
// npm run shot:todos -> este script (CLAUDE.md §13, aceite de 2026-10-01). Roda todos os roteiros, um
// de cada vez, na porta CANGACO_SHOT_PORTA (padrao 5176). A trava e pega pelo `npm run shot:todos`
// (tools/trava-de-testes.js), e cada roteiro roda dentro dela. Grava test-output/shot-todos.json.
// Porta ocupada no inicio: sai 2 sem rodar nada. Memoria abaixo do minimo: para e sai 3. Sai 0 so
// se todos sairam 0.
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { MEMORIA_MINIMA_MB, listarRoteiros, deveParar } = require('./shot-todos-regra.js');
const { liberarViteOrfao } = require('./_servidor');

const PORTA = Number(process.env.CANGACO_SHOT_PORTA ?? 5176);
// o teste troca o arquivo do resumo, para nao escrever por cima da evidencia real (aceite 6)
const SAIDA = process.env.CANGACO_SHOT_TODOS_SAIDA ?? 'test-output/shot-todos.json';

function portaOcupada(porta) {
  return new Promise((ok) => {
    const s = net.createConnection({ port: porta, host: 'localhost' });
    s.once('connect', () => { s.destroy(); ok(true); });
    s.once('error', () => ok(false));
  });
}

/** A memoria livre: no Windows, a do Win32 (a mesma conta que o Claude Code usa para encerrar
 *  comandos); fora dele, `os.freemem`. */
function memoriaLivreMb() {
  if (process.platform === 'win32') {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-Command', '[int]((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)'], { encoding: 'utf8' });
    const n = Number(String(r.stdout).trim());
    if (r.status === 0 && Number.isFinite(n)) return n;
  }
  return Math.round(os.freemem() / 1024 / 1024);
}

function gravar(resumo) {
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify(resumo, null, 2));
}

async function principal() {
  let commit = '?';
  try { commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { /* sem git */ }
  const roteiros = listarRoteiros(fs.readdirSync('tools/shots'));
  const resumo = { commit, porta: PORTA, quando: new Date().toISOString(), total: roteiros.length, roteiros: [], falhas: [], parou: null };
  // o vite orfao do proprio shot sai antes da conferencia (CLAUDE.md §13); qualquer outro dono segue recusado
  if (await portaOcupada(PORTA)) console.error(`shot:todos: porta ${PORTA} ocupada; ${(await liberarViteOrfao(PORTA)).motivo}.`);
  if (await portaOcupada(PORTA)) {
    resumo.parou = `porta ${PORTA} ja ocupada no inicio (vite orfao ou de outra sessao); nenhum roteiro rodou`;
    gravar(resumo);
    console.error(`shot:todos: ${resumo.parou}. Rode com CANGACO_SHOT_PORTA=<outra>.`);
    return 2;
  }
  for (const nome of roteiros) {
    const livre = memoriaLivreMb();
    if (deveParar(livre)) {
      resumo.parou = `memoria livre ${livre} MB (< ${MEMORIA_MINIMA_MB}) antes de ${nome}`;
      gravar(resumo);
      console.error(`shot:todos: PAROU — ${resumo.parou}. Nao religar sem memoria.`);
      return 3;
    }
    const t0 = Date.now();
    const r = spawnSync(`node tools/shot.js ${nome}`, { stdio: 'inherit', shell: true, env: { ...process.env, CANGACO_SHOT_PORTA: String(PORTA) } });
    const linha = { nome, saida: r.status ?? 1, segundos: Math.round((Date.now() - t0) / 1000), memoriaLivreMb: livre };
    resumo.roteiros.push(linha);
    if (linha.saida !== 0) resumo.falhas.push(nome);
    gravar(resumo);
  }
  const falhas = resumo.falhas.length;
  console.log(`\nshot:todos: ${resumo.roteiros.length} de ${roteiros.length} roteiros, ${falhas} com saida diferente de 0`
    + `${falhas ? `: ${resumo.falhas.join(', ')}` : ''}. Resumo em ${SAIDA}.`);
  return falhas === 0 ? 0 : 1;
}

principal().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
