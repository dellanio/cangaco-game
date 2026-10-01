import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.mts';
import { ARQUIVOS_LONGOS, SO_O_LONGO } from './tests/helpers/suite-longa';

/**
 * Suite longa (decisao do operador, 2026-09-30): `npm run test:longo`. Roda SO os testes com
 * `[longo]` no titulo, que saem do `verify` (`vitest.config.mts`). Regra do CLAUDE.md §13:
 * nenhuma leva fecha sem esta suite verde, rodada sozinha na maquina, antes do avaliador.
 *
 * `include` so com os arquivos que tem teste longo: o resto da suite tem trabalho no corpo do
 * `describe`, que roda na coleta mesmo com o teste filtrado. A guarda de que a lista e a marca
 * andam juntas e `tests/LONGO-lista.test.ts`.
 */

// o `mergeConfig` CONCATENA o `include` com o da base (medido: a primeira corrida coletou a suite
// inteira), entao a lista e posta depois do merge, substituindo
const config = mergeConfig(base, defineConfig({ test: { testNamePattern: SO_O_LONGO } }));
export default { ...config, test: { ...config.test, include: [...ARQUIVOS_LONGOS] } };
