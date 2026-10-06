/**
 * I-COMBATE-BENCAO e I-COMBATE-CONVERTER — os poderes do padre (pedido do operador, 2026-10-06; pesquisa
 * em docs/pesquisas/2026-10-05-igreja-e-padre.md): a bencao das tropas (resistencia, nao acumula) e a
 * conversao do militar inimigo (a janela do 5o ao 9o intervalo, a recarga).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { chanceDeAcerto } from '../src/sim/combate';
import { abencoado, multiplicadorDaDefesa } from '../src/sim/systems/padre';
import { createRng } from '../src/sim/rng';
import { gravarEvidencia } from './helpers/evidence';
import { ordemDoBotaoDireito } from '../src/ui/ordem-militar';

const IA = LADO_DO_JOGADOR + 1;
const C = gameData.combate.padre;
const un = (id: string, tipo: string, gx: number, gy: number, lado = LADO_DO_JOGADOR): Unidade =>
  ({ id, lado, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao: 100000 });
/** As unidades no estado inicial. O lado da IA tem uma posicao de defesa no tile do primeiro militar dela,
 *  com os militares dela de membros (o convertido tem de sair dela), e raio 0 (ela nao sai para lutar). */
function com(...us: Unidade[]): GameState {
  const s = createInitialState(1);
  const militaresDaIA = us.filter((u) => u.lado === IA && u.tipo !== 'serf');
  const ponto = militaresDaIA[0] === undefined ? { gx: 90, gy: 90 } : { gx: militaresDaIA[0].gx, gy: militaresDaIA[0].gy };
  return {
    ...s,
    ia: { ...s.ia, [String(IA)]: { posicoes: [{ id: 'pos', ponto, tipoDeGrupo: 'corpoACorpo', raio: 0, linha: 'frente', membros: militaresDaIA.map((u) => u.id) }] } },
    unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] },
  } as GameState;
}

describe('I-COMBATE-BENCAO', () => {
  it('(1) a chance contra o abencoado e a do nao abencoado com a defesa x 1,2', () => {
    const atacante = un('a', 'militia', 60, 60, IA);
    const alvo = un('b', 'militia', 61, 60);
    const s = com(atacante, alvo, un('p', 'priest', 63, 60));
    expect(multiplicadorDaDefesa(s, alvo, gameData)).toBeCloseTo(1 + C.resistencia);
    const sem = chanceDeAcerto(atacante, alvo, gameData);
    const comBencao = chanceDeAcerto(atacante, alvo, gameData, multiplicadorDaDefesa(s, alvo, gameData));
    // a chance cai na razao da defesa (fora dos pisos e tetos da formula)
    expect(comBencao).toBeLessThanOrEqual(sem);
    if (sem > gameData.combate.pisoAcerto && sem < gameData.combate.tetoAcerto) {
      expect(comBencao).toBeCloseTo(Math.max(gameData.combate.pisoAcerto, sem / (1 + C.resistencia)), 5);
    }
    gravarEvidencia('I-COMBATE-BENCAO', { sem, comBencao, raio: C.raioDaBencao_tiles, resistencia: C.resistencia });
  });

  it('(2) a 8 tiles abencoa, a 9 nao; (3) dois padres dao o mesmo que um; (4) o padre do outro lado nao', () => {
    const alvo = un('b', 'militia', 50, 50);
    expect(abencoado(com(alvo, un('p', 'priest', 50 + C.raioDaBencao_tiles, 50)), alvo, gameData)).toBe(true);
    expect(abencoado(com(alvo, un('p', 'priest', 50 + C.raioDaBencao_tiles + 1, 50)), alvo, gameData)).toBe(false);
    const dois = com(alvo, un('p1', 'priest', 52, 50), un('p2', 'priest', 48, 50));
    expect(multiplicadorDaDefesa(dois, alvo, gameData)).toBe(multiplicadorDaDefesa(com(alvo, un('p1', 'priest', 52, 50)), alvo, gameData));
    expect(abencoado(com(alvo, un('p', 'priest', 52, 50, IA)), alvo, gameData)).toBe(false);
  });
});

