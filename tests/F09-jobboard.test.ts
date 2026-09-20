import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto, PredioEmObra, Tarefa } from '../src/sim/state';
import { deepFreeze } from './helpers/determinism';
import { chaveDeTile, distanciaPorEstrada } from '../src/sim/estradas';
import type { TileDeGrid } from '../src/sim/estradas';
import {
  disponivelNaOrigem, reservadoNaOrigem, reservadoNoDestino, vagaNoDestino,
} from '../src/sim/reservas';

// --- montagem (so teste) ---

const inicial = createInitialState(1);
const tile = (gx: number, gy: number): TileDeGrid => ({ gx, gy });

function estradasDe(tiles: readonly TileDeGrid[]): GameState['estradas'] {
  return Object.fromEntries(tiles.map((t) => [chaveDeTile(t), true as const]));
}

function armazemDoCenario(estado: GameState): PredioCompleto {
  const p = estado.predios.ordem.map((id) => estado.predios.porId[id]).find((x) => x?.tipo === 'storehouse');
  if (!p || p.estado !== 'completo') throw new Error('fixture: cenario sem armazem');
  return p;
}

/** Uma obra com `faltam` dado, longe do cenario, so para as consultas de reserva. */
function comObra(estado: GameState, id: string, faltam: Record<string, number>): GameState {
  const obra: PredioEmObra = { id, tipo: 'quarry', gx: 0, gy: 0, estado: 'obra', hp: 0, obra: { faltam } };
  return {
    ...estado,
    predios: { porId: { ...estado.predios.porId, [id]: obra }, ordem: [...estado.predios.ordem, id] },
  };
}

function tarefa(parcial: Partial<Tarefa> & { readonly numero: number }): Tarefa {
  return {
    id: `t${parcial.numero}`,
    tipo: 'material-para-obra',
    mercadoria: 'stone',
    origem: armazemDoCenario(inicial).id,
    destino: 'obra-a',
    estado: 'aberta',
    reclamadaPor: null,
    ...parcial,
  };
}

function comTarefas(estado: GameState, tarefas: readonly Tarefa[]): GameState {
  return {
    ...estado,
    jobs: {
      tarefas: {
        porId: Object.fromEntries(tarefas.map((t) => [t.id, t])),
        ordem: tarefas.map((t) => t.id),
      },
    },
  };
}

describe('F09 — o JobBoard no GameState', () => {
  it('o estado inicial nasce com o quadro vazio', () => {
    expect(inicial.jobs.tarefas.ordem).toEqual([]);
    expect(inicial.jobs.tarefas.porId).toEqual({});
  });

  it('um quadro com tarefas reclamadas e abertas sobrevive ao JSON de ida e volta', () => {
    const estado = comTarefas(comObra(inicial, 'obra-a', { stone: 2 }), [
      tarefa({ numero: 1, estado: 'reclamada', reclamadaPor: 'u1' }),
      tarefa({ numero: 2 }),
    ]);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });
});

describe('F09 — a reserva e DERIVADA das tarefas reclamadas', () => {
  const armazem = armazemDoCenario(inicial);
  const base = comObra(inicial, 'obra-a', { stone: 3, timber: 2 });

  it('so a tarefa reclamada reserva; a aberta nao reserva nada', () => {
    const estado = comTarefas(base, [
      tarefa({ numero: 1, estado: 'reclamada', reclamadaPor: 'u1' }),
      tarefa({ numero: 2, estado: 'reclamada', reclamadaPor: 'u2' }),
      tarefa({ numero: 3 }),
    ]);
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(2);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(2);
  });

  it('a reserva e por predio E por mercadoria', () => {
    const estado = comTarefas(base, [
      tarefa({ numero: 1, estado: 'reclamada', reclamadaPor: 'u1' }),
      tarefa({ numero: 2, mercadoria: 'timber', estado: 'reclamada', reclamadaPor: 'u2' }),
    ]);
    expect(reservadoNaOrigem(estado, armazem.id, 'stone')).toBe(1);
    expect(reservadoNaOrigem(estado, armazem.id, 'timber')).toBe(1);
    expect(reservadoNaOrigem(estado, armazem.id, 'gold')).toBe(0);
    expect(reservadoNoDestino(estado, 'obra-a', 'stone')).toBe(1);
    expect(reservadoNoDestino(estado, 'outra-obra', 'stone')).toBe(0);
  });

  it('disponivel na origem = saida - reservado; vaga no destino = faltam - reservado', () => {
    const noArmazem = armazem.estoque.saida.stone ?? 0;
    const estado = comTarefas(base, [
      tarefa({ numero: 1, estado: 'reclamada', reclamadaPor: 'u1' }),
      tarefa({ numero: 2, estado: 'reclamada', reclamadaPor: 'u2' }),
    ]);
    expect(disponivelNaOrigem(estado, armazem.id, 'stone')).toBe(noArmazem - 2);
    expect(vagaNoDestino(estado, 'obra-a', 'stone')).toBe(3 - 2);
    // sem tarefa nenhuma, nada foi descontado
    expect(disponivelNaOrigem(base, armazem.id, 'stone')).toBe(noArmazem);
    expect(vagaNoDestino(base, 'obra-a', 'stone')).toBe(3);
  });

  it('prédio que nao e armazem completo nao tem disponivel; que nao e obra nao tem vaga', () => {
    expect(disponivelNaOrigem(base, 'obra-a', 'stone')).toBe(0);
    expect(vagaNoDestino(base, armazem.id, 'stone')).toBe(0);
    expect(disponivelNaOrigem(base, 'nao-existe', 'stone')).toBe(0);
    expect(vagaNoDestino(base, 'nao-existe', 'stone')).toBe(0);
  });

  it('nao ha contador para dessincronizar: tirar a tarefa tira a reserva', () => {
    const reclamada = comTarefas(base, [tarefa({ numero: 1, estado: 'reclamada', reclamadaPor: 'u1' })]);
    expect(reservadoNaOrigem(reclamada, armazem.id, 'stone')).toBe(1);
    expect(reservadoNaOrigem(comTarefas(base, []), armazem.id, 'stone')).toBe(0);
  });
});

