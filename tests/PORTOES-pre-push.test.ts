/**
 * O portao do push (CLAUDE.md §13, decisao do operador de 2026-10-01): o hook `pre-push` recusa o
 * push se o `.verify-ok` nao e o selo completo do commit empurrado. Aqui a regra por tabela e o hook
 * de verdade, num repositorio falso com um remoto bare, sem tocar o `.verify-ok` real.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decidirPush, lerRefs } from '../tools/pre-push-regra.js';
import { testesQueLeemDado } from '../tools/testes-que-leem-dado.js';

const RAIZ = process.cwd();
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const NULO = '0'.repeat(40);
const selo = (o: Record<string, unknown>): string => JSON.stringify(o);
const branch = (sha: string) => [{ refLocal: 'refs/heads/main', shaLocal: sha, refRemota: 'refs/heads/main', shaRemoto: NULO }];

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('o portao do push', () => {
  it('verify-rapido-dado-lido: leitores por tabela, sem retirar arquivos do related', () => {
    const fontes = {
      'tests/F-SPR-carregamento.test.ts': "readFileSync('assets/manifest.json')",
      'tests/F17f-manifesto.test.ts': "readFileSync('assets/manifest.json')",
      'tests/x.test.ts': "readFileSync('data/x.json'); readFileSync('saves/x.txt')",
      'tests/y.test.ts': "readFileSync('data/y.json')",
    };
    const casos: [string[], string[]][] = [
      [['assets/manifest.json'], ['tests/F-SPR-carregamento.test.ts', 'tests/F17f-manifesto.test.ts']],
      [['data/x.json'], ['tests/x.test.ts']],
      [['src/x.ts'], []],
      [['data/x.json', 'saves/x.txt'], ['tests/x.test.ts']],
      [['data/sub/x.json'], []],
    ];
    for (const [dados, esperado] of casos) expect(testesQueLeemDado(dados, fontes)).toEqual(esperado);
  });

  it('verify-rapido-dado-lido: commit so de manifesto chega ao vitest falso; related real sozinho perde o leitor', () => {
    const base = mkdtempSync(join(tmpdir(), 'zz-dado-lido-'));
    dirs.push(base);
    const repo = join(base, 'repo');
    const remoto = join(base, 'remoto.git');
    const git = (cwd: string, ...args: string[]) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
    expect(git(base, 'init', '-q', '--bare', remoto).status).toBe(0);
    expect(git(base, 'init', '-q', '-b', 'main', repo).status).toBe(0);
    mkdirSync(join(repo, 'assets'));
    mkdirSync(join(repo, 'tests'));
    writeFileSync(join(repo, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e 0', lint: 'node -e 0', 'validate:data': 'node -e 0' } }));
    writeFileSync(join(repo, '.gitignore'), '.verify-rapido-ok\ntest-output/\nnode_modules/\n');
    writeFileSync(join(repo, 'assets/manifest.json'), '{}');
    const leitor = 'tests/manifesto.test.ts';
    const fonte = "import { readFileSync } from 'node:fs';\nimport { it, expect } from 'vitest';\nit('le o manifesto', () => expect(JSON.parse(readFileSync('assets/manifest.json', 'utf8')).ok).toBe(true));\n";
    writeFileSync(join(repo, leitor), fonte);
    expect(git(repo, 'remote', 'add', 'origin', remoto).status).toBe(0);
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'base').status).toBe(0);
    expect(git(repo, 'push', '-q', '-u', 'origin', 'main').status).toBe(0);
    writeFileSync(join(repo, 'assets/manifest.json'), '{"ok":true}');
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'so manifesto').status).toBe(0);
    const vitest = join(RAIZ, 'node_modules/vitest/vitest.mjs');
    const rodar = (arquivos: string[], nome: string): number => {
      const relatorio = join(base, nome + '.json');
      const r = spawnSync('node', [vitest, 'related', '--run', '--passWithNoTests', '--reporter=json', '--outputFile=' + relatorio, ...arquivos], { cwd: repo, encoding: 'utf8', timeout: 60_000 });
      expect(r.status, r.stdout + r.stderr).toBe(0);
      return (JSON.parse(readFileSync(relatorio, 'utf8')) as { numTotalTests: number }).numTotalTests;
    };
    expect(rodar(['assets/manifest.json'], 'antes')).toBe(0);
    const leitores = testesQueLeemDado(['assets/manifest.json'], { [leitor]: fonte });
    expect(rodar(['assets/manifest.json', ...leitores], 'depois')).toBe(1);
    const falso = join(base, 'vitest-falso.js');
    const recebidos = join(base, 'recebidos.json');
    writeFileSync(falso, "const fs = require('fs'); const args = process.argv.slice(2); fs.writeFileSync(process.env.ZZ_RECEBIDOS, JSON.stringify(args)); fs.writeFileSync(args.find(a => a.startsWith('--outputFile.json=')).split('=')[1], JSON.stringify({numTotalTests: args.includes('tests/manifesto.test.ts') ? 1 : 0}));");
    const r = spawnSync('node', [join(RAIZ, 'scripts/verify-rapido.js')], { cwd: repo, encoding: 'utf8', timeout: 60_000, env: { ...process.env, CANGACO_VITEST: `node "${falso}"`, ZZ_RECEBIDOS: recebidos } });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(JSON.parse(readFileSync(recebidos, 'utf8'))).toContain(leitor);
    expect(JSON.parse(readFileSync(join(repo, '.verify-rapido-ok'), 'utf8'))).toMatchObject({ arquivos: 1, testes: 1 });
  }, 90_000);

  it('aceite 1, por tabela: so o selo completo do sha empurrado passa', () => {
    const casos: [string, string | null, ReturnType<typeof branch>, boolean][] = [
      ['completo do commit empurrado', selo({ tipo: 'completo', commit: A, quando: 'x' }), branch(A), true],
      ['completo de outro commit', selo({ tipo: 'completo', commit: B, quando: 'x' }), branch(A), false],
      ['selo rapido no lugar do completo', selo({ tipo: 'rapido', commit: A }), branch(A), false],
      ['sem selo', null, branch(A), false],
      ['ilegivel', '{nao e json', branch(A), false],
      ['formato antigo (so a data)', '2026-10-01T10:00:00.000Z', branch(A), false],
      ['apagar ref remota', null, [{ refLocal: '(delete)', shaLocal: NULO, refRemota: 'refs/heads/velha', shaRemoto: A }], true],
      ['empurrar tag', null, [{ refLocal: 'refs/tags/teste', shaLocal: A, refRemota: 'refs/tags/teste', shaRemoto: NULO }], true],
    ];
    for (const [caso, s, refs, ok] of casos) expect(decidirPush(s, refs).ok, caso).toBe(ok);
    expect(lerRefs(`refs/heads/main ${A} refs/heads/main ${NULO}\n`)).toEqual(branch(A));
  });

  it('verify-rapido-no-push, aceite 1, por tabela: o selo rapido do sha, com a base que cobre o remoto', () => {
    const R = 'c'.repeat(40); // o sha que o remoto tem
    const VELHO = 'd'.repeat(40); // um ancestral do remoto
    const FRENTE = 'e'.repeat(40); // um commit local, a frente do remoto
    const ancestrais: Record<string, string[]> = { [R]: [R, VELHO], [FRENTE]: [FRENTE, R, VELHO] };
    const git = {
      ehAncestral: (a: string, b: string): boolean => (ancestrais[b] ?? [b]).includes(a),
      emRefRemota: (a: string): boolean => a === R || a === VELHO,
    };
    const push = [{ refLocal: 'refs/heads/main', shaLocal: A, refRemota: 'refs/heads/main', shaRemoto: R }];
    const nova = [{ refLocal: 'refs/heads/nova', shaLocal: A, refRemota: 'refs/heads/nova', shaRemoto: NULO }];
    const rapido = (o: Record<string, unknown>): string => selo({ tipo: 'rapido', ...o });
    const casos: [string, string | null, string | null, typeof push, boolean][] = [
      ['rapido do sha, base = remoto', null, rapido({ commit: A, base: R }), push, true],
      ['rapido do sha, base ancestral do remoto', null, rapido({ commit: A, base: VELHO }), push, true],
      ['rapido de outro commit', null, rapido({ commit: B, base: R }), push, false],
      ['rapido com a base a frente do remoto', null, rapido({ commit: A, base: FRENTE }), push, false],
      ['rapido sem commit (formato antigo)', null, rapido({ base: R }), push, false],
      ['rapido sem base (formato antigo)', null, rapido({ commit: A }), push, false],
      ['branch nova, base numa ref remota', null, rapido({ commit: A, base: R }), nova, true],
      ['branch nova, base fora das refs remotas', null, rapido({ commit: A, base: FRENTE }), nova, false],
      ['completo do sha continua passando', selo({ tipo: 'completo', commit: A }), null, push, true],
      ['completo velho, rapido do sha', selo({ tipo: 'completo', commit: B }), rapido({ commit: A, base: R }), push, true],
      ['completo velho, sem rapido', selo({ tipo: 'completo', commit: B }), null, push, false],
    ];
    for (const [caso, c, r, refs, ok] of casos) expect(decidirPush(c, refs, r, git).ok, caso).toBe(ok);
  });

  it('verify-rapido-no-push, aceite 2: o rapido com a arvore limpa testa os commits que nao subiram, e o push passa com o selo', () => {
    const base = mkdtempSync(join(tmpdir(), 'zz-rapido-push-'));
    dirs.push(base);
    const remoto = join(base, 'remoto.git');
    const repo = join(base, 'repo');
    const git = (cwd: string, ...args: string[]) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
    expect(git(base, 'init', '-q', '--bare', remoto).status).toBe(0);
    expect(git(base, 'init', '-q', '-b', 'main', repo).status).toBe(0);
    mkdirSync(join(repo, '.githooks'));
    mkdirSync(join(repo, 'tools'));
    copyFileSync(join(RAIZ, '.githooks', 'pre-push'), join(repo, '.githooks', 'pre-push'));
    for (const f of ['pre-push-hook.js', 'pre-push-regra.js']) copyFileSync(join(RAIZ, 'tools', f), join(repo, 'tools', f));
    // as tres etapas nao fazem nada; o vitest e falso: grava os arquivos que recebeu e um relatorio
    writeFileSync(join(repo, 'package.json'), JSON.stringify({
      name: 'zz-rapido', private: true, scripts: { typecheck: 'node -e 0', lint: 'node -e 0', 'validate:data': 'node -e 0' },
    }));
    const vitestFalso = join(base, 'vitest-falso.js');
    writeFileSync(vitestFalso, [
      "const fs = require('fs');",
      "const args = process.argv.slice(2);",
      "const saida = args.find((a) => a.startsWith('--outputFile.json=')).split('=')[1];",
      "const arquivos = args.filter((a) => !a.startsWith('-') && a !== 'related');",
      "fs.writeFileSync(process.env.ZZ_RECEBIDOS, JSON.stringify(arquivos));",
      "fs.mkdirSync(require('path').dirname(saida), { recursive: true });",
      "fs.writeFileSync(saida, JSON.stringify({ numTotalTests: 7 }));",
    ].join('\n'));
    writeFileSync(join(repo, '.gitignore'), '.verify-ok\n.verify-rapido-ok\ntest-output/\n');
    expect(git(repo, 'config', 'core.hooksPath', '.githooks').status).toBe(0);
    expect(git(repo, 'remote', 'add', 'origin', remoto).status).toBe(0);
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'primeiro').status).toBe(0);
    // o primeiro push, com o completo do HEAD; depois, o upstream existe
    const head = (): string => git(repo, 'rev-parse', 'HEAD').stdout.trim();
    writeFileSync(join(repo, '.verify-ok'), selo({ tipo: 'completo', commit: head() }));
    expect(git(repo, 'push', '-q', '-u', 'origin', 'main').status).toBe(0);
    const noRemoto0 = head();

    // dois commits que ainda nao subiram, e a arvore limpa
    writeFileSync(join(repo, 'a.ts'), 'export const a = 1;\n');
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'a').status).toBe(0);
    writeFileSync(join(repo, 'b.ts'), 'export const b = 2;\n');
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'b').status).toBe(0);
    const recebidos = join(base, 'recebidos.json');
    const r = spawnSync('node', [join(RAIZ, 'scripts', 'verify-rapido.js')], {
      cwd: repo, encoding: 'utf8', timeout: 60_000,
      env: { ...process.env, CANGACO_VITEST: `node "${vitestFalso}"`, ZZ_RECEBIDOS: recebidos },
    });
    expect(r.status, r.stderr).toBe(0);
    expect((JSON.parse(readFileSync(recebidos, 'utf8')) as string[]).map((f) => f.replace(/"/g, '')).sort()).toEqual(['a.ts', 'b.ts']);
    const seloRapido = JSON.parse(readFileSync(join(repo, '.verify-rapido-ok'), 'utf8')) as Record<string, unknown>;
    expect(seloRapido).toMatchObject({ tipo: 'rapido', commit: head(), base: noRemoto0, arquivos: 2, testes: 7 });

    // o push passa com o selo rapido (o completo e do commit anterior)
    const comRapido = git(repo, 'push', '-q', 'origin', 'main');
    expect(comRapido.status, comRapido.stderr).toBe(0);
    expect(git(remoto, 'rev-parse', 'refs/heads/main').stdout.trim()).toBe(head());

    // um commit depois do selo: recusado
    writeFileSync(join(repo, 'c.ts'), 'export const c = 3;\n');
    expect(git(repo, 'add', '-A').status).toBe(0);
    expect(git(repo, 'commit', '-q', '-m', 'c').status).toBe(0);
    const velho = git(repo, 'push', '-q', 'origin', 'main');
    expect(velho.status).not.toBe(0);
    expect(velho.stderr).toContain('RECUSADO');
  }, 90_000);

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
