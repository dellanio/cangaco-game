/**
 * F10 — o ciclo em duas fases no JobBoard: `reclamada` (indo buscar: reserva a origem E o
 * destino) -> `carregando` (a coleta consumiu a reserva da origem: a unidade leva o
 * recurso; sobra so a reserva do destino) -> entregue (a tarefa some).
 *
 * Aqui so o estado do quadro (reservas, liberar, sanear). A FSM do serf, que faz as
 * transicoes, e a Task seguinte.
 */
import { describe, it, expect } from 'vitest';
import type { GameState, PredioCompleto, TarefaMaterialParaObra } from '../src/sim/state';
import { liberar, reclamar } from '../src/sim/jobs';
import type { MotivoDeLiberacao } from '../src/sim/jobs';
import { disponivelNaOrigem, reservadoNaOrigem, reservadoNoDestino, vagaNoDestino } from '../src/sim/reservas';
import { gerarTarefas, sanearTarefas } from '../src/sim/systems/jobs';
import { deepFreeze } from './helpers/determinism';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import {
  armazemDoCenario, cenarioLigado, comObra, comPedraNaSaida, comTarefas, inicial, semAUnidade, semOPredio,
  serfsDoCenario, tarefaDe, tile,
} from './helpers/jobs-cenario';

const armazem = armazemDoCenario(inicial);
const serfsIniciais = serfsDoCenario(inicial);
const serfNo = (i: number): string => {
  const id = serfsIniciais[i];
  if (id === undefined) throw new Error(`fixture: o cenario deveria ter o serf ${i}`);
  return id;
};
const serf1 = serfNo(0);
const serf2 = serfNo(1);

const carregando = (numero: number, serf: string, extra: Partial<TarefaMaterialParaObra> = {}): TarefaMaterialParaObra =>
  tarefaDe({ numero, estado: 'carregando', reclamadaPor: serf, ...extra });
const reclamada = (numero: number, serf: string, extra: Partial<TarefaMaterialParaObra> = {}): TarefaMaterialParaObra =>
  tarefaDe({ numero, estado: 'reclamada', reclamadaPor: serf, ...extra });

/** Uma tarefa `carregando` valida de pedra: obra-a pede 2, a unidade ja pegou 1. */
const comUmaCarregando = (): GameState => comTarefas(cenarioLigado({ stone: 2 }), [carregando(1, serf1)]);

/**
 * Um tick do QUADRO: `sanearTarefas` e depois `gerarTarefas`, sem os serfs. Aqui se testa o
 * JobBoard; o serf real (F10) agiria sobre as tarefas no mesmo tick (o teste da FSM e outro
 * arquivo). Os eventos do saneamento ficam em `events`, como no `step`.
 */
function tickDoQuadro(estado: GameState): GameState {
  const saneado = sanearTarefas(estado);
  return { ...gerarTarefas(saneado.state), events: saneado.events };
}

const semOTile = (estado: GameState, chave: string): GameState => ({
  ...estado, estradas: Object.fromEntries(Object.entries(estado.estradas).filter(([k]) => k !== chave)) as GameState['estradas'],
});

// F11b: so as tarefas de material — este arquivo testa o ciclo reclamada->carregando do
// serf; 'construir' (sem 'carregando') nao faz parte do universo destes testes.
const tarefasDe = (estado: GameState): TarefaMaterialParaObra[] =>
  estado.jobs.tarefas.ordem
    .map((id) => estado.jobs.tarefas.porId[id])
    .filter((t): t is TarefaMaterialParaObra => t !== undefined && t.tipo === 'material-para-obra');
const liberacoes = (estado: GameState): unknown[] => estado.events.filter((e) => e.type === 'task-released');

describe('F10 — reservas entre as duas fases', () => {
  it('a tarefa carregando NAO reserva a origem (a coleta a consumiu) e AINDA reserva o destino', () => {
    const estado = comUmaCarregando();
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(0);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(1);
    expect(vagaNoDestino(estado, 'obra-a', 'stone')).toBe(1); // faltam 2 - 1 reservado
  });

  it('a reclamada reserva as DUAS pontas; a mesma tarefa carregando so uma: a coleta libera a origem', () => {
    const antes = comTarefas(cenarioLigado({ stone: 2 }), [reclamada(1, serf1)]);
    const depois = comTarefas(cenarioLigado({ stone: 2 }), [carregando(1, serf1)]);
    expect(reservadoNaOrigem(antes, armazem.id, 'stone')).toBe(1);
    expect(reservadoNaOrigem(depois, armazem.id, 'stone')).toBe(0);
    expect(reservadoNoDestino(antes, 'obra-a', 'stone')).toBe(reservadoNoDestino(depois, 'obra-a', 'stone'));
  });

  it('reclamada e carregando somam no destino (a vaga e uma so)', () => {
    const estado = comTarefas(cenarioLigado({ stone: 3 }), [reclamada(1, serf1), carregando(2, serf2)]);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(2);
    expect(vagaNoDestino(estado, 'obra-a', 'stone')).toBe(1);
  });

  it('o disponivel na origem nao depende de tarefa carregando', () => {
    const base = cenarioLigado({ stone: 2 });
    expect(disponivelNaOrigem(comTarefas(base, [carregando(1, serf1)]), armazem.id, 'stone'))
      .toBe(disponivelNaOrigem(base, armazem.id, 'stone'));
  });

  it('uma unidade com tarefa carregando esta ocupada: nao reclama outra', () => {
    const estado = comTarefas(cenarioLigado({ stone: 3 }), [carregando(1, serf1), tarefaDe({ numero: 2 })]);
    expect(reclamar(estado, 't2', serf1)).toEqual({ ok: false, motivo: 'unidade-ocupada' });
  });

  it('o JSON de ida e volta preserva um quadro com tarefa carregando', () => {
    const estado = comUmaCarregando();
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });
});

