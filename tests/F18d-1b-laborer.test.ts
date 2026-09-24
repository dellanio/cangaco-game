/**
 * F18d-1b — o laborer assenta um tile do canteiro.
 *
 * D1 do plano: tile planejado e obra, e por isso a FSM NAO ganha estado novo. O
 * laborer reclama, caminha (`indo_a_obra`), martela um ciclo (`martelando`) e
 * volta a `ocioso`. `esperando_material` nao acontece: a pedra nao viaja com ele
 * — ela sai do armazem que a tarefa reservou, no tick do assentamento.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { criarTarefaDeAssentamento } from '../src/sim/jobs';
import { chaveDeTile, ehEstrada, ehPlanejada, MERCADORIA_DA_ESTRADA } from '../src/sim/estradas';
import { disponivelNaOrigem, reservadoNaOrigem } from '../src/sim/reservas';
import type { GameState } from '../src/sim/state';
import { comPedraNaSaida, comPlanejadas, inicial, laborersDoCenario, tile } from './helpers/jobs-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { ESTADOS_DO_LABORER, violacoesDaFsmDoLaborer } from './helpers/laborer-invariantes';
import { bensPorMercadoria } from './helpers/serf-invariantes';
import { ate, fsmDe } from './helpers/serf-cenario';

/** Colado no laborer u7 (34,34): a viagem e curta de proposito, o que se mede aqui
 *  e o assentamento, nao o pathfinding. */
const CANTEIRO = tile(34, 33);
const ARMAZEM = 'p1';

function comOCanteiro(): { readonly estado: GameState; readonly tarefa: string } {
  const criada = criarTarefaDeAssentamento(comPlanejadas(inicial, [CANTEIRO]), CANTEIRO);
  if (criada === null) throw new Error('fixture: o armazem inicial tem pedra e a tarefa nao nasceu');
  return { estado: criada.state, tarefa: criada.id };
}

const assentado = (e: GameState): boolean => ehEstrada(e.estradas, CANTEIRO);

describe('F18d-1b — o ciclo do assentamento', () => {
  it('o tile sai do canteiro e entra na rede de pe, e a FSM continua com cinco estados', () => {
    const { estado } = comOCanteiro();
    expect(ehPlanejada(estado.estradasPlanejadas, CANTEIRO)).toBe(true);
    expect(ehEstrada(estado.estradas, CANTEIRO)).toBe(false);

    const laborer = laborersDoCenario(estado)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    const reclamou = step(estado, []);
    expect(fsmDe(reclamou, laborer)).toBe('indo_a_obra');

    const pronto = ate(estado, assentado, 'o tile planejado vira estrada de pe');
    expect(ehPlanejada(pronto.estradasPlanejadas, CANTEIRO)).toBe(false);
    expect(Object.keys(pronto.estradas)).toEqual([chaveDeTile(CANTEIRO)]);
    // e o laborer volta ao comeco, sem tarefa pendurada
    const depois = step(pronto, []);
    expect(fsmDe(depois, laborer)).toBe('ocioso');
    expect(depois.jobs.tarefas.ordem).toEqual([]);

    expect(ESTADOS_DO_LABORER).toHaveLength(5);
  });

  it('o assentamento debita EXATAMENTE uma pedra, e a reserva some junto com a tarefa', () => {
    const { estado } = comOCanteiro();
    const custo = gameData.terreno.estrada.custoStonePorTile;
    const antes = bensPorMercadoria(estado).stone ?? 0;
    expect(reservadoNaOrigem(estado, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(custo);

    const pronto = ate(estado, assentado, 'o tile e assentado');
    expect((bensPorMercadoria(pronto).stone ?? 0)).toBe(antes - custo);
    expect(reservadoNaOrigem(pronto, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(0);
    expect(disponivelNaOrigem(pronto, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(30 - custo);
  });

  it('a invariante da FSM continua ACUSANDO: assentando sem a tarefa na mao', () => {
    // a mesma invariante que parou de reclamar do assentamento legitimo tem de
    // reclamar quando a tarefa some da mao do laborer — senao ela so foi calada.
    const { estado, tarefa: tarefaId } = comOCanteiro();
    const laborer = laborersDoCenario(estado)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    const martelando = ate(estado, (e) => fsmDe(e, laborer) === 'martelando', 'o laborer chega e martela');
    const u = martelando.unidades.porId[laborer];
    if (u === undefined) throw new Error('fixture: o laborer sumiu');
    const orfao: GameState = {
      ...martelando,
      unidades: { ...martelando.unidades, porId: { ...martelando.unidades.porId, [laborer]: { ...u, fsmData: {} } } },
    };
    // as DUAS metades da invariante acusam: a do laborer sem tarefa e a da tarefa sem dono.
    expect(violacoesDaFsmDoLaborer(orfao)).toEqual([
      `${laborer}: martelando sem tarefa de laborer reclamada por ele`,
      `${tarefaId}: o laborer ${laborer} nao a reconhece (fsmData.tarefa='undefined')`,
    ]);
  });

  it('as invariantes ficam vazias em TODO tick da corrida', () => {
    let atual = comOCanteiro().estado;
    for (let i = 0; i < 40; i += 1) {
      atual = step(atual, []);
      expect(violacoesDeInvariantes(atual)).toEqual([]);
      expect(violacoesDaFsmDoLaborer(atual)).toEqual([]);
    }
    expect(assentado(atual)).toBe(true);
  });
});

describe('F18d-1b — os ramos de falha devolvem a reserva', () => {
  it('o tile sai do canteiro no meio da viagem: o laborer volta a ocioso, sem reserva', () => {
    const { estado, tarefa } = comOCanteiro();
    const laborer = laborersDoCenario(estado)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    const andando = step(estado, []);
    expect(fsmDe(andando, laborer)).toBe('indo_a_obra');

    const semCanteiro = step({ ...andando, estradasPlanejadas: {} }, []);
    expect(semCanteiro.jobs.tarefas.porId[tarefa]).toBeUndefined();
    expect(reservadoNaOrigem(semCanteiro, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(0);
    expect(fsmDe(semCanteiro, laborer)).toBe('ocioso');
    expect(violacoesDaFsmDoLaborer(semCanteiro)).toEqual([]);
  });

  it('o armazem ficou sem pedra na hora de assentar: a tarefa sai, e nada fica negativo', () => {
    const { estado, tarefa } = comOCanteiro();
    const laborer = laborersDoCenario(estado)[0];
    if (laborer === undefined) throw new Error('fixture: cenario sem laborer');
    const martelando = ate(estado, (e) => fsmDe(e, laborer) === 'martelando', 'o laborer chega e martela');
    const seco = comPedraNaSaida(martelando, ARMAZEM, 0);

    const depois = ate(seco, (e) => e.jobs.tarefas.porId[tarefa] === undefined, 'a tarefa sai do quadro');
    expect(ehEstrada(depois.estradas, CANTEIRO)).toBe(false);
    expect(ehPlanejada(depois.estradasPlanejadas, CANTEIRO)).toBe(true);
    expect(disponivelNaOrigem(depois, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(0);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
    expect(fsmDe(step(depois, []), laborer)).toBe('ocioso');
  });
});
