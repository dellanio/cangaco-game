/**
 * F14 — a posse mora no predio, e quem ocupa o que vem do dado.
 */
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState } from '../src/sim/state';
import type { PredioEmObra } from '../src/sim/state';
import { gameData } from '../src/sim/data';

const inicial = createInitialState(1);

describe('F14 — a posse mora no predio', () => {
  it('todo predio completo do cenario inicial nasce sem ocupante', () => {
    const completos = inicial.predios.ordem
      .map((id) => inicial.predios.porId[id])
      .filter((p) => p?.estado === 'completo');
    expect(completos).not.toHaveLength(0);
    expect(completos.every((p) => p?.estado === 'completo' && p.ocupante === null)).toBe(true);
  });

  it('obra que completa nasce vaga: completarObra devolve ocupante null', () => {
    const def = gameData.predios.find((p) => p.id === 'quarry');
    const obra: PredioEmObra = {
      id: 'o1', tipo: 'quarry', gx: 26, gy: 36, estado: 'obra', hp: def?.hp ?? 0,
      obra: { faltam: {}, nivelamento: 0 },
    };
    expect(completarObra(obra).ocupante).toBe(null);
  });
});
