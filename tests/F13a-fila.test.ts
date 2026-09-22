/**
 * F13a — a fila de treino da escola: os dois comandos e o relogio.
 * O caminho do ouro (serf, JobBoard) esta em `F13a-ouro.test.ts`; o aceite do
 * BUILD_PLAN, ponta a ponta, em `F13a-aceite.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState, ItemDeFila } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { filaDaEscola } from '../src/sim/escola';
import { tilesDaPorta } from '../src/sim/estradas';
import {
  armazemPorTipo, avancar, cancelar, comOuroNaEscola, escolaDoCenario, novasUnidades,
  ouroNaEscola, pedir,
} from './helpers/escola-cenario';
import { semOPredio } from './helpers/jobs-cenario';

const inicial = createInitialState(1);
const ESCOLA = escolaDoCenario(inicial).id;
const ARMAZEM = armazemPorTipo(inicial).id;
const { custoOuroPorUnidade: CUSTO, slotsDeFila: SLOTS, ticksPorTreino: TICKS } =
  gameData.economia.schoolhouse;

const primeiro = (estado: GameState): ItemDeFila => {
  const item = filaDaEscola(estado, ESCOLA)[0];
  if (item === undefined) throw new Error('fila vazia');
  return item;
};

describe('F13a — EnqueueTraining', () => {
  it('escola sem pedido nao tem entrada em `treino`', () => {
    expect(inicial.treino).toEqual({});
    expect(filaDaEscola(inicial, ESCOLA)).toEqual([]);
  });

  it('tres pedidos entram na ordem, todos `aguardando`, com ids distintos', () => {
    const depois = step(inicial, [
      pedir(ESCOLA, 'stonemason'), pedir(ESCOLA, 'woodcutter'), pedir(ESCOLA, 'serf'),
    ]);
    const fila = filaDaEscola(depois, ESCOLA);
    expect(fila.map((i) => i.unidade)).toEqual(['stonemason', 'woodcutter', 'serf']);
    expect(fila.every((i) => i.estado === 'aguardando')).toBe(true);
    expect(new Set(fila.map((i) => i.id)).size).toBe(3);
    // Enfileirar NAO cobra ouro (a cobranca e no inicio do treino).
    expect(ouroNaEscola(depois, ESCOLA)).toBe(0);
  });

  it('passar do teto de slots recusa o excedente e para a fila no teto', () => {
    const depois = step(inicial, Array.from({ length: SLOTS + 1 }, () => pedir(ESCOLA, 'serf')));
    expect(filaDaEscola(depois, ESCOLA)).toHaveLength(SLOTS);
    expect(depois.events).toContainEqual({
      type: 'command-rejected', command: 'EnqueueTraining',
      predio: ESCOLA, unidade: 'serf', motivo: 'fila-cheia',
    });
  });

  it('recusa predio inexistente, predio que nao e escola e tipo desconhecido', () => {
    const depois = step(inicial, [
      pedir('p999', 'serf'), pedir(ARMAZEM, 'serf'), pedir(ESCOLA, 'cangaceiro'),
    ]);
    const motivos = depois.events.flatMap((e) =>
      e.type === 'command-rejected' && e.command === 'EnqueueTraining' ? [e.motivo] : []);
    expect(motivos).toEqual(['predio-inexistente', 'nao-e-escola', 'unidade-desconhecida']);
    expect(depois.treino).toEqual({});
  });
});

describe('F13a — CancelTraining', () => {
  const comTres = step(inicial, [
    pedir(ESCOLA, 'stonemason'), pedir(ESCOLA, 'woodcutter'), pedir(ESCOLA, 'serf'),
  ]);

  it('tira o item pedido e preserva a ordem dos outros', () => {
    const alvo = filaDaEscola(comTres, ESCOLA)[1] as ItemDeFila;
    const depois = step(comTres, [cancelar(ESCOLA, alvo.id)]);
    expect(filaDaEscola(depois, ESCOLA).map((i) => i.unidade)).toEqual(['stonemason', 'serf']);
  });

  it('cancelar o ultimo item APAGA a entrada de `treino`', () => {
    const um = step(inicial, [pedir(ESCOLA, 'serf')]);
    const depois = step(um, [cancelar(ESCOLA, primeiro(um).id)]);
    expect(depois.treino).toEqual({});
  });

  it('item inexistente e escola inexistente sao no-op, nunca recusa', () => {
    const depois = step(comTres, [cancelar(ESCOLA, 'f999'), cancelar('p999', 'f1')]);
    expect(filaDaEscola(depois, ESCOLA)).toHaveLength(3);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
  });
});

describe('F13a — sistemaDasEscolas', () => {
  // Ouro posto direto na escola: aqui se observa o RELOGIO da fila. O produtor de
  // verdade (o serf) esta na suite do ouro e no aceite.
  const base = comOuroNaEscola(step(inicial, [pedir(ESCOLA, 'stonemason')]), ESCOLA, CUSTO);

  it('cobra o ouro no tick em que o treino comeca, e so entao conta', () => {
    const t1 = step(base, []);
    expect(ouroNaEscola(t1, ESCOLA)).toBe(0);
    expect(primeiro(t1)).toEqual({
      id: primeiro(base).id, unidade: 'stonemason', estado: 'treinando', restam: TICKS,
    });
  });

  it('sem ouro o item fica `aguardando` e nada e gasto', () => {
    const semOuro = step(inicial, [pedir(ESCOLA, 'serf')]);
    const depois = avancar(semOuro, 50);
    expect(primeiro(depois).estado).toBe('aguardando');
    expect(novasUnidades(inicial, depois)).toEqual([]);
  });

  it('ao fim do treino a unidade nasce na PORTA da escola e o item sai da fila', () => {
    const fim = avancar(base, TICKS + 1);
    const novas = novasUnidades(inicial, fim);
    expect(novas).toHaveLength(1);
    const nova = novas[0] as NonNullable<(typeof novas)[number]>;
    expect(nova.tipo).toBe('stonemason');
    expect({ gx: nova.gx, gy: nova.gy }).toEqual(tilesDaPorta(escolaDoCenario(fim))[0]);
    expect(nova.fsm).toBe('ocioso');
    expect(fim.treino).toEqual({});
    expect(fim.events).toContainEqual({
      type: 'unit-trained', predio: ESCOLA, unidade: nova.id, tipo: 'stonemason',
    });
  });

  it('nao nasce antes da hora: um tick a menos e a fila ainda tem o item', () => {
    const antes = avancar(base, TICKS);
    expect(primeiro(antes).estado).toBe('treinando');
    expect(novasUnidades(inicial, antes)).toEqual([]);
  });

  it('treina UM item por vez, na ordem da fila', () => {
    const dois = comOuroNaEscola(step(base, [pedir(ESCOLA, 'woodcutter')]), ESCOLA, CUSTO * 2);
    const meio = avancar(dois, 5);
    expect(filaDaEscola(meio, ESCOLA).map((i) => i.estado)).toEqual(['treinando', 'aguardando']);
  });

  it('escola demolida leva a fila junto (saneamento)', () => {
    expect(step(semOPredio(base, ESCOLA), []).treino).toEqual({});
  });
});

describe('F13a — cancelamento x ouro (a regra do BUILD_PLAN)', () => {
  it('cancelar antes de comecar nao custa; cancelar depois nao devolve', () => {
    // Ouro para UM treino, dois pedidos na fila.
    const dois = comOuroNaEscola(
      step(inicial, [pedir(ESCOLA, 'serf'), pedir(ESCOLA, 'laborer')]), ESCOLA, CUSTO,
    );
    const comecou = step(dois, []);
    expect(ouroNaEscola(comecou, ESCOLA)).toBe(0);

    const queEspera = filaDaEscola(comecou, ESCOLA)[1] as ItemDeFila;
    expect(ouroNaEscola(step(comecou, [cancelar(ESCOLA, queEspera.id)]), ESCOLA)).toBe(0);

    const queTreina = primeiro(comecou);
    const abortado = step(comecou, [cancelar(ESCOLA, queTreina.id)]);
    expect(ouroNaEscola(abortado, ESCOLA)).toBe(0); // gasto e gasto
    // O treino abortado nao gera unidade, e o item que sobrou nao tem ouro para comecar.
    expect(novasUnidades(inicial, avancar(abortado, TICKS + 5))).toEqual([]);
  });
});
