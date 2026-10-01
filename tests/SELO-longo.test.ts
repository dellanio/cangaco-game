/**
 * O selo da suite longa (decisao do operador, 2026-10-01; CLAUDE.md §13): `npm run test:longo`
 * grava o commit testado, e `npm run selo:longo` recusa se ele nao for o HEAD. Aqui, a regra pura:
 * cada condicao que derruba o selo, uma por vez.
 */
import { describe, expect, it } from 'vitest';
import { problemasDoSelo } from '../tools/selo-longo-regra.js';

const HEAD = 'a'.repeat(40);
const BOM = { commit: HEAD, verde: true, arvoreLimpa: true, sozinha: true };

describe('selo da suite longa', () => {
  it('vale: verde, sozinha, arvore limpa, no HEAD', () => {
    expect(problemasDoSelo(BOM, HEAD, false)).toEqual([]);
  });

  it('cada condicao, sozinha, recusa', () => {
    const casos: [string, Parameters<typeof problemasDoSelo>][] = [
      ['sem selo', [null, HEAD, false]],
      ['outro commit', [{ ...BOM, commit: 'b'.repeat(40) }, HEAD, false]],
      ['vermelho', [{ ...BOM, verde: false }, HEAD, false]],
      ['arvore suja na corrida', [{ ...BOM, arvoreLimpa: false }, HEAD, false]],
      ['arvore suja agora', [BOM, HEAD, true]],
      ['outro teste rodando', [{ ...BOM, sozinha: false }, HEAD, false]],
      ['sozinha nao medida', [{ ...BOM, sozinha: null }, HEAD, false]],
    ];
    for (const [nome, args] of casos) expect(problemasDoSelo(...args), nome).toHaveLength(1);
  });
});
