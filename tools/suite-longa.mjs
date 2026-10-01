// Suite longa (decisoes do operador, 2026-09-30 e 2026-10-01): teste de sim longa mora num arquivo
// `*.longo.test.ts`, sai do `verify` e roda em `npm run test:longo`. O filtro e pelo NOME DO ARQUIVO,
// nao pelo titulo. ESM de verdade (`.mjs`), importado com extensao pelas configs do Vitest: sem
// isto o Vite carregava um `.ts` como CommonJS e avisava a cada corrida (leva desatendida 2, 6a).
import { configDefaults } from 'vitest/config';

/** Os testes da suite longa. */
export const ARQUIVOS_LONGOS = 'tests/**/*.longo.test.ts';
/** O `exclude` da suite do `verify`: o padrao do Vitest mais os longos. */
export const EXCLUDE_DO_VERIFY = [...configDefaults.exclude, ARQUIVOS_LONGOS];
/** O `exclude` da suite longa: so o padrao do Vitest (sem tirar os longos). */
export const EXCLUDE_DO_LONGO = [...configDefaults.exclude];
