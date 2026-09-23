/**
 * Ajuste pos-F10 (decisao do operador): o HUD mostra o estoque dos ARMAZENS, nao `estoqueTotal`.
 * O numero da barra de recursos precisa prever o que o jogador PODE GASTAR; somar a saida de
 * uma pedreira faria o HUD mostrar pedra que a estrada (F08) e as obras (F10) nao conseguem
 * usar — elas so tiram de armazem. `estoqueTotal` continua existindo para outros usos.
 *
 * Reservado NAO e descontado: a pedra ainda esta la (a previa da estrada ja explica a recusa).
 */
import { describe, it, expect, afterAll, vi } from 'vitest';
import { gameData } from '../src/sim/data';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { estoqueDosArmazens, estoqueTotal } from '../src/sim/selectors';
import { montarHud } from '../src/ui/hud';
import {
  armazemDoCenario, cenarioLigado, comObra, comTarefas, serfsDoCenario, tarefaDe,
} from './helpers/jobs-cenario';

const inicial = createInitialState(1);
const armazem = armazemDoCenario(inicial);

/** Uma pedreira COMPLETA com estoque proprio na saida: o que a F15 vai produzir. */
function comPedreiraComEstoque(estado: GameState, saida: Record<string, number>): GameState {
  const pedreira: PredioCompleto = {
    id: 'p99', tipo: 'quarry', gx: 50, gy: 50, estado: 'completo', hp: 250,
    capacidade: { entrada: null, saida: null }, estoque: { entrada: {}, saida },
    ocupante: null, producao: { progresso: 0, veio: null },
  };
  return { ...estado, predios: { porId: { ...estado.predios.porId, p99: pedreira }, ordem: [...estado.predios.ordem, 'p99'] } };
}

describe('estoqueDosArmazens — o seletor', () => {
  it('no estado inicial e IDENTICO a estoqueTotal (e a tabela do dado): a troca nao muda nada visivel', () => {
    expect(estoqueDosArmazens(inicial)).toEqual(estoqueTotal(inicial));
    expect(estoqueDosArmazens(inicial)).toEqual(gameData.economia.estadoInicial.estoque);
  });

  it('nao conta o estoque de um predio que nao e armazem: e onde os dois numeros passam a divergir', () => {
    const estado = comPedreiraComEstoque(inicial, { stone: 7, timber: 3 });
    expect(estoqueTotal(estado).stone).toBe((estoqueTotal(inicial).stone ?? 0) + 7);
    expect(estoqueDosArmazens(estado).stone).toBe(estoqueDosArmazens(inicial).stone);
    expect(estoqueDosArmazens(estado).timber).toBe(estoqueDosArmazens(inicial).timber);
    expect(estoqueDosArmazens(estado)).toEqual(estoqueDosArmazens(inicial));
  });

  it('soma as DUAS gavetas do armazem (entrada e saida)', () => {
    const base = estoqueDosArmazens(inicial).stone ?? 0;
    const comEntrada: PredioCompleto = { ...armazem, estoque: { ...armazem.estoque, entrada: { ...armazem.estoque.entrada, stone: (armazem.estoque.entrada.stone ?? 0) + 4 } } };
    const estado = { ...inicial, predios: { ...inicial.predios, porId: { ...inicial.predios.porId, [armazem.id]: comEntrada } } };
    expect(estoqueDosArmazens(estado).stone).toBe(base + 4);
  });

  it('soma varios armazens', () => {
    const segundo: PredioCompleto = {
      id: 'p98', tipo: 'storehouse', gx: 40, gy: 10, estado: 'completo', hp: 0,
      capacidade: { entrada: null, saida: null }, estoque: { entrada: {}, saida: { stone: 5 } },
      ocupante: null, producao: null,
    };
    const estado = { ...inicial, predios: { porId: { ...inicial.predios.porId, p98: segundo }, ordem: [...inicial.predios.ordem, 'p98'] } };
    expect(estoqueDosArmazens(estado).stone).toBe((estoqueDosArmazens(inicial).stone ?? 0) + 5);
  });

  it('uma OBRA nao e armazem e nao guarda mercadoria', () => {
    const estado = comObra(inicial, 'obra-x', { gx: 5, gy: 5, faltam: { stone: 2, timber: 3 } });
    expect(estoqueDosArmazens(estado)).toEqual(estoqueDosArmazens(inicial));
  });

  it('o RESERVADO nao e descontado: a pedra ainda esta la', () => {
    const [serf] = serfsDoCenario(inicial);
    if (serf === undefined) throw new Error('fixture: sem serf');
    const semTarefa = cenarioLigado({ stone: 2 });
    const comReserva = comTarefas(semTarefa, [tarefaDe({ numero: 1, estado: 'reclamada', reclamadaPor: serf })]);
    expect(estoqueDosArmazens(comReserva)).toEqual(estoqueDosArmazens(semTarefa));
  });

  it('a mercadoria em TRANSITO (na mao do serf) nao esta em armazem nenhum, e nao conta', () => {
    // a coleta tira do armazem: o numero cai enquanto o serf leva (o HUD da F10 mostrou Tabua 40 -> 38)
    const [serf] = serfsDoCenario(inicial);
    if (serf === undefined) throw new Error('fixture: sem serf');
    const saida = armazem.estoque.saida.stone ?? 0;
    const semUma: PredioCompleto = { ...armazem, estoque: { ...armazem.estoque, saida: { ...armazem.estoque.saida, stone: saida - 1 } } };
    const estado = {
      ...inicial,
      predios: { ...inicial.predios, porId: { ...inicial.predios.porId, [armazem.id]: semUma } },
      unidades: { ...inicial.unidades, porId: { ...inicial.unidades.porId, [serf]: { ...(inicial.unidades.porId[serf] as NonNullable<(typeof inicial.unidades.porId)[string]>), fsm: 'indo_entregar', fsmData: { carga: 'stone' } } } },
    };
    expect(estoqueDosArmazens(estado).stone).toBe((estoqueDosArmazens(inicial).stone ?? 0) - 1);
  });
});