describe('F10 — liberar uma tarefa carregando: sempre CANCELA (a carga volta a um armazem, nao necessariamente o de origem)', () => {
  it.each<MotivoDeLiberacao>([
    'unidade-removida', 'pedido-da-unidade', 'caminho-cortado', 'origem-sumiu', 'origem-sem-recurso', 'destino-sumiu', 'destino-completo',
  ])('motivo %s: a tarefa some, a reserva do destino volta, o evento diz cancelada', (motivo) => {
    const estado = comUmaCarregando();
    const r = liberar(estado, 't1', motivo);
    expect(r.state.jobs.tarefas.porId.t1).toBeUndefined();
    expect(r.state.jobs.tarefas.ordem).toEqual([]);
    expect(reservadoNoDestino(r.state, 'obra-a', 'stone')).toBe(0);
    expect(r.events).toEqual([{ type: 'task-released', tarefa: 't1', motivo, resultado: 'cancelada' }]);
  });

  it('e o `pedido-da-unidade`, que numa reclamada REABRE, aqui cancela: nao ha como reabrir com a origem consumida', () => {
    const reclamadaAntes = comTarefas(cenarioLigado({ stone: 2 }), [reclamada(1, serf1)]);
    expect(liberar(reclamadaAntes, 't1', 'pedido-da-unidade').events).toMatchObject([{ resultado: 'reaberta' }]);
    expect(liberar(comUmaCarregando(), 't1', 'pedido-da-unidade').events).toMatchObject([{ resultado: 'cancelada' }]);
  });
});

