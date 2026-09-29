/**
 * BUG-R (a pedra da estrada saia do armazem de OUTRO lado, e a tarefa ficava aberta para
 * sempre). Achado pelo avaliador na segunda leva (docs/avaliacoes/2026-09-29-segunda-leva.md,
 * achado 2): na escaramuca, o jogador planeja estrada perto da vila da IA, e o gerador
 * escolhia o armazem da IA como origem (o mais perto) — que o serf do jogador nao pode
 * reclamar (C7, lado no JobBoard).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';

describe('BUG-R — a pedra da estrada sai do armazem do jogador', () => {
  it('estrada perto da vila da IA: a origem e do jogador, e a tarefa e reclamada', () => {
    let s: GameState = criarEscaramuca(gameData.economia.estadoInicial.semente);
    const armazemDaIA = s.predios.ordem.map((id) => s.predios.porId[id]).find((p) => p?.lado !== LADO_DO_JOGADOR && p?.tipo === 'storehouse');
    if (armazemDaIA === undefined) throw new Error('armazem da IA');
    const tiles = [{ gx: armazemDaIA.gx, gy: armazemDaIA.gy + 4 }, { gx: armazemDaIA.gx + 1, gy: armazemDaIA.gy + 4 }];
    s = step(s, [{ type: 'PlaceRoad', tiles }], gameData);
    const pedra = (e: GameState) => e.jobs.tarefas.ordem.map((id) => e.jobs.tarefas.porId[id])
      .filter((t) => t?.tipo === 'pedra-para-canteiro');
    expect(pedra(s).length).toBeGreaterThan(0);
    for (const t of pedra(s)) {
      const origem = t && 'origem' in t ? s.predios.porId[t.origem] : undefined;
      expect(origem?.lado, `origem de ${t?.id}`).toBe(LADO_DO_JOGADOR);
    }
    let reclamada = false;
    for (let i = 0; i < 300 && !reclamada; i++) {
      s = step(s, [], gameData);
      reclamada = pedra(s).some((t) => t?.estado !== 'aberta');
    }
    expect(reclamada, 'nenhum serf do jogador reclamou a pedra da estrada').toBe(true);
  });
});
