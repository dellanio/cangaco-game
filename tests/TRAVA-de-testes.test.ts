/**
 * A trava de testes entre worktrees (regra do operador, 2026-10-01; CLAUDE.md §13). Aqui a regra
 * pura, num arquivo de trava PROPRIO em diretorio temporario: o teste roda dentro da trava de
 * verdade (o `verify` a segura) e nunca a toca.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  abandonada, caminhoDaTrava, darSinalDeVida, LIMITE_DE_ABANDONO_MS, lerTrava, SINAL_DE_VIDA_MS, soltar, tentarPegar,
} from '../tools/trava-regra.js';

const dirs: string[] = [];
function travaNova(): string {
  const d = mkdtempSync(join(tmpdir(), 'zz-trava-'));
  dirs.push(d);
  return join(d, 'cangaco-testes.lock');
}
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

const AGORA = Date.parse('2026-10-01T12:00:00.000Z');
const dono = (id: string, inicio = new Date(AGORA).toISOString()) => ({ id, branch: 'main', inicio, comando: 'npm run verify' });

describe('trava de testes', () => {
  it('os tempos sao os da regra: sinal de vida a cada 60 s, abandonada sem sinal ha 10 min', () => {
    expect(SINAL_DE_VIDA_MS).toBe(60 * 1000);
    expect(LIMITE_DE_ABANDONO_MS).toBe(10 * 60 * 1000);
  });

  it('aceite 1: conta pelo ultimo sinal de vida; sem `vivoEm`, pelo inicio', () => {
    const min = 60 * 1000;
    const muitoAntes = new Date(AGORA - 60 * min).toISOString();
    const tabela = [
      { caso: 'sinal ha 9 min', trava: { ...dono('a', muitoAntes), vivoEm: new Date(AGORA - 9 * min).toISOString() }, abandonada: false },
      { caso: 'sinal ha 10 min exatos', trava: { ...dono('a', muitoAntes), vivoEm: new Date(AGORA - 10 * min).toISOString() }, abandonada: false },
      { caso: 'sinal ha 10 min e 1 ms', trava: { ...dono('a', muitoAntes), vivoEm: new Date(AGORA - 10 * min - 1).toISOString() }, abandonada: true },
      { caso: 'sem sinal, inicio ha 9 min', trava: dono('a', new Date(AGORA - 9 * min).toISOString()), abandonada: false },
      { caso: 'sem sinal, inicio ha 11 min', trava: dono('a', new Date(AGORA - 11 * min).toISOString()), abandonada: true },
    ];
    for (const l of tabela) expect(abandonada(l.trava, AGORA), l.caso).toBe(l.abandonada);
  });

  it('o sinal de vida so regrava a trava do proprio dono', () => {
    const c = travaNova();
    tentarPegar(c, dono('a'), AGORA);
    expect(darSinalDeVida(c, 'b', AGORA + 1000)).toBe(false);
    expect(lerTrava(c)?.vivoEm).toBeUndefined();
    expect(darSinalDeVida(c, 'a', AGORA + 1000)).toBe(true);
    expect(lerTrava(c)?.vivoEm).toBe(new Date(AGORA + 1000).toISOString());
  });

  it('livre: pega, grava branch e horario; ocupada: o segundo nao pega e ve quem a tem', () => {
    const c = travaNova();
    expect(tentarPegar(c, dono('a'), AGORA)).toEqual({ ok: true });
    expect(lerTrava(c)).toMatchObject({ id: 'a', branch: 'main', inicio: new Date(AGORA).toISOString() });
    const r = tentarPegar(c, dono('b'), AGORA + 1000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.dona?.id).toBe('a');
  });

  it('soltar so apaga a trava do proprio dono', () => {
    const c = travaNova();
    tentarPegar(c, dono('a'), AGORA);
    expect(soltar(c, 'b')).toBe(false);
    expect(lerTrava(c)?.id).toBe('a');
    expect(soltar(c, 'a')).toBe(true);
    expect(lerTrava(c)).toBeNull();
    expect(tentarPegar(c, dono('b'), AGORA)).toEqual({ ok: true });
  });

  it('sem sinal de vida ha mais do limite, a trava e abandonada e o proximo a toma; no limite, nao', () => {
    const c = travaNova();
    tentarPegar(c, dono('velho', new Date(AGORA - LIMITE_DE_ABANDONO_MS).toISOString()), AGORA);
    expect(abandonada(lerTrava(c), AGORA)).toBe(false);
    expect(tentarPegar(c, dono('novo'), AGORA).ok).toBe(false);
    expect(tentarPegar(c, dono('novo'), AGORA + 1).ok).toBe(true);
    expect(lerTrava(c)?.id).toBe('novo');
  });

  it('trava ilegivel conta como abandonada (senao travaria todas as sessoes para sempre)', () => {
    const c = travaNova();
    writeFileSync(c, 'nao e json');
    expect(tentarPegar(c, dono('a'), AGORA)).toEqual({ ok: true });
  });

  it('o caminho e comum (Temp do usuario no Windows), e CANGACO_TRAVA o troca', () => {
    expect(caminhoDaTrava({ CANGACO_TRAVA: 'X:/t.lock' })).toBe('X:/t.lock');
    if (process.platform === 'win32') {
      const local = join('C:', 'Users', 'u', 'AppData', 'Local');
      // o TEMP da sessao (um scratchpad) e ignorado: a trava tem de ser comum
      expect(caminhoDaTrava({ LOCALAPPDATA: local, TEMP: join('C:', 'sessao', 'scratchpad') }))
        .toBe(join(local, 'Temp', 'cangaco-testes.lock'));
    }
  });
});

/**
 * Os aceites 2 e 3 rodam o SCRIPT de verdade, com os tempos reduzidos por variavel de ambiente
 * (`CANGACO_TRAVA_SINAL_MS`, `CANGACO_TRAVA_ABANDONO_MS`) e um arquivo de trava proprio. A proporcao
 * do dado (60 s : 10 min = 1 : 10) e mantida: sinal de 200 ms, abandono de 2 s.
 */
