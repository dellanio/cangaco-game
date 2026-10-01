/**
 * A trava de testes entre worktrees (regra do operador, 2026-10-01; CLAUDE.md §13). Aqui a regra
 * pura, num arquivo de trava PROPRIO em diretorio temporario: o teste roda dentro da trava de
 * verdade (o `verify` a segura) e nunca a toca.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abandonada, caminhoDaTrava, LIMITE_DE_ABANDONO_MS, lerTrava, soltar, tentarPegar } from '../tools/trava-regra.js';

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
  it('o limite de abandono e o da regra: 90 minutos', () => {
    expect(LIMITE_DE_ABANDONO_MS).toBe(90 * 60 * 1000);
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

  it('com mais de 90 minutos, a trava e abandonada e o proximo a toma; com 90 exatos, nao', () => {
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
