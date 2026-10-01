/**
 * Os portoes do `verify` (camadas de teste, CLAUDE.md §13; aceite de 2026-10-01). Antes eram so
 * sondas de sessao (ressalva do avaliador). Aqui rodam como processo, num diretorio de projeto falso
 * por teste, e nunca tocam o `.verify-ok` real.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RAIZ = process.cwd();
const HOOK = join(RAIZ, '.claude', 'hooks', 'verify-gate.js');
const dirs: string[] = [];
const projeto = (): string => { const d = mkdtempSync(join(tmpdir(), 'zz-portao-')); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** O hook como o Claude Code o chama: o payload no stdin, o projeto em CLAUDE_PROJECT_DIR. */
function portao(dir: string, alvo: string): number {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ tool_input: { file_path: join(dir, alvo) } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8',
  });
  return r.status ?? -1;
}

describe('o portao do test-results.json (.claude/hooks/verify-gate.js)', () => {
  it('aceite 1, por tabela: so o selo completo e recente libera a escrita no test-results.json', () => {
    const agora = new Date().toISOString();
    const casos: { caso: string; selo: string | null; velho?: boolean; alvo?: string; esperado: number }[] = [
      { caso: 'completo recente', selo: JSON.stringify({ tipo: 'completo', commit: 'x', quando: agora }), esperado: 0 },
      { caso: 'formato antigo (so a data)', selo: agora, esperado: 0 },
      { caso: 'selo rapido', selo: JSON.stringify({ tipo: 'rapido' }), esperado: 2 },
      { caso: 'sem selo', selo: null, esperado: 2 },
      { caso: 'ilegivel', selo: '{nao e json', esperado: 2 },
      { caso: 'completo vencido (mais de 15 min)', selo: JSON.stringify({ tipo: 'completo', commit: 'x', quando: agora }), velho: true, esperado: 2 },
      { caso: 'outro arquivo, sem selo', selo: null, alvo: 'PROGRESS.md', esperado: 0 },
    ];
    for (const c of casos) {
      const dir = projeto();
      if (c.selo !== null) {
        writeFileSync(join(dir, '.verify-ok'), c.selo);
        if (c.velho) {
          const antes = (Date.now() - 16 * 60 * 1000) / 1000;
          utimesSync(join(dir, '.verify-ok'), antes, antes);
        }
      }
      expect(portao(dir, c.alvo ?? 'test-results.json'), c.caso).toBe(c.esperado);
    }
  });

  it('aceite 2: scripts/verify-gate.js e igual ao hook, byte a byte', () => {
    expect(readFileSync(join(RAIZ, 'scripts', 'verify-gate.js'), 'utf8')).toBe(readFileSync(HOOK, 'utf8'));
  });
});

describe('o verify:rapido (scripts/verify-rapido.js)', () => {
  it('aceite 3: sem arquivo alterado, sai 0, grava o .verify-rapido-ok e nao cria o .verify-ok', () => {
    const dir = projeto();
    // um projeto falso: as tres etapas nao fazem nada, e o git nao tem arquivo alterado
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'zz-portao', private: true,
      scripts: { typecheck: 'node -e 0', lint: 'node -e 0', 'validate:data': 'node -e 0' },
    }));
    for (const args of [['init', '-q'], ['add', '-A'], ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'x']]) {
      expect(spawnSync('git', args, { cwd: dir }).status, args.join(' ')).toBe(0);
    }
    const r = spawnSync('node', [join(RAIZ, 'scripts', 'verify-rapido.js')], { cwd: dir, encoding: 'utf8', shell: false, timeout: 60_000 });
    expect(r.status, r.stderr).toBe(0);
    expect(existsSync(join(dir, '.verify-rapido-ok'))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, '.verify-rapido-ok'), 'utf8'))).toMatchObject({ tipo: 'rapido', arquivos: 0, testes: 0 });
    expect(existsSync(join(dir, '.verify-ok'))).toBe(false);
  }, 90_000);
});
