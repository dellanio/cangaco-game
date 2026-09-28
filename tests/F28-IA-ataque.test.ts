/**
 * F28-IA, ponto 6 — um ataque repetido contra o predio mais perto quando houver homens
 * suficientes (aceite escrito na sessao autonoma, PARA REVISAO; "suficientes" = um grupo
 * cheio, `combate.ia.tamanhoDoGrupo`, de militares ociosos FORA das posicoes):
 *  - 9 livres atacam o predio inimigo mais perto deles, derrubam, e atacam o proximo;
 *  - 8 livres nao atacam;
 *  - quem e membro de posicao de defesa nao conta como livre;
 *  - a mesma corrida duas vezes da o mesmo estado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DA_ESCOLA, ID_DO_ARMAZEM, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, PosicaoDeDefesa, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { gravarEvidencia } from './helpers/evidence';

const IA = LADO_DO_JOGADOR + 1;
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });

/** `n` milicianos da IA em tiles andaveis ao sul da escola do jogador. */
function comSoldados(s: GameState, n: number): GameState {
  const escola = s.predios.porId[s.predios.ordem.find((id) => s.predios.porId[id]?.tipo === ID_DA_ESCOLA) as string];
  if (escola === undefined) throw new Error('fixture: sem escola');
  const porId = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  for (let dy = 6, i = 0; i < n && dy < 20; dy += 1) {
    for (let dx = 0; dx < 5 && i < n; dx += 1) {
      const t = { gx: escola.gx + dx, gy: escola.gy + dy };
      if (!tileAndavel(s, t, 'livre', gameData)) continue;
      const u: Unidade = { lado: IA, id: `ia${i + 1}`, tipo: 'militia', ...t, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo('militia') };
      porId[u.id] = u;
      ordem.push(u.id);
      i += 1;
    }
  }
  return { ...s, unidades: { porId, ordem } };
}

function correr(s0: GameState, n: number): { s: GameState; caidos: string[]; golpeados: string[] } {
  let s = s0;
  const caidos: string[] = [];
  const golpeados = new Set<string>();
  for (let i = 0; i < n; i += 1) {
    s = step(s, [], gameData);
    for (const e of s.events as GameEvent[]) {
      if (e.type === 'building-attacked') golpeados.add(e.predio);
      if (e.type === 'building-demolished' && e.armazem === null) caidos.push(e.predio);
    }
  }
  return { s, caidos, golpeados: [...golpeados] };
}

describe('F28-IA — ponto 6: o ataque repetido', () => {
  const base = semCivis(createInitialState(1));
  const escola = base.predios.ordem.find((id) => base.predios.porId[id]?.tipo === ID_DA_ESCOLA) as string;
  const armazem = base.predios.ordem.find((id) => base.predios.porId[id]?.tipo === ID_DO_ARMAZEM) as string;

  it('9 livres derrubam o predio mais perto e partem para o proximo', () => {
    const s0: GameState = { ...comSoldados(base, 9), ia: { [IA]: { posicoes: [] } } };
    const r = correr(s0, 3000);
    expect(r.caidos[0]).toBe(escola); // a escola e a mais perto deles
    expect(r.golpeados).toContain(armazem); // e o ataque se repete no seguinte
    gravarEvidencia('F28-IA-ataque', { caidos: r.caidos, golpeados: r.golpeados, tick: r.s.tick });
  });

  it('8 livres nao atacam', () => {
    const s0: GameState = { ...comSoldados(base, 8), ia: { [IA]: { posicoes: [] } } };
    const r = correr(s0, 300);
    expect(r.golpeados).toEqual([]);
  });

  it('membro de posicao nao conta como livre', () => {
    const s = comSoldados(base, 9);
    const ponto = { gx: (s.unidades.porId['ia1'] as Unidade).gx, gy: (s.unidades.porId['ia1'] as Unidade).gy + 3 };
    const posicao: PosicaoDeDefesa = { id: 'p1', ponto, tipoDeGrupo: 'corpoACorpo', raio: 2, linha: 'frente', membros: [] };
    const r = correr({ ...s, ia: { [IA]: { posicoes: [posicao] } } }, 300);
    expect(r.golpeados).toEqual([]);
    expect(r.s.ia?.[IA]?.posicoes[0]?.membros).toHaveLength(9);
  });

  it('a mesma corrida duas vezes da o mesmo estado', () => {
    const montar = (): GameState => ({ ...comSoldados(base, 9), ia: { [IA]: { posicoes: [] } } });
    expect(salvar(correr(montar(), 800).s)).toBe(salvar(correr(montar(), 800).s));
  });
});
