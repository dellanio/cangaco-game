/**
 * A suite longa (decisoes do operador, 2026-09-30 e 2026-10-01): o filtro e pelo nome do arquivo.
 * Aqui a guarda de que o `verify` e a `test:longo` juntos cobrem todo arquivo de teste exatamente
 * uma vez, e de que nao sobrou a marca antiga no titulo (que agora nao tira ninguem de suite
 * nenhuma, e enganaria quem a lesse).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const ARQUIVOS = readdirSync('tests').filter((f) => f.endsWith('.test.ts'));
const longos = ARQUIVOS.filter((f) => f.endsWith('.longo.test.ts'));

describe('suite longa — o filtro pelo nome do arquivo', () => {
  it('ha os cinco longos que o operador mandou, e cada um tem um arquivo curto irmao', () => {
    expect(longos.sort()).toEqual([
      'BUG-T-troca-mutua.longo.test.ts',
      'BUG-Y-refeicao-garantida.longo.test.ts',
      'C-IA-03b-peacetime-e-tropas.longo.test.ts',
      'D-TRANSPORTE-03-T2-oferta-demanda.longo.test.ts',
      'F-VIVO-e-ocioso.longo.test.ts',
    ]);
    for (const f of longos) expect(ARQUIVOS, f).toContain(f.replace('.longo.test.ts', '.test.ts'));
  });

  it('nenhum titulo carrega a marca antiga `[longo]`', () => {
    const marcados = ARQUIVOS.filter((f) => f !== 'LONGO-lista.test.ts' && readFileSync(`tests/${f}`, 'utf8').includes('[longo]'));
    expect(marcados).toEqual([]);
  });
});
