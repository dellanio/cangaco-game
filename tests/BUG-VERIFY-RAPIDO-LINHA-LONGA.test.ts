/**
 * BUG-VERIFY-RAPIDO-LINHA-LONGA — o `verify:rapido` chama o vitest sem shell, e acima do teto da linha
 * roda a suite inteira e diz isso no selo. A regra por tabela, e o script de verdade num repositorio
 * falso com um vitest falso (o mesmo arranjo do `PORTOES-pre-push`), sem tocar o selo real.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TETO_DA_LINHA, comandoDoVitest, corridaDoVitest, palavras, tamanhoDaLinha } from '../tools/vitest-do-rapido.js';

const RAIZ = process.cwd();
const LIMITE_DO_CMD = 8191;
const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe('BUG-VERIFY-RAPIDO-LINHA-LONGA', () => {
  it('o teto fica abaixo do limite do Windows e acima do cmd.exe', () => {
    expect(TETO_DA_LINHA).toBeLessThan(32767);
    expect(TETO_DA_LINHA).toBeGreaterThan(LIMITE_DO_CMD);
  });

  it('o comando, por tabela: o CANGACO_VITEST com aspas, ou o node no vitest.mjs', () => {
    expect(palavras('node "C:\\a b\\falso.js"')).toEqual(['node', 'C:\\a b\\falso.js']);
    expect(comandoDoVitest(undefined, '/bin/node', '/p/vitest.mjs')).toEqual(['/bin/node', '/p/vitest.mjs']);
    expect(comandoDoVitest('npx vitest', '/bin/node', '/p/vitest.mjs')).toEqual(['npx', 'vitest']);
  });

  it('o modo, por tabela: related ate o teto, suite inteira acima, com o motivo', () => {
    const nomes = (n: number): string[] => Array.from({ length: n }, (_, i) => `src/arquivo-${String(i).padStart(4, '0')}.ts`);
    const casos: [number, number, string][] = [[1, 1000, 'related'], [10, 1000, 'related'], [100, 1000, 'suite-inteira'], [100, TETO_DA_LINHA, 'related']];
    for (const [n, teto, modo] of casos) {
      const c = corridaDoVitest(['node', 'v.mjs'], nomes(n), 'r.json', teto);
      expect(c.modo, `${n} arquivos, teto ${teto}`).toBe(modo);
      if (modo === 'related') {
        expect(c.argv.slice(-n)).toEqual(nomes(n));
        expect(tamanhoDaLinha(c.argv)).toBeLessThanOrEqual(teto);
      } else {
        expect(c.argv).toContain('run');
        expect(c.argv).not.toContain('related');
        expect(c.motivo).toContain(`${n} arquivo(s)`);
      }
    }
  });

  it('como processo: 600 arquivos de nome longo chegam todos ao vitest; acima do teto, a suite inteira no selo', () => {
    const base = mkdtempSync(join(tmpdir(), 'zz-linha-longa-'));
    dirs.push(base);
    const repo = join(base, 'repo');
    const git = (...args: string[]) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo, encoding: 'utf8' });
    mkdirSync(repo);
    expect(git('init', '-q', '-b', 'main').status).toBe(0);
    writeFileSync(join(repo, 'package.json'), JSON.stringify({
      name: 'zz-linha-longa', private: true, scripts: { typecheck: 'node -e 0', lint: 'node -e 0', 'validate:data': 'node -e 0' },
    }));
    writeFileSync(join(repo, '.gitignore'), '.verify-rapido-ok\ntest-output/\n');
    expect(git('add', '-A').status).toBe(0);
    expect(git('commit', '-q', '-m', 'base').status).toBe(0);
    const vitestFalso = join(base, 'vitest-falso.js');
    const recebidos = join(base, 'recebidos.json');
    writeFileSync(vitestFalso, [
      "const fs = require('fs');",
      'const args = process.argv.slice(2);',
      "const saida = args.find((a) => a.startsWith('--outputFile.json=')).split('=')[1];",
      "fs.writeFileSync(process.env.ZZ_RECEBIDOS, JSON.stringify(args));",
      "fs.mkdirSync(require('path').dirname(saida), { recursive: true });",
      'fs.writeFileSync(saida, JSON.stringify({ numTotalTests: 3 }));',
    ].join('\n'));
    mkdirSync(join(repo, 'src'));
    const criar = (de: number, ate: number): string[] => Array.from({ length: ate - de }, (_, i) => {
      const f = `src/nome-comprido-da-linha-longa-${String(de + i).padStart(4, '0')}.ts`;
      writeFileSync(join(repo, f), 'export {};\n');
      return f;
    });
    const rodar = () => {
      const r = spawnSync('node', [join(RAIZ, 'scripts', 'verify-rapido.js')], {
        cwd: repo, encoding: 'utf8', timeout: 60_000, env: { ...process.env, CANGACO_VITEST: `node "${vitestFalso}"`, ZZ_RECEBIDOS: recebidos },
      });
      expect(r.status, r.stdout + r.stderr).toBe(0);
      return {
        args: JSON.parse(readFileSync(recebidos, 'utf8')) as string[],
        selo: JSON.parse(readFileSync(join(repo, '.verify-rapido-ok'), 'utf8')) as Record<string, unknown>,
      };
    };

    const seiscentos = criar(0, 600);
    const a = rodar();
    const linha = tamanhoDaLinha(a.args);
    expect(linha).toBeGreaterThan(LIMITE_DO_CMD);
    expect(a.args).toContain('related');
    expect(a.args.filter((x) => x.startsWith('src/')).sort()).toEqual(seiscentos);
    expect(a.selo).toMatchObject({ tipo: 'rapido', arquivos: 600, testes: 3 });
    expect(a.selo['modo']).toBeUndefined();

    criar(600, 1000);
    const b = rodar();
    expect(b.args).toContain('run');
    expect(b.args).not.toContain('related');
    expect(b.args.some((x) => x.startsWith('src/'))).toBe(false);
    expect(b.selo).toMatchObject({ tipo: 'rapido', arquivos: 1000, testes: 3, modo: 'suite-inteira' });
    expect(String(b.selo['motivo'])).toContain('1000 arquivo(s)');
  }, 90_000);
});
