import { defineConfig, mergeConfig } from 'vitest/config';
import transladado from './vitest.transladado.config.mts';
import { ARQUIVOS_LONGOS, SO_O_LONGO } from './tests/helpers/suite-longa';

/** A suite longa no mundo transladado: os mesmos testes, como o `verify` faz com a suite curta. */

// o `mergeConfig` CONCATENA o `include` com o da base (medido: a primeira corrida coletou a suite
// inteira), entao a lista e posta depois do merge, substituindo
const config = mergeConfig(transladado, defineConfig({ test: { testNamePattern: SO_O_LONGO } }));
export default { ...config, test: { ...config.test, include: [...ARQUIVOS_LONGOS] } };
