/**
 * C-COMIDA-01b (fome militar com o Feed: a tarefa comida-para-tropa com destino
 * movel; plano em docs/planos/2026-09-28-F-FEED-fome-militar.md §3.3). Aceite:
 *  - entrega e enche: a condicao volta a cheia, o pedido some, a comida sai do armazem;
 *  - com o militar marchando, o serf recalcula e entrega; a tropa marcha 3 vezes
 *    seguidas, e o serf entrega na parada (risco 11: afirma PROGRESSO, nao prazo);
 *  - um caso por ramo de falha (morto reclamada / morto carregando / pedido sumiu /
 *    inalcancavel / sem comida / so armazem de outro lado / serf de outro lado);
 *  - invariantes a cada tick; conservacao de bens descontando `unit-fed`;
 *  - determinismo; nunca duas tarefas por militar.
 * O militar ainda NAO drena (C-COMIDA-01c): o teste baixa a condicao a mao.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameEvent, GameState, TarefaComidaParaTropa, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { criarTarefaComidaParaTropa, reclamar } from '../src/sim/jobs';
import { salvar } from '../src/sim/save';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { bensPorMercadoria, violacoesDaFsm } from './helpers/serf-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const ARMAZEM = 'p1';
const TETO = 3000;

function soldado(id: string, gx: number, gy: number, fracao = 0.4, lado = LADO_DO_JOGADOR): Unidade {
  return { lado, id, tipo: 'militia', gx, gy, fsm: 'ocioso', fsmData: {}, condicao: Math.round(fracao * condicaoCheiaDoTipo('militia')) };
}
function com(...us: Unidade[]): GameState {
  const s = createInitialState(1);
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } };
}
const feed = (...unidades: string[]): Command => ({ type: 'FeedUnits', unidades });
const mover = (id: string, gx: number, gy: number): Command => ({ type: 'MoveUnits', unidades: [id], destino: { gx, gy } });
const tarefasDaTropa = (s: GameState, id: string): TarefaComidaParaTropa[] =>
  s.jobs.tarefas.ordem.map((t) => s.jobs.tarefas.porId[t])
    .filter((t): t is TarefaComidaParaTropa => t !== undefined && t.tipo === 'comida-para-tropa' && t.destinoUnidade === id);
const soma = (b: Record<string, number>, m: string): number => b[m] ?? 0;

interface Corrida { readonly s: GameState; readonly ticks: number; readonly eventos: GameEvent[]; readonly violacoes: string[] }

/** Roda ate `parar` (ou o teto), conferindo as invariantes e a conservacao a cada tick. */
function correr(
  s0: GameState, parar: (s: GameState) => boolean, comandos: (t: number, s: GameState) => Command[] = () => [],
): Corrida {
  let s = s0;
  const eventos: GameEvent[] = [];
  const violacoes: string[] = [];
  const bens0 = bensPorMercadoria(s0);
  let comido: Record<string, number> = {};
  for (let t = 0; t < TETO; t++) {
    s = step(s, comandos(t, s), gameData);
    eventos.push(...s.events);
    for (const e of s.events) if (e.type === 'unit-fed') comido = { ...comido, [e.mercadoria]: (comido[e.mercadoria] ?? 0) + 1 };
    violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `t${t}: ${v}`));
    violacoes.push(...violacoesDaFsm(s, gameData).map((v) => `t${t}: ${v}`));
    const bens = bensPorMercadoria(s);
    for (const m of ['loaves', 'sausages']) {
      if (soma(bens, m) + (comido[m] ?? 0) !== soma(bens0, m)) violacoes.push(`t${t}: ${m} nao conserva`);
    }
    if (parar(s)) return { s, ticks: t + 1, eventos, violacoes };
  }
  return { s, ticks: TETO, eventos, violacoes };
}
const alimentou = (id: string) => (s: GameState): boolean => s.events.some((e) => e.type === 'unit-fed' && e.unidade === id);
const saida = (s: GameState, m: string): number => {
  const p = s.predios.porId[ARMAZEM];
  return p && p.estado === 'completo' ? (p.estoque.saida[m] ?? 0) : 0;
};