// O vitest roda em `node`: sem DOM. Um `document` falso, do tamanho do que `montarHud` usa
// (getElementById, createElement, append, dataset, className, textContent), basta para provar a
// FIACAO — que o HUD chama o seletor certo — sem varrer o texto do fonte.
class ElementoFalso {
  className = '';
  textContent = '';
  dataset: Record<string, string> = {};
  filhos: ElementoFalso[] = [];
  append(...nos: ElementoFalso[]): void {
    this.filhos.push(...nos);
  }
}

function montarHudFalso(): { hud: ReturnType<typeof montarHud>; valor: (campo: string) => string } {
  const raiz = new ElementoFalso();
  vi.stubGlobal('document', {
    getElementById: (id: string) => (id === 'hud' ? raiz : null),
    createElement: () => new ElementoFalso(),
  });
  const hud = montarHud();
  const valor = (campo: string): string => {
    const linha = raiz.filhos.find((l) => l.filhos[1]?.dataset.campo === campo);
    if (!linha) throw new Error(`fixture: o HUD nao tem o campo '${campo}'`);
    return (linha.filhos[1] as ElementoFalso).textContent;
  };
  return { hud, valor };
}

describe('o HUD mostra o estoque dos armazens (fiacao)', () => {
  afterAll(() => vi.unstubAllGlobals());
  const { hud, valor } = montarHudFalso();
  const estoque = gameData.economia.estadoInicial.estoque;

  it('no estado inicial os tres campos batem com o dado (o que o roteiro da F05b confere na tela)', () => {
    hud.atualizar(inicial);
    expect(valor('gold')).toBe(String(estoque.gold));
    expect(valor('timber')).toBe(String(estoque.timber));
    expect(valor('stone')).toBe(String(estoque.stone));
  });

  it('com estoque numa pedreira, o HUD NAO soma: continua mostrando so o que ha nos armazens', () => {
    const estado = comPedreiraComEstoque(inicial, { stone: 7, timber: 3, gold: 2 });
    expect(estoqueTotal(estado).stone).not.toBe(estoque.stone); // a soma total divergiria...
    hud.atualizar(estado);
    expect(valor('stone')).toBe(String(estoque.stone)); // ...e o HUD nao a mostra
    expect(valor('timber')).toBe(String(estoque.timber));
    expect(valor('gold')).toBe(String(estoque.gold));
  });
});
