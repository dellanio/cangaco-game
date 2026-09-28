/**
 * F-CERCO-b — o reparo, ligado predio a predio e nascendo desligado (BUILD_PLAN,
 * F-CERCO-b; plano em docs/planos/2026-09-28-A6-F-CERCO-b.md).
 *
 * Os quatro aceites do item:
 *  1. com o reparo desligado, o predio danificado nao recebe martelada nenhuma;
 *  2. ligado, o `hp` sobe 5 por martelada ate o teto e para, e a tarefa some;
 *  3. desligar no meio libera a tarefa, e as reservas voltam;
 *  4. o predio completo sem dano nao gera tarefa, mesmo com o reparo ligado.
 * Mais: o comando recusado deixa o estado igual, e o save da versao 3 migra desligado.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState, ID_DO_ARMAZEM } from '../src/sim/state';
import type { GameState, Predio, PredioCompleto, Tarefa } from '../src/sim/state';
import { step } from '../src/sim/tick';
import type { Command } from '../src/sim/commands';
import { carregar, salvar } from '../src/sim/save';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const { hpPorMartelada: MARTELADA } = gameData.construcao;
const DANO = 23; // nao multiplo de 5: a ultima martelada so completa ate o teto

function comArmazemDanificado(dano: number): { readonly s: GameState; readonly id: string; readonly total: number } {
  const s0 = createInitialState(1);
  const id = s0.predios.ordem.find((i) => s0.predios.porId[i]?.tipo === ID_DO_ARMAZEM) as string;
  const p = s0.predios.porId[id] as PredioCompleto;
  const total = p.hp;
  return { s: { ...s0, predios: { ...s0.predios, porId: { ...s0.predios.porId, [id]: { ...p, hp: total - dano } } } }, id, total };
}

const reparo = (predio: string, ligado: boolean): Command => ({ type: 'SetBuildingRepair', predio, ligado });
const reparosDe = (s: GameState, predio: string): Tarefa[] =>
  s.jobs.tarefas.ordem.map((i) => s.jobs.tarefas.porId[i] as Tarefa).filter((t) => t.tipo === 'reparar' && t.destino === predio);
const hpDe = (s: GameState, id: string): number => (s.predios.porId[id] as Predio).hp;

describe('F-CERCO-b — o reparo', () => {
  it('o predio nasce com o reparo desligado', () => {
    const s = createInitialState(1);
    for (const id of s.predios.ordem) expect((s.predios.porId[id] as PredioCompleto).reparo).toBe(false);
  });

  it('(1) desligado, o predio danificado nao recebe martelada em 600 ticks', () => {
    const { s: s0, id, total } = comArmazemDanificado(DANO);
    let s = s0;
    for (let t = 0; t < 600; t += 1) {
      s = step(s, [], gameData);
      expect(reparosDe(s, id)).toEqual([]);
    }
    expect(hpDe(s, id)).toBe(total - DANO);
  });

  it('(2) ligado, o hp sobe 5 por martelada ate o teto e para, e a tarefa some', () => {
    const { s: s0, id, total } = comArmazemDanificado(DANO);
    let s = step(s0, [reparo(id, true)], gameData);
    expect(reparosDe(s, id).length).toBe(gameData.construcao.laborersMaximosPorObra);
    const subidas: number[] = [];
    let anterior = hpDe(s, id);
    const violacoes: string[] = [];
    for (let t = 0; t < 2000 && hpDe(s, id) < total; t += 1) {
      s = step(s, [], gameData);
      const agora = hpDe(s, id);
      if (agora !== anterior) subidas.push(agora - anterior);
      anterior = agora;
      violacoes.push(...violacoesDeInvariantes(s, gameData).map((v) => `tick ${s.tick}: ${v}`));
    }
    expect(violacoes).toEqual([]);
    expect(hpDe(s, id)).toBe(total);
    // cada martelada soma 5; so a ultima completa o resto ate o teto (23 = 4 x 5 + 3)
    expect(subidas).toEqual([MARTELADA, MARTELADA, MARTELADA, MARTELADA, DANO % MARTELADA]);
    expect(reparosDe(s, id)).toEqual([]);
    // e para: 300 ticks depois, nem martelada nem tarefa nova
    const tickDoTeto = s.tick;
    for (let t = 0; t < 300; t += 1) {
      s = step(s, [], gameData);
      expect(hpDe(s, id)).toBe(total);
      expect(reparosDe(s, id)).toEqual([]);
    }
    const laborers = s.unidades.ordem.filter((u) => s.unidades.porId[u]?.tipo === 'laborer');
    for (const u of laborers) expect(s.unidades.porId[u]?.fsmData.tarefa).toBeUndefined();
    gravarEvidencia('F-CERCO-b', { dano: DANO, martelada: MARTELADA, subidas, tickDoTeto, total });
  });

  it('(3) desligar no meio libera a tarefa no mesmo tick, e ninguem fica preso a ela', () => {
    const { s: s0, id, total } = comArmazemDanificado(DANO);
    let s = step(s0, [reparo(id, true)], gameData);
    while (hpDe(s, id) === total - DANO && s.tick < 2000) s = step(s, [], gameData);
    expect(hpDe(s, id), 'a primeira martelada deveria ter caido').toBe(total - DANO + MARTELADA);
    const reclamadas = reparosDe(s, id).filter((t) => t.estado === 'reclamada');
    expect(reclamadas.length).toBeGreaterThan(0);

    s = step(s, [reparo(id, false)], gameData);
    expect(reparosDe(s, id)).toEqual([]);
    expect(s.events.filter((e) => e.type === 'task-released').map((e) => (e as { tarefa: string }).tarefa).sort())
      .toEqual(reclamadas.map((t) => t.id).sort());
    for (const t of reclamadas) {
      const u = s.unidades.porId[t.reclamadaPor as string];
      expect(u?.fsm).toBe('ocioso');
    }
    expect(violacoesDeInvariantes(s, gameData)).toEqual([]);
    const hpAoDesligar = hpDe(s, id);
    for (let t = 0; t < 300; t += 1) s = step(s, [], gameData);
    expect(hpDe(s, id)).toBe(hpAoDesligar);
  });

  it('(4) completo sem dano e ligado nao gera tarefa', () => {
    const { s: s0, id } = comArmazemDanificado(0);
    let s = step(s0, [reparo(id, true)], gameData);
    expect((s.predios.porId[id] as PredioCompleto).reparo).toBe(true);
    for (let t = 0; t < 100; t += 1) {
      expect(reparosDe(s, id)).toEqual([]);
      s = step(s, [], gameData);
    }
  });

  it('recusa com o estado igual: predio inexistente e obra; o mesmo valor e no-op', () => {
    const { s: s0, id } = comArmazemDanificado(DANO);
    const obra = step(s0, [{ type: 'PlaceBlueprint', buildingId: 'woodcutters', gx: 20, gy: 36 }], gameData);
    const idObra = obra.predios.ordem.find((i) => obra.predios.porId[i]?.estado === 'obra');
    const casos: [GameState, Command, string | null][] = [
      [s0, reparo('nao-existe', true), 'predio-inexistente'],
      [s0, reparo(id, false), null], // ja desligado: no-op, sem evento
    ];
    if (idObra !== undefined) casos.push([obra, reparo(idObra, true), 'predio-em-obra']);
    for (const [s, cmd, motivo] of casos) {
      const r = step(s, [cmd], gameData);
      const recusa = r.events.find((e) => e.type === 'command-rejected');
      if (motivo === null) expect(recusa).toBeUndefined();
      else expect(recusa).toMatchObject({ command: 'SetBuildingRepair', motivo });
      expect(salvar({ ...r, events: [] })).toBe(salvar({ ...step(s, [], gameData), events: [] }));
    }
    expect(idObra, 'o PlaceBlueprint da fixture deveria ter criado a obra').toBeDefined();
  });

  it('o save da versao 3 (sem o campo) carrega com o reparo desligado, byte a byte', () => {
    const partida = step(createInitialState(1), [], gameData);
    const envelope = JSON.parse(salvar(partida)) as { estado: GameState } & Record<string, unknown>;
    for (const p of Object.values(envelope.estado.predios.porId)) delete (p as { reparo?: boolean }).reparo;
    const textoV3 = JSON.stringify({ ...envelope, versao: 3 });
    expect(textoV3).not.toMatch(/"reparo"/);
    const migrado = carregar(textoV3, gameData);
    expect(salvar(migrado)).toBe(salvar(partida));
  });
});