const SINAL_TESTE = 200;
const ABANDONO_TESTE = 2000;
const ambiente = (c: string): NodeJS.ProcessEnv => ({
  ...process.env, CANGACO_TRAVA: c, CANGACO_TRAVA_DONO: '',
  CANGACO_TRAVA_SINAL_MS: String(SINAL_TESTE), CANGACO_TRAVA_ABANDONO_MS: String(ABANDONO_TESTE),
});
const dormir = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });

describe('trava de testes — o script, com os tempos reduzidos', () => {
  it('aceite 2: enquanto o comando roda, o `vivoEm` avanca', async () => {
    expect(SINAL_TESTE * 10).toBe(ABANDONO_TESTE); // a mesma proporcao do dado
    const c = travaNova();
    // o comando do filho e um arquivo de script: passar codigo por dois shells perde as aspas
    const dorme = join(c, '..', 'dorme.js');
    writeFileSync(dorme, `setTimeout(() => {}, ${SINAL_TESTE * 6});`);
    const filho = spawn('node', ['tools/trava-de-testes.js', 'node', `"${dorme}"`], { env: ambiente(c), shell: true });
    const saiu = new Promise((r) => filho.on('exit', r));
    const vistos = new Set<string>();
    for (let i = 0; i < 10; i += 1) {
      await dormir(SINAL_TESTE / 2);
      const v = lerTrava(c)?.vivoEm;
      if (v !== undefined) vistos.add(v);
    }
    await saiu;
    expect(vistos.size).toBeGreaterThanOrEqual(2);
    expect(existsSync(c)).toBe(false);
  }, 20_000);

  it('aceite 3: processo morto sem soltar -> a trava fica, e e liberada so depois do limite', async () => {
    const c = travaNova();
    // o dono morre sem soltar: a trava fica no disco, com o ultimo sinal dele
    // o dono morreu sem soltar: fica no disco exatamente o que o script grava, com o ultimo sinal
    // dele agora. Escrito aqui, e nao por um processo encerrado a forca, porque o que o teste
    // precisa e o ARQUIVO que sobra; o encerramento forcado nao roda codigo nenhum para mudar isso
    writeFileSync(c, JSON.stringify({ id: 'morto', branch: 'x', inicio: new Date().toISOString(), vivoEm: new Date().toISOString() }));
    expect(lerTrava(c)?.id).toBe('morto');
    const t0 = Date.now();
    const r = spawnSync('node', ['tools/trava-de-testes.js', 'node', '-e', '"process.exit(0)"'], { env: ambiente(c), shell: true, encoding: 'utf8' });
    const esperou = Date.now() - t0;
    expect(r.status).toBe(0);
    expect(r.stderr).toContain('ocupada por x');
    // nao antes do limite (a trava era fresca), e nao muito depois (a espera e de meio sinal)
    expect(esperou).toBeGreaterThanOrEqual(ABANDONO_TESTE);
    expect(existsSync(c)).toBe(false);
  }, 20_000);
});
