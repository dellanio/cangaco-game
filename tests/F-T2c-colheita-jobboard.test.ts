/**
 * F-T2c — a escolha do tile e uma TAREFA do quadro, com reserva no claim.
 *
 * A divida declarada na F-T2a: a pedreira varria o proprio alcance e cavava o
 * primeiro tile com recurso, sem reservar nada. Duas pedreiras de alcances
 * sobrepostos escolhiam o MESMO tile — cada uma tirava a sua unidade dele no
 * mesmo tick, e o lajedo sumia no dobro da velocidade que qualquer numero de
 * `data/` prometia.
 *
 * O aceite do item: duas pedreiras com alcances sobrepostos NUNCA colhem o mesmo
 * tile no mesmo tick. Aqui ele e medido por comportamento — cenario inteiro,
 * tick a tick, olhando a queda de quantidade em cada tile — e nao por inspecao
 * do codigo que escolhe.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { ehTarefaDeColheita } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import type { ColheitaDeRecurso, GameData } from '../src/sim/data/types';
import { step } from '../src/sim/tick';
import { chaveDeTile, predioLigadoAoArmazem } from '../src/sim/estradas';
import { melhorTileDeColheita, tilesReservadosParaColheita } from '../src/sim/recursos';
import { receitaDoTipo } from '../src/sim/producao';
import { comEstradas, linhaH, linhaV } from './helpers/jobs-cenario';
import { comEspacoNaSaida, comJazida, comProdutorOcupado, fsmDe } from './helpers/producao-cenario';
import { violacoesDeInvariantes } from './helpers/jobs-invariantes';
import { gravarEvidencia } from './helpers/evidence';

const chave = (gx: number, gy: number): string => chaveDeTile({ gx, gy });

/** A rua da F-T2a: y=36 de x=18 a x=35, mais a coluna x=29 ate a porta do armazem. */
const RUA = [...linhaH(18, 35, 36), ...linhaV(29, 33, 35)];

/**
 * A mancha de rocha do cenario, escolhida para ficar ao alcance das DUAS: a
 * distancia e de Chebyshev a partir do footprint, `q1` ocupa x=22..24 e `q2`
 * x=26..28, ambos em y=34..35, e o alcance e 6. De (24,30) a (27,30) todo tile
 * dista <= 6 das duas — nao ha tile "so meu" para onde fugir da disputa.
 */
const ROCHA: readonly (readonly [number, number])[] = [[24, 30], [25, 30], [26, 30], [27, 30]];

/** Dois por tile: a jazida inteira sao 8 unidades, e o cenario vai ate o
 *  esgotamento sem virar medicao de paciencia. */
const DADOS: GameData = comJazida(gameData, 'rock', ROCHA, 2);

function predioDe(estado: GameState, id: string): PredioCompleto {
  const p = estado.predios.porId[id];
  if (p === undefined || p.estado !== 'completo') throw new Error(`fixture: '${id}' nao esta completo`);
  return p;
}

function colheitaDaPedreira(dados: GameData): ColheitaDeRecurso {
  const colheita = receitaDoTipo('quarry', dados)?.colheita;
  if (colheita == null) throw new Error('fixture: quarry perdeu a colheita da receita');
  return colheita;
}

/** Duas pedreiras completas, ocupadas e ligadas, com alcances sobrepostos sobre
 *  a MESMA mancha de rocha — o cenario que o aceite pede. */
function duasPedreiras(dados: GameData = DADOS): GameState {
  const vazio: GameState = { ...createInitialState(1, dados), unidades: { porId: {}, ordem: [] } };
  let s = comProdutorOcupado(vazio, { tipo: 'quarry', id: 'q1', unidade: 'pedreiro-1', gx: 22, gy: 34 }, dados);
  s = comProdutorOcupado(s, { tipo: 'quarry', id: 'q2', unidade: 'pedreiro-2', gx: 26, gy: 34 }, dados);
  s = comEstradas(s, RUA);
  const colheita = colheitaDaPedreira(dados);
  for (const id of ['q1', 'q2']) {
    if (!predioLigadoAoArmazem(s, predioDe(s, id), dados)) throw new Error(`fixture: '${id}' nao ligou`);
    if (melhorTileDeColheita(s, predioDe(s, id), colheita, 1, undefined, dados) === null) {
      throw new Error(`fixture: '${id}' nasceu sem rocha ao alcance`);
    }
  }
  return s;
}

