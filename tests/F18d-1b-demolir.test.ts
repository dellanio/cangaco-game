/**
 * F18d-1b — `DemolishRoad` sobre TRES conjuntos de tile, no mesmo comando.
 *
 * Desde que o `PlaceRoad` virou canteiro, um tile pode estar em tres situacoes, e a
 * borracha responde diferente a cada uma:
 *
 *  - DE PE: sai de `estradas` e devolve `floor(removidos x devolucaoAoDemolir)`. O
 *    arredondamento e por comando, e conta SO os de pe — pedra devolvida e pedra que
 *    um dia saiu do armazem.
 *  - DESENHADO (canteiro): sai de `estradasPlanejadas` e devolve ZERO, porque nada foi
 *    gasto ainda. A tarefa de assentamento dele perde o destino e cai no mesmo tick
 *    (`sanearTarefas`, `'destino-sumiu'`), e com ela a reserva.
 *  - NEM UM NEM OUTRO: ignorado, sem evento — apagar chao vazio nao e erro.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import { step } from '../src/sim/tick';
import { criarTarefaDeAssentamento } from '../src/sim/jobs';
import { ehEstrada, ehPlanejada, MERCADORIA_DA_ESTRADA, tilesOrdenados } from '../src/sim/estradas';
import { reservadoNaOrigem } from '../src/sim/reservas';
import { ehTarefaDeAssentamento } from '../src/sim/state';
import {
  comEstradas, comPedraNaSaida, comPlanejadas, inicial, laborersDoCenario, semAUnidade, tile,
} from './helpers/jobs-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { violacoesDaFsmDoLaborer } from './helpers/laborer-invariantes';
import { fsmDe } from './helpers/serf-cenario';

const FRACAO = gameData.terreno.estrada.devolucaoAoDemolir;
const CUSTO = gameData.terreno.estrada.custoStonePorTile;
const ARMAZEM = 'p1';

const DE_PE = [tile(10, 40), tile(11, 40)];
const DESENHADOS = [tile(12, 40), tile(13, 40)];
const CHAO_VAZIO = tile(20, 20);

const demolir = (tiles: readonly { readonly gx: number; readonly gy: number }[]): Command =>
  ({ type: 'DemolishRoad', tiles });

/** Sem unidade nenhuma: aqui se mede o COMANDO, e nem serf nem laborer podem mexer no
 *  estoque nem no canteiro enquanto ele acontece. */
const semNinguem = (e: GameState): GameState =>
  e.unidades.ordem.reduce((x, id) => semAUnidade(x, id), e);

const saidaDoArmazem = (e: GameState): number => {
  const p = e.predios.porId[ARMAZEM];
  if (!p || p.estado !== 'completo') throw new Error('fixture: sem armazem');
  return p.estoque.saida[MERCADORIA_DA_ESTRADA] ?? 0;
};
const assentamentos = (e: GameState): number =>
  e.jobs.tarefas.ordem.filter((id) => {
    const t = e.jobs.tarefas.porId[id];
    return t !== undefined && ehTarefaDeAssentamento(t);
  }).length;

/** Dois tiles de pe, dois desenhados (cada um com a sua tarefa), e mais nada. */
function cenarioDosTres(): GameState {
  let estado = comPlanejadas(comEstradas(semNinguem(inicial), DE_PE), DESENHADOS);
  for (const t of DESENHADOS) {
    const criada = criarTarefaDeAssentamento(estado, t);
    if (criada === null) throw new Error('fixture: o armazem inicial tem pedra e a tarefa nao nasceu');
    estado = criada.state;
  }
  return estado;
}

