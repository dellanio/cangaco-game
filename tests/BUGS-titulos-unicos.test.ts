/**
 * BUGS.md sem titulo repetido (pedido do operador, 2026-09-30). O arquivo saiu duplicado duas
 * vezes, no BUG-Y e no BUG-T, por um corte que achou a mencao de "## Polimento" no texto e colou
 * o arquivo de novo. Aqui a regra roda no `verify`: todo titulo `## ` aparece uma vez so.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { titulosRepetidos } from '../tools/titulos-repetidos.js';

const BUGS = readFileSync('BUGS.md', 'utf8');

describe('BUGS.md — titulos unicos', () => {
  it('nenhum titulo `## ` aparece duas vezes', () => {
    expect(titulosRepetidos(BUGS)).toEqual([]);
  });

  it('a regra acusa: o proprio arquivo colado duas vezes (o defeito das duas vezes) reprova', () => {
    const duplicado = titulosRepetidos(BUGS + '\n' + BUGS);
    expect(duplicado.length).toBeGreaterThan(0);
    expect(duplicado.some((t) => t.startsWith('## Polimento'))).toBe(true);
  });

  it('titulo dentro de bloco de codigo nao conta (o modelo do BUG-000)', () => {
    expect(titulosRepetidos('## A\n```\n## A\n```\n')).toEqual([]);
    expect(titulosRepetidos('## A\n## A\n')).toEqual(['## A (2x)']);
  });
});
