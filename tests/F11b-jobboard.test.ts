import { describe, it, expect } from 'vitest';
import type { TarefaConstruir } from '../src/sim/state';
import { cenarioLigado, comTarefas } from './helpers/jobs-cenario';

describe('F11b — Tarefa vira uniao discriminada', () => {
  it('uma tarefa de construir (sem mercadoria/origem) sobrevive ao JSON de ida e volta', () => {
    const construir: TarefaConstruir = { id: 't1', numero: 1, tipo: 'construir', destino: 'obra-a', estado: 'aberta', reclamadaPor: null };
    const estado = comTarefas(cenarioLigado(), [construir]);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
    expect(estado.jobs.tarefas.porId.t1).not.toHaveProperty('mercadoria');
    expect(estado.jobs.tarefas.porId.t1).not.toHaveProperty('origem');
  });
});
