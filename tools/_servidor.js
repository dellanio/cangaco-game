'use strict';

// As duas defesas do BUG-K, num lugar so: o roteiro (`tools/shot.js`) e o dev
// server (`tools/dev.js`) as usam. Duas copias da mesma defesa divergem — foi
// assim que o `npm run dev` continuou deixando orfao depois de o roteiro parar
// (F-DEV, 2026-09-26).

const { spawnSync } = require('node:child_process');

/**
 * Derruba o servidor INTEIRO. Com `shell: true` o filho e o `cmd.exe`
 * (Windows), e o `kill()` mata so ele: o `node vite.js`, neto, ficava orfao
 * escutando a porta, e a corrida seguinte media ele. `taskkill /T` desce a
 * arvore a partir do pid do filho. Sincrono de proposito: roda dentro do
 * `process.on('exit')`, onde nada assincrono chega a acontecer.
 */
function derrubarServidor(processo) {
  if (process.platform === 'win32' && processo.pid !== undefined) {
    spawnSync('taskkill', ['/pid', String(processo.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  // Linux/macOS: o mesmo defeito, com `sh` no lugar do `cmd.exe`. O roteiro sobe o
  // vite como lider de grupo (`detached`), e o sinal para `-pid` desce o grupo
  // inteiro. Quem nao subiu como lider (o dev) cai no `kill()` de antes.
  if (processo.pid !== undefined) {
    try {
      process.kill(-processo.pid, 'SIGTERM');
      return;
    } catch {
      // sem grupo com esse id: o filho nao e lider; segue para o kill simples
    }
  }
  processo.kill();
}

/**
 * A porta ja responde ANTES de o vite daqui subir? Entao quem responde e outro
 * processo (orfao de corrida anterior, ou vite de outra sessao), servindo outra
 * arvore. O `--strictPort` faria o nosso morrer calado, e sem ele o vite pula
 * para a porta seguinte sem avisar; recusar aqui e o que impede medir o vizinho.
 */
async function portaJaResponde(url) {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

/** A recusa, com a mesma frase para os dois: nomeia a porta, o comando que
 *  mostra o dono e a variavel que troca a porta. Nao mata o dono — ele pode ser
 *  a sessao de outra pessoa. */
function mensagemDePortaOcupada(quem, porta, variavel) {
  return `${quem}: a porta ${porta} ja responde antes de o vite subir — outro processo a ocupa `
    + `(vite orfao ou de outra sessao) e serviria OUTRA arvore. Veja quem e com `
    + `\`netstat -ano | findstr :${porta}\`, ou rode com ${variavel}=<outra>.`;
}

module.exports = { derrubarServidor, portaJaResponde, mensagemDePortaOcupada };