describe('I-COMBATE-CONVERTER', () => {
  const recusas = (s: GameState) => s.events.filter((e): e is Extract<GameEvent, { type: 'command-rejected' }> => e.type === 'command-rejected');
  /** Roda a conversao e devolve em que intervalo ela saiu (ou null) e o estado. */
  function converter(semente: number, distancia = 3): { intervalo: number | null; s: GameState; ticks: number } {
    let s = com(un('p', 'priest', 40, 40), un('alvo', 'militia', 40 + distancia, 40, IA));
    s = { ...s, rng: createRng(semente) };
    s = step(s, [{ type: 'ConvertUnit', padre: 'p', alvo: 'alvo' }]);
    for (let t = 0; t < C.ticksDoIntervalo * (C.intervaloGarantido + 2) + 200; t++) {
      s = step(s, []);
      if (s.events.some((e) => e.type === 'unit-converted')) {
        const comecou = s.tick;
        return { intervalo: null, s, ticks: comecou };
      }
    }
    return { intervalo: null, s, ticks: -1 };
  }

  it('(1) nunca antes do 5o intervalo e sempre ate o 9o, em muitas sementes', () => {
    const ticks: number[] = [];
    for (let semente = 1; semente <= 40; semente++) {
      const r = converter(semente);
      expect(r.ticks, `semente ${semente}`).toBeGreaterThan(0);
      ticks.push(r.ticks);
    }
    // o padre ja esta no alcance: ele comeca a rezar no tick 2 (o comando no 1, a FSM no 2)
    const intervalos = ticks.map((t) => Math.ceil((t - 1) / C.ticksDoIntervalo));
    for (const i of intervalos) {
      expect(i).toBeGreaterThanOrEqual(C.intervaloMinimo);
      expect(i).toBeLessThanOrEqual(C.intervaloGarantido);
    }
    // a janela e aleatoria: nem toda semente converte no mesmo intervalo
    expect(new Set(intervalos).size).toBeGreaterThan(1);
    gravarEvidencia('I-COMBATE-CONVERTER', { intervalos, ticksDoIntervalo: C.ticksDoIntervalo });
  });

  it('(2) o convertido troca de lado, fica ocioso e sai da IA; (3) a recarga impede a segunda antes do tempo', () => {
    const { s } = converter(7);
    const alvo = s.unidades.porId['alvo']!;
    expect(alvo.lado).toBe(LADO_DO_JOGADOR);
    expect(alvo.fsm).toBe('ocioso');
    expect(s.ia?.[String(IA)]?.posicoes[0]?.membros).not.toContain('alvo');
    const padre = s.unidades.porId['p']!;
    expect(padre.conversaoProntaEm).toBe(s.tick + C.ticksDeRecarga);
    // um segundo inimigo, logo depois: recusado na recarga
    const s2 = { ...s, unidades: { porId: { ...s.unidades.porId, outro: un('outro', 'militia', 42, 41, IA) }, ordem: [...s.unidades.ordem, 'outro'] } };
    expect(recusas(step(s2, [{ type: 'ConvertUnit', padre: 'p', alvo: 'outro' }])).map((r) => r.motivo)).toEqual(['em-recarga']);
  });

  it('(4) civil, aliado e quem nao e padre sao recusados; alvo longe anda ate o alcance e converte', () => {
    const base = com(un('p', 'priest', 40, 40), un('civil', 'serf', 42, 40, IA), un('amigo', 'militia', 41, 40), un('soldado', 'militia', 39, 40));
    const r = (cmd: { padre: string; alvo: string }) => recusas(step(base, [{ type: 'ConvertUnit', ...cmd }])).map((e) => e.motivo);
    expect(r({ padre: 'p', alvo: 'civil' })).toEqual(['alvo-nao-militar']);
    expect(r({ padre: 'p', alvo: 'amigo' })).toEqual(['alvo-do-proprio-lado']);
    expect(r({ padre: 'soldado', alvo: 'civil' })).toEqual(['nao-e-padre']);
    const longe = converter(3, C.alcance_tiles + 6);
    expect(longe.ticks).toBeGreaterThan(0);
    expect(longe.s.unidades.porId['alvo']?.lado).toBe(LADO_DO_JOGADOR);
  });

  it('(5) determinismo: a mesma semente da o mesmo tick de conversao', () => {
    expect(converter(11).ticks).toBe(converter(11).ticks);
  });

  it('a ordem do botao direito: com o padre no grupo, o clique no inimigo converte (e a tropa ataca)', () => {
    const s = com(un('p', 'priest', 40, 40), un('m', 'militia', 41, 41), un('alvo', 'militia', 45, 40, IA));
    const o = ordemDoBotaoDireito(s, gameData, LADO_DO_JOGADOR, ['p', 'm'], { gx: 45, gy: 40 }, ['alvo']);
    expect(o.comandos).toEqual([
      { type: 'ConvertUnit', padre: 'p', alvo: 'alvo' },
      { type: 'AttackUnit', unidades: ['m'], alvo: 'alvo' },
    ]);
  });
});
