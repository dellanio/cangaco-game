/**
 * I-TRANSPORTE-MATERIAL-DIRETO-DA-CASA — a pedra e a tabua vao da casa direto a obra (pedido do
 * operador, 2026-10-04: "Pedra e Tabua devem ter como prioridade construcoes pendentes antes do
 * estoque"). A origem do material de obra e da pedra do canteiro passa a ser escolhida como a do
 * insumo: a casa com a mercadoria livre na `saida`, ligada ao armazem por estrada, ou o armazem com a
 * multa do lance (`delivery.lance`, KM_HandLogistics.pas:1587-1590).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '../src/sim/commands';
import type { GameState, TarefaDeTransporte } from '../src/sim/state';
import { ehTarefaDeTransporte, ID_DO_ARMAZEM } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { cenarioDePedreira, cenarioDeSerraria, comSaida, pedreiraDaVila } from './helpers/producao-cenario';
import { comEstradas, comObra, comUnidadeExtra } from './helpers/jobs-cenario';
import { linhaHDe, naVila, relativoA } from './helpers/ancoras';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const OBRA = 'obra-longe';

const tarefas = (s: GameState, tipo: string): TarefaDeTransporte[] => s.jobs.tarefas.ordem
  .map((id) => s.jobs.tarefas.porId[id])
  .filter((t): t is TarefaDeTransporte => t !== undefined && ehTarefaDeTransporte(t) && t.tipo === tipo);
/** A pedra do canteiro nao e `TarefaDeTransporte` (o destino e um tile): filtro proprio. */
const cargasDoCanteiro = (s: GameState): { origem: string }[] => s.jobs.tarefas.ordem
  .map((id) => s.jobs.tarefas.porId[id])
  .filter((t) => t?.tipo === 'pedra-para-canteiro')
  .map((t) => t as unknown as { origem: string });
const tipoDe = (s: GameState, id: string): string | undefined => s.predios.porId[id]?.tipo;

/** A casa `casa` (ja ligada ao armazem) com `n` de `mercadoria` na `saida`, e uma obra nivelada longe
 *  pedindo 2 dela (a mesma geometria do F17b: a rua de y=36 ate x=45, obra em (42,34)). */
function comObraPedindo(base: GameState, casa: string, mercadoria: string, n: number): GameState {
  let s = n > 0 ? comSaida(base, casa, { [mercadoria]: n }) : base;
  s = comEstradas(s, linhaHDe(naVila, 0, 16, 6));
  return comObra(s, OBRA, { ...naVila(13, 4), tipo: 'quarry', faltam: { [mercadoria]: 2 } });
}

const origensDoMaterial = (s: GameState): (string | undefined)[] =>
  tarefas(s, 'material-para-obra').filter((t) => t.destino === OBRA).map((t) => tipoDe(s, t.origem));

describe('I-TRANSPORTE-MATERIAL-DIRETO-DA-CASA', () => {
  it('1. a pedra da obra sai da pedreira que tem pedra; sem pedra nela, sai do armazem', () => {
    const comPedra = step(comObraPedindo(cenarioDePedreira(), 'q1', 'stone', 2), []);
    expect(origensDoMaterial(comPedra)).toEqual(['quarry', 'quarry']);
    const semPedra = step(comObraPedindo(cenarioDePedreira(), 'q1', 'stone', 0), []);
    expect(origensDoMaterial(semPedra)).toEqual([ID_DO_ARMAZEM, ID_DO_ARMAZEM]);
    // a pedreira com UMA pedra paga uma, e o armazem a outra
    const umaSo = step(comObraPedindo(cenarioDePedreira(), 'q1', 'stone', 1), []);
    expect(origensDoMaterial(umaSo).sort()).toEqual(['quarry', ID_DO_ARMAZEM].sort());
  });

  it('2. a tabua da obra sai da serraria que tem tabua', () => {
    const comTabua = step(comObraPedindo(cenarioDeSerraria(), 's1', 'timber', 2), []);
    expect(origensDoMaterial(comTabua)).toEqual(['sawmill', 'sawmill']);
  });

  it('3. a pedra do canteiro de estrada sai da pedreira ligada', () => {
    const base = comSaida(cenarioDePedreira(), 'q1', { stone: 2 });
    const planejar: Command = { type: 'PlaceRoad', tiles: [naVila(5, 7)] };
    // o comando so planeja: a carga nasce nos ticks seguintes (o canteiro assenta antes)
    let depois = step(base, [planejar]);
    expect(Object.keys(depois.estradasPlanejadas).length, 'o canteiro foi aceito').toBeGreaterThan(0);
    for (let i = 0; i < 100 && cargasDoCanteiro(depois).length === 0; i++) depois = step(depois, []);
    const origens = cargasDoCanteiro(depois).map((t) => tipoDe(depois, t.origem));
    expect(origens.length).toBeGreaterThan(0);
    expect(origens.every((o) => o === 'quarry')).toBe(true);
  });

  it('4. sem obra pendente, a saida da pedreira continua indo ao armazem', () => {
    const s = step(comSaida(cenarioDePedreira(), 'q1', { stone: 2 }), []);
    expect(tarefas(s, 'material-para-obra')).toEqual([]);
    expect(tarefas(s, 'saida-cheia-para-armazem').some((t) => t.origem === 'q1')).toBe(true);
  });

  it('5. pelo step, a pedra da pedreira chega a obra, sem violar invariante do quadro', () => {
    // o cenario nao tem obreiro: a obra nao se ergue, mas o material chega (faltam zera)
    // o cenario da pedreira nao tem serf: um, aos pes da pedreira, como no F17b
    const posto = relativoA(pedreiraDaVila())(1, 2);
    let s = comUnidadeExtra(comObraPedindo(cenarioDePedreira(), 'q1', 'stone', 2), 'serf-da-obra', 'serf', posto.gx, posto.gy);
    const daPedreira = new Set<string>();
    let entregue: number | null = null;
    const faltam = (e: GameState): number => {
      const o = e.predios.porId[OBRA];
      return o?.estado === 'obra' ? o.obra.faltam['stone'] ?? 0 : 0;
    };
    for (let i = 0; i < 1500 && entregue === null; i++) {
      s = step(s, []);
      for (const t of tarefas(s, 'material-para-obra')) if (t.origem === 'q1') daPedreira.add(t.id);
      expect(violacoesDeInvariantes(s), `tick ${s.tick}`).toEqual([]);
      if (faltam(s) === 0) entregue = s.tick;
    }
    expect(daPedreira.size).toBe(2);
    expect(entregue).not.toBeNull();
    gravarEvidencia('I-TRANSPORTE-MATERIAL-DIRETO-DA-CASA', { cargasDaPedreiraParaAObra: daPedreira.size, tickEntregue: entregue });
  });

  it('o guarda acusa: material de obra saindo de predio que nao esta completo', () => {
    const s = step(comObraPedindo(cenarioDePedreira(), 'q1', 'stone', 2), []);
    const t = tarefas(s, 'material-para-obra')[0]!;
    const torta: GameState = {
      ...s,
      jobs: { ...s.jobs, tarefas: { ...s.jobs.tarefas, porId: { ...s.jobs.tarefas.porId, [t.id]: { ...t, origem: OBRA } } } },
    };
    expect(violacoesDeInvariantes(torta).some((v) => v.startsWith(`${t.id}: origem '${OBRA}'`))).toBe(true);
  });
});
