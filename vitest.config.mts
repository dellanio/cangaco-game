import { defineConfig } from 'vitest/config';
import { SEM_O_LONGO } from './tests/helpers/suite-longa';

// maxWorkers (decisao do operador, 2026-09-30): o padrao do vitest e nucleos - 1, e com 15
// workers a maquina fica sobrecarregada — o teste pesado roda 4 a 4,5x mais lento que isolado
// e estoura o `timeout` de seguranca (C-IA-03b, F05a). Com metade: a suite fecha mais cedo e
// sem falha. Percentual, nao numero: a nuvem tem outra contagem de nucleos. O
// `vitest.transladado.config.mts` herda daqui pelo `mergeConfig`.
//
// Suite longa (decisao do operador, 2026-09-30): teste com `[longo]` no titulo NAO roda aqui nem
// no `verify`; roda em `npm run test:longo`. As constantes estao em `tests/helpers/suite-longa.ts`.
export default defineConfig({
  test: {
    environment: 'node', globals: true, include: ['tests/**/*.test.ts'], maxWorkers: '50%',
    testNamePattern: new RegExp(`^${SEM_O_LONGO}`),
  },
});
