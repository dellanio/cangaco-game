import { describe, expect, it } from 'vitest';
import { workersDosTestes } from '../tools/concorrencia-testes.mjs';
import { execFileSync } from 'node:child_process';
import process from 'node:process';
describe('I-ENTREGA-VERIFY-CONCORRENCIA', () => {
  it('preserva o padrão e permite limitar processos', () => {
    expect(workersDosTestes(undefined)).toBe('50%');
    for (const n of ['1', '2', '8']) expect(workersDosTestes(n)).toBe(Number(n));
  });
  it.each(['', '0', '-1', '1.5', '50%', 'NaN', ' 2', '2 ', '9007199254740992'])(
    'recusa uma configuração inválida: %s', valor => {
      expect(() => workersDosTestes(valor)).toThrow('inteiro positivo');
    });
  it('a transladada herda os mesmos workers, prazos e arquivos', () => {
    const codigo = `
      import normal from './vitest.config.mts';
      import transladada from './vitest.transladado.config.mts';
      import { EXCLUDE_DO_VERIFY } from './tools/suite-longa.mjs';
      console.log(JSON.stringify({normal: normal.test, transladada: transladada.test, exclusoes: EXCLUDE_DO_VERIFY}));
    `;
    interface Config { maxWorkers: number | string; include: string[]; exclude: string[]; testTimeout?: number; hookTimeout?: number }
    const { normal, transladada, exclusoes } = JSON.parse(execFileSync(process.execPath,
      ['--input-type=module', '-e', codigo], { encoding: 'utf8' })) as {
        normal: Config; transladada: Config; exclusoes: string[];
      };
    expect(normal.maxWorkers).toBe(workersDosTestes(process.env.CANGACO_TEST_WORKERS));
    expect(transladada.maxWorkers).toBe(normal.maxWorkers);
    expect(normal.include).toEqual(['tests/**/*.test.ts']);
    expect(transladada.include).toEqual(normal.include);
    expect(normal.exclude).toEqual(exclusoes);
    expect(transladada.exclude).toEqual(normal.exclude);
    expect(normal.testTimeout).toBeUndefined();
    expect(normal.hookTimeout).toBeUndefined();
    expect(transladada.testTimeout).toBeUndefined();
    expect(transladada.hookTimeout).toBeUndefined();
  });
});
