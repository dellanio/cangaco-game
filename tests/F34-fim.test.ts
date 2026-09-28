/**
 * F34 — vitoria e derrota (plano em docs/planos/2026-09-28-A16-F34-fim.md). Decisao do
 * operador: "Vitoria: destruir Armazem, Escola e Quartel inimigos e todas as tropas.
 * Derrota: perder os tres e todas as tropas." O resto do aceite e da sessao autonoma
 * (PARA REVISAO):
 *  - vitoria quando o oponente perdeu os tres e todas as tropas, e nao antes;
 *  - derrota quando o jogador perdeu os tres e todas as tropas; perda mutua e derrota;
 *  - sem IA (jogo livre) nao ha fim;
 *  - obra de um dos tres conta como de pe;
 *  - o fim e gravado uma vez so, com `match-ended`; e a mesma corrida da o mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { ladoCaiu, resultadoDaPartida } from '../src/sim/partida';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';

const IA = LADO_DO_JOGADOR + 1;

function lugar(s: GameState, tipo: string, desde = 8): { gx: number; gy: number } {
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill', 'quarry'])] };
  for (let r = desde; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, tipo, p.gx, p.gy, gameData).ok) return p;
    }
  }
  throw new Error(`fixture: '${tipo}' nao coube`);
}
function comPredio(s: GameState, id: string, tipo: string, lado: number, obra = false): GameState {
  const p = lugar(s, tipo);
  const hp = gameData.predios.find((d) => d.id === tipo)?.hp ?? 1;
  const emObra = { lado, id, tipo, ...p, estado: 'obra' as const, hp: obra ? 0 : hp, obra: { faltam: {}, nivelamento: 0 } };
  const predio: Predio = obra ? emObra : completarObra(emObra, gameData);
  return { ...s, predios: { porId: { ...s.predios.porId, [id]: predio }, ordem: [...s.predios.ordem, id] } };
}
function comSoldado(s: GameState, id: string, lado: number): GameState {
  for (let dx = 0; dx < 30; dx += 1) {
    const t = naVila(-10 + dx, 12);
    if (!tileAndavel(s, t, 'livre', gameData)) continue;
    const u: Unidade = { lado, id, tipo: 'militia', ...t, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') };
    return { ...s, unidades: { porId: { ...s.unidades.porId, [id]: u }, ordem: [...s.unidades.ordem, id] } };
  }
  throw new Error('fixture: sem tile');
}
const semO = (s: GameState, id: string): GameState => {
  const porId = { ...s.predios.porId };
  delete porId[id];
  return { ...s, predios: { porId, ordem: s.predios.ordem.filter((i) => i !== id) } };
};
const semA = (s: GameState, id: string): GameState => {
  const porId = { ...s.unidades.porId };
  delete porId[id];
  return { ...s, unidades: { porId, ordem: s.unidades.ordem.filter((i) => i !== id) } };
};
const comIA = (s: GameState): GameState => ({ ...s, ia: { [IA]: { posicoes: [] } } });

/** A vila do jogador (armazem e escola da abertura) mais o inimigo com os tres e um soldado. */
function escaramuca(): GameState {
  let s = comIA(createInitialState(1));
  s = comPredio(s, 'arm-ia', 'storehouse', IA);
  s = comPredio(s, 'esc-ia', 'schoolhouse', IA);
  s = comPredio(s, 'qua-ia', 'barracks', IA);
  return comSoldado(s, 'sold-ia', IA);
}

describe('F34 — vitoria e derrota', () => {
  it('vitoria so quando o oponente perdeu os tres E todas as tropas', () => {
    let s = escaramuca();
    expect(resultadoDaPartida(s)).toBeNull();
    for (const id of ['arm-ia', 'esc-ia', 'qua-ia']) {
      s = semO(s, id);
      expect(resultadoDaPartida(s), `sem ${id}, o soldado ainda segura`).toBeNull();
    }
    s = semA(s, 'sold-ia');
    expect(ladoCaiu(s, IA)).toBe(true);
    expect(resultadoDaPartida(s)).toBe('vitoria');
  });

  it('derrota quando o jogador perdeu os tres e as tropas; perda mutua e derrota', () => {
    let s = escaramuca();
    for (const id of s.predios.ordem.filter((i) => s.predios.porId[i]?.lado === LADO_DO_JOGADOR)) s = semO(s, id);
    expect(resultadoDaPartida(s)).toBe('derrota'); // o jogador nao tinha quartel nem tropa
    // perda mutua: o inimigo tambem cai
    for (const id of ['arm-ia', 'esc-ia', 'qua-ia']) s = semO(s, id);
    s = semA(s, 'sold-ia');
    expect(resultadoDaPartida(s)).toBe('derrota');
  });

  it('sem IA nao ha fim, e obra de um dos tres conta como de pe', () => {
    let livre = createInitialState(1);
    for (const id of [...livre.predios.ordem]) livre = semO(livre, id);
    expect(resultadoDaPartida(livre)).toBeNull();
    let s = comPredio(escaramuca(), 'obra-ia', 'storehouse', IA, true);
    for (const id of ['arm-ia', 'esc-ia', 'qua-ia']) s = semO(s, id);
    s = semA(s, 'sold-ia');
    expect(resultadoDaPartida(s)).toBeNull(); // a obra do armazem inimigo ainda esta de pe
  });

  it('o fim e gravado uma vez, com match-ended, e a sim continua', () => {
    let s = escaramuca();
    for (const id of ['arm-ia', 'esc-ia', 'qua-ia']) s = semO(s, id);
    s = semA(s, 'sold-ia');
    const t0 = s.tick;
    s = step(s, [], gameData);
    expect(s.partida).toEqual({ fim: 'vitoria', tick: t0 + 1 });
    expect(s.events.filter((e) => e.type === 'match-ended')).toEqual([{ type: 'match-ended', fim: 'vitoria' }]);
    for (let i = 0; i < 20; i += 1) {
      s = step(s, [], gameData);
      expect(s.events.filter((e) => e.type === 'match-ended')).toEqual([]);
    }
    expect(s.partida).toEqual({ fim: 'vitoria', tick: t0 + 1 });
    expect(s.tick).toBe(t0 + 21);
  });

  it('a mesma corrida duas vezes da o mesmo estado; e grava as partidas do roteiro', () => {
    const quaseVitoria = (): GameState => {
      let s = escaramuca();
      for (const id of ['arm-ia', 'esc-ia', 'qua-ia']) s = semO(s, id);
      return s; // resta so o soldado inimigo
    };
    const correr = (): GameState => {
      let s = semA(quaseVitoria(), 'sold-ia');
      for (let i = 0; i < 10; i += 1) s = step(s, [], gameData);
      return s;
    };
    expect(salvar(correr())).toBe(salvar(correr()));
    const dir = process.env['CANGACO_EVIDENCIA_DIR'] ?? 'test-output';
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/F34-vitoria.save.txt`, salvar(semA(quaseVitoria(), 'sold-ia')));
    let derrota = escaramuca();
    for (const id of derrota.predios.ordem.filter((i) => derrota.predios.porId[i]?.lado === LADO_DO_JOGADOR)) derrota = semO(derrota, id);
    writeFileSync(`${dir}/F34-derrota.save.txt`, salvar(derrota));
  });
});
