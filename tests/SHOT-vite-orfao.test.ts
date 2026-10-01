/**
 * O `shot.js` encerra o PROPRIO vite orfao (decisao do operador, 2026-10-01; aceite no CLAUDE.md
 * §13). So o PID que ele gravou ao subir, so se a linha de comando ainda for o vite daquela porta, e
 * so com o shot que o subiu morto. Qualquer outro processo continua intocavel.
 *
 * O registro vai para um diretorio temporario (`CANGACO_SHOT_REGISTRO_DIR`), e a porta e uma livre
 * pedida ao sistema: o teste nao toca o registro nem a porta de uma corrida de verdade.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as esperar } from 'node:timers/promises';
import { arquivoDoRegistro, liberarViteOrfao, podeEncerrar, portaJaResponde } from '../tools/_servidor.js';

const DIR = mkdtempSync(join(tmpdir(), 'zz-shot-registro-'));
process.env['CANGACO_SHOT_REGISTRO_DIR'] = DIR;
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

async function portaLivre(): Promise<number> {
  const s = createServer();
  const porta: number = await new Promise((ok) => s.listen(0, 'localhost', () => ok((s.address() as { port: number }).port)));
  await new Promise((ok) => s.close(ok));
  return porta;
}

async function ate(condicao: () => Promise<boolean> | boolean, tetoMs: number): Promise<boolean> {
  for (let t = 0; t < tetoMs; t += 50) {
    if (await condicao()) return true;
    await esperar(50);
  }
  return condicao();
}

describe('o vite orfao do shot', () => {
  it('aceite 1, por tabela: so o registro certo, com o vite na porta dele e o dono morto, encerra', () => {
    const vite = 'C:\\node.exe D:\\x\\node_modules\\vite\\bin\\vite.js --port 5176 --strictPort';
    const reg = { porta: 5176, vite: 4321, dono: 1234 };
    const casos: [string, Parameters<typeof podeEncerrar>[0], boolean][] = [
      ['o orfao do proprio shot', { registro: reg, porta: 5176, linhaDeComando: vite, donoVivo: false }, true],
      ['registro de outra porta', { registro: { ...reg, porta: 5178 }, porta: 5176, linhaDeComando: vite, donoVivo: false }, false],
      ['vite de outra porta', { registro: reg, porta: 5176, linhaDeComando: vite.replace('5176', '51760'), donoVivo: false }, false],
      ['nao e vite', { registro: reg, porta: 5176, linhaDeComando: 'node servidor.js --port 5176', donoVivo: false }, false],
      ['vitest nao e vite', { registro: reg, porta: 5176, linhaDeComando: 'node vitest --port 5176', donoVivo: false }, false],
      ['o processo ja nao existe', { registro: reg, porta: 5176, linhaDeComando: null, donoVivo: false }, false],
      ['o shot dono ainda roda', { registro: reg, porta: 5176, linhaDeComando: vite, donoVivo: true }, false],
      ['sem registro', { registro: null, porta: 5176, linhaDeComando: vite, donoVivo: false }, false],
    ];
    for (const [caso, entrada, esperado] of casos) expect(podeEncerrar(entrada), caso).toBe(esperado);
  });

  it('aceite 2a: um shot.js real encerrado a forca, com o vite de pe, nao deixa a porta presa', async () => {
    const porta = await portaLivre();
    const url = `http://localhost:${porta}/`;
    const shot = spawn(process.execPath, ['tools/shot.js', 'D-TELA-CAPTURA-DETERMINISTICA'], {
      cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, CANGACO_SHOT_PORTA: String(porta), CANGACO_SHOT_REGISTRO_DIR: DIR },
    });
    // o registro nasce no spawn do vite, com o PID do shot como dono
    expect(await ate(() => existsSync(arquivoDoRegistro(porta)), 20_000)).toBe(true);
    const registro = JSON.parse(readFileSync(arquivoDoRegistro(porta), 'utf8')) as { vite: number; dono: number; porta: number };
    expect(registro.dono).toBe(shot.pid);
    expect(registro.porta).toBe(porta);
    expect(await ate(() => portaJaResponde(url), 30_000)).toBe(true);
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(shot.pid), '/F'], { stdio: 'ignore' });
    else shot.kill('SIGKILL');
    expect(await ate(() => shot.exitCode !== null || shot.signalCode !== null, 10_000)).toBe(true);
    await liberarViteOrfao(porta);
    expect(await ate(async () => !(await portaJaResponde(url)), 10_000)).toBe(true);
  }, 90_000);

  it('aceite 2b: o vite orfao de verdade (o dono saiu sem derruba-lo) e encerrado pela liberacao, e a porta solta', async () => {
    const porta = await portaLivre();
    const url = `http://localhost:${porta}/`;
    // o "shot" que sai sem derrubar: sobe o vite com a MESMA linha de comando do shot.js, grava o
    // registro e termina, deixando o vite desligado dele
    const dono = spawnSync(process.execPath, ['-e', `
      const { spawn } = require('node:child_process');
      const path = require('node:path');
      const { gravarRegistro } = require('./tools/_servidor.js');
      const vite = spawn(process.execPath, [path.join('node_modules', 'vite', 'bin', 'vite.js'), '--port', '${porta}', '--strictPort'],
        { detached: true, stdio: 'ignore' });
      gravarRegistro(${porta}, vite.pid);
      vite.unref();
    `], { cwd: process.cwd(), env: { ...process.env, CANGACO_SHOT_REGISTRO_DIR: DIR }, encoding: 'utf8' });
    expect(dono.status, dono.stderr).toBe(0);
    const registro = JSON.parse(readFileSync(arquivoDoRegistro(porta), 'utf8')) as { vite: number };
    try {
      expect(await ate(() => portaJaResponde(url), 30_000)).toBe(true);
      // o dono ja saiu e o vite segue escutando: a porta esta presa
      await esperar(500);
      expect(await portaJaResponde(url)).toBe(true);
      const r = await liberarViteOrfao(porta);
      expect(r.encerrado, r.motivo).toBe(true);
      expect(await portaJaResponde(url)).toBe(false);
      expect(existsSync(arquivoDoRegistro(porta))).toBe(false);
    } finally {
      // so o vite que este teste subiu, se algo acima falhou
      if (await portaJaResponde(url) && process.platform === 'win32') spawnSync('taskkill', ['/pid', String(registro.vite), '/T', '/F'], { stdio: 'ignore' });
    }
  }, 90_000);

  it('aceite 3: um servidor que nao e o vite do registro continua escutando', async () => {
    const outro = createServer((c) => c.end());
    const porta: number = await new Promise((ok) => outro.listen(0, 'localhost', () => ok((outro.address() as { port: number }).port)));
    try {
      // o registro aponta este processo (o vitest, que nao e vite) e um dono que nao existe
      writeFileSync(arquivoDoRegistro(porta), JSON.stringify({ porta, vite: process.pid, dono: 2 ** 22 + 7 }));
      const r = await liberarViteOrfao(porta);
      expect(r.encerrado).toBe(false);
      expect(outro.listening).toBe(true);
      // e sem registro nenhum, tambem nao
      rmSync(arquivoDoRegistro(porta), { force: true });
      expect((await liberarViteOrfao(porta)).encerrado).toBe(false);
      expect(outro.listening).toBe(true);
    } finally {
      outro.close();
    }
  });
});
