/**
 * Suite longa (decisoes do operador, 2026-09-30 e 2026-10-01): teste de sim longa mora num arquivo
 * `*.longo.test.ts`, sai do `verify` e roda em `npm run test:longo`. O filtro e pelo NOME DO
 * ARQUIVO, nao pelo titulo: arquivo nao some de suite nenhuma por um titulo mal escrito, e a
 * suite longa nao coleta os outros arquivos.
 */
import { configDefaults } from 'vitest/config';

/** Os testes da suite longa. */
export const ARQUIVOS_LONGOS = 'tests/**/*.longo.test.ts';
/** O `exclude` da suite do `verify`: o padrao do Vitest mais os longos. */
export const EXCLUDE_DO_VERIFY: readonly string[] = [...configDefaults.exclude, ARQUIVOS_LONGOS];
/** O `exclude` da suite longa: so o padrao do Vitest (sem tirar os longos). */
export const EXCLUDE_DO_LONGO: readonly string[] = [...configDefaults.exclude];
