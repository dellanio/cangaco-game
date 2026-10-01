/**
 * A suite longa (decisao do operador, 2026-09-30): a marca de longo no titulo e a lista de
 * arquivos de `vitest.longo.config.mts` andam juntas. Teste marcado fora da lista nao rodaria em
 * suite nenhuma; arquivo na lista sem teste marcado faria a suite longa coletar a toa.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { ARQUIVOS_LONGOS, MARCA_DO_LONGO } from './helpers/suite-longa';

describe('suite longa — a lista e a marca', () => {
  it('todo arquivo com teste marcado esta na lista, e todo arquivo da lista tem um', () => {
    const marcados = readdirSync('tests').filter((f) => f.endsWith('.test.ts') && f !== 'LONGO-lista.test.ts')
      .filter((f) => readFileSync(`tests/${f}`, 'utf8').includes(`${MARCA_DO_LONGO}'`))
      .map((f) => `tests/${f}`).sort();
    expect(marcados).toEqual([...ARQUIVOS_LONGOS].sort());
  });
});
