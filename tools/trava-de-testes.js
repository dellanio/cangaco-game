#!/usr/bin/env node
'use strict';
// node tools/trava-de-testes.js <comando...> — roda o comando com a TRAVA DE TESTES entre worktrees
// (regra do operador, 2026-10-01; CLAUDE.md §13). Antes de rodar, confere a trava comum
// (`caminhoDaTrava`): se existe e nao esta abandonada (mais de 90 min), espera. Se nao existe, cria
// com a branch, o horario e o comando, roda, e apaga ao terminar, inclusive em falha e em Ctrl+C.
//
// Reentrante: quem segura a trava passa `CANGACO_TRAVA_DONO` aos filhos. O `verify` chama
// `npm run test`, e o filho nao pede a trava de novo (senao esperaria por si mesmo para sempre).
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const { setTimeout: esperar } = require('timers/promises');
const { caminhoDaTrava, tentarPegar, soltar } = require('./trava-regra.js');

const comando = process.argv.slice(2).join(' ');
if (comando === '') {
  console.error('uso: node tools/trava-de-testes.js <comando...>');
  process.exit(2);
}

/** Intervalo entre as conferencias enquanto espera. Tempo de parede de ferramenta, nao de jogo. */
const ESPERA_ENTRE_TENTATIVAS_MS = 5000;

function rodar(env) {
  const filho = spawn(comando, { stdio: 'inherit', shell: true, env });
  return new Promise((resolve) => filho.on('exit', (codigo, sinal) => resolve(codigo ?? (sinal ? 1 : 0))));
}

function branch() {
  try { return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(); } catch { return '?'; }
}

async function principal() {
  if (process.env.CANGACO_TRAVA_DONO) return rodar(process.env); // ja dentro da trava

  const caminho = caminhoDaTrava();
  const id = crypto.randomUUID();
  const dono = { id, branch: branch(), diretorio: process.cwd(), comando, pid: process.pid, inicio: new Date().toISOString() };
  let avisado = '';
  for (;;) {
    const r = tentarPegar(caminho, dono, Date.now());
    if (r.ok) break;
    const quem = r.dona === null ? 'trava ilegivel' : `${r.dona.branch} desde ${r.dona.inicio} (${r.dona.comando})`;
    if (quem !== avisado) {
      console.error(`trava de testes ocupada por ${quem}; esperando (${caminho})`);
      avisado = quem;
    }
    await esperar(ESPERA_ENTRE_TENTATIVAS_MS);
  }

  // solta em qualquer saida: fim normal, falha, Ctrl+C, encerramento pedido
  const liberar = () => soltar(caminho, id);
  process.on('exit', liberar);
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
    process.on(sinal, () => { liberar(); process.exit(130); });
  }
  try {
    return await rodar({ ...process.env, CANGACO_TRAVA_DONO: id });
  } finally {
    liberar();
  }
}

principal().then((codigo) => process.exit(codigo), (e) => { console.error(e); process.exit(1); });
