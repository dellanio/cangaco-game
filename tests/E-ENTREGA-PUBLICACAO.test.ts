/**
 * E-ENTREGA-PUBLICACAO — `npm run publicar` (tools/publicar.js), sem enviar nada a lugar nenhum.
 *
 * Aceite (BUILD_PLAN, Fase E):
 *  (a) a regra pura, por tabela: recusa sem a tag `teste-jogo-<n>` no HEAD, com a arvore suja, sem o
 *      selo `completo` do HEAD e sem `dist/` do mesmo commit. Passa com os quatro;
 *  (b) como processo, com um `butler` falso (`CANGACO_BUTLER`): o comando chega ao butler com o
 *      diretorio, o canal e a versao certos, e nada e enviado quando a regra recusa;
 *  (c) a primeira publicacao e do operador (PROGRESS).
 * O processo roda num repositorio git falso, num diretorio temporario: o `.verify-ok` e o `dist/`
 * reais nao sao tocados.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { argumentosDoButler, podePublicar, versaoDasTags } from '../tools/publicar-regra.js';
import { gravarEvidencia } from './helpers/evidence';

const RAIZ = process.cwd();
const PUBLICAR = join(RAIZ, 'tools', 'publicar.js');
const HEAD = 'a'.repeat(40);
const QUATRO = {
  head: HEAD,
  tags: ['teste-jogo-3'],
  arvoreLimpa: true,
  selo: { tipo: 'completo', commit: HEAD, quando: '2026-10-03T00:00:00.000Z' },
  build: { commit: HEAD, arvoreLimpa: true },
};
const evidencia: Record<string, unknown> = {};

describe('E-ENTREGA-PUBLICACAO — aceite (a): a regra, por tabela', () => {
  it('passa com os quatro, e a versao e a tag', () => {
    expect(podePublicar(QUATRO)).toEqual({ ok: true, problemas: [], versao: 'teste-jogo-3' });
  });

  const recusas: [string, Record<string, unknown>, RegExp][] = [
    ['sem tag', { tags: [] }, /tag teste-jogo-<n>/],
    ['tag de outro formato', { tags: ['v1.0', 'teste-jogo-x'] }, /tag teste-jogo-<n>/],
    ['arvore suja', { arvoreLimpa: false }, /nao commitada/],
    ['sem selo', { selo: null }, /selo completo/],
    ['selo rapido do HEAD', { selo: { tipo: 'rapido', commit: HEAD } }, /selo completo/],
    ['selo completo de outro commit', { selo: { tipo: 'completo', commit: 'b'.repeat(40) } }, /selo completo/],
    ['selo no formato antigo (so a data)', { selo: '2026-10-03T00:00:00.000Z' }, /selo completo/],
    ['sem dist/', { build: null }, /dist\/ nao e do HEAD/],
    ['dist/ de outro commit', { build: { commit: 'b'.repeat(40), arvoreLimpa: true } }, /dist\/ nao e do HEAD/],
    ['dist/ feito com a arvore suja', { build: { commit: HEAD, arvoreLimpa: false } }, /dist\/ nao e do HEAD/],
  ];
  for (const [caso, mudanca, esperado] of recusas) {
    it(`recusa: ${caso}`, () => {
      const r = podePublicar({ ...QUATRO, ...mudanca } as Parameters<typeof podePublicar>[0]);
      expect(r.ok).toBe(false);
      expect(r.problemas.length).toBe(1);
      expect(r.problemas[0]).toMatch(esperado);
    });
  }

  it('com mais de uma tag teste-jogo no HEAD, vale a de maior numero', () => {
    expect(versaoDasTags(['teste-jogo-2', 'teste-jogo-10', 'outra'])).toBe('teste-jogo-10');
  });

  it('os argumentos do butler: diretorio, <alvo>:html5 e a versao', () => {
    expect(argumentosDoButler('dist', 'operador/cangaco', 'teste-jogo-3'))
      .toEqual(['push', 'dist', 'operador/cangaco:html5', '--userversion', 'teste-jogo-3']);
  });
});

describe('E-ENTREGA-PUBLICACAO — aceite (b): como processo, com o butler falso', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

  function git(dir: string, ...args: string[]): string {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  }

  /** Um projeto git com os quatro em ordem, e um butler falso FORA dele (o log nao suja a arvore). */
  function projeto(): { repo: string; butler: string; log: string } {
    const fora = mkdtempSync(join(tmpdir(), 'zz-publicar-'));
    dirs.push(fora);
    const repo = join(fora, 'repo');
    mkdirSync(repo);
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 'teste@example.com');
    git(repo, 'config', 'user.name', 'teste');
    git(repo, 'config', 'commit.gpgsign', 'false');
    writeFileSync(join(repo, '.gitignore'), '.verify-ok\ndist/\n');
    writeFileSync(join(repo, 'jogo.txt'), 'o jogo\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'o jogo');
    git(repo, 'tag', 'teste-jogo-7');
    const head = git(repo, 'rev-parse', 'HEAD');
    writeFileSync(join(repo, '.verify-ok'), JSON.stringify({ tipo: 'completo', commit: head, quando: new Date().toISOString() }));
    mkdirSync(join(repo, 'dist'));
    writeFileSync(join(repo, 'dist', 'index.html'), '<!doctype html>');
    writeFileSync(join(repo, 'dist', 'build.json'), JSON.stringify({ commit: head, arvoreLimpa: true }));
    const log = join(fora, 'butler.log');
    const butler = join(fora, 'butler-falso.js');
    writeFileSync(butler, `require('node:fs').writeFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));\n`);
    return { repo, butler, log };
  }

  function publicar(repo: string, butler: string, ...extra: string[]): { status: number; saida: string } {
    const r = spawnSync(process.execPath, [PUBLICAR, ...extra], {
      cwd: repo, encoding: 'utf8',
      env: { ...process.env, CANGACO_BUTLER: butler, CANGACO_ITCH_ALVO: 'operador/cangaco' },
    });
    return { status: r.status ?? -1, saida: `${r.stdout}${r.stderr}` };
  }

  it('com os quatro: o butler recebe o dist/, o canal html5 e a versao da tag', () => {
    const { repo, butler, log } = projeto();
    const r = publicar(repo, butler);
    expect(r.status, r.saida).toBe(0);
    const chamada = JSON.parse(readFileSync(log, 'utf8')) as { args: string[]; cwd: string };
    expect(chamada.args).toEqual(['push', 'dist', 'operador/cangaco:html5', '--userversion', 'teste-jogo-7']);
    expect(chamada.cwd.toLowerCase()).toBe(repo.toLowerCase());
    evidencia['chamada'] = chamada.args;
  });

  it('--ensaio: confere e mostra o comando, sem chamar o butler', () => {
    const { repo, butler, log } = projeto();
    const r = publicar(repo, butler, '--ensaio');
    expect(r.status, r.saida).toBe(0);
    expect(r.saida).toContain('operador/cangaco:html5');
    expect(existsSync(log)).toBe(false);
  });

  it('cada recusa sai diferente de 0 e nao chama o butler', () => {
    const casos: [string, (repo: string) => void][] = [
      ['arvore suja', (repo) => { writeFileSync(join(repo, 'jogo.txt'), 'mudou\n'); }],
      ['sem a tag', (repo) => { git(repo, 'tag', '-d', 'teste-jogo-7'); }],
      ['sem o selo', (repo) => { rmSync(join(repo, '.verify-ok')); }],
      ['dist/ de outro commit', (repo) => { writeFileSync(join(repo, 'dist', 'build.json'), JSON.stringify({ commit: 'c'.repeat(40), arvoreLimpa: true })); }],
      ['um commit depois do selo e do dist/', (repo) => {
        writeFileSync(join(repo, 'outro.txt'), 'x\n');
        git(repo, 'add', '-A');
        git(repo, 'commit', '-q', '-m', 'depois');
        git(repo, 'tag', 'teste-jogo-8');
      }],
    ];
    const saidas: Record<string, number> = {};
    for (const [caso, estragar] of casos) {
      const { repo, butler, log } = projeto();
      estragar(repo);
      const r = publicar(repo, butler);
      expect(r.status, `${caso}: ${r.saida}`).not.toBe(0);
      expect(r.saida, caso).toContain('nada foi enviado');
      expect(existsSync(log), caso).toBe(false);
      saidas[caso] = r.status;
    }
    evidencia['recusas'] = saidas;
    gravarEvidencia('E-ENTREGA-PUBLICACAO', evidencia);
  });
});
