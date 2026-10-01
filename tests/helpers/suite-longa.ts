/**
 * Suite longa (decisao do operador, 2026-09-30): o que as configs do Vitest e a guarda
 * `tests/LONGO-lista.test.ts` dividem. Teste com a marca no titulo sai do `verify` e roda em
 * `npm run test:longo`. A marca e o titulo, e nao `.skip`: o teste continua inteiro e afirma o
 * mesmo, so muda em qual suite ele roda.
 */
export const MARCA_DO_LONGO = '[longo]';

/** Os arquivos com teste marcado. `include` da suite longa: o resto da suite tem trabalho no
 *  corpo do `describe`, que roda na coleta mesmo com o teste filtrado. */
export const ARQUIVOS_LONGOS: readonly string[] = [
  'tests/F-VIVO-e-ocioso.test.ts',
  'tests/C-IA-03b-peacetime-e-tropas.test.ts',
  'tests/D-TRANSPORTE-03-T2-oferta-demanda.test.ts',
  'tests/BUG-T-troca-mutua.test.ts',
  'tests/BUG-Y-refeicao-garantida.test.ts',
];

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Lookahead negativo: o titulo NAO tem a marca. Prefixo dos padroes do `verify`. */
export const SEM_O_LONGO = `(?!.*${escapar(MARCA_DO_LONGO)})`;
/** So os testes longos. */
export const SO_O_LONGO = new RegExp(escapar(MARCA_DO_LONGO));
