import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { TarefaConstruir } from '../src/sim/state';
import {
  criarTarefaDeConstrucao, elegivelParaTarefa, reclamar, TIPO_QUE_CONSTROI, tarefasEmOrdem,
} from '../src/sim/jobs';
import {
  cenarioLigado, comObra, comTarefas, comUnidadeExtra, inicial, laborersDoCenario, serfsDoCenario, tarefaDe,
} from './helpers/jobs-cenario';

describe('F11b — Tarefa vira uniao discriminada', () => {
  it('uma tarefa de construir (sem mercadoria/origem) sobrevive ao JSON de ida e volta', () => {
    const construir: TarefaConstruir = { id: 't1', numero: 1, tipo: 'construir', destino: 'obra-a', estado: 'aberta', reclamadaPor: null };
    const estado = comTarefas(cenarioLigado(), [construir]);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
    expect(estado.jobs.tarefas.porId.t1).not.toHaveProperty('mercadoria');
    expect(estado.jobs.tarefas.porId.t1).not.toHaveProperty('origem');
  });
});

describe('F11b — elegibilidade por tipo de tarefa', () => {
  it('material-para-obra so e elegivel para serf; construir so para laborer', () => {
    expect(elegivelParaTarefa('material-para-obra', 'serf')).toBe(true);
    expect(elegivelParaTarefa('material-para-obra', 'laborer')).toBe(false);
    expect(elegivelParaTarefa('construir', 'laborer')).toBe(true);
    expect(elegivelParaTarefa('construir', 'serf')).toBe(false);
  });

  it('TIPO_QUE_CONSTROI e laborer', () => {
    expect(TIPO_QUE_CONSTROI).toBe('laborer');
  });

  it('criarTarefaDeConstrucao cria uma tarefa aberta, sem mercadoria/origem', () => {
    const { state, id } = criarTarefaDeConstrucao(inicial, 'obra-a');
    const t = state.jobs.tarefas.porId[id];
    expect(t).toEqual({ id, numero: expect.any(Number), tipo: 'construir', destino: 'obra-a', estado: 'aberta', reclamadaPor: null });
  });
});

describe('F11b — tarefasEmOrdem exclui construir da escada', () => {
  it('nao quebra com uma tarefa de construir no quadro', () => {
    const [serf1] = serfsDoCenario(inicial);
    if (!serf1) throw new Error('fixture: sem serf');
    const material = tarefaDe({ numero: 1 });
    const construir: TarefaConstruir = { id: 't2', numero: 2, tipo: 'construir', destino: 'obra-a', estado: 'aberta', reclamadaPor: null };
    const estado = comTarefas(cenarioLigado(), [material, construir]);
    expect(() => tarefasEmOrdem(estado)).not.toThrow();
    expect(tarefasEmOrdem(estado).map((t) => t.id)).toEqual(['t1']);
    expect(tarefasEmOrdem(estado, serf1).map((t) => t.id)).toEqual(['t1']);
  });
});

describe('F11b — reclamar tarefa de construir', () => {
  const cenarioComObra = () => comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2 } });

  it('so laborer reclama; serf e recusado com unidade-invalida', () => {
    const [serf1] = serfsDoCenario(inicial);
    const [laborer1] = laborersDoCenario(inicial);
    if (!serf1 || !laborer1) throw new Error('fixture: sem serf/laborer');
    const { state, id } = criarTarefaDeConstrucao(cenarioComObra(), 'obra-a');
    expect(reclamar(state, id, serf1)).toEqual({ ok: false, motivo: 'unidade-invalida' });
    expect(reclamar(state, id, laborer1).ok).toBe(true);
  });

  it('respeita o teto de laborersMaximosPorObra (4 no dado real)', () => {
    const teto = gameData.construcao.laborersMaximosPorObra;
    let estado = cenarioComObra();
    const laborers: string[] = [];
    for (let i = 0; i < teto + 1; i++) {
      const id = `laborer-extra-${i}`;
      estado = comUnidadeExtra(estado, id, 'laborer', 10 + i, 10);
      laborers.push(id);
    }
    for (let i = 0; i < teto; i++) {
      const { state: comMaisUma, id } = criarTarefaDeConstrucao(estado, 'obra-a');
      const laborerId = laborers[i];
      if (laborerId === undefined) throw new Error('fixture: laborer faltando');
      const r = reclamar(comMaisUma, id, laborerId);
      expect(r.ok, `laborer #${i}`).toBe(true);
      estado = r.ok ? r.state : comMaisUma;
    }
    const { state: comAQuinta, id: quinta } = criarTarefaDeConstrucao(estado, 'obra-a');
    const quintoLaborer = laborers[teto];
    if (quintoLaborer === undefined) throw new Error('fixture: laborer faltando');
    expect(reclamar(comAQuinta, quinta, quintoLaborer)).toMatchObject({ ok: false, motivo: 'destino-sem-vaga' });
  });
});
