/**
 * C-COMBATE-02 — a cerca da paz (plano em docs/planos/2026-09-29-C-COMBATE-02-cerca-da-paz.md).
 * Decisao do operador (2026-09-29), divergindo do KaM: em paz, mover livre a ate N tiles de um
 * predio PRONTO do proprio lado; atacar, treinar e contratar seguem proibidos. Aceite:
 *  1. dentro da cerca a tropa anda;
 *  2. fora dela, recusa `longe-na-paz` e ninguem anda;
 *  3. na borda: N passa, N+1 recusa (derivado da caixa e do dado, sem literal);
 *  4. obra nao estende a cerca;
 *  5. `AttackUnit` em paz segue `em-paz`;
 *  6. depois da paz, o destino longe anda.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { dentroDaCercaDaPaz, emPaz } from '../src/sim/paz';
import { caixaDoPredio } from '../src/sim/footprint';
import { tileAndavel } from '../src/sim/pathfinding';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const N = gameData.escaramuca.cercaDaPaz_tiles;
/** Longe da vila do jogador: a ponta da frente da IA, do dado (vale no mundo transladado). */
const FRENTE = (gameData.escaramuca.posicoes.find((p) => p.id === 'frente') as { ponto: { gx: number; gy: number } }).ponto;
const LONGE = { gx: FRENTE.gx - 7, gy: FRENTE.gy - 7 };
const tropaDoJogador = (s: GameState): string[] =>
  s.unidades.ordem.filter((id) => s.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);
const recusa = (s: GameState, c: Command): string | undefined =>
  (step(s, [c], gameData).events.find((e) => e.type === 'command-rejected') as { motivo?: string } | undefined)?.motivo;

/** A caixa (inclusiva) de todos os predios prontos do jogador e o tile andavel a `d` tiles
 *  ao sul dela, na coluna do meio — derivado do estado, nao de literal. */
function aoSul(s: GameState, d: number): { gx: number; gy: number } {
  const caixas = s.predios.ordem.map((id) => s.predios.porId[id] as Predio)
    .filter((p) => p.lado === LADO_DO_JOGADOR && p.estado === 'completo')
    .map((p) => caixaDoPredio(p, gameData)).filter((c) => c !== null);
  const x0 = Math.min(...caixas.map((c) => c.x0));
  const x1 = Math.max(...caixas.map((c) => c.x1)) - 1;
  const y1 = Math.max(...caixas.map((c) => c.y1)) - 1;
  const t = { gx: Math.floor((x0 + x1) / 2), gy: y1 + d };
  if (!tileAndavel(s, t, 'livre', gameData)) throw new Error(`fixture: ${t.gx},${t.gy} nao e andavel`);
  return t;
}

describe('C-COMBATE-02 — a cerca da paz', () => {
  const s0 = criarEscaramuca(SEMENTE);
  const tropa = tropaDoJogador(s0);

  it('o dado: N inteiro, e a partida comeca em paz', () => {
    expect(Number.isInteger(N) && N > 0).toBe(true);
    expect(emPaz(s0)).toBe(true);
  });

  it('1. dentro da cerca, em paz, a tropa anda', () => {
    const destino = aoSul(s0, N - 2);
    let s = step(s0, [{ type: 'MoveUnits', unidades: tropa, destino }], gameData);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    for (let t = 0; t < 20; t += 1) s = step(s, [], gameData);
    const andaram = tropa.filter((id) => {
      const a = s0.unidades.porId[id];
      const b = s.unidades.porId[id];
      return a !== undefined && b !== undefined && (a.gx !== b.gx || a.gy !== b.gy || (b.fsmData.progresso ?? 0) > 0);
    });
    expect(andaram.length).toBeGreaterThan(0);
  });

  it('2. fora da cerca, em paz: longe-na-paz, e o estado das unidades nao muda', () => {
    const longe = LONGE;
    const r = step(s0, [{ type: 'MoveUnits', unidades: tropa, destino: longe }], gameData);
    expect(r.events.find((e) => e.type === 'command-rejected')).toMatchObject({ command: 'MoveUnits', motivo: 'longe-na-paz' });
    expect(r.unidades).toEqual(step(s0, [], gameData).unidades);
  });

  it('3. na borda: N passa, N+1 recusa', () => {
    const dentro = aoSul(s0, N);
    const fora = aoSul(s0, N + 1);
    expect(dentroDaCercaDaPaz(s0, dentro, LADO_DO_JOGADOR, gameData)).toBe(true);
    expect(dentroDaCercaDaPaz(s0, fora, LADO_DO_JOGADOR, gameData)).toBe(false);
    expect(recusa(s0, { type: 'MoveUnits', unidades: tropa, destino: dentro })).toBeUndefined();
    expect(recusa(s0, { type: 'MoveUnits', unidades: tropa, destino: fora })).toBe('longe-na-paz');
    // a cerca e do lado: a do jogador nao vale para a IA
    expect(dentroDaCercaDaPaz(s0, dentro, LADO_DA_IA, gameData)).toBe(false);
    gravarEvidencia('C-COMBATE-02', { N, dentro, fora });
  });

  it('4. obra nao estende a cerca', () => {
    const fora = aoSul(s0, N + 1);
    // uma planta colada ao tile de fora: em obra, nao conta
    let s = step(s0, [{ type: 'PlaceBlueprint', buildingId: 'woodcutters', gx: fora.gx, gy: fora.gy + 2 }], gameData);
    const obra = s.predios.ordem.map((id) => s.predios.porId[id] as Predio).find((p) => p.estado === 'obra' && p.lado === LADO_DO_JOGADOR);
    expect(obra, 'a planta precisa ter nascido para o caso valer').toBeDefined();
    expect(recusa(s, { type: 'MoveUnits', unidades: tropa, destino: fora })).toBe('longe-na-paz');
    // a mesma planta, pronta: estende
    const pronta = { ...(obra as Predio), estado: 'completo' } as unknown as Predio;
    s = { ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [pronta.id]: pronta } } };
    expect(dentroDaCercaDaPaz(s, fora, LADO_DO_JOGADOR, gameData)).toBe(true);
  });

  it('5. AttackUnit em paz segue em-paz', () => {
    const alvo = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.lado === LADO_DA_IA) as string;
    expect(recusa(s0, { type: 'AttackUnit', unidades: tropa, alvo })).toBe('em-paz');
  });

  it('6. depois da paz, a cerca nao existe', () => {
    const s = { ...s0, pazAteTick: s0.tick };
    expect(emPaz(s)).toBe(false);
    expect(recusa(s, { type: 'MoveUnits', unidades: tropa, destino: LONGE })).toBeUndefined();
  });
});
