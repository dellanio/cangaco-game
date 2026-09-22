import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameEvent, GameState } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { estaDesbloqueado, registrarConclusoes } from '../src/sim/desbloqueio';
import { step } from '../src/sim/tick';

const inicial = createInitialState(1);

const concluido = (predio: string, tipo: string): GameEvent =>
  ({ type: 'building-completed', predio, tipo });

/** Os ids liberados AGORA, calculados do dado — nunca uma lista digitada. */
const liberados = (e: GameState): string[] =>
  gameData.predios.filter((p) => estaDesbloqueado(e, p.id)).map((p) => p.id);

describe('F12 — registrarConclusoes: a dobra dos eventos do tick', () => {
  it('tick sem building-completed devolve o MESMO estado (identidade, nao copia)', () => {
    const soTick: GameEvent = { type: 'tick-advanced', tick: 1 };
    expect(registrarConclusoes(inicial, [soTick])).toBe(inicial);
    // storehouse ja esta no historico: o evento chega, e o estado nao se move
    expect(registrarConclusoes(inicial, [soTick, concluido('p1', 'storehouse')])).toBe(inicial);
  });

  it('um building-completed acrescenta o tipo e libera os filhos dele', () => {
    const depois = registrarConclusoes(inicial, [concluido('p7', 'woodcutters')]);
    expect(depois.tiposJaConstruidos).toEqual([...inicial.tiposJaConstruidos, 'woodcutters']);
    expect(estaDesbloqueado(inicial, 'sawmill')).toBe(false);
    expect(estaDesbloqueado(depois, 'sawmill')).toBe(true);
  });

  it('dois eventos no mesmo tick registram os dois, na ordem dos eventos', () => {
    const depois = registrarConclusoes(inicial, [
      concluido('p7', 'woodcutters'), concluido('p8', 'quarry'),
    ]);
    expect(depois.tiposJaConstruidos)
      .toEqual([...inicial.tiposJaConstruidos, 'woodcutters', 'quarry']);
  });

  it('dois eventos do MESMO tipo no mesmo tick registram uma vez so', () => {
    const depois = registrarConclusoes(inicial, [
      concluido('p7', 'woodcutters'), concluido('p8', 'woodcutters'),
    ]);
    expect(depois.tiposJaConstruidos).toEqual([...inicial.tiposJaConstruidos, 'woodcutters']);
  });

  it('nao muta o estado recebido', () => {
    const congelado = Object.freeze({
      ...inicial, tiposJaConstruidos: Object.freeze([...inicial.tiposJaConstruidos]),
    }) as GameState;
    const antes = liberados(congelado);
    registrarConclusoes(congelado, [concluido('p7', 'woodcutters')]);
    expect(liberados(congelado)).toEqual(antes);
  });
});

describe('F12 — o step() consome o evento', () => {
  it('um tick sem conclusao nao mexe no historico', () => {
    const depois = step(inicial, []);
    expect(depois.tiposJaConstruidos).toEqual(inicial.tiposJaConstruidos);
  });

  it('o historico sobrevive ao tick e o desbloqueio vale para o tick seguinte', () => {
    // Nao se fabrica o evento: o aceite, abaixo, o produz pelo caminho real. Aqui
    // prova-se so que `step` PRESERVA o historico movido e que `canPlace` o enxerga.
    const comConclusao = registrarConclusoes(inicial, [concluido('p7', 'woodcutters')]);
    const depois = step(comConclusao, []);
    expect(depois.tiposJaConstruidos).toContain('woodcutters');
    expect(estaDesbloqueado(depois, 'sawmill')).toBe(true);
  });
});
