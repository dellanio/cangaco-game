#!/usr/bin/env node
'use strict';

// F-DEV — o `npm run dev` recusa porta ocupada e nao deixa orfao.
//
// O `"dev": "vite"` de antes subia por `npm` -> `cmd.exe` -> `node vite.js`.
// Parar o `npm` matava o `cmd` e deixava o `node vite.js`, neto, escutando a
// porta; e sem `--strictPort` o vite seguinte pulava calado para a porta livre
// seguinte, com o orfao servindo a arvore velha. Mesmo defeito que o BUG-K
// matou no roteiro, com as mesmas armas (`_servidor.js`).
//
// Tres saidas, e as tres derrubam a arvore do vite:
//   - Ctrl+C / SIGTERM / SIGHUP neste processo;
//   - o vite sair sozinho (este processo sai com o codigo dele);
//   - o `npm` que chamou este script morrer sem avisar (kill do pid do `npm`):
//     ninguem manda sinal para ca, entao a vigia pergunta pelos ancestrais.
//
// npm run dev                          # porta 5173
// CANGACO_DEV_PORTA=5180 npm run dev   # outra porta, para uma segunda arvore
// npm run dev -- --host                # o resto vai para o vite

const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { derrubarServidor, portaJaResponde, mensagemDePortaOcupada } = require('./_servidor');

const PORTA = Number(process.env.CANGACO_DEV_PORTA ?? 5173);
const VIGIA_MS = 1000;

/**
 * Os pids que, se morrerem, deixam este processo sem dono: o pai e, no Windows,
 * o avo. O `npm run` roda o script por `cmd.exe /c`, entao o pai e o `cmd` e o
 * `npm` e o avo — matar so o `npm` deixa o `cmd` de pe, esperando por nos.
 */
function ancestrais() {
  const pids = [process.ppid];
  if (process.platform !== 'win32') return pids;
  const r = spawnSync('powershell', [
    '-NoProfile', '-Command',
    `(Get-CimInstance Win32_Process -Filter 'ProcessId=${process.ppid}').ParentProcessId`,
  ], { encoding: 'utf8' });
  const avo = Number(String(r.stdout).trim());
  if (Number.isInteger(avo) && avo > 0) pids.push(avo);
  return pids;
}

function vivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    // EPERM: existe, so nao e nosso
    return erro.code === 'EPERM';
  }
}

async function main() {
  const url = `http://localhost:${PORTA}/`;
  if (await portaJaResponde(url)) {
    console.error(mensagemDePortaOcupada('dev', PORTA, 'CANGACO_DEV_PORTA'));
    process.exit(1);
  }

  const vite = spawn('npx', ['vite', '--port', String(PORTA), '--strictPort', ...process.argv.slice(2)], {
    cwd: path.join(__dirname, '..'),
    shell: true,
    stdio: 'inherit',
  });

  let saindo = false;
  const sair = (codigo) => {
    if (saindo) return;
    saindo = true;
    derrubarServidor(vite);
    process.exit(codigo);
  };
  // `exit` pega tambem o `process.exit` de qualquer outro caminho
  process.on('exit', () => { if (!saindo) derrubarServidor(vite); });
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sinal, () => sair(0));
  vite.on('exit', (codigo) => sair(codigo ?? 1));

  const donos = ancestrais();
  setInterval(() => {
    const morto = donos.find((pid) => !vivo(pid));
    if (morto !== undefined) {
      console.error(`dev: o processo ${morto}, que chamou este script, morreu — derrubando o vite.`);
      sair(1);
    }
  }, VIGIA_MS);
}

main();