describe('C-COMIDA-01b — a comida vai ate a tropa', () => {
  it('entrega e enche: condicao cheia, pedido apagado, um pao a menos no armazem', () => {
    const s0 = step(com(soldado('a', 30, 38)), [feed('a')], gameData);
    expect(s0.unidades.porId['a']?.pedidoDeComida).toBe(true);
    const r = correr(s0, alimentou('a'));
    expect(r.violacoes).toEqual([]);
    const fed = r.eventos.find((e) => e.type === 'unit-fed');
    // o pao (15) e a comida de mais unidades livres no armazem inicial (salsicha 10)
    expect(fed).toMatchObject({ type: 'unit-fed', unidade: 'a', mercadoria: 'loaves' });
    const a = r.s.unidades.porId['a'];
    expect(a?.condicao).toBe(condicaoCheiaDoTipo('militia'));
    expect(a?.pedidoDeComida).toBeUndefined();
    expect(saida(r.s, 'loaves')).toBe(14);
    expect(tarefasDaTropa(r.s, 'a')).toEqual([]);
    gravarEvidencia('C-COMIDA-01b-entrega', { ticksAteComer: r.ticks, evento: fed, condicao: a?.condicao });
  });

  it('a tropa marcha 3 vezes seguidas, e o serf entrega na parada', () => {
    const s0 = step(com(soldado('a', 30, 40)), [feed('a')], gameData);
    // as tres ordens saem SEGUIDAS, a tropa ainda andando: a primeira quando o serf ja
    // carrega, as outras a cada `INTERVALO` ticks. Destinos longe um do outro.
    const destinos = [{ gx: 44, gy: 44 }, { gx: 22, gy: 48 }, { gx: 38, gy: 52 }];
    const INTERVALO = 20;
    let dadas = 0;
    let recalculos = 0;
    let inicio: number | null = null;
    let antes: string | undefined;
    const r = correr(s0, alimentou('a'), (t, s) => {
      const tarefa = tarefasDaTropa(s, 'a')[0];
      const serf = tarefa?.reclamadaPor;
      const fsm = serf === undefined || serf === null ? undefined : s.unidades.porId[serf]?.fsm;
      if (antes === 'entregando' && fsm === 'indo_entregar') recalculos++;
      antes = fsm;
      if (inicio === null && tarefa?.estado === 'carregando') inicio = t;
      const d = destinos[dadas];
      if (inicio !== null && d !== undefined && t === inicio + dadas * INTERVALO) {
        dadas++;
        return [mover('a', d.gx, d.gy)];
      }
      return [];
    });
    expect(r.violacoes).toEqual([]);
    expect(dadas).toBe(3);
    expect(recalculos).toBeGreaterThanOrEqual(1);
    const a = r.s.unidades.porId['a'];
    const fed = r.eventos.find((e) => e.type === 'unit-fed');
    expect(fed).toBeDefined();
    const serf = fed?.type === 'unit-fed' ? r.s.unidades.porId[fed.serf] : undefined;
    // entregou ADJACENTE a onde o militar estava na entrega (Chebyshev <= 1)
    expect(a && serf ? Math.max(Math.abs(a.gx - serf.gx), Math.abs(a.gy - serf.gy)) : 99).toBeLessThanOrEqual(1);
    expect(a?.condicao).toBe(condicaoCheiaDoTipo('militia'));
    // a entrega foi na PARADA da terceira marcha: o militar esta ocioso perto do destino dela
    expect(a?.fsm).toBe('ocioso');
    expect(a ? Math.max(Math.abs(a.gx - 38), Math.abs(a.gy - 52)) : 99).toBeLessThanOrEqual(2);
    gravarEvidencia('C-COMIDA-01b-marcha', { ticksAteComer: r.ticks, ordensDeMarcha: dadas, recalculos, parada: a && { gx: a.gx, gy: a.gy } });
  });

  it('nunca duas tarefas por militar: a segunda aberta criada a mao cai no saneamento', () => {
    const s0 = step(com(soldado('a', 30, 38)), [feed('a')], gameData);
    expect(tarefasDaTropa(s0, 'a')).toHaveLength(1);
    const extra = criarTarefaComidaParaTropa(s0, { mercadoria: 'sausages', origem: ARMAZEM, destinoUnidade: 'a' }).state;
    expect(tarefasDaTropa(extra, 'a')).toHaveLength(2);
    const s1 = step(extra, [], gameData);
    expect(tarefasDaTropa(s1, 'a')).toHaveLength(1);
  });

  it('o serf nao leva comida a militar de outro lado: unidade-invalida', () => {
    // serf e armazem do MESMO lado (o C7 passa); so o militar e do outro. A tarefa e
    // feita a mao — o gerador nunca a criaria — para isolar a conferencia deste item.
    const s0 = step(com(soldado('x', 30, 38, 0.4, LADO_DO_JOGADOR + 1)), [feed('x')], gameData);
    const { state, id } = criarTarefaComidaParaTropa(s0, { mercadoria: 'loaves', origem: ARMAZEM, destinoUnidade: 'x' });
    const serf = state.unidades.ordem.find((u) => state.unidades.porId[u]?.tipo === 'serf') as string;
    expect(state.unidades.porId[serf]?.lado).toBe(state.predios.porId[ARMAZEM]?.lado);
    const r = reclamar(state, id, serf, gameData);
    expect(r.ok ? '' : r.motivo).toBe('unidade-invalida');
  });

  describe('os ramos de falha', () => {
    const ateEstado = (id: string, estado: 'reclamada' | 'carregando') => (s: GameState): boolean =>
      tarefasDaTropa(s, id)[0]?.estado === estado;
    const semTropa = (s: GameState, id: string): GameState => {
      const porId = { ...s.unidades.porId };
      delete porId[id];
      return { ...s, unidades: { porId, ordem: s.unidades.ordem.filter((u) => u !== id) } };
    };

    it('o militar morre com a tarefa RECLAMADA: cai no saneamento, nada sai do armazem', () => {
      const r = correr(step(com(soldado('a', 30, 40)), [feed('a')], gameData), ateEstado('a', 'reclamada'));
      const pao = saida(r.s, 'loaves');
      const s = step(semTropa(r.s, 'a'), [], gameData);
      expect(s.jobs.tarefas.ordem.map((id) => s.jobs.tarefas.porId[id]?.tipo)).not.toContain('comida-para-tropa');
      expect(s.events).toContainEqual(expect.objectContaining({ type: 'task-released', motivo: 'destino-sumiu' }));
      expect(saida(s, 'loaves')).toBe(pao);
      expect(violacoesDeInvariantes(s, gameData)).toEqual([]);
    });

    it('o militar morre com a comida na mao do serf: a carga volta ao armazem', () => {
      const r = correr(step(com(soldado('a', 30, 44)), [feed('a')], gameData), ateEstado('a', 'carregando'));
      const serf = tarefasDaTropa(r.s, 'a')[0]?.reclamadaPor as string;
      const volta = correr(semTropa(r.s, 'a'), (s) => s.unidades.porId[serf]?.fsm === 'ocioso' && s.unidades.porId[serf]?.fsmData.carga === undefined);
      expect(volta.violacoes).toEqual([]);
      expect(volta.eventos).toContainEqual(expect.objectContaining({ type: 'cargo-returned' }));
      expect(saida(volta.s, 'loaves') + saida(volta.s, 'sausages')).toBe(25);
    });

    it('o pedido some com a comida a caminho: destino-completo, e a carga volta', () => {
      const r = correr(step(com(soldado('a', 30, 44)), [feed('a')], gameData), ateEstado('a', 'carregando'));
      const a = r.s.unidades.porId['a'] as Unidade;
      const { pedidoDeComida: _p, ...semPedido } = a;
      const s = step({ ...r.s, unidades: { ...r.s.unidades, porId: { ...r.s.unidades.porId, a: semPedido } } }, [], gameData);
      expect(s.events).toContainEqual(expect.objectContaining({ type: 'task-released', motivo: 'destino-completo' }));
      expect(tarefasDaTropa(s, 'a')).toEqual([]);
    });

    it('sem comida no armazem: nao cria tarefa, e o pedido persiste', () => {
      const s0 = com(soldado('a', 30, 38));
      const p = s0.predios.porId[ARMAZEM];
      if (!p || p.estado !== 'completo') throw new Error('armazem inicial');
      const vazio: GameState = { ...s0, predios: { ...s0.predios, porId: { ...s0.predios.porId, [ARMAZEM]: { ...p, estoque: { ...p.estoque, saida: { gold: 20, timber: 40, stone: 30 } } } } } };
      let s = step(vazio, [feed('a')], gameData);
      for (let t = 0; t < 50; t++) s = step(s, [], gameData);
      expect(tarefasDaTropa(s, 'a')).toEqual([]);
      expect(s.unidades.porId['a']?.pedidoDeComida).toBe(true);
    });

    it('so ha armazem de OUTRO lado: nao cria tarefa', () => {
      const s = step(com(soldado('x', 30, 38, 0.4, LADO_DO_JOGADOR + 1)), [feed('x')], gameData);
      expect(s.unidades.porId['x']?.pedidoDeComida).toBe(true);
      expect(tarefasDaTropa(step(s, [], gameData), 'x')).toEqual([]);
    });

    it('militar inalcancavel (dentro do predio da escola): nao cria tarefa, e o pedido persiste', () => {
      const escola = createInitialState(1).predios.porId['p2'];
      const s = step(com(soldado('a', (escola?.gx ?? 0) + 1, (escola?.gy ?? 0) + 1)), [feed('a')], gameData);
      const s2 = step(s, [], gameData);
      expect(s2.unidades.porId['a']?.pedidoDeComida).toBe(true);
      expect(tarefasDaTropa(s2, 'a')).toEqual([]);
    });
  });

  it('determinismo: a mesma corrida duas vezes da o mesmo save, byte a byte', () => {
    const rodar = (): string => {
      const r = correr(step(com(soldado('a', 30, 40), soldado('b', 26, 42)), [feed('a', 'b')], gameData), (s) =>
        s.unidades.porId['a']?.pedidoDeComida === undefined && s.unidades.porId['b']?.pedidoDeComida === undefined);
      expect(r.violacoes).toEqual([]);
      return salvar({ ...r.s, events: [] });
    };
    expect(rodar()).toBe(rodar());
  });
});
