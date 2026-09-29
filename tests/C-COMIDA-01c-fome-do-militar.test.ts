/**
 * C-COMIDA-01c (fome militar com o Feed: o militar sente fome; plano em
 * docs/planos/2026-09-28-F-FEED-fome-militar.md §3.4 e §7). Aceite:
 *  - o militar drena 1 por tick e morre a 0 (R1, R3); o mercenario tambem (decisao 7, F36);
 *  - ele nao vai a Bodega: nunca reclama `comer`;
 *  - ANDAIME (L8): a tropa de lado com IA nao drena enquanto `condition.militar.iaDrena`
 *    for false; com o dado em true, drena;
 *  - a morte por fome libera, no mesmo tick, a comida que vinha para o morto, e a carga
 *    volta ao armazem (risco 2);
 *  - ponta a ponta: drena ate o pedido, Feed, o serf entrega e a condicao volta a cheia.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { condicaoCheiaDoTipo, drenaNoTick, resumoDeCondicao } from '../src/sim/condicao';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsm } from './helpers/serf-invariantes';
import { gravarEvidencia } from './helpers/evidence';
import { cenarioDaVilaComBodegaCheia } from './helpers/fome-cenario';

const CHEIA = condicaoCheiaDoTipo('militia');

function tropa(id: string, tipo: string, condicao: number, lado = LADO_DO_JOGADOR, gx = 30, gy = 40): Unidade {
  return { lado, id, tipo, gx, gy, fsm: 'ocioso', fsmData: {}, condicao };
}
function com(...us: Unidade[]): GameState {
  const s = createInitialState(1);
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } };
}
const comIa = (s: GameState, lado: number): GameState => ({ ...s, ia: { ...s.ia, [String(lado)]: { posicoes: [] } } });
const rodar = (s0: GameState, n: number, dados: GameData = gameData): { s: GameState; eventos: GameEvent[] } => {
  let s = s0;
  const eventos: GameEvent[] = [];
  for (let t = 0; t < n; t++) {
    s = step(s, [], dados);
    eventos.push(...s.events);
  }
  return { s, eventos };
};
const tipoMercenario = gameData.unidades.mercenarios.tipos[0]?.id ?? '';

describe('C-COMIDA-01c — o militar sente fome', () => {
  it('o militar e o mercenario drenam 1 por tick', () => {
    expect(tipoMercenario).not.toBe('');
    const { s } = rodar(com(tropa('a', 'militia', CHEIA), tropa('m', tipoMercenario, condicaoCheiaDoTipo(tipoMercenario), LADO_DO_JOGADOR, 26, 42)), 50);
    expect(s.unidades.porId['a']?.condicao).toBe(CHEIA - 50);
    expect(s.unidades.porId['m']?.condicao).toBe(condicaoCheiaDoTipo(tipoMercenario) - 50);
    expect(resumoDeCondicao(s)).toMatchObject({ militares: 2, militaresEmAlerta: 0 });
  });

  it('morre a 0 com unit-starved, o mercenario tambem; e nunca reclama `comer`', () => {
    const { s, eventos } = rodar(com(tropa('a', 'militia', 5), tropa('m', tipoMercenario, 3, LADO_DO_JOGADOR, 26, 42)), 10);
    expect(s.unidades.porId['a']).toBeUndefined();
    expect(s.unidades.porId['m']).toBeUndefined();
    const mortes = eventos.filter((e) => e.type === 'unit-starved').map((e) => (e.type === 'unit-starved' ? e.unidade : ''));
    expect(mortes).toEqual(['m', 'a']);
  });

  it('abaixo do limiar do civil, com a Bodega cheia, o militar nao vai: nem `indo_comer`, nem tarefa `comer`', () => {
    // a vila da F20a com a Bodega cheia pelo caminho real: o civil com fome IRIA
    const { estado } = cenarioDaVilaComBodegaCheia();
    const a = tropa('a', 'militia', Math.round(0.2 * CHEIA));
    let s: GameState = { ...estado, unidades: { porId: { ...estado.unidades.porId, a }, ordem: [...estado.unidades.ordem, 'a'] } };
    for (let t = 0; t < 20; t++) {
      s = step(s, [], gameData);
      expect(s.unidades.porId['a']?.fsm).not.toBe('indo_comer');
      expect(s.jobs.tarefas.ordem.some((id) => s.jobs.tarefas.porId[id]?.tipo === 'comer' && s.jobs.tarefas.porId[id]?.reclamadaPor === 'a')).toBe(false);
    }
  });

  it('ANDAIME (L8): a tropa de lado com IA nao drena; com `iaDrena` true, drena', () => {
    const LADO_IA = LADO_DO_JOGADOR + 1;
    const s0 = comIa(com(tropa('j', 'militia', CHEIA), tropa('x', 'militia', CHEIA, LADO_IA, 26, 42)), LADO_IA);
    expect(gameData.condicao.iaDrena).toBe(false);
    const { s } = rodar(s0, 30);
    expect(s.unidades.porId['j']?.condicao).toBe(CHEIA - 30);
    expect(s.unidades.porId['x']?.condicao).toBe(CHEIA);
    // o andaime e so da TROPA: um civil do lado da IA continua drenando
    expect(drenaNoTick(s0, { ...tropa('c', 'serf', 100, LADO_IA) })).toBe(true);
    // a condicao de saida: o dado vira true, e a tropa da IA drena como a do jogador
    const saida: GameData = { ...gameData, condicao: { ...gameData.condicao, iaDrena: true } };
    const r = rodar(s0, 30, saida);
    expect(r.s.unidades.porId['x']?.condicao).toBe(CHEIA - 30);
  });

  it('morrer de fome com a comida na mao do serf: a tarefa cai no mesmo tick e a carga volta', () => {
    // pedido feito com folga, e depois a condicao baixa a mao ate quase zero
    let s = step(com(tropa('a', 'militia', Math.round(0.4 * CHEIA), LADO_DO_JOGADOR, 30, 46)), [{ type: 'FeedUnits', unidades: ['a'] }], gameData);
    let t = 0;
    while (t++ < 500 && s.jobs.tarefas.ordem.every((id) => s.jobs.tarefas.porId[id]?.tipo !== 'comida-para-tropa' || s.jobs.tarefas.porId[id]?.estado !== 'carregando')) {
      s = step(s, [], gameData);
    }
    const tarefa = s.jobs.tarefas.ordem.map((id) => s.jobs.tarefas.porId[id]).find((x) => x?.tipo === 'comida-para-tropa');
    expect(tarefa?.estado).toBe('carregando');
    const serf = tarefa?.reclamadaPor as string;
    const a = s.unidades.porId['a'] as Unidade;
    s = { ...s, unidades: { ...s.unidades, porId: { ...s.unidades.porId, a: { ...a, condicao: 1 } } } };
    const morte = step(s, [], gameData);
    expect(morte.unidades.porId['a']).toBeUndefined();
    expect(morte.events).toContainEqual(expect.objectContaining({ type: 'task-released', tarefa: tarefa?.id, motivo: 'destino-sumiu' }));
    expect(morte.jobs.tarefas.porId[tarefa?.id as string]).toBeUndefined();
    const volta = rodar(morte, 300);
    expect(volta.eventos).toContainEqual(expect.objectContaining({ type: 'cargo-returned' }));
    expect(volta.s.unidades.porId[serf]?.fsmData.carga).toBeUndefined();
    expect(violacoesDeInvariantes(volta.s, gameData)).toEqual([]);
    expect(violacoesDaFsm(volta.s, gameData)).toEqual([]);
  });

  it('ponta a ponta: drena ate o pedido, Feed, o serf entrega, a condicao volta a cheia', () => {
    const pede = gameData.condicao.ticksPedeComida;
    // comeca 20 ticks acima do limiar do pedido: o Feed antes disso e recusado (sem-fome)
    let s = com(tropa('a', 'militia', pede + 20));
    s = step(s, [{ type: 'FeedUnits', unidades: ['a'] }], gameData);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'command-rejected', motivo: 'sem-fome' }));
    s = rodar(s, 25).s;
    expect((s.unidades.porId['a']?.condicao ?? 0) < pede).toBe(true);
    s = step(s, [{ type: 'FeedUnits', unidades: ['a'] }], gameData);
    expect(s.unidades.porId['a']?.pedidoDeComida).toBe(true);
    let ticks = 0;
    let fed: GameEvent | undefined;
    while (ticks++ < 1000 && fed === undefined) {
      s = step(s, [], gameData);
      fed = s.events.find((e) => e.type === 'unit-fed');
      expect(violacoesDeInvariantes(s, gameData)).toEqual([]);
    }
    expect(fed).toBeDefined();
    expect(s.unidades.porId['a']?.condicao).toBe(CHEIA);
    gravarEvidencia('C-COMIDA-01c-ponta-a-ponta', { limiarDoPedido: pede, ticksDoFeedAteComer: ticks, condicaoFinal: s.unidades.porId['a']?.condicao });
  });
});
