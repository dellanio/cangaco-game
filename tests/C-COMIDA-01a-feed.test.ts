/**
 * C-COMIDA-01a (fome militar com o Feed: dado, comando e pedido; plano em
 * docs/planos/2026-09-28-F-FEED-fome-militar.md). Aceite:
 *  - pede a 50 % da cheia e nao a 60 % (o limiar do pedido e 55 %, o TROOPS_FEED_MAX do KaM);
 *  - dois Feed deixam um pedido so;
 *  - as recusas deixam o estado igual, byte a byte;
 *  - o save faz a viagem byte a byte com o pedido, e um save v4 sem o campo carrega;
 *  - a regra de dado reprova o limiar da IA (o do civil) acima do limiar do pedido.
 * O militar ainda NAO drena (isso e a C-COMIDA-01c): o teste baixa a condicao a mao.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { gameData } from '../src/sim/data';
import { createInitialState, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { condicaoCheiaDoTipo } from '../src/sim/condicao';
import { importanciaDoTipo } from '../src/sim/jobs';
import { resumoDoGrupo } from '../src/sim/selectors';
import { carregar, salvar } from '../src/sim/save';
import { validarTudo } from '../tools/data-rules.js';
import { naVila } from './helpers/ancoras';

const CHEIA = gameData.condicao.ticksCondicaoCheia.militar;
const aFracao = (f: number): number => Math.round(f * CHEIA);

function soldado(id: string, fracao: number, tipo = 'militia', lado = LADO_DO_JOGADOR, k = 0): Unidade {
  const t = naVila(k, 6);
  const cheia = condicaoCheiaDoTipo(tipo);
  return { lado, id, tipo, gx: t.gx, gy: t.gy, fsm: 'ocioso', fsmData: {}, condicao: Math.round(fracao * cheia) };
}
function com(...us: Unidade[]): GameState {
  const s = createInitialState(1);
  return { ...s, unidades: { porId: { ...s.unidades.porId, ...Object.fromEntries(us.map((u) => [u.id, u])) }, ordem: [...s.unidades.ordem, ...us.map((u) => u.id)] } };
}
const feed = (...unidades: string[]): Command => ({ type: 'FeedUnits', unidades });
const pediu = (s: GameState, id: string): boolean => s.unidades.porId[id]?.pedidoDeComida === true;

describe('C-COMIDA-01a — o Feed marca o pedido de comida', () => {
  it('o dado: pede abaixo de 55 % da cheia do militar; a comida da tropa e a classe 3, abaixo da Bodega, a pe', () => {
    expect(gameData.condicao.ticksPedeComida).toBe(aFracao(0.55));
    // a tarefa nasce na C-COMIDA-01b; a linha da escada ja existe no dado
    // D-TRANSPORTE-03 T1: classes do KaM. D2 poe a escola na 1; D1 mantem a Bodega (2)
    // acima da tropa (3)
    expect(gameData.entrega.prioridades.find((p) => p.id === 'comida-para-tropa')).toMatchObject({ importancia: 3, modo: 'livre' });
    expect(importanciaDoTipo('comida-para-inn')).toBe(2);
    expect(importanciaDoTipo('ouro-para-escola')).toBe(1);
  });

  it('pede a 50 % e nao a 60 %; o de 60 % fica sem pedido', () => {
    const s = step(com(soldado('a', 0.5, 'militia', LADO_DO_JOGADOR, 0), soldado('b', 0.6, 'militia', LADO_DO_JOGADOR, 1)), [feed('a', 'b')], gameData);
    expect([pediu(s, 'a'), pediu(s, 'b')]).toEqual([true, false]);
    expect(s.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });

  it('o mercenario e militar para o Feed (decisao do operador, F36)', () => {
    const s = step(com(soldado('m', 0.3, 'rogue')), [feed('m')], gameData);
    expect(pediu(s, 'm')).toBe(true);
  });

  it('dois Feed deixam um pedido so: o segundo volta sem-fome, e o estado nao muda', () => {
    const s1 = step(com(soldado('a', 0.4)), [feed('a')], gameData);
    const s2 = step(s1, [feed('a')], gameData);
    expect(pediu(s2, 'a')).toBe(true);
    expect(s2.events.find((e) => e.type === 'command-rejected')).toMatchObject({ command: 'FeedUnits', motivo: 'sem-fome' });
    expect(salvar({ ...s2, events: [] })).toBe(salvar({ ...step(s1, [], gameData), events: [] }));
  });

  it('as recusas: com motivo, e o estado igual byte a byte', () => {
    const s0 = com(soldado('a', 0.4), soldado('b', 0.9, 'militia', LADO_DO_JOGADOR, 1), soldado('x', 0.4, 'militia', LADO_DO_JOGADOR + 1, 2));
    const serf = s0.unidades.ordem.find((id) => s0.unidades.porId[id]?.tipo === 'serf') as string;
    const casos: [Command, string][] = [
      [feed(), 'sem-unidades'],
      [feed('a', 'fantasma'), 'unidade-inexistente'],
      [feed('a', serf), 'unidade-nao-militar'],
      [feed('a', 'x'), 'lados-diferentes'],
      [feed('b'), 'sem-fome'],
    ];
    const semComando = salvar({ ...step(s0, [], gameData), events: [] });
    for (const [cmd, motivo] of casos) {
      const r = step(s0, [cmd], gameData);
      expect(r.events.find((e) => e.type === 'command-rejected'), motivo).toMatchObject({ command: 'FeedUnits', motivo });
      expect(salvar({ ...r, events: [] })).toBe(semComando);
    }
  });

  it('o resumo do grupo: por tipo, a condicao do mais faminto e quantos esperam comida', () => {
    const s = step(com(soldado('a', 0.4), soldado('b', 0.8, 'militia', LADO_DO_JOGADOR, 1), soldado('m', 0.2, 'rogue', LADO_DO_JOGADOR, 2)), [feed('a', 'b')], gameData);
    const r = resumoDoGrupo(s, ['a', 'b', 'm', 'fantasma']);
    expect(r.porTipo).toEqual({ militia: 2, rogue: 1 });
    expect(r.esperandoComida).toBe(1);
    expect(r.condicao).toBeCloseTo(s.unidades.porId['m']!.condicao / condicaoCheiaDoTipo('rogue'), 6);
    expect(resumoDoGrupo(s, [])).toEqual({ porTipo: {}, condicao: 1, esperandoComida: 0 });
  });

  it('o save: o pedido faz a viagem byte a byte, e um save v4 sem o campo carrega', () => {
    const s = step(com(soldado('a', 0.4)), [feed('a')], gameData);
    const texto = salvar(s);
    expect(salvar(carregar(texto))).toBe(texto);
    expect(pediu(carregar(texto), 'a')).toBe(true);
    const antigo = salvar(com(soldado('a', 0.4)));
    expect(antigo).not.toMatch(/pedidoDeComida/);
    expect(pediu(carregar(antigo), 'a')).toBe(false);
  });

  it('a regra de dado reprova o limiar da IA (o do civil) acima do limiar do pedido', () => {
    const cru = (ia: number, pede: number): Record<string, unknown> => {
      const d: Record<string, unknown> = {};
      for (const n of readdirSync('data').filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''))) d[n] = JSON.parse(readFileSync(`data/${n}.json`, 'utf8'));
      const c = d['condition'] as { limiares: { civilVaiComer: number }; militar: { pedeComidaAbaixoDe: number } };
      c.limiares.civilVaiComer = ia;
      c.militar.pedeComidaAbaixoDe = pede;
      return d;
    };
    const daRegra = (ia: number, pede: number): string[] => validarTudo(cru(ia, pede)).filter((e: string) => e.startsWith('condicao/pedido'));
    expect(daRegra(0.5, 0.55)).toEqual([]);
    expect(daRegra(0.55, 0.55)).toHaveLength(1);
    expect(daRegra(0.6, 0.55)).toHaveLength(1);
    expect(daRegra(0.5, 1.2)).toHaveLength(1);
  });
});