describe('F18d-1b — `DemolishRoad` responde diferente a cada conjunto', () => {
  it('um comando com os tres: os dois de pe caem e devolvem 1, os dois do canteiro caem e devolvem 0', () => {
    const antes = cenarioDosTres();
    expect(assentamentos(antes)).toBe(2);
    expect(reservadoNaOrigem(antes, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(2 * CUSTO);
    const pedraAntes = saidaDoArmazem(antes);

    const depois = step(antes, [demolir([...DE_PE, ...DESENHADOS, CHAO_VAZIO])]);

    for (const t of [...DE_PE, ...DESENHADOS]) {
      expect(ehEstrada(depois.estradas, t), `${t.gx},${t.gy} de pe`).toBe(false);
      expect(ehPlanejada(depois.estradasPlanejadas, t), `${t.gx},${t.gy} no canteiro`).toBe(false);
    }
    // 4 tiles no comando, 2 de pe: a devolucao conta so os de pe (fossem os 4, seriam 2)
    expect(saidaDoArmazem(depois) - pedraAntes).toBe(Math.floor(DE_PE.length * FRACAO));
    expect(saidaDoArmazem(depois) - pedraAntes).toBe(1);
    // e o canteiro levou junto as tarefas dele, e as reservas
    expect(assentamentos(depois)).toBe(0);
    expect(reservadoNaOrigem(depois, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(0);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });

  it('so canteiro: nao devolve pedra nenhuma — nada foi gasto ainda', () => {
    const antes = cenarioDosTres();
    const depois = step(antes, [demolir(DESENHADOS)]);
    expect(saidaDoArmazem(depois)).toBe(saidaDoArmazem(antes));
    expect(tilesOrdenados(depois.estradasPlanejadas)).toEqual([]);
    expect(tilesOrdenados(depois.estradas)).toEqual(DE_PE); // a rua de pe nao foi tocada
    expect(assentamentos(depois)).toBe(0);
  });

  it('so chao vazio: no-op de verdade — mesma referencia dos dois conjuntos, sem evento', () => {
    const antes = cenarioDosTres();
    const depois = step(antes, [demolir([CHAO_VAZIO, tile(21, 20)])]);
    expect(depois.estradas).toBe(antes.estradas);
    expect(depois.estradasPlanejadas).toBe(antes.estradasPlanejadas);
    expect(depois.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(assentamentos(depois)).toBe(2);
  });

  it('o arredondamento e por comando e conta so os de pe: 1 de pe + 3 desenhados devolve 0', () => {
    const base = comPlanejadas(comEstradas(semNinguem(inicial), [tile(10, 40)]), DESENHADOS.concat(tile(14, 40)));
    const pedraAntes = saidaDoArmazem(base);
    const depois = step(base, [demolir([tile(10, 40), ...DESENHADOS, tile(14, 40)])]);
    expect(saidaDoArmazem(depois)).toBe(pedraAntes + Math.floor(1 * FRACAO));
    expect(saidaDoArmazem(depois)).toBe(pedraAntes);
    expect(tilesOrdenados(depois.estradas)).toEqual([]);
    expect(tilesOrdenados(depois.estradasPlanejadas)).toEqual([]);
  });
});

describe('F18d-1b — o laborer a caminho do tile demolido volta a ocioso, sem reserva pendurada', () => {
  /** Colado no laborer u7 (34,34), como em `F18d-1b-laborer.test.ts`. */
  const CANTEIRO = tile(34, 33);

  it('a tarefa cai no mesmo tick do comando e ele nao fica preso a ela', () => {
    const [u7] = laborersDoCenario(inicial);
    if (u7 === undefined) throw new Error('fixture: cenario sem laborer');
    const criada = criarTarefaDeAssentamento(comPlanejadas(comPedraNaSaida(inicial, ARMAZEM, 10), [CANTEIRO]), CANTEIRO);
    if (criada === null) throw new Error('fixture: a tarefa nao nasceu');

    // ele reclama e sai andando
    let estado = criada.state;
    estado = step(estado, []);
    expect(fsmDe(estado, u7)).toBe('indo_a_obra');
    expect(estado.unidades.porId[u7]?.fsmData.tarefa).toBe(criada.id);
    const reservaAntes = reservadoNaOrigem(estado, ARMAZEM, MERCADORIA_DA_ESTRADA);
    expect(reservaAntes).toBeGreaterThanOrEqual(CUSTO);

    const depois = step(estado, [demolir([CANTEIRO])]);
    expect(depois.jobs.tarefas.porId[criada.id]).toBeUndefined();
    expect(reservadoNaOrigem(depois, ARMAZEM, MERCADORIA_DA_ESTRADA)).toBe(reservaAntes - CUSTO);
    expect(fsmDe(depois, u7)).toBe('ocioso');
    expect(depois.unidades.porId[u7]?.fsmData.tarefa).toBeUndefined();
    expect(ehPlanejada(depois.estradasPlanejadas, CANTEIRO)).toBe(false);
    expect(ehEstrada(depois.estradas, CANTEIRO)).toBe(false);
    expect(violacoesDaFsmDoLaborer(depois)).toEqual([]);
    expect(violacoesDeInvariantes(depois)).toEqual([]);
  });
});
