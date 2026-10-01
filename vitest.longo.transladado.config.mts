import { defineConfig, mergeConfig } from 'vitest/config';
import transladado from './vitest.transladado.config.mts';
import { ARQUIVOS_LONGOS, EXCLUDE_DO_LONGO } from './tools/suite-longa.mjs';

/** A suite longa no mundo transladado: os mesmos testes, como o `verify` faz com a suite curta. */

// o `mergeConfig` CONCATENA `include` e `exclude` com os da base (medido: a primeira corrida
// coletou a suite inteira), entao os dois sao postos depois do merge, substituindo
const config = mergeConfig(transladado, defineConfig({ test: {} }));
export default { ...config, test: { ...config.test, include: [ARQUIVOS_LONGOS], exclude: [...EXCLUDE_DO_LONGO] } };
