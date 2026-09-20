import { describe, it, expect, afterAll } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameEvent, GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { createRng, nextU32 } from '../src/sim/rng';
import { compararComESemSave, deepFreeze, reviverPorJson } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

/** Varre o estado atras de qualquer coisa que o JSON nao carrega. */
function acharNaoSerializavel(valor: unknown, caminho = 'state'): string[] {
  const problemas: string[] = [];
  const visitar = (v: unknown, p: string, ancestrais: Set<object>): void => {
    if (typeof v === 'function') { problemas.push(`${p}: funcao`); return; }
    if (typeof v === 'undefined') { problemas.push(`${p}: undefined`); return; }
    if (v instanceof Map) { problemas.push(`${p}: Map`); return; }
    if (v instanceof Set) { problemas.push(`${p}: Set`); return; }
    if (v instanceof Date) { problemas.push(`${p}: Date`); return; }
    if (v === null || typeof v !== 'object') return;
    if (ancestrais.has(v)) { problemas.push(`${p}: referencia circular`); return; }
    if (Object.getPrototypeOf(v) !== Object.prototype && !Array.isArray(v)) {
      problemas.push(`${p}: prototipo nao-plano (classe?)`);
      return;
    }
    const proximos = new Set(ancestrais).add(v);
    for (const [k, filho] of Object.entries(v)) visitar(filho, `${p}.${k}`, proximos);
  };
  visitar(valor, caminho, new Set());
  return problemas;
}

const rodar = (seed: number, ticks: number): GameState => {
  let state = createInitialState(seed);
  for (let i = 0; i < ticks; i++) state = step(state, []);
  return state;
};

describe('F02 — tick determinista', () => {
  // --- Aceite literal do BUILD_PLAN ---

  it('1000 ticks com a mesma semente, duas vezes, dao o mesmo estado', () => {
    expect(JSON.stringify(rodar(2026, 1000))).toBe(JSON.stringify(rodar(2026, 1000)));
  });

  it('sementes diferentes ficam registradas em estados diferentes', () => {
    expect(JSON.stringify(rodar(1, 10))).not.toBe(JSON.stringify(rodar(2, 10)));
  });

  it('step nao muta o estado de entrada', () => {
    const entrada = deepFreeze(createInitialState(7));
    const antes = JSON.stringify(entrada);
    const saida = step(entrada, []); // com entrada congelada, mutar lanca TypeError
    expect(JSON.stringify(entrada)).toBe(antes);
    expect(saida).not.toBe(entrada);
    expect(saida.tick).toBe(entrada.tick + 1);
  });

  // Ate a F06 `Command` era `never`, a unica lista valida era a vazia e este
  // teste so guardava o contrato da assinatura. Desde a F07 ha um comando de
  // verdade: a lista e o ELEMENTO congelados provam que `step` nao os muta
  // (mutar um objeto congelado lanca TypeError). A prova sobre o efeito do
  // comando esta em tests/F07-posicionar.test.ts.
  it('step aceita uma lista de comandos congelada, com elemento real, sem muta-la', () => {
    const comandos: readonly Command[] = deepFreeze([
      { type: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0 } as const,
    ]);
    const antes = JSON.stringify(comandos);
    expect(() => step(createInitialState(1), comandos)).not.toThrow();
    expect(JSON.stringify(comandos)).toBe(antes);
  });

  // --- Exigencia 1: serializavel de verdade ---

  it('o estado nao contem nada que o JSON perca', () => {
    expect(acharNaoSerializavel(rodar(5, 3))).toEqual([]);
  });

  it('round-trip por JSON devolve um estado equivalente', () => {
    const state = rodar(5, 3);
    expect(reviverPorJson(state)).toEqual(state);
  });

  it('o estado revivido continua igual ao que nunca foi salvo', () => {
    const state = rodar(5, 3);
    expect(JSON.stringify(step(reviverPorJson(state), []))).toBe(JSON.stringify(step(state, [])));
  });

  // --- Exigencia 2: a semente vive no estado ---

  it('salvar no meio, recarregar e continuar da o mesmo resultado', () => {
    const { direto, comSave } = compararComESemSave({ seed: 2026, totalTicks: 1000, saveAtTick: 500 });
    expect(comSave).toBe(direto);
  });

  it('o rng do estado sobrevive ao save e continua a mesma sequencia', () => {
    const state = rodar(31337, 12);
    expect(nextU32(reviverPorJson(state).rng).value).toBe(nextU32(state.rng).value);
  });

  it('o estado inicial carrega a semente pedida', () => {
    expect(createInitialState(4242).rng).toEqual(createRng(4242));
  });

  // --- Exigencia do operador: eventos tambem sao deterministicos ---

  it('events carrega so o tick corrente e nao acumula', () => {
    let state = createInitialState(1);
    for (let i = 0; i < 50; i++) state = step(state, []);
    expect(state.events).toEqual([{ type: 'tick-advanced', tick: 50 }]);
  });

  it('dois runs iguais emitem os mesmos eventos, na mesma ordem', () => {
    const colher = (): GameEvent[][] => {
      let state = createInitialState(77);
      const porTick: GameEvent[][] = [];
      for (let i = 0; i < 100; i++) { state = step(state, []); porTick.push([...state.events]); }
      return porTick;
    };
    expect(colher()).toEqual(colher());
  });

  afterAll(() => {
    const final = rodar(2026, 1000);
    const { direto, comSave } = compararComESemSave({ seed: 2026, totalTicks: 1000, saveAtTick: 500 });
    gravarEvidencia('F02', {
      feature: 'F02-tick-determinista',
      semente: 2026,
      ticks: 1000,
      tickFinal: final.tick,
      rngFinal: final.rng,
      eventosNoUltimoTick: final.events,
      determinismo: {
        doisRunsIdenticos: JSON.stringify(rodar(2026, 1000)) === JSON.stringify(final),
        saveLoadIdentico: direto === comSave,
        salvoNoTick: 500,
      },
      naoSerializavel: acharNaoSerializavel(final),
      nota: 'step() nao consome rng na F02: nenhum sistema ainda.',
    });
  });
});