describe('F10 — sanearTarefas sobre uma tarefa carregando: so olha unidade, destino e vaga', () => {
  it('uma carregando valida sobrevive a ticks sem evento nenhum', () => {
    let estado = comUmaCarregando();
    for (let i = 0; i < 5; i++) estado = tickDoQuadro(estado);
    expect(estado.jobs.tarefas.porId.t1?.estado).toBe('carregando');
    expect(estado.jobs.tarefas.porId.t1?.reclamadaPor).toBe(serf1);
    // obra pede 2 e uma ja esta na mao: o gerador cria so a que falta, uma vez
    expect(tarefasDe(estado).map((t) => t.estado)).toEqual(['carregando', 'aberta']);
    expect(liberacoes(estado)).toEqual([]);
  });

  it('a ORIGEM sumir nao cancela: a coleta ja aconteceu', () => {
    const depois = tickDoQuadro(semOPredio(comUmaCarregando(), armazem.id));
    expect(tarefasDe(depois).map((t) => t.estado)).toEqual(['carregando']);
    expect(liberacoes(depois)).toEqual([]);
  });

  it('a origem sem estoque nao cancela', () => {
    const depois = tickDoQuadro(comPedraNaSaida(comUmaCarregando(), armazem.id, 0));
    expect(tarefasDe(depois).map((t) => t.estado)).toEqual(['carregando']);
  });

  it('a estrada cortada entre as portas de origem e destino nao cancela aqui: o caminho do serf carregado e da FSM', () => {
    const depois = tickDoQuadro(semOTile(comUmaCarregando(), '29,35'));
    expect(tarefasDe(depois).map((t) => t.estado)).toEqual(['carregando']);
    expect(liberacoes(depois)).toEqual([]);
  });

  it('destino que sumiu: cancela com `destino-sumiu`', () => {
    const depois = tickDoQuadro(semOPredio(comUmaCarregando(), 'obra-a'));
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa: 't1', motivo: 'destino-sumiu', resultado: 'cancelada' }]);
    expect(reservadoNoDestino(depois, 'obra-a', 'stone')).toBe(0);
  });

  it('destino que virou predio completo: cancela com `destino-completo`', () => {
    const completo: PredioCompleto = {
      id: 'obra-a', tipo: 'quarry', gx: 26, gy: 34, estado: 'completo', hp: 250,
      capacidade: { entrada: 5, saida: 5 }, estoque: { entrada: {}, saida: {} },
      ocupante: null,
    };
    const estado = comUmaCarregando();
    const depois = tickDoQuadro({ ...estado, predios: { ...estado.predios, porId: { ...estado.predios.porId, 'obra-a': completo } } });
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa: 't1', motivo: 'destino-completo', resultado: 'cancelada' }]);
  });

  it('destino sem mais vaga (faltam abaixo do reservado): cancela com `destino-completo`', () => {
    const estado = comTarefas(comObra(semOPredio(cenarioLigado({ stone: 2 }), 'obra-a'), 'obra-a', { gx: 26, gy: 34, faltam: { stone: 0 } }), [carregando(1, serf1)]);
    const depois = tickDoQuadro(estado);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa: 't1', motivo: 'destino-completo', resultado: 'cancelada' }]);
  });

  it('unidade removida: CANCELA (nao reabre): a carga se perdeu com ela', () => {
    const depois = tickDoQuadro(semAUnidade(comUmaCarregando(), serf1));
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa: 't1', motivo: 'unidade-removida', resultado: 'cancelada' }]);
    expect(tarefasDe(depois).filter((t) => t.id === 't1')).toEqual([]);
  });

  it('na disputa por vaga solta a RECLAMADA primeiro, mesmo de numero MENOR: a carregando tem carga na mao', () => {
    // faltam 1, uma reclamada (t3) e uma carregando (t9). Por numero decrescente sairia a t9.
    const estado = comTarefas(cenarioLigado({ stone: 1 }), [reclamada(3, serf1), carregando(9, serf2)]);
    const depois = tickDoQuadro(estado);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa: 't3', motivo: 'destino-completo', resultado: 'cancelada' }]);
    expect(tarefasDe(depois).map((t) => [t.id, t.estado])).toEqual([['t9', 'carregando']]);
  });

  it('e quando so ha carregandas em excesso, solta a de MAIOR numero', () => {
    const estado = comTarefas(cenarioLigado({ stone: 1 }), [carregando(3, serf1), carregando(9, serf2)]);
    const depois = tickDoQuadro(estado);
    expect(liberacoes(depois)).toEqual([{ type: 'task-released', tarefa: 't9', motivo: 'destino-completo', resultado: 'cancelada' }]);
  });
});

describe('F10 — o gerador e o verificador de invariantes conhecem a carregando', () => {
  it('o gerador conta a carregando: obra pedindo 1, uma carregando -> nenhuma tarefa nova, nenhuma cancelada', () => {
    const estado = comTarefas(cenarioLigado({ stone: 1 }), [carregando(1, serf1)]);
    const depois = tickDoQuadro(estado);
    expect(tarefasDe(depois).map((t) => t.id)).toEqual(['t1']);
  });

  it('o verificador aceita uma carregando valida', () => {
    expect(violacoesDeInvariantes(comUmaCarregando())).toEqual([]);
  });

  it('o verificador NAO exige origem nem caminho da origem numa carregando', () => {
    expect(violacoesDeInvariantes(semOPredio(comUmaCarregando(), armazem.id))).toEqual([]);
  });

  it('o verificador reprova uma carregando sem unidade viva e uma carregando sem obra de destino', () => {
    expect(violacoesDeInvariantes(semAUnidade(comUmaCarregando(), serf1)).join('|')).toMatch(/t1.*unidade/);
    expect(violacoesDeInvariantes(semOPredio(comUmaCarregando(), 'obra-a')).join('|')).toMatch(/t1.*destino/);
  });

  it('o verificador reprova duas tarefas na mesma unidade, contando a carregando', () => {
    const estado = comTarefas(cenarioLigado({ stone: 3 }), [carregando(1, serf1), reclamada(2, serf1)]);
    expect(violacoesDeInvariantes(estado).join('|')).toMatch(/tambem segura/);
  });
});

describe('F10 — fsmData carrega o que a FSM precisa e continua JSON puro', () => {
  it('uma unidade com carga, caminho e progresso sobrevive ao JSON e ao congelamento profundo', () => {
    const estado = inicial;
    const comFsm: GameState = {
      ...estado,
      unidades: {
        ...estado.unidades,
        porId: {
          ...estado.unidades.porId,
          [serf1]: {
            ...(estado.unidades.porId[serf1] as NonNullable<(typeof estado.unidades.porId)[string]>),
            fsm: 'indo_entregar',
            fsmData: { tarefa: 't1', carga: 'stone', caminho: [tile(29, 34), tile(29, 35)], progresso: 2 },
          },
        },
      },
    };
    expect(JSON.parse(JSON.stringify(comFsm))).toEqual(comFsm);
    expect(() => deepFreeze(comFsm)).not.toThrow();
  });
});
