'use strict';

// As duas defesas do BUG-K, num lugar so: o roteiro (`tools/shot.js`) e o dev
// server (`tools/dev.js`) as usam. Duas copias da mesma defesa divergem — foi
// assim que o `npm run dev` continuou deixando orfao depois de o roteiro parar
// (F-DEV, 2026-09-26).

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setTimeout: esperar } = require('node:timers/promises');

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

// ---------------------------------------------------------------------------------------------
// O vite ORFAO do proprio shot (decisao do operador, 2026-10-01; aceite no CLAUDE.md §13). Um
// roteiro encerrado a forca nao chega ao `derrubarServidor`, e o vite fica escutando a porta: foi
// assim que a 5178 ficou presa e 70 roteiros falharam em 1 s. O shot grava, ao subir, o PID do vite,
// a porta e o proprio PID; na corrida seguinte so esse processo pode ser encerrado, e so se ainda for
// o vite daquela porta e se quem o subiu ja nao existir. Qualquer outro processo continua intocavel.

/** O registro, por porta, fora das worktrees (como a trava de testes): o orfao prende a porta da
 *  maquina, e nao a de uma arvore. `CANGACO_SHOT_REGISTRO_DIR` troca o diretorio (o teste). */
function arquivoDoRegistro(porta) {
  const base = process.env.CANGACO_SHOT_REGISTRO_DIR
    ?? path.join(process.env.LOCALAPPDATA ?? os.tmpdir(), 'Temp');
  return path.join(base, `cangaco-shot-vite-${porta}.json`);
}

function gravarRegistro(porta, vite) {
  const arquivo = arquivoDoRegistro(porta);
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, JSON.stringify({ porta, vite, dono: process.pid, inicio: new Date().toISOString() }));
}

function lerRegistro(porta) {
  try {
    return JSON.parse(fs.readFileSync(arquivoDoRegistro(porta), 'utf8'));
  } catch {
    return null;
  }
}

/** Apaga o registro so se ele ainda e o deste vite (outra corrida pode ter gravado o dela). */
function apagarRegistro(porta, vite) {
  const registro = lerRegistro(porta);
  if (registro !== null && registro.vite === vite) fs.rmSync(arquivoDoRegistro(porta), { force: true });
}

/** A linha de comando e a do vite DAQUELA porta? */
function ehViteNaPorta(linhaDeComando, porta) {
  return /\bvite(\.js)?\b/.test(linhaDeComando) && new RegExp(`--port[ =]${porta}(?![0-9])`).test(linhaDeComando);
}

/** A regra pura: encerra so o vite do registro, na porta dele, com o dono morto. */
function podeEncerrar({ registro, porta, linhaDeComando, donoVivo }) {
  return registro !== null && registro !== undefined && registro.porta === porta && Number.isInteger(registro.vite)
    && typeof linhaDeComando === 'string' && ehViteNaPorta(linhaDeComando, porta) && donoVivo === false;
}

function linhaDeComandoDe(pid) {
  if (process.platform === 'win32') {
    const r = spawnSync('powershell.exe', ['-NoProfile', '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}").CommandLine`], { encoding: 'utf8' });
    const linha = String(r.stdout ?? '').trim();
    return r.status === 0 && linha !== '' ? linha : null;
  }
  try {
    return fs.readFileSync(`/proc/${Number(pid)}/cmdline`, 'utf8').split('\0').join(' ').trim() || null;
  } catch {
    return null;
  }
}

function processoVivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (erro) {
    return erro.code === 'EPERM';
  }
}

/**
 * Chamada no inicio do `shot.js` e do `shot:todos`, com a porta ocupada: encerra o vite orfao do
 * proprio shot, se for ele, e espera a porta soltar. Devolve `{ encerrado, motivo }`; quem chamou
 * confere a porta de novo e recusa como antes se ela continuar ocupada.
 */
async function liberarViteOrfao(porta) {
  const registro = lerRegistro(porta);
  if (registro === null) return { encerrado: false, motivo: 'sem registro do shot nesta porta' };
  const linhaDeComando = linhaDeComandoDe(registro.vite);
  const donoVivo = processoVivo(registro.dono);
  if (!podeEncerrar({ registro, porta, linhaDeComando, donoVivo })) {
    if (linhaDeComando === null) fs.rmSync(arquivoDoRegistro(porta), { force: true }); // o vite do registro ja nao existe
    return { encerrado: false, motivo: donoVivo ? 'o shot que subiu o vite ainda roda' : 'o processo do registro nao e o vite desta porta' };
  }
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(registro.vite), '/T', '/F'], { stdio: 'ignore' });
  else {
    try { process.kill(-registro.vite, 'SIGTERM'); } catch { try { process.kill(registro.vite, 'SIGTERM'); } catch { /* ja saiu */ } }
  }
  fs.rmSync(arquivoDoRegistro(porta), { force: true });
  for (let i = 0; i < 50 && await portaJaResponde(`http://localhost:${porta}/`); i += 1) {
    await esperar(100);
  }
  return { encerrado: true, motivo: `vite orfao ${registro.vite} da porta ${porta} encerrado` };
}

module.exports = {
  derrubarServidor, portaJaResponde, mensagemDePortaOcupada,
  arquivoDoRegistro, gravarRegistro, apagarRegistro, ehViteNaPorta, podeEncerrar, liberarViteOrfao,
};
