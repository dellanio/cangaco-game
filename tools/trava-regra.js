'use strict';
// A trava de testes entre worktrees (regra do operador, 2026-10-01; CLAUDE.md §13), a parte pura e
// testavel: pegar, ver se esta abandonada, soltar. Quem a usa e tools/trava-de-testes.js.
// O caminho e um parametro: o teste usa um arquivo proprio e nunca toca a trava de verdade.
const fs = require('fs');
const os = require('os');
const path = require('path');

/** Quem segura a trava atualiza `vivoEm` a este intervalo (sinal de vida; operador, 2026-10-01). */
const SINAL_DE_VIDA_MS = 60 * 1000;
/** Trava sem sinal de vida ha mais que isto e abandonada (operador, 2026-10-01: 10 min; antes 90). */
const LIMITE_DE_ABANDONO_MS = 10 * 60 * 1000;

/**
 * O arquivo de trava, COMUM a todas as worktrees e sessoes da maquina. Nao e `os.tmpdir()`: nas
 * sessoes do Claude o `TEMP` aponta para um scratchpad por sessao, e a trava nao seria comum. No
 * Windows e a pasta Temp do usuario (`%LOCALAPPDATA%\Temp`). `CANGACO_TRAVA` troca o caminho.
 */
function caminhoDaTrava(env = process.env) {
  if (env.CANGACO_TRAVA) return env.CANGACO_TRAVA;
  const base = process.platform === 'win32' && env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'Temp') : os.tmpdir();
  return path.join(base, 'cangaco-testes.lock');
}

/** O conteudo da trava, ou null se ela nao existe ou esta ilegivel. */
function lerTrava(caminho) {
  try { return JSON.parse(fs.readFileSync(caminho, 'utf8')); } catch { return null; }
}

/**
 * A trava esta abandonada: o ultimo sinal de vida (`vivoEm`, ou o `inicio` se ela nunca deu sinal)
 * tem mais que o limite, ou nao da para ler.
 */
function abandonada(trava, agoraMs, limiteMs = LIMITE_DE_ABANDONO_MS) {
  if (trava === null) return true;
  const ultimo = typeof trava.vivoEm === 'string' ? trava.vivoEm : trava.inicio;
  if (typeof ultimo !== 'string') return true;
  const ms = Date.parse(ultimo);
  return Number.isNaN(ms) || agoraMs - ms > limiteMs;
}

/** O sinal de vida: regrava a trava com `vivoEm`, mas so se ela ainda for deste dono. */
function darSinalDeVida(caminho, id, agoraMs) {
  const atual = lerTrava(caminho);
  if (atual === null || atual.id !== id) return false;
  fs.writeFileSync(caminho, JSON.stringify({ ...atual, vivoEm: new Date(agoraMs).toISOString() }, null, 2));
  return true;
}

/**
 * Tenta pegar a trava UMA vez: cria o arquivo de forma atomica (`wx`, falha se existir). Se ela
 * existe e esta abandonada, apaga e tenta de novo. Devolve { ok: true } ou { ok: false, dona }.
 */
function tentarPegar(caminho, dono, agoraMs, limiteMs = LIMITE_DE_ABANDONO_MS) {
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      fs.mkdirSync(path.dirname(caminho), { recursive: true });
      const fd = fs.openSync(caminho, 'wx');
      fs.writeFileSync(fd, JSON.stringify(dono, null, 2));
      fs.closeSync(fd);
      return { ok: true };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const dona = lerTrava(caminho);
      if (!abandonada(dona, agoraMs, limiteMs)) return { ok: false, dona };
      try { fs.unlinkSync(caminho); } catch { /* outra sessao ja apagou */ }
    }
  }
  return { ok: false, dona: lerTrava(caminho) };
}

/** Solta a trava, mas so se ela for deste dono (pelo `id`). Nunca apaga a trava de outra sessao. */
function soltar(caminho, id) {
  const atual = lerTrava(caminho);
  if (atual !== null && atual.id === id) {
    try { fs.unlinkSync(caminho); } catch { /* ja saiu */ }
    return true;
  }
  return false;
}

module.exports = { SINAL_DE_VIDA_MS, LIMITE_DE_ABANDONO_MS, caminhoDaTrava, lerTrava, abandonada, darSinalDeVida, tentarPegar, soltar };