/** Os tiles apontados por tarefa de colheita, na ordem do quadro. */
function tilesEmTarefa(estado: GameState): string[] {
  const tiles: string[] = [];
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (t !== undefined && ehTarefaDeColheita(t)) tiles.push(chaveDeTile(t.origemTile));
  }
  return tiles;
}

/** Quanto CAIU em cada tile de um tick para o outro. Sair do mapa conta como
 *  queda do que ainda havia: rocha e regime `nunca` e a entrada some ao zerar. */
function quedasPorTile(antes: GameState, depois: GameState): Record<string, number> {
  const quedas: Record<string, number> = {};
  for (const [k, r] of Object.entries(antes.recursos)) {
    const agora = depois.recursos[k]?.quantidade ?? 0;
    if (agora < r.quantidade) quedas[k] = r.quantidade - agora;
  }
  return quedas;
}

interface Colisao {
  readonly tick: number;
  readonly tile: string;
  readonly queda: number;
}

interface Corrida {
  readonly fim: GameState;
  /** Ticks em que as DUAS depositaram. Sem nenhum, o aceite nao mediu nada. */
  readonly ticksComAsDuas: number;
  readonly depositos: number;
  readonly colhido: number;
  /** Toda colisao vista, com tick e tile. Vazio e o aceite. */
  readonly colisoes: readonly Colisao[];
  readonly tiquesComTarefaRepetida: readonly number[];
  readonly violacoes: readonly string[];
}

/**
 * Roda o cenario tick a tick, drenando a gaveta (o serf da F15b em uma linha), e
 * anota tudo o que o aceite pergunta. Uma queda de 2 num tile num tick e a
 * colisao que a F-T2a deixava acontecer: duas pedreiras cavando o mesmo lajedo.
 */
function correr(estado: GameState, ticks: number, dados: GameData = DADOS): Corrida {
  let s = estado;
  let ticksComAsDuas = 0;
  let depositos = 0;
  let colhido = 0;
  const colisoes: Colisao[] = [];
  const tiquesComTarefaRepetida: number[] = [];
  const violacoes: string[] = [];
  for (let i = 1; i <= ticks; i++) {
    const antes = s;
    s = step(s, [], dados);
    const quedas = quedasPorTile(antes, s);
    const produtores = new Set(
      s.events.flatMap((e) => (e.type === 'goods-produced' ? [e.predio] : [])),
    );
    for (const [tile, queda] of Object.entries(quedas)) {
      colhido += queda;
      if (queda > 1) colisoes.push({ tick: i, tile, queda });
    }
    // duas pedreiras depositando no mesmo tick tem de ter cavado DOIS tiles
    if (produtores.size === 2) {
      ticksComAsDuas++;
      const cavados = Object.keys(quedas).length;
      if (cavados !== 2) colisoes.push({ tick: i, tile: `tiles cavados: ${cavados}`, queda: cavados });
    }
    depositos += produtores.size;
    const tiles = tilesEmTarefa(s);
    if (new Set(tiles).size !== tiles.length) tiquesComTarefaRepetida.push(i);
    violacoes.push(...violacoesDeInvariantes(s, dados).map((v) => `t${i}: ${v}`));
    s = comEspacoNaSaida(comEspacoNaSaida(s, 'q1'), 'q2');
  }
  return { fim: s, ticksComAsDuas, depositos, colhido, colisoes, tiquesComTarefaRepetida, violacoes };
}

