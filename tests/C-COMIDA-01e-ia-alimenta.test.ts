/**
 * C-COMIDA-01e (a IA alimenta a tropa; e o C-IA-01, IA alimentar tropas, antes F28-IA
 * ponto 5; plano em docs/planos/2026-09-28-F-FEED-fome-militar.md §3.5 e §7). Aceite, com
 * o limiar do CIVIL (decisao do operador: `limiares.civilVaiComer`, 50 %, e nao os 13,3 %
 * do KaM que o plano citava):
 *  - no limiar ou acima, a posicao nao pede;
 *  - abaixo, pede, e o serf DA IA a alimenta;
 *  - com um membro lutando, ninguem da posicao pede;
 *  - o serf do jogador nunca atende a IA;
 *  - determinismo.
 * ANDAIME (L8): a tropa da IA nao drena (`condicao.iaDrena` false). O teste baixa a
 * condicao a mao, e a vila do cenario e DA IA (armazem e serfs virados para o lado dela).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, PosicaoDeDefesa, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { salvar } from '../src/sim/save';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const IA = LADO_DO_JOGADOR + 1;
const LIMIAR = gameData.condicao.ticksNoLimiar.militar.civilVaiComer;
const CHEIA = condicaoCheiaDoTipo('militia');
const MEMBROS = ['ia1', 'ia2', 'ia3'];

function soldado(id: string, gx: number, gy: number, condicao: number, lado = IA): Unidade {
  return { lado, id, tipo: 'militia', gx, gy, fsm: 'ocioso', fsmData: {}, condicao };
}
const posicao = (membros: readonly string[]): PosicaoDeDefesa =>
  ({ id: 'p1', ponto: { gx: 31, gy: 40 }, tipoDeGrupo: 'corpoACorpo', raio: 6, linha: 'frente', membros });

/** A vila inicial, com prédios e civis do `ladoDaVila`, e tres cabras da IA numa posicao. */
function cenario(condicoes: readonly number[], ladoDaVila = IA): GameState {
  const s0 = createInitialState(1);
  const predios = Object.fromEntries(Object.entries(s0.predios.porId).map(([id, p]) => [id, { ...p, lado: ladoDaVila }]));
  const civis = Object.fromEntries(Object.entries(s0.unidades.porId).map(([id, u]) => [id, { ...u, lado: ladoDaVila }]));
  const tropa = MEMBROS.map((id, i) => soldado(id, 30 + i, 40, condicoes[i] ?? CHEIA));
  return {
    ...s0,
    predios: { ...s0.predios, porId: predios },
    unidades: { porId: { ...civis, ...Object.fromEntries(tropa.map((u) => [u.id, u])) }, ordem: [...s0.unidades.ordem, ...MEMBROS] },
    ia: { [String(IA)]: { posicoes: [posicao(MEMBROS)] } },
  };
}
const pedidos = (s: GameState): string[] => MEMBROS.filter((id) => s.unidades.porId[id]?.pedidoDeComida === true);

describe('C-COMIDA-01e — a IA alimenta a tropa (C-IA-01)', () => {
  it('no limiar do civil, ou acima, a posicao nao pede', () => {
    const s = step(cenario([LIMIAR, LIMIAR + 1, CHEIA]), [], gameData);
    expect(pedidos(s)).toEqual([]);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('abaixo do limiar, a posicao pede e o serf DA IA entrega; os tres ficam cheios', () => {
    // um membro abaixo basta para a posicao pedir; so pede quem esta abaixo de 55 %
    let s = step(cenario([LIMIAR - 1, LIMIAR + 100, CHEIA]), [], gameData);
    expect(pedidos(s)).toEqual(['ia1', 'ia2']);
    const eventos: GameEvent[] = [];
    const violacoes: string[] = [];
    let ticks = 0;
    while (ticks++ < 1500 && pedidos(s).length > 0) {
      s = step(s, [], gameData);
      eventos.push(...s.events);
      violacoes.push(...violacoesDeInvariantes(s, gameData));
    }
    expect(violacoes).toEqual([]);
    expect(pedidos(s)).toEqual([]);
    const alimentados = eventos.filter((e) => e.type === 'unit-fed');
    expect(alimentados.map((e) => (e.type === 'unit-fed' ? e.unidade : '')).sort()).toEqual(['ia1', 'ia2']);
    for (const e of alimentados) if (e.type === 'unit-fed') expect(s.unidades.porId[e.serf]?.lado).toBe(IA);
    expect(s.unidades.porId['ia1']?.condicao).toBe(CHEIA);
    // a IA nao reemite Feed a cada tick: nenhuma recusa sem-fome na corrida inteira
    expect(eventos.filter((e) => e.type === 'command-rejected')).toEqual([]);
    gravarEvidencia('C-COMIDA-01e-ia-alimenta', { limiar: LIMIAR, ticksAteTodosComerem: ticks, alimentados: alimentados.length });
  });

  it('com um membro lutando, ninguem da posicao pede', () => {
    // um inimigo do jogador DENTRO do raio da posicao: a defesa manda os membros lutar
    const base = cenario([LIMIAR - 100, LIMIAR - 100, LIMIAR - 100]);
    const inimigo = soldado('inimigo', 34, 40, CHEIA, LADO_DO_JOGADOR);
    let s: GameState = { ...base, unidades: { porId: { ...base.unidades.porId, inimigo }, ordem: [...base.unidades.ordem, 'inimigo'] } };
    const LUTA = ['indo_lutar', 'lutando', 'atirando'];
    let tickComLuta = 0;
    for (let t = 0; t < 30; t++) {
      s = step(s, [], gameData);
      const alguemLuta = MEMBROS.some((id) => LUTA.includes(s.unidades.porId[id]?.fsm ?? ''));
      if (alguemLuta) {
        tickComLuta++;
        expect(pedidos(s), `tick ${t}`).toEqual([]);
      }
    }
    expect(tickComLuta).toBeGreaterThan(0);
  });

  it('o serf do jogador nunca atende a IA: a vila e do jogador, e a tropa da IA fica com fome', () => {
    let s = step(cenario([LIMIAR - 1, LIMIAR - 1, LIMIAR - 1], LADO_DO_JOGADOR), [], gameData);
    expect(pedidos(s)).toEqual(MEMBROS);
    for (let t = 0; t < 300; t++) {
      s = step(s, [], gameData);
      expect(s.jobs.tarefas.ordem.some((id) => s.jobs.tarefas.porId[id]?.tipo === 'comida-para-tropa')).toBe(false);
    }
    expect(pedidos(s)).toEqual(MEMBROS);
    expect(s.unidades.porId['ia1']?.condicao).toBe(LIMIAR - 1);
  });

  it('determinismo: a mesma corrida duas vezes da o mesmo save', () => {
    const rodar = (): string => {
      let s = cenario([LIMIAR - 1, LIMIAR - 50, CHEIA]);
      for (let t = 0; t < 400; t++) s = step(s, [], gameData);
      return salvar({ ...s, events: [] });
    };
    expect(rodar()).toBe(rodar());
  });
});
