import { mkdirSync, writeFileSync } from 'node:fs';

/** CLAUDE.md §8: npm run test grava o resultado em test-output/<feature>.json.
 *  A corrida transladada (F18c-1c) aponta outro diretorio, para nao sobrescrever. */
export function gravarEvidencia(feature: string, dados: Record<string, unknown>): void {
  const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${feature}.json`, JSON.stringify(dados, null, 2));
}
