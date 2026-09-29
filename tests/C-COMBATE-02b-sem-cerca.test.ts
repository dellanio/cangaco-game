/**
 * C-COMBATE-02b — a cerca da paz sai (plano em docs/planos/2026-09-29-C-COMBATE-02b-a-cerca-sai.md).
 * Decisao do operador (2026-09-29, segunda partida): "REMOVA a cerca da paz. Ela impede os
 * meus soldados de avancar no mapa". Em paz a marcha anda para qualquer destino; atacar,
 * treinar e contratar seguem `em-paz`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { emPaz } from '../src/sim/paz';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
/** Longe da vila do jogador: a ponta da frente da IA, do dado (vale no mundo transladado). */
const FRENTE = (gameData.escaramuca.posicoes.find((p) => p.id === 'frente') as { ponto: { gx: number; gy: number } }).ponto;
const LONGE = { gx: FRENTE.gx - 7, gy: FRENTE.gy - 7 };

describe('C-COMBATE-02b — em paz a marcha e livre', () => {
  const s0 = criarEscaramuca(SEMENTE);
  const tropa = s0.unidades.ordem.filter((id) => s0.unidades.porId[id]?.lado === LADO_DO_JOGADOR && s0.unidades.porId[id]?.tipo === gameData.escaramuca.tropaDoJogador.tipo);

  it('a cerca nao existe mais no dado', () => {
    expect('cercaDaPaz_tiles' in gameData.escaramuca).toBe(false);
  });

  it('em paz, a marcha longe da vila passa, e a tropa chega perto do destino ainda em paz', () => {
    expect(emPaz(s0)).toBe(true);
    let s: GameState = step(s0, [{ type: 'MoveUnits', unidades: tropa, destino: LONGE }], gameData);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    const lider = s0.unidades.porId[tropa[0] as string];
    const antes = Math.max(Math.abs((lider?.gx ?? 0) - LONGE.gx), Math.abs((lider?.gy ?? 0) - LONGE.gy));
    for (let t = 0; t < 1500 && s.unidades.porId[tropa[0] as string]?.fsm !== 'ocioso'; t += 1) s = step(s, [], gameData);
    const u = s.unidades.porId[tropa[0] as string];
    const depois = Math.max(Math.abs((u?.gx ?? 0) - LONGE.gx), Math.abs((u?.gy ?? 0) - LONGE.gy));
    expect(emPaz(s)).toBe(true);
    expect(depois).toBeLessThanOrEqual(1);
    gravarEvidencia('C-COMBATE-02b', { destino: LONGE, distanciaAntes: antes, distanciaDepois: depois, tick: s.tick, pazAteTick: s.pazAteTick });
  });

  it('as quatro ordens de combate seguem em-paz', () => {
    const alvo = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.lado === LADO_DA_IA) as string;
    const quartel = s0.predios.ordem.find((id) => s0.predios.porId[id]?.lado === LADO_DA_IA && s0.predios.porId[id]?.tipo === 'barracks') as string;
    for (const c of [
      { type: 'AttackUnit', unidades: tropa, alvo },
      { type: 'AttackBuilding', unidades: tropa, predio: quartel },
      { type: 'TrainSoldier', predio: quartel, tipo: 'militia' },
      { type: 'HireMercenary', predio: quartel, tipo: 'rebel' },
    ] as const) {
      const r = step(s0, [c], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), c.type).toMatchObject({ command: c.type, motivo: 'em-paz' });
    }
  });
});
