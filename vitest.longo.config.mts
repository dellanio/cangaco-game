import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.mts';
import { ARQUIVOS_LONGOS, EXCLUDE_DO_LONGO } from './tools/suite-longa.mjs';

/**
 * Suite longa (decisoes do operador, 2026-09-30 e 2026-10-01): `npm run test:longo` roda os
 * arquivos `*.longo.test.ts`, que saem do `verify` (`vitest.config.mts`). Regra do CLAUDE.md §13:
 * nenhuma leva fecha sem esta suite verde, rodada sozinha na maquina, antes do avaliador.
 */

// o `mergeConfig` CONCATENA `include` e `exclude` com os da base (medido: a primeira corrida
// coletou a suite inteira), entao os dois sao postos depois do merge, substituindo
const config = mergeConfig(base, defineConfig({ test: {} }));
export default { ...config, test: { ...config.test, include: [ARQUIVOS_LONGOS], exclude: [...EXCLUDE_DO_LONGO] } };
