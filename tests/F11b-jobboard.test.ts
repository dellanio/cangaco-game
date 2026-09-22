import { describe, it, expect } from 'vitest';
import type { TarefaConstruir } from '../src/sim/state';
import { criarTarefaDeConstrucao, elegivelParaTarefa, TIPO_QUE_CONSTROI } from '../src/sim/jobs';
import { cenarioLigado, comTarefas, inicial } from './helpers/jobs-cenario';

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
