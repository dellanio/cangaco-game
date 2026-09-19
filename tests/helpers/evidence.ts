import { mkdirSync, writeFileSync } from 'node:fs';

/** CLAUDE.md §8: npm run test grava o resultado em test-output/<feature>.json */
export function gravarEvidencia(feature: string, dados: Record<string, unknown>): void {
  mkdirSync('test-output', { recursive: true });
  writeFileSync(`test-output/${feature}.json`, JSON.stringify(dados, null, 2));
}