describe('F09 — distanciaPorEstrada: caminho a pe pela rede, nunca reta', () => {
  it('em reta pela estrada: o nº de passos', () => {
    const estradas = estradasDe([0, 1, 2, 3, 4].map((x) => tile(x, 0)));
    expect(distanciaPorEstrada(estradas, [tile(0, 0)], [tile(4, 0)])).toBe(4);
  });

  it('a volta conta inteira: dois pontos vizinhos em linha reta, longe pela estrada', () => {
    // A(0,0) e B(2,0) estao a 2 tiles de distancia direta, mas a estrada dá a volta por baixo
    const volta = estradasDe([tile(0, 0), tile(0, 1), tile(0, 2), tile(1, 2), tile(2, 2), tile(2, 1), tile(2, 0)]);
    expect(distanciaPorEstrada(volta, [tile(0, 0)], [tile(2, 0)])).toBe(6);
    // com o atalho no meio, cai para 2
    const comAtalho = estradasDe([tile(0, 0), tile(1, 0), tile(2, 0)]);
    expect(distanciaPorEstrada(comAtalho, [tile(0, 0)], [tile(2, 0)])).toBe(2);
  });

  it('null quando nao ha caminho, e quando uma das pontas nao e estrada', () => {
    const doisTrechos = estradasDe([tile(0, 0), tile(1, 0), tile(5, 0), tile(6, 0)]);
    expect(distanciaPorEstrada(doisTrechos, [tile(0, 0)], [tile(6, 0)])).toBeNull();
    expect(distanciaPorEstrada(doisTrechos, [tile(0, 0)], [tile(3, 3)])).toBeNull();
    expect(distanciaPorEstrada(doisTrechos, [tile(9, 9)], [tile(0, 0)])).toBeNull();
    expect(distanciaPorEstrada({}, [tile(0, 0)], [tile(1, 0)])).toBeNull();
  });

  it('o mesmo tile de estrada esta a distancia 0', () => {
    const estradas = estradasDe([tile(3, 3)]);
    expect(distanciaPorEstrada(estradas, [tile(3, 3)], [tile(3, 3)])).toBe(0);
  });

  it('com varias portas de cada lado vale a menor distancia entre qualquer par', () => {
    const estradas = estradasDe([0, 1, 2, 3, 4, 5].map((x) => tile(x, 0)));
    expect(distanciaPorEstrada(estradas, [tile(0, 0), tile(2, 0)], [tile(5, 0), tile(4, 0)])).toBe(2);
  });

  it('diagonal nao e passo: dois tiles em diagonal nao se ligam', () => {
    expect(distanciaPorEstrada(estradasDe([tile(0, 0), tile(1, 1)]), [tile(0, 0)], [tile(1, 1)])).toBeNull();
  });

  it('e pura e determinista: mesma resposta em chamadas repetidas, sobre estradas congeladas', () => {
    const estradas = deepFreeze(estradasDe([0, 1, 2, 3].map((x) => tile(x, 0))));
    const a = distanciaPorEstrada(estradas, [tile(0, 0)], [tile(3, 0)]);
    const b = distanciaPorEstrada(estradas, [tile(0, 0)], [tile(3, 0)]);
    expect([a, b]).toEqual([3, 3]);
  });
});