// --- o aceite ----------------------------------------------------------------

describe('F-T2c — duas pedreiras de alcances sobrepostos nunca colhem o mesmo tile', () => {
  it('o cenario e mesmo de disputa: as duas veem a mancha e a MESMA preferencia', () => {
    const s = duasPedreiras();
    const colheita = colheitaDaPedreira(DADOS);
    // sem o conjunto de reservados — a escolha pura, que e o que a F-T2a fazia —
    // as duas apontam para o MESMO tile. E dai que vem a colisao que o quadro corta.
    const semQuadro1 = melhorTileDeColheita(s, predioDe(s, 'q1'), colheita, 1, undefined, DADOS);
    const semQuadro2 = melhorTileDeColheita(s, predioDe(s, 'q2'), colheita, 1, undefined, DADOS);
    expect(semQuadro1).toBe(semQuadro2);
    expect(semQuadro1).toBe(chave(24, 30));
  });

  it('o tile de cada uma e exclusivo, e a reserva o diz desde o primeiro tick', () => {
    const s = step(duasPedreiras(), [], DADOS);
    const tiles = tilesEmTarefa(s);
    expect(tiles).toHaveLength(2);
    expect(new Set(tiles).size).toBe(2);
    expect(tilesReservadosParaColheita(s)).toEqual(new Set(tiles));
  });

  it('cenario inteiro ate o esgotamento: nenhum tick com duas cavando o mesmo tile', () => {
    const r = correr(duasPedreiras(), 1200);
    expect(r.colisoes).toEqual([]);
    expect(r.tiquesComTarefaRepetida).toEqual([]);
    expect(r.violacoes).toEqual([]);
    // o aceite so vale se as duas chegaram a produzir JUNTAS
    expect(r.ticksComAsDuas).toBeGreaterThan(0);
    // e se a jazida inteira saiu pelo caminho de verdade
    expect(r.colhido).toBe(ROCHA.length * 2);
    expect(r.depositos).toBe(ROCHA.length * 2);
  });

  it('jazida seca: as duas param em esperando_insumo e nenhuma tarefa segura tile', () => {
    const r = correr(duasPedreiras(), 1200);
    const sobrou = Object.keys(r.fim.recursos).filter((k) => r.fim.recursos[k]?.tipo === 'rock');
    expect(sobrou).toEqual([]);
    expect(fsmDe(r.fim, 'pedreiro-1')).toBe('esperando_insumo');
    expect(fsmDe(r.fim, 'pedreiro-2')).toBe('esperando_insumo');
    expect(tilesEmTarefa(r.fim)).toEqual([]);
  });
});

// --- o guarda acusa -----------------------------------------------------------

describe('F-T2c — a invariante do quadro reprova o tile com duas tarefas', () => {
  it('estado forjado com as duas na mesma rocha e ACUSADO, e nao passa calado', () => {
    const s = step(duasPedreiras(), [], DADOS);
    const [primeira, segunda] = s.jobs.tarefas.ordem.flatMap((id) => {
      const t = s.jobs.tarefas.porId[id];
      return t !== undefined && ehTarefaDeColheita(t) ? [t] : [];
    });
    if (primeira === undefined || segunda === undefined) throw new Error('fixture: faltou tarefa de colheita');
    expect(violacoesDeInvariantes(s, DADOS)).toEqual([]);
    // a colisao que a F-T2a deixava acontecer, escrita a mao no estado
    const colidindo: GameState = {
      ...s,
      jobs: {
        ...s.jobs,
        tarefas: {
          ...s.jobs.tarefas,
          porId: { ...s.jobs.tarefas.porId, [segunda.id]: { ...segunda, origemTile: primeira.origemTile } },
        },
      },
    };
    const acusacoes = violacoesDeInvariantes(colidindo, DADOS);
    expect(acusacoes).toHaveLength(1);
    expect(acusacoes[0]).toContain(`o tile '${chaveDeTile(primeira.origemTile)}' ja e reservado por ${primeira.id}`);
  });
});

