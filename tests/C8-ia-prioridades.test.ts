/**
 * C8 — a IA com prioridade de alvo e de tipo de tropa (fila do operador, item 8; plano em
 * docs/planos/2026-09-28-C8-ia-prioridades.md). Medido no kam_remake. Aceite:
 *  (a) a reposicao forma o MAIS FORTE que o equipamento permite (AI_TROOP_TRAIN_ORDER);
 *  (b) o ataque vai ao alvo PRIORITARIO mesmo com um nao prioritario mais perto; sem
 *      prioritario de pe, ataca qualquer predio;
 *  (c) determinismo.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { completarObra, createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, PosicaoDeDefesa, Predio, PredioCompleto, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { gravarEvidencia } from './helpers/evidence';

const IA = LADO_DO_JOGADOR + 1;
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });
const comPredio = (s: GameState, p: Predio): GameState =>
  ({ ...s, predios: { porId: { ...s.predios.porId, [p.id]: p }, ordem: [...s.predios.ordem, p.id] } });

function lugar(s: GameState, tipo: string, desde: number): { gx: number; gy: number } {
  const busca: GameState = { ...s, tiposJaConstruidos: [...new Set([...s.tiposJaConstruidos, 'sawmill', 'quarry'])] };
  for (let r = desde; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const p = naVila(d, r);
      if (canPlace(busca, tipo, p.gx, p.gy, gameData).ok) return p;
    }
  }
  throw new Error(`fixture: '${tipo}' nao coube`);
}
function formar(entrada: Record<string, number>): string[] {
  let s = semCivis(createInitialState(1));
  const q = completarObra({ lado: IA, id: 'quartel-ia', tipo: 'barracks', ...lugar(s, 'barracks', 10), estado: 'obra', hp: 600, obra: { faltam: {}, nivelamento: 0 } }, gameData);
  s = comPredio(s, { ...q, estoque: { ...q.estoque, entrada }, recrutas: 1 } as PredioCompleto);
  const ponto = naVila(-8, 14);
  const posicao: PosicaoDeDefesa = { id: 'p1', ponto, tipoDeGrupo: 'corpoACorpo', raio: 6, linha: 'frente', membros: [] };
  s = { ...s, ia: { [IA]: { posicoes: [posicao] } } };
  const tipos: string[] = [];
  for (let t = 0; t < 20; t += 1) {
    s = step(s, [], gameData);
    for (const e of s.events) if (e.type === 'unit-trained') tipos.push(e.tipo);
  }
  return tipos;
}

describe('C8 — a IA escolhe como o KaM', () => {
  it('(a) forma o mais forte que o equipamento permite', () => {
    expect(formar({ hand_axe: 1 })).toEqual(['militia']); // so machado: o de sempre
    expect(formar({ hand_axe: 1, leather_armor: 1, wooden_shield: 1 })).toEqual(['axe_fighter']);
    expect(formar({ sword: 1, iron_armor: 1, iron_shield: 1, hand_axe: 1 })).toEqual(['sword_fighter']);
    gravarEvidencia('C8-tropa', { ordem: gameData.combate.ia.ordemDeTreino });
  });

  function ataque(comArmazem: boolean): { golpeados: string[]; s: GameState } {
    let s = semCivis(createInitialState(1));
    // tira os predios da abertura: o jogador fica so com o que o cenario poe
    s = { ...s, predios: { porId: {}, ordem: [] } };
    const pedreira = completarObra({ lado: LADO_DO_JOGADOR, id: 'pedreira', tipo: 'quarry', ...lugar(s, 'quarry', 8), estado: 'obra', hp: 300, obra: { faltam: {}, nivelamento: 0 } }, gameData);
    s = comPredio(s, { ...pedreira, hp: 99999 });
    if (comArmazem) {
      const arm = completarObra({ lado: LADO_DO_JOGADOR, id: 'armazem', tipo: 'storehouse', ...lugar(s, 'storehouse', 16), estado: 'obra', hp: 400, obra: { faltam: {}, nivelamento: 0 } }, gameData);
      s = comPredio(s, { ...arm, hp: 99999 });
    }
    // 9 da IA colados a pedreira (a pedreira e o predio MAIS PERTO deles)
    const soldados: Unidade[] = [];
    for (let dy = 0; dy < 12 && soldados.length < 9; dy += 1) {
      for (let dx = -4; dx <= 4 && soldados.length < 9; dx += 1) {
        const t = { gx: pedreira.gx + dx, gy: pedreira.gy + 4 + dy };
        if (tileAndavel(s, t, 'livre', gameData)) {
          soldados.push({ lado: IA, id: `ia${soldados.length}`, tipo: 'militia', ...t, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') });
        }
      }
    }
    s = { ...s, unidades: { porId: Object.fromEntries(soldados.map((u) => [u.id, u])), ordem: soldados.map((u) => u.id) }, ia: { [IA]: { posicoes: [] } } };
    const golpeados: string[] = [];
    for (let t = 0; t < 1500; t += 1) {
      s = step(s, [], gameData);
      for (const e of s.events as GameEvent[]) if (e.type === 'building-attacked' && !golpeados.includes(e.predio)) golpeados.push(e.predio);
    }
    return { golpeados, s };
  }

  it('(b) o prioritario antes do mais perto; sem prioritario, qualquer um', () => {
    expect(ataque(true).golpeados[0]).toBe('armazem');
    expect(ataque(false).golpeados[0]).toBe('pedreira');
  });

  it('(c) a mesma corrida duas vezes da o mesmo estado', () => {
    expect(salvar(ataque(true).s)).toBe(salvar(ataque(true).s));
  });
});
