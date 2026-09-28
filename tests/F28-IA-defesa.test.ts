/**
 * F28-IA, pontos 1, 2 e 3 — a defesa da IA (plano em
 * docs/planos/2026-09-28-A12-F28-IA-defesa.md).
 *
 * Aceite do ponto 1 (BUILD_PLAN): um grupo posto numa posicao de defesa sai para o
 * inimigo que entra no raio e nao sai para o que fica fora; a mesma corrida duas vezes
 * da o mesmo estado. E os dos pontos 2 e 3, escritos na sessao autonoma (PARA REVISAO):
 * morto o intruso, o grupo volta aos seus tiles; o inimigo que ataca um membro de fora
 * do raio vira alvo.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, PosicaoDeDefesa, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { tileAndavel } from '../src/sim/pathfinding';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { tipoDeGrupo } from '../src/sim/ia';
import { tilesDoGrupo } from '../src/sim/systems/marcha';
import { salvar } from '../src/sim/save';
import { naVila } from './helpers/ancoras';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const IA = LADO_DO_JOGADOR + 1;
const RAIO = 6;

function unidade(id: string, tipo: string, lado: number, t: { gx: number; gy: number }, direcao?: number): Unidade {
  return {
    lado, id, tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: condicaoCheiaDoTipo(tipo),
    ...(direcao === undefined ? {} : { direcao }),
  };
}
function com(s: GameState, ...us: Unidade[]): GameState {
  const porId = { ...s.unidades.porId };
  const ordem = [...s.unidades.ordem];
  for (const u of us) {
    porId[u.id] = u;
    ordem.push(u.id);
  }
  return { ...s, unidades: { porId, ordem } };
}
function campo(s: GameState): { gx: number; gy: number } {
  for (let r = 8; r < 40; r += 1) {
    for (let d = -r; d <= r; d += 1) {
      const c = naVila(d, r);
      let livre = true;
      for (let dy = -12; dy <= 12 && livre; dy += 2) for (let dx = -12; dx <= 12 && livre; dx += 2) livre = tileAndavel(s, { gx: c.gx + dx, gy: c.gy + dy }, 'livre', gameData);
      if (livre) return c;
    }
  }
  throw new Error('fixture: sem campo');
}
const posicao = (ponto: { gx: number; gy: number }, tipo: PosicaoDeDefesa['tipoDeGrupo'] = 'corpoACorpo', linha: 'frente' | 'tras' = 'frente', id = 'p1'): PosicaoDeDefesa =>
  ({ id, ponto: { gx: ponto.gx, gy: ponto.gy }, tipoDeGrupo: tipo, raio: RAIO, linha, membros: [] });
const andar = (s0: GameState, n: number, violacoes?: string[]): GameState => {
  let s = s0;
  for (let i = 0; i < n; i += 1) {
    s = step(s, [], gameData);
    if (violacoes) violacoes.push(...violacoesDeInvariantes(s, gameData));
  }
  return s;
};
const semCivis = (s: GameState): GameState => ({ ...s, unidades: { porId: {}, ordem: [] } });

describe('F28-IA — a defesa (pontos 1, 2 e 3)', () => {
  const base = semCivis(createInitialState(1));
  const c = campo(base);
  const soldadosDaIA = (n: number, tipo = 'militia'): Unidade[] =>
    Array.from({ length: n }, (_, i) => unidade(`ia${i + 1}`, tipo, IA, { gx: c.gx - 6 + (i % 6), gy: c.gy + 8 + Math.floor(i / 6) }));

  it('o tipo de grupo sai do dado da tropa', () => {
    expect(['militia', 'pikeman', 'bowman', 'knight', 'serf'].map((t) => tipoDeGrupo(t)))
      .toEqual(['corpoACorpo', 'antiCavalo', 'distancia', 'montado', null]);
  });

  it('ponto 1: guarnece ate 9 por posicao, frente antes de tras, e so do tipo certo; e o grupo vai ao ponto', () => {
    const s0: GameState = {
      ...com(base, ...soldadosDaIA(12), unidade('arq', 'bowman', IA, { gx: c.gx - 6, gy: c.gy + 11 })),
      ia: { [IA]: { posicoes: [posicao({ gx: c.gx, gy: c.gy + 4 }, 'corpoACorpo', 'tras', 'tras1'), posicao(c, 'corpoACorpo', 'frente', 'frente1'), posicao({ gx: c.gx + 5, gy: c.gy }, 'distancia', 'tras', 'arco1')] } },
    };
    const s = andar(s0, 300);
    const [tras, frente, arco] = s.ia?.[IA]?.posicoes ?? [];
    expect(frente?.membros).toHaveLength(9); // a da frente enche primeiro
    expect(tras?.membros).toHaveLength(3);
    expect(arco?.membros).toEqual(['arq']);
    // os nove da frente estao nos nove tiles do grupo, e ociosos
    const tiles = tilesDoGrupo(s, c, 9, gameData).map((t) => `${t.gx},${t.gy}`);
    const onde = (frente?.membros ?? []).map((id) => s.unidades.porId[id] as Unidade);
    expect(onde.every((u) => u.fsm === 'ocioso')).toBe(true);
    expect(onde.map((u) => `${u.gx},${u.gy}`)).toEqual(tiles);
  });

  it('ponto 1/3: o inimigo que ENTRA no raio tira o grupo; o que fica logo fora nao', () => {
    let s: GameState = { ...com(base, ...soldadosDaIA(9)), ia: { [IA]: { posicoes: [posicao(c)] } } };
    s = andar(s, 300);
    // fora: a RAIO + 2 do ponto, parado
    const fora = com(s, unidade('fora', 'militia', 0, { gx: c.gx + RAIO + 2, gy: c.gy }));
    const semSair = andar(fora, 100);
    expect(semSair.ia?.[IA]?.posicoes[0]?.membros.every((id) => ['ocioso'].includes(semSair.unidades.porId[id]?.fsm ?? ''))).toBe(true);
    // dentro: a 4 do ponto
    const dentro = com(s, unidade('dentro', 'militia', 0, { gx: c.gx + 4, gy: c.gy }));
    const saiu = andar(dentro, 5);
    const estados = (saiu.ia?.[IA]?.posicoes[0]?.membros ?? []).map((id) => saiu.unidades.porId[id]?.fsm);
    expect(estados.filter((f) => f === 'indo_lutar' || f === 'lutando').length).toBeGreaterThan(0);
    gravarEvidencia('F28-IA-raio', { raio: RAIO, foraOcioso: true, dentro: estados });
  });

  it('ponto 2: morto o intruso, o grupo volta aos seus tiles e fica ocioso', () => {
    let s: GameState = { ...com(base, ...soldadosDaIA(9)), ia: { [IA]: { posicoes: [posicao(c)] } } };
    s = andar(s, 300);
    s = com(s, unidade('dentro', 'militia', 0, { gx: c.gx + 4, gy: c.gy }));
    const violacoes: string[] = [];
    for (let t = 0; t < 2000 && s.unidades.porId['dentro'] !== undefined; t += 1) {
      s = step(s, [], gameData);
      violacoes.push(...violacoesDeInvariantes(s, gameData));
    }
    expect(s.unidades.porId['dentro']).toBeUndefined();
    s = andar(s, 400, violacoes);
    expect(violacoes).toEqual([]);
    const membros = s.ia?.[IA]?.posicoes[0]?.membros ?? [];
    const tiles = tilesDoGrupo(s, c, 9, gameData);
    membros.forEach((id, i) => {
      const u = s.unidades.porId[id] as Unidade;
      expect(u.fsm).toBe('ocioso');
      expect(`${u.gx},${u.gy}`).toBe(`${tiles[i]?.gx},${tiles[i]?.gy}`);
    });
  });

  it('ponto 3: o arqueiro que ataca um membro de FORA do raio vira alvo do grupo', () => {
    let s: GameState = { ...com(base, ...soldadosDaIA(9)), ia: { [IA]: { posicoes: [posicao(c)] } } };
    s = andar(s, 300);
    // arqueiro do jogador a 9 do ponto (fora do raio 6), olhando para o grupo (oeste = 6)
    s = com(s, unidade('arq', 'bowman', 0, { gx: c.gx + 9, gy: c.gy }, 6));
    let retaliou = false;
    for (let t = 0; t < 200 && !retaliou; t += 1) {
      s = step(s, [], gameData);
      retaliou = (s.ia?.[IA]?.posicoes[0]?.membros ?? []).some((id) => s.unidades.porId[id]?.fsmData.alvoUnidade === 'arq');
    }
    expect(retaliou).toBe(true);
  });

  it('a mesma corrida duas vezes da o mesmo estado', () => {
    const correr = (): GameState => {
      const s: GameState = { ...com(base, ...soldadosDaIA(9), unidade('dentro', 'militia', 0, { gx: c.gx + 4, gy: c.gy })), ia: { [IA]: { posicoes: [posicao(c)] } } };
      return andar(s, 600);
    };
    expect(salvar(correr())).toBe(salvar(correr()));
  });
});