// --- release em todo ramo -----------------------------------------------------

describe('F-T2c — o tile volta ao conjunto livre em todo ramo de saida', () => {
  const comTarefas = (): GameState => step(duasPedreiras(), [], DADOS);

  it('predio demolido devolve o tile no mesmo tick', () => {
    const s = comTarefas();
    const daQ1 = tilesEmTarefa(s)[0] ?? '';
    const depois = step(s, [{ type: 'DemolishBuilding', predio: 'q1' }], DADOS);
    expect(tilesReservadosParaColheita(depois).has(daQ1)).toBe(false);
    expect(tilesEmTarefa(depois)).toHaveLength(1);
  });

  it('predio pausado devolve o tile, e despausado reclama de novo', () => {
    const s = comTarefas();
    const pausado = step(s, [{ type: 'SetBuildingPaused', predio: 'q1', pausado: true }], DADOS);
    expect(tilesEmTarefa(pausado)).toHaveLength(1);
    const voltou = step(pausado, [{ type: 'SetBuildingPaused', predio: 'q1', pausado: false }], DADOS);
    expect(tilesEmTarefa(voltou)).toHaveLength(2);
    expect(new Set(tilesEmTarefa(voltou)).size).toBe(2);
  });

  it('ocupante morto devolve o tile, e a pedreira nao fica com tarefa orfa', () => {
    const s = comTarefas();
    const porId = { ...s.unidades.porId };
    delete porId['pedreiro-1'];
    const semPedreiro: GameState = {
      ...s,
      unidades: { porId, ordem: s.unidades.ordem.filter((id) => id !== 'pedreiro-1') },
    };
    const depois = step(semPedreiro, [], DADOS);
    expect(tilesEmTarefa(depois)).toHaveLength(1);
    expect(violacoesDeInvariantes(depois, DADOS)).toEqual([]);
  });

  it('a unidade que perde o predio larga a tarefa e volta a ser ocupavel', () => {
    const s = comTarefas();
    const q1 = predioDe(s, 'q1');
    const semOcupante: GameState = {
      ...s,
      predios: { ...s.predios, porId: { ...s.predios.porId, q1: { ...q1, ocupante: null } } },
    };
    const depois = step(semOcupante, [], DADOS);
    expect(tilesEmTarefa(depois).length).toBeLessThanOrEqual(1);
    // sem o release a unidade ficaria presa: `unidadeJaTemTarefa` recusaria o
    // claim da proxima ocupacao e ela nunca mais trabalharia
    const segurando = depois.jobs.tarefas.ordem.filter((id) => {
      const t = depois.jobs.tarefas.porId[id];
      return t !== undefined && t.reclamadaPor === 'pedreiro-1';
    });
    expect(segurando).toEqual([]);
  });
});

// --- evidencia ----------------------------------------------------------------

describe('F-T2c — evidencia', () => {
  it('grava test-output/F-T2c.json com o aceite medido', () => {
    const r = correr(duasPedreiras(), 1200);
    gravarEvidencia('F-T2c', {
      cenario: 'q1 (22,34) e q2 (26,34), alcance 6, mancha de rocha em y=30, x=24..27',
      rochaPorTile: 2,
      ticks: 1200,
      ticksComAsDuasProduzindo: r.ticksComAsDuas,
      depositos: r.depositos,
      unidadesColhidas: r.colhido,
      colisoesDeTile: r.colisoes,
      tiquesComTarefaRepetida: r.tiquesComTarefaRepetida,
      violacoesDeInvariante: r.violacoes,
      tarefasAoFim: tilesEmTarefa(r.fim),
      fsmAoFim: { 'pedreiro-1': fsmDe(r.fim, 'pedreiro-1'), 'pedreiro-2': fsmDe(r.fim, 'pedreiro-2') },
    });
    expect(r.colisoes).toEqual([]);
  });
});
