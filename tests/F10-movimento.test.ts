/**
 * F10 — ticks por passo na diagonal. O A* de vizinhanca 8 precisa de um custo para o
 * passo diagonal, e ele tem que nascer no CARREGAMENTO (CLAUDE.md §5: nenhum sistema
 * converte tempo em execucao), com UM unico arredondamento — o mesmo cuidado de
 * `ticksParaTile` na F03.
 */
import { describe, it, expect } from 'vitest';
import { loadGameData } from '../src/sim/data/loader';
import { rawGameData } from '../src/sim/data/raw';
import type { GameData, TerrenoTipo } from '../src/sim/data/types';

const TERRENOS: readonly TerrenoTipo[] = ['estrada', 'grama', 'campoArado', 'areia'];
const dadosReais: GameData = loadGameData(rawGameData);

/** O valor esperado, recalculado do dado CRU com a formula direta (sem passar pelo
 *  loader): `round(sqrt(2) * tickHz * custo / (velocidade * escala))`. */
function esperadoDoDado(raw: typeof rawGameData, terreno: TerrenoTipo, modo: 'aPe' | 'montado'): number {
  const { tickHz } = raw.time;
  const escala = raw.time.escalas.movimento;
  const custo = raw.terrain.custoDeMovimento[terreno];
  const velocidade = raw.units.velocidadeBase_tilesPorSegundo[modo];
  return Math.round((Math.SQRT2 * tickHz * custo) / (velocidade * escala));
}

describe('F10 — movimento na diagonal: ticks por tile convertidos no carregamento', () => {
  it.each(['aPe', 'montado'] as const)('%s: cada terreno bate com a formula direta sobre o dado cru', (modo) => {
    for (const terreno of TERRENOS) {
      expect(dadosReais.movimento.ticksPorTileDiagonal[modo][terreno], `${modo}/${terreno}`)
        .toBe(esperadoDoDado(rawGameData, terreno, modo));
    }
  });

  it('e UM arredondamento so: com custo 1.3 a diagonal nao e round(sqrt2 x round(ortogonal))', () => {
    // dado sintetico e explicito, para o teste nao depender do balanceamento atual:
    // 10 Hz, escala 2.0, 1 tile/s, grama 1.3 -> ortogonal 6.5 -> 7; diagonal exata 9.19 -> 9,
    // enquanto arredondar duas vezes daria round(sqrt2 * 7 = 9.90) = 10.
    const dados = loadGameData({
      ...rawGameData,
      time: { ...rawGameData.time, tickHz: 10, escalas: { ...rawGameData.time.escalas, movimento: 2 } },
      units: { ...rawGameData.units, velocidadeBase_tilesPorSegundo: { aPe: 1, montado: 1.66 } },
      terrain: { ...rawGameData.terrain, custoDeMovimento: { ...rawGameData.terrain.custoDeMovimento, grama: 1.3 } },
    });
    expect(dados.movimento.ticksPorTile.aPe.grama).toBe(7);
    expect(dados.movimento.ticksPorTileDiagonal.aPe.grama).toBe(9);
    expect(dados.movimento.ticksPorTileDiagonal.aPe.grama).not.toBe(Math.round(Math.SQRT2 * dados.movimento.ticksPorTile.aPe.grama));
  });

  it('trocar o dado muda o resultado: escala de movimento 2.0 -> 4.0 corta os ticks da diagonal', () => {
    const rapido = loadGameData({
      ...rawGameData,
      time: { ...rawGameData.time, escalas: { ...rawGameData.time.escalas, movimento: 4 } },
    });
    for (const terreno of TERRENOS) {
      expect(rapido.movimento.ticksPorTileDiagonal.aPe[terreno], terreno)
        .toBeLessThan(dadosReais.movimento.ticksPorTileDiagonal.aPe[terreno]);
    }
  });

  it('a diagonal nunca e mais barata que o passo reto, e nunca custa mais que dois retos', () => {
    // a heuristica octil do A* e a ausencia de "atalho" por quina dependem disto
    for (const modo of ['aPe', 'montado'] as const) {
      for (const terreno of TERRENOS) {
        const reto = dadosReais.movimento.ticksPorTile[modo][terreno];
        const diagonal = dadosReais.movimento.ticksPorTileDiagonal[modo][terreno];
        expect(diagonal, `${modo}/${terreno}`).toBeGreaterThanOrEqual(reto);
        expect(diagonal, `${modo}/${terreno}`).toBeLessThanOrEqual(2 * reto);
      }
    }
  });

  it('cada conversao entra em `conversoes` (auditoria), no grupo de movimento, como inteiro >= 1', () => {
    const doGrupo = dadosReais.conversoes.filter((c) => c.caminho.startsWith('movimento.ticksPorTileDiagonal.'));
    expect(doGrupo).toHaveLength(2 * TERRENOS.length);
    for (const c of doGrupo) {
      expect(c.grupo).toBe('movimento');
      expect(Number.isInteger(c.ticks)).toBe(true);
      expect(c.ticks).toBeGreaterThanOrEqual(1);
    }
  });
});
