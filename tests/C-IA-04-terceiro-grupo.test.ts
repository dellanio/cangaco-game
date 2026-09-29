/**
 * C-IA-04 — o terceiro grupo da IA, ANDAIME (plano em
 * docs/planos/2026-09-29-C-IA-04-terceiro-grupo-andaime.md). Sai quando a C-IA-02 (economia
 * da IA) der a IA uma sobra vinda da reposicao. Aceite: depois da paz, a IA ataca a vila do
 * jogador na partida headless, sem ordem nenhuma do jogador.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { criarEscaramuca } from '../src/sim/cenario';
import { classeDaUnidade } from '../src/sim/condicao';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const AT = gameData.escaramuca.atacantes;
/** Depois da paz: a marcha de ~45 tiles e o primeiro golpe, com folga para o caso travar. */
const TICKS_DEPOIS_DA_PAZ = 3000;

const foraDasPosicoes = (s: GameState): string[] => {
  const membros = new Set(Object.values(s.ia ?? {}).flatMap((ia) => ia.posicoes.flatMap((p) => p.membros)));
  return s.unidades.ordem.filter((id) => {
    const u = s.unidades.porId[id];
    return u !== undefined && u.lado === LADO_DA_IA && classeDaUnidade(u.tipo, gameData) === 'militar' && !membros.has(id);
  });
};
const prediosDoJogador = (s: GameState): Predio[] =>
  s.predios.ordem.map((id) => s.predios.porId[id] as Predio).filter((p) => p.lado === LADO_DO_JOGADOR);

describe('C-IA-04 — o terceiro grupo da IA (andaime)', () => {
  const s0 = criarEscaramuca(SEMENTE);
  const atacantes = foraDasPosicoes(s0);

  it('nasce com o grupo do dado fora das posicoes, ocioso, sem pisar em ninguem', () => {
    expect(AT.quantidade).toBe(9);
    expect(atacantes).toHaveLength(AT.quantidade);
    expect(atacantes.every((id) => s0.unidades.porId[id]?.fsm === 'ocioso' && s0.unidades.porId[id]?.tipo === AT.tipo)).toBe(true);
    const tiles = s0.unidades.ordem.map((id) => s0.unidades.porId[id]).filter((u) => u !== undefined).map((u) => `${u.gx},${u.gy}`);
    expect(new Set(tiles).size).toBe(tiles.length);
  });

  it('em paz ninguem sai; no fim da paz os 9 vao atacar; e a IA chega a bater na vila do jogador', () => {
    const fimDaPaz = s0.pazAteTick as number;
    let s = s0;
    while (s.tick < fimDaPaz - 1) s = step(s, [], gameData);
    expect(atacantes.every((id) => s.unidades.porId[id]?.fsm === 'ocioso')).toBe(true);

    s = step(step(s, [], gameData), [], gameData);
    const alvos = new Set(atacantes.map((id) => s.unidades.porId[id]?.fsmData.alvo));
    const doJogador = new Set(prediosDoJogador(s0).map((p) => p.id));
    expect(atacantes.every((id) => s.unidades.porId[id]?.fsm === 'indo_atacar')).toBe(true);
    expect(alvos.size).toBe(1);
    expect(doJogador.has([...alvos][0] as string)).toBe(true);
    const tickDoAtaque = s.tick;

    const hp0 = new Map(prediosDoJogador(s0).map((p) => [p.id, p.hp]));
    let tickDoGolpe: number | null = null;
    for (let t = 0; t < TICKS_DEPOIS_DA_PAZ && tickDoGolpe === null; t++) {
      s = step(s, [], gameData);
      if (prediosDoJogador(s).some((p) => p.hp < (hp0.get(p.id) ?? p.hp))) tickDoGolpe = s.tick;
    }
    expect(tickDoGolpe, 'a IA deveria chegar e bater num predio do jogador').not.toBeNull();
    gravarEvidencia('C-IA-04', { fimDaPaz, tickDoAtaque, alvo: [...alvos][0], tickDoGolpe, ticksAteOGolpe: (tickDoGolpe ?? 0) - tickDoAtaque });
  }, 20_000);
});
