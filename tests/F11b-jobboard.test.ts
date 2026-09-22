import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { TarefaConstruir } from '../src/sim/state';
import {
  criarTarefaDeConstrucao, elegivelParaTarefa, reclamar, TIPO_QUE_CONSTROI, tarefasEmOrdem,
} from '../src/sim/jobs';
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';
import { gravarEvidencia } from './helpers/evidence';
import {
  cenarioLigado, comObra, comTarefas, comUnidadeExtra, inicial, laborersDoCenario, semAUnidade, semOPredio,
  serfsDoCenario, tarefaDe,
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

describe('F11b — sanearTarefas cobre construir', () => {
  it('unidade removida: reabre a mesma tarefa de construir', () => {
    const [laborer1] = laborersDoCenario(inicial);
    if (!laborer1) throw new Error('fixture: sem laborer');
    const { state, id } = criarTarefaDeConstrucao(comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }), 'obra-a');
    const r = reclamar(state, id, laborer1);
    if (!r.ok) throw new Error('fixture: reclamar deveria aceitar');
    const semOLaborer = semAUnidade(r.state, laborer1);
    const { state: saneado } = sanearTarefas(semOLaborer);
    const t = saneado.jobs.tarefas.porId[id];
    expect(t?.estado).toBe('aberta');
    expect(t?.reclamadaPor).toBeNull();
  });

  it('obra demolida: cancela a tarefa de construir (sem tarefa fantasma)', () => {
    const { state, id } = criarTarefaDeConstrucao(comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }), 'obra-a');
    const semAObra = semOPredio(state, 'obra-a');
    const { state: saneado } = sanearTarefas(semAObra);
    expect(saneado.jobs.tarefas.porId[id]).toBeUndefined();
  });

  it('abertas em excesso: nunca mais construir do que laborersMaximosPorObra', () => {
    const teto = gameData.construcao.laborersMaximosPorObra;
    let estado = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    for (let i = 0; i < teto + 2; i++) {
      estado = criarTarefaDeConstrucao(estado, 'obra-a').state;
    }
    const { state: saneado } = sanearTarefas(estado);
    const construir = saneado.jobs.tarefas.ordem.filter((id) => saneado.jobs.tarefas.porId[id]?.tipo === 'construir');
    expect(construir).toHaveLength(teto);
  });
});

describe('F11b — gerarTarefas cria construir ate o teto', () => {
  it('cria ate laborersMaximosPorObra tarefas de construir por obra, sem exigir estrada', () => {
    const semEstrada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2 } }); // sem comEstradas: nao ligada
    const gerado = gerarTarefas(semEstrada);
    const construir = gerado.jobs.tarefas.ordem.filter((id) => gerado.jobs.tarefas.porId[id]?.tipo === 'construir');
    expect(construir).toHaveLength(gameData.construcao.laborersMaximosPorObra);
    const material = gerado.jobs.tarefas.ordem.filter((id) => gerado.jobs.tarefas.porId[id]?.tipo === 'material-para-obra');
    expect(material).toHaveLength(0); // material continua exigindo estrada
  });

  it('nao duplica construir ja existente: chamar duas vezes fica no teto', () => {
    const obra = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
    const umaVez = gerarTarefas(obra);
    const duasVezes = gerarTarefas(umaVez);
    const contar = (e: typeof obra): number => e.jobs.tarefas.ordem.filter((id) => e.jobs.tarefas.porId[id]?.tipo === 'construir').length;
    expect(contar(duasVezes)).toBe(contar(umaVez));
    expect(contar(umaVez)).toBe(gameData.construcao.laborersMaximosPorObra);
  });
});

afterAll(() => {
  const [serf1] = serfsDoCenario(inicial);
  const [laborer1] = laborersDoCenario(inicial);
  if (!serf1 || !laborer1) throw new Error('evidencia: fixture sem serf/laborer');

  // aceite 1: elegibilidade
  const { state: comConstruirA, id: construirA } = criarTarefaDeConstrucao(
    comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} }), 'obra-a',
  );
  const serfRecusado = reclamar(comConstruirA, construirA, serf1);
  const laborerAceito = reclamar(comConstruirA, construirA, laborer1);

  // aceite 2: teto de 4 recusando o quinto
  const teto = gameData.construcao.laborersMaximosPorObra;
  let comOTeto = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: {} });
  const laborersExtras: string[] = [];
  for (let i = 0; i < teto + 1; i++) {
    const id = `laborer-evidencia-${i}`;
    comOTeto = comUnidadeExtra(comOTeto, id, 'laborer', 10 + i, 10);
    laborersExtras.push(id);
  }
  for (let i = 0; i < teto; i++) {
    const { state, id } = criarTarefaDeConstrucao(comOTeto, 'obra-a');
    const l = laborersExtras[i] ?? laborer1;
    const r = reclamar(state, id, l);
    comOTeto = r.ok ? r.state : state;
  }
  const { state: comQuinta, id: quinta } = criarTarefaDeConstrucao(comOTeto, 'obra-a');
  const quintoLaborer = laborersExtras[teto] ?? laborer1;
  const quintoRecusado = reclamar(comQuinta, quinta, quintoLaborer);

  // aceite 3: gerador cria exatamente o teto, sem estrada
  const semEstrada = comObra(inicial, 'obra-a', { gx: 26, gy: 34, faltam: { stone: 2 } });
  const gerado = gerarTarefas(semEstrada);
  const construirGeradas = gerado.jobs.tarefas.ordem.filter((id) => gerado.jobs.tarefas.porId[id]?.tipo === 'construir');

  gravarEvidencia('F11b', {
    feature: 'F11b-jobboard-construir',
    // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md.
    aceite: {
      elegibilidade: {
        serfRecusado,
        laborerAceito: laborerAceito.ok,
      },
      tetoDeQuatroRecusaOQuinto: {
        laborersMaximosPorObra: teto,
        quintoRecusado,
      },
      geradorCriaExatamenteOTetoSemEstrada: {
        laborersMaximosPorObra: teto,
        construirCriadas: construirGeradas.length,
      },
    },
  });
});
