/**
 * D-TELA-01 — aba de estatisticas (plano em docs/planos/2026-09-29-D-TELA-01-aba-de-estatisticas.md).
 * O seletor puro `estatisticasDaVila`: predios e trabalhadores do lado por tipo, na ordem do
 * dado, com os ociosos contados (especialista sem posto, serf e peao sem tarefa).
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DO_RECRUTA, LADO_DA_IA, LADO_DO_JOGADOR } from '../src/sim/state';
import type { GameState, Predio, TarefaOcupar, Unidade } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { canPlace } from '../src/sim/placement';
import { criarEscaramuca } from '../src/sim/cenario';
import { estatisticasDaVila, populacaoPorGrupo } from '../src/sim/selectors';
import { comUnidade } from '../src/sim/units/movimento';
import { TIPO_QUE_CARREGA } from '../src/sim/jobs';
import { gravarEvidencia } from './helpers/evidence';

const SEMENTE = gameData.economia.estadoInicial.semente;
const FARMER = 'farmer';

const unidadesDoLado = (s: GameState, lado: number, tipo: string): Unidade[] => s.unidades.ordem
  .map((id) => s.unidades.porId[id])
  .filter((u): u is Unidade => u !== undefined && u.lado === lado && u.tipo === tipo);
const predioDoLado = (s: GameState, lado: number, tipo: string): Predio => {
  const p = s.predios.ordem.map((id) => s.predios.porId[id] as Predio).find((q) => q.lado === lado && q.tipo === tipo);
  if (p === undefined) throw new Error(`o lado ${lado} deveria ter ${tipo}`);
  return p;
};
const comPredio = (s: GameState, p: Predio): GameState => ({ ...s, predios: { ...s.predios, porId: { ...s.predios.porId, [p.id]: p } } });
const linhaDeGente = (s: GameState, tipo: string, lado = LADO_DO_JOGADOR) =>
  estatisticasDaVila(s, gameData, lado).gente.find((l) => l.tipo === tipo);

/** A vila da IA na escaramuca, rodada ate o fazendeiro chegar ao posto (no tick 0 ele
 *  ainda vai a pe ate a fazenda). */
function fazendaDaIA(): { s: GameState; fazenda: Predio & { estado: 'completo' }; farmer: Unidade } {
  let s = criarEscaramuca(SEMENTE);
  const ocupada = (a: GameState): boolean => { const p = predioDoLado(a, LADO_DA_IA, 'farm'); return p.estado === 'completo' && p.ocupante !== null; };
  for (let t = 0; t < 600 && !ocupada(s); t++) s = step(s, [], gameData);
  const fazenda = predioDoLado(s, LADO_DA_IA, 'farm');
  if (fazenda.estado !== 'completo') throw new Error('a fazenda da IA deveria estar completa');
  const [farmer] = unidadesDoLado(s, LADO_DA_IA, FARMER);
  if (farmer === undefined || fazenda.ocupante !== farmer.id) throw new Error('o fazendeiro da IA deveria ocupar a fazenda');
  return { s, fazenda, farmer };
}

