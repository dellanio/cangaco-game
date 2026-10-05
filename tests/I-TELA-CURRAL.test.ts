/**
 * I-TELA-CURRAL — "Malhada" vira "Curral" em todo o jogo (pedido do operador, 2026-10-05). O id
 * neutro `swine_farm` nao muda: a sim nunca le o tema (CLAUDE.md §9).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';

describe('I-TELA-CURRAL', () => {
  it('nenhum texto do jogador diz Malhada: o tema e o HTML', () => {
    for (const arq of ['data/theme-sertao.json', 'index.html']) {
      expect(readFileSync(arq, 'utf8'), arq).not.toMatch(/malhada/i);
    }
  });

  it('o swine_farm se chama Curral no tema, e o id neutro continua', () => {
    const tema = JSON.parse(readFileSync('data/theme-sertao.json', 'utf8')) as { predios: Record<string, { nome: string }> };
    expect(tema.predios['swine_farm']?.nome).toBe('Curral');
    expect(gameData.predios.some((p) => p.id === 'swine_farm')).toBe(true);
  });
});
