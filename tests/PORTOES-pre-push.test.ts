/**
 * O portao do push (CLAUDE.md §13, decisao do operador de 2026-10-01): o hook `pre-push` recusa o
 * push se o `.verify-ok` nao e o selo completo do commit empurrado. Aqui a regra por tabela e o hook
 * de verdade, num repositorio falso com um remoto bare, sem tocar o `.verify-ok` real.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decidirPush, lerRefs } from '../tools/pre-push-regra.js';

const RAIZ = process.cwd();
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const NULO = '0'.repeat(40);
const selo = (o: Record<string, unknown>): string => JSON.stringify(o);
const branch = (sha: string) => [{ refLocal: 'refs/heads/main', shaLocal: sha, refRemota: 'refs/heads/main', shaRemoto: NULO }];

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('o portao do push', () => {
  it('aceite 1, por tabela: so o selo completo do sha empurrado passa', () => {
    const casos: [string, string | null, ReturnType<typeof branch>, boolean][] = [
      ['completo do commit empurrado', selo({ tipo: 'completo', commit: A, quando: 'x' }), branch(A), true],
      ['completo de outro commit', selo({ tipo: 'completo', commit: B, quando: 'x' }), branch(A), false],
      ['selo rapido', selo({ tipo: 'rapido', commit: A }), branch(A), false],
      ['sem selo', null, branch(A), false],
      ['ilegivel', '{nao e json', branch(A), false],
      ['formato antigo (so a data)', '2026-10-01T10:00:00.000Z', branch(A), false],
      ['apagar ref remota', null, [{ refLocal: '(delete)', shaLocal: NULO, refRemota: 'refs/heads/velha', shaRemoto: A }], true],
      ['empurrar tag', null, [{ refLocal: 'refs/tags/teste', shaLocal: A, refRemota: 'refs/tags/teste', shaRemoto: NULO }], true],
    ];
    for (const [caso, s, refs, ok] of casos) expect(decidirPush(s, refs).ok, caso).toBe(ok);
    expect(lerRefs(`refs/heads/main ${A} refs/heads/main ${NULO}\n`)).toEqual(branch(A));
  });

  it('aceite 2: push com selo velho e recusado e o remoto fica intocado; com o selo do HEAD passa', () => {
    const base = mkdtempSync(join(tmpdir(), 'zz-pre-push-'));
    dirs.push(base);
    const remoto = join(base, 'remoto.git');
    const repo = join(base, 'repo');
    const git = (cwd: string, ...args: string[]) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
    expect(git(base, 'init', '-q', '--bare', remoto).status).toBe(0);
    expect(git(base, 'init', '-q', '-b', 'main', repo).status).toBe(0);
    // o hook e a regra copiados do projeto, ligados como o `npm run hooks:instalar` liga
    mkdirSync(join(repo, '.githooks'));
    mkdirSync(join(repo, 'tools'));
    copyFileSync(join(RAIZ, '.githooks', 'pre-push'), join(repo, '.githooks', 'pre-push'));
    for (const f of ['pre-push-hook.js', 'pre-push-regra.js']) copyFileSync(join(RAIZ, 'tools', f), join(repo, 'tools', f));
    writeFileSync(join(repo, '.gitignore'), '.verify-ok\n');
    expect(git(repo, 'config', 'core.hooksPath', '.githooks').status).toBe(0);
    expect(git(repo, 'remote', 'add', 'origin', remoto).status).toBe(0);
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'primeiro').status).toBe(0);
    const head = (): string => git(repo, 'rev-parse', 'HEAD').stdout.trim();
    const noRemoto = (): string => git(remoto, 'rev-parse', '--verify', '-q', 'refs/heads/main').stdout.trim();

    // o selo do primeiro commit, e depois um commit a mais: o selo ficou velho
    writeFileSync(join(repo, '.verify-ok'), selo({ tipo: 'completo', commit: head(), quando: new Date().toISOString() }));
    writeFileSync(join(repo, 'nota.txt'), 'depois do verify\n');
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'depois do selo').status).toBe(0);
    const velho = git(repo, 'push', '-q', 'origin', 'main');
    expect(velho.status, velho.stderr).not.toBe(0);
    expect(velho.stderr).toContain('RECUSADO');
    expect(noRemoto()).toBe('');

    // o selo do HEAD: o mesmo push passa
    writeFileSync(join(repo, '.verify-ok'), selo({ tipo: 'completo', commit: head(), quando: new Date().toISOString() }));
    const novo = git(repo, 'push', '-q', 'origin', 'main');
    expect(novo.status, novo.stderr).toBe(0);
    expect(noRemoto()).toBe(head());
  }, 60_000);
});
