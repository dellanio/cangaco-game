/**
 * npm run shot:todos (CLAUDE.md §13, aceite de 2026-10-01). Aqui a regra pura e o caso da porta
 * ocupada, que roda o script de verdade sem abrir navegador nenhum: com a porta tomada no inicio, ele
 * sai 2 e nao roda roteiro.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { deveParar, listarRoteiros, MEMORIA_MINIMA_MB } from '../tools/shot-todos-regra.js';

describe('npm run shot:todos', () => {
  it('aceite 1: a lista e todo tools/shots/*.js sem prefixo _, na ordem do nome', () => {
    const disco = readdirSync('tools/shots');
    const lista = listarRoteiros(disco);
    const esperado = disco.filter((f) => f.endsWith('.js') && !f.startsWith('_')).map((f) => f.replace(/\.js$/, '')).sort();
    expect(lista).toEqual(esperado);
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.some((n) => n.startsWith('_'))).toBe(false);
    expect(listarRoteiros(['b.js', '_ajuda.js', 'a.js', 'nota.md'])).toEqual(['a', 'b']);
  });

  it('aceite 4: para so com a memoria medida e abaixo do minimo', () => {
    expect(MEMORIA_MINIMA_MB).toBe(1500);
    const tabela: [number | null | undefined, boolean][] = [
      [1499, true], [1500, false], [8000, false], [0, true], [null, false], [undefined, false], [Number.NaN, false],
    ];
    for (const [mb, para] of tabela) expect(deveParar(mb), String(mb)).toBe(para);
  });

  it('aceite 3 e 6: com a porta ocupada no inicio, sai 2 sem rodar roteiro e grava o motivo, no arquivo do teste', async () => {
    const REAL = 'test-output/shot-todos.json';
    const realAntes = existsSync(REAL) ? readFileSync(REAL) : null;
    const dir = mkdtempSync(join(tmpdir(), 'zz-shot-todos-'));
    const saida = join(dir, 'shot-todos.json');
    const servidor = createServer();
    const porta: number = await new Promise((ok) => {
      servidor.listen(0, 'localhost', () => ok((servidor.address() as { port: number }).port));
    });
    try {
      const r = spawnSync('node', [join(process.cwd(), 'tools', 'shot-todos.js')], {
        cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, CANGACO_SHOT_PORTA: String(porta), CANGACO_SHOT_TODOS_SAIDA: saida }, timeout: 15_000,
      });
      expect(r.status).toBe(2);
      expect(r.stderr).toContain(`porta ${porta}`);
      const resumo = JSON.parse(readFileSync(saida, 'utf8')) as { roteiros: unknown[]; parou: string; porta: number };
      expect(resumo.porta).toBe(porta);
      expect(resumo.roteiros).toEqual([]);
      expect(resumo.parou).toContain('ocupada');
      // aceite 6: a evidencia real nao mudou
      if (realAntes === null) expect(existsSync(REAL)).toBe(false);
      else expect(readFileSync(REAL).equals(realAntes)).toBe(true);
    } finally {
      servidor.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 20_000);
});