describe('D-TELA-01 — a aba de estatisticas', () => {
  it('a vila inicial: predios por tipo batem com o estado, e a gente soma o civil da barra', () => {
    const s = createInitialState(1);
    const est = estatisticasDaVila(s);
    const esperado: Record<string, number> = {};
    for (const id of s.predios.ordem) {
      const p = s.predios.porId[id];
      if (p?.lado === LADO_DO_JOGADOR) esperado[p.tipo] = (esperado[p.tipo] ?? 0) + 1;
    }
    expect(Object.fromEntries(est.predios.map((l) => [l.tipo, l.completos + l.emObra]))).toEqual(esperado);
    expect(est.gente.reduce((n, l) => n + l.total, 0)).toBe(populacaoPorGrupo(s).civil);
    gravarEvidencia('D-TELA-01-estatisticas', { vilaInicial: est });
  });

  it('o lado da IA nao entra na conta do jogador, e vice-versa', () => {
    const s = criarEscaramuca(SEMENTE);
    const doJogador = estatisticasDaVila(s);
    const daIA = estatisticasDaVila(s, gameData, LADO_DA_IA);
    expect(doJogador.predios.find((l) => l.tipo === 'farm')).toBeUndefined();
    expect(daIA.predios.find((l) => l.tipo === 'farm')?.completos).toBe(1);
    expect(doJogador.gente.find((l) => l.tipo === FARMER)).toBeUndefined();
    expect(daIA.gente.reduce((n, l) => n + l.total, 0)).toBe(populacaoPorGrupo(s, gameData, LADO_DA_IA).civil);
  });

  it('a obra conta em emObra, nao em completos', () => {
    const s0 = createInitialState(1);
    let comando: { gx: number; gy: number } | null = null;
    for (let gy = 0; gy < gameData.mapa.altura && comando === null; gy++) {
      for (let gx = 0; gx < gameData.mapa.largura && comando === null; gx++) {
        if (canPlace(s0, 'quarry', gx, gy, gameData).ok) comando = { gx, gy };
      }
    }
    if (comando === null) throw new Error('deveria haver lugar para uma pedreira');
    const s = step(s0, [{ type: 'PlaceBlueprint', buildingId: 'quarry', ...comando }], gameData);
    expect(estatisticasDaVila(s).predios.find((l) => l.tipo === 'quarry')).toEqual({ tipo: 'quarry', completos: 0, emObra: 1 });
  });

  it('serf e peao: ocioso e quem esta sem tarefa (fsm ocioso)', () => {
    const s0 = createInitialState(1);
    const [primeiro] = unidadesDoLado(s0, LADO_DO_JOGADOR, TIPO_QUE_CARREGA);
    if (primeiro === undefined) throw new Error('a vila inicial deveria ter serf');
    const total = unidadesDoLado(s0, LADO_DO_JOGADOR, TIPO_QUE_CARREGA).length;
    expect(linhaDeGente(s0, TIPO_QUE_CARREGA)).toEqual({ tipo: TIPO_QUE_CARREGA, total, ociosos: total });
    const s = comUnidade(s0, { ...primeiro, fsm: 'carregando' });
    expect(linhaDeGente(s, TIPO_QUE_CARREGA)).toEqual({ tipo: TIPO_QUE_CARREGA, total, ociosos: total - 1 });
  });

  it('especialista: ocioso e quem nao tem posto nem vai a um; parado dentro nao conta', () => {
    const { s, fazenda, farmer } = fazendaDaIA();
    // no posto, mesmo com a FSM parada: nao e ocioso
    expect(linhaDeGente(comUnidade(s, { ...farmer, fsm: 'ocioso' }), FARMER, LADO_DA_IA)).toEqual({ tipo: FARMER, total: 1, ociosos: 0 });
    // sem posto: ocioso
    const semPosto = comPredio(s, { ...fazenda, ocupante: null });
    expect(linhaDeGente(semPosto, FARMER, LADO_DA_IA)).toEqual({ tipo: FARMER, total: 1, ociosos: 1 });
    // a caminho do posto (vaga reclamada): nao e ocioso
    const tarefa: TarefaOcupar = { id: 't-ocupar', numero: 999_999, reclamadaPor: farmer.id, tipo: 'ocupar', estado: 'reclamada', destino: fazenda.id };
    const aCaminho: GameState = {
      ...semPosto,
      jobs: { ...semPosto.jobs, tarefas: { porId: { ...semPosto.jobs.tarefas.porId, [tarefa.id]: tarefa }, ordem: [...semPosto.jobs.tarefas.ordem, tarefa.id] } },
    };
    expect(linhaDeGente(aCaminho, FARMER, LADO_DA_IA)).toEqual({ tipo: FARMER, total: 1, ociosos: 0 });
  });

  it('o recruta da ociosos null: esperar no quartel e o papel dele', () => {
    const s0 = createInitialState(1);
    const recruta: Unidade = { id: 'r1', lado: LADO_DO_JOGADOR, tipo: ID_DO_RECRUTA, gx: 10, gy: 10, fsm: 'ocioso', fsmData: {}, condicao: 1 };
    const s: GameState = { ...s0, unidades: { porId: { ...s0.unidades.porId, r1: recruta }, ordem: [...s0.unidades.ordem, 'r1'] } };
    expect(linhaDeGente(s, ID_DO_RECRUTA)).toEqual({ tipo: ID_DO_RECRUTA, total: 1, ociosos: null });
  });

  it('a ordem e a do dado, e nao ha linha com zero', () => {
    const est = estatisticasDaVila(criarEscaramuca(SEMENTE), gameData, LADO_DA_IA);
    const ordemDosPredios = gameData.predios.map((d) => d.id);
    const ordemDaGente = gameData.unidades.civis.tipos.map((c) => c.id);
    const indices = (ids: readonly string[], ordem: readonly string[]) => ids.map((id) => ordem.indexOf(id));
    const crescente = (xs: readonly number[]) => xs.every((x, i) => i === 0 || x > (xs[i - 1] ?? -1));
    expect(crescente(indices(est.predios.map((l) => l.tipo), ordemDosPredios))).toBe(true);
    expect(crescente(indices(est.gente.map((l) => l.tipo), ordemDaGente))).toBe(true);
    expect(est.predios.every((l) => l.completos + l.emObra > 0)).toBe(true);
    expect(est.gente.every((l) => l.total > 0)).toBe(true);
  });
});
