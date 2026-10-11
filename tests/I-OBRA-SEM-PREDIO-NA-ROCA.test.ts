import { describe, it, expect, afterAll } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import type { GameData } from '../src/sim/data/types';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { caixaDeTipo, bordaSul } from '../src/sim/footprint';
import { chaveDeTile } from '../src/sim/estradas';
import { gravarEvidencia } from './helpers/evidence';

/**
 * I-OBRA-SEM-PREDIO-NA-ROCA — o `canPlace` recusa com `roca` o lote com um tile de roca no footprint:
 * milho ou cana em qualquer quantidade (o pousio tambem) ou campo planejado. A porta nao entra.
 */
const evidencia: Record<string, unknown> = {};
afterAll(() => gravarEvidencia('I-OBRA-SEM-PREDIO-NA-ROCA', evidencia));

const inicial = createInitialState(1);
const TIPO = 'quarry';

/** O primeiro lote livre que o `canPlace` aceita, procurando a partir do armazem. */
function loteLivre(e: GameState): { gx: number; gy: number } {
  for (let r = 6; r < 40; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const gx = 30 + dx; const gy = 30 + dy;
        if (canPlace(e, TIPO, gx, gy).ok) return { gx, gy };
      }
    }
  }
  throw new Error('fixture: sem lote livre');
}

const LOTE = loteLivre(inicial);
const caixa = caixaDeTipo(TIPO, LOTE.gx, LOTE.gy, gameData);
if (caixa === null) throw new Error('fixture');
/** Um tile no meio do footprint, e o tile da porta. */
const MEIO = { gx: caixa.x0 + 1, gy: caixa.y0 + 1 };
const PORTA = { gx: bordaSul(caixa).x0, gy: bordaSul(caixa).y0 };

function comRecurso(e: GameState, t: { gx: number; gy: number }, tipo: string, quantidade: number): GameState {
  return { ...e, recursos: { ...e.recursos, [chaveDeTile(t)]: { tipo, quantidade } } };
}
function comCampoPlanejado(e: GameState, t: { gx: number; gy: number }): GameState {
  return { ...e, camposPlanejados: { ...e.camposPlanejados, [chaveDeTile(t)]: 'corn' } };
}

describe('I-OBRA-SEM-PREDIO-NA-ROCA', () => {
  it('1. por tabela: roca no footprint recusa com `roca`; ao lado e na porta aceita', () => {
    const casos: Array<[string, GameState, boolean | string]> = [
      ['lote livre', inicial, true],
      ['milho maduro no footprint', comRecurso(inicial, MEIO, 'corn', 4), 'roca'],
      ['milho em pousio no footprint', comRecurso(inicial, MEIO, 'corn', 0), 'roca'],
      ['cana no footprint', comRecurso(inicial, MEIO, 'grapes', 2), 'roca'],
      ['campo planejado no footprint', comCampoPlanejado(inicial, MEIO), 'roca'],
      ['milho na porta', comRecurso(inicial, PORTA, 'corn', 4), true],
      ['campo planejado na porta', comCampoPlanejado(inicial, PORTA), true],
    ];
    const tabela: Record<string, unknown> = {};
    for (const [nome, e, esperado] of casos) {
      const r = canPlace(e, TIPO, LOTE.gx, LOTE.gy);
      tabela[nome] = r.ok ? true : r.motivo;
      expect(r.ok ? true : r.motivo, nome).toBe(esperado);
    }
    // o mesmo lote, um passo ao lado da roca (a roca fica fora do footprint e da porta)
    const roca = comRecurso(inicial, { gx: caixa.x1 + 2, gy: caixa.y0 }, 'corn', 4);
    expect(canPlace(roca, TIPO, LOTE.gx, LOTE.gy).ok).toBe(true);
    evidencia['tabela'] = { lote: LOTE, tabela };
  });

  it('2. pelo step: o PlaceBlueprint sobre a roca e recusado e nenhuma obra nasce', () => {
    const e = comRecurso(inicial, MEIO, 'corn', 0);
    const depois = step(e, [{ type: 'PlaceBlueprint', buildingId: TIPO, gx: LOTE.gx, gy: LOTE.gy }]);
    expect(depois.predios.ordem).toEqual(e.predios.ordem);
    expect(depois.events.filter((x) => x.type === 'command-rejected')).toEqual([
      { type: 'command-rejected', command: 'PlaceBlueprint', buildingId: TIPO, gx: LOTE.gx, gy: LOTE.gy, motivo: 'roca' },
    ]);
    // e sem a roca o mesmo comando planta
    const livre = step(inicial, [{ type: 'PlaceBlueprint', buildingId: TIPO, gx: LOTE.gx, gy: LOTE.gy }]);
    expect(livre.predios.ordem.length).toBe(inicial.predios.ordem.length + 1);
  });

  it('3. a roca vem do dado (`aradura`), e nao de uma lista no codigo', () => {
    const tree = gameData.recursos.tipos['tree'];
    const corn = gameData.recursos.tipos['corn'];
    if (tree === undefined || corn === undefined) throw new Error('fixture');
    // um tipo de teste que se ara, e o milho sem `aradura`
    const dados: GameData = {
      ...gameData,
      recursos: { ...gameData.recursos, tipos: { ...gameData.recursos.tipos, palma: { ...corn }, corn: { ...corn, aradura: null } } },
    };
    expect(canPlace(comRecurso(inicial, MEIO, 'palma', 0), TIPO, LOTE.gx, LOTE.gy, dados)).toEqual({ ok: false, motivo: 'roca' });
    expect(canPlace(comRecurso(inicial, MEIO, 'corn', 0), TIPO, LOTE.gx, LOTE.gy, dados).ok).toBe(true);
  });
});
