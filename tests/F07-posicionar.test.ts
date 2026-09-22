import { describe, it, expect, afterAll } from 'vitest';
import { createInitialState } from '../src/sim/state';
import type { GameEvent, GameState, PredioEmObra } from '../src/sim/state';
import type { Command } from '../src/sim/commands';
import type { GameData } from '../src/sim/data/types';
import { gameData } from '../src/sim/data';
import { step } from '../src/sim/tick';
import { estoqueTotal } from '../src/sim/selectors';
import { estaDesbloqueado } from '../src/sim/desbloqueio';
import { compararComESemSave, deepFreeze } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';

// --- montagem (so teste) ---

function colocar(buildingId: string, gx: number, gy: number): Command {
  return { type: 'PlaceBlueprint', buildingId, gx, gy };
}

function definicaoDe(id: string): (typeof gameData.predios)[number] {
  const def = gameData.predios.find((p) => p.id === id);
  if (!def) throw new Error(`fixture: '${id}' nao existe em buildings.json`);
  return def;
}

function obraDe(estado: GameState, id: string): PredioEmObra {
  const predio = estado.predios.porId[id];
  if (!predio || predio.estado !== 'obra') throw new Error(`fixture: '${id}' nao e uma obra`);
  return predio;
}

/** O id do ultimo predio acrescentado ao estado. */
function ultimoId(estado: GameState): string {
  const id = estado.predios.ordem[estado.predios.ordem.length - 1];
  if (id === undefined) throw new Error('fixture: estado sem predio');
  return id;
}

function rejeicoes(estado: GameState): GameEvent[] {
  return estado.events.filter((e) => e.type === 'command-rejected');
}

describe('F07 — PlaceBlueprint cria uma obra', () => {
  const inicial = createInitialState(1);

  it('o estado ganha UMA obra pendente: estado obra, HP 0, tipo e posicao do comando', () => {
    const depois = step(inicial, [colocar('quarry', 0, 0)]);
    expect(depois.predios.ordem).toHaveLength(inicial.predios.ordem.length + 1);
    const obra = obraDe(depois, ultimoId(depois));
    expect(obra.tipo).toBe('quarry');
    expect([obra.gx, obra.gy]).toEqual([0, 0]);
    expect(obra.estado).toBe('obra');
    expect(obra.hp).toBe(0);
  });

  it('os materiais faltantes sao o custo de buildings.json, sem numero digitado no teste', () => {
    const depois = step(inicial, [colocar('quarry', 0, 0)]);
    const { timber, stone } = definicaoDe('quarry');
    expect(obraDe(depois, ultimoId(depois)).obra.faltam).toEqual({ timber, stone });
  });

  it('o custo vem do dado: com outro custo injetado, a obra nasce com outro faltam', () => {
    const dados: GameData = {
      ...gameData,
      predios: gameData.predios.map((p) => (p.id === 'quarry' ? { ...p, timber: 77, stone: 88 } : p)),
    };
    const depois = step(inicial, [colocar('quarry', 0, 0)], dados);
    expect(obraDe(depois, ultimoId(depois)).obra.faltam).toEqual({ timber: 77, stone: 88 });
  });

  it('o id e novo e deterministico: p<proximoId>, e proximoId cobre exatamente o predio + o que o gerador criou', () => {
    const depois = step(inicial, [colocar('quarry', 0, 0)]);
    expect(ultimoId(depois)).toBe(`p${inicial.proximoId}`);
    // F11b: o mesmo step ja roda gerarTarefas (hoje cria tarefas de construir para a obra
    // nova; um tipo futuro poderia criar mais). Derivado do estado, nao de um literal — o
    // contador e compartilhado, mas "1 predio + o que esta no quadro agora" e exato aqui
    // porque nada foi removido do quadro neste unico tick.
    expect(depois.proximoId).toBe(inicial.proximoId + 1 + depois.jobs.tarefas.ordem.length);
  });

  it('nao emite evento de rejeicao quando aceita', () => {
    expect(rejeicoes(step(inicial, [colocar('quarry', 0, 0)]))).toEqual([]);
  });
});

describe('F07 — um segundo comando na mesma posicao e rejeitado', () => {
  const inicial = createInitialState(1);

  it('em ticks separados: nada e criado e o evento diz por que', () => {
    const primeiro = step(inicial, [colocar('quarry', 0, 0)]);
    const segundo = step(primeiro, [colocar('quarry', 0, 0)]);
    expect(segundo.predios.ordem).toEqual(primeiro.predios.ordem);
    expect(segundo.proximoId).toBe(primeiro.proximoId);
    expect(rejeicoes(segundo)).toEqual([
      { type: 'command-rejected', command: 'PlaceBlueprint', buildingId: 'quarry', gx: 0, gy: 0, motivo: 'sobreposicao' },
    ]);
  });

  it('no MESMO tick, na mesma lista: o segundo ve o estado que o primeiro deixou', () => {
    const depois = step(inicial, [colocar('quarry', 0, 0), colocar('quarry', 0, 0)]);
    expect(depois.predios.ordem).toHaveLength(inicial.predios.ordem.length + 1);
    expect(rejeicoes(depois)).toHaveLength(1);
  });

  it('a posicao vizinha, encostada e sem sobrepor, segue aceita (largura lida do dado)', () => {
    const [largura] = definicaoDe('quarry').tamanho;
    if (largura === undefined) throw new Error('fixture: quarry sem tamanho');
    const depois = step(inicial, [colocar('quarry', 0, 0), colocar('quarry', largura, 0)]);
    expect(depois.predios.ordem).toHaveLength(inicial.predios.ordem.length + 2);
    expect(rejeicoes(depois)).toEqual([]);
  });
});

describe('F07 — as outras recusas do canPlace tambem nao criam obra', () => {
  const inicial = createInitialState(1);

  it.each([
    ['sawmill', 0, 0, 'bloqueado'],
    ['quarry', -1, 0, 'fora-do-mapa'],
    ['nao-existe', 0, 0, 'predio-desconhecido'],
  ] as const)('%s em (%i,%i) -> %s', (id, gx, gy, motivo) => {
    const depois = step(inicial, [colocar(id, gx, gy)]);
    expect(depois.predios.ordem).toEqual(inicial.predios.ordem);
    expect(depois.proximoId).toBe(inicial.proximoId);
    expect(rejeicoes(depois)).toEqual([
      { type: 'command-rejected', command: 'PlaceBlueprint', buildingId: id, gx, gy, motivo },
    ]);
  });
});

describe('F07 — o custo NAO sai do estoque no clique (sai na entrega, F10)', () => {
  const inicial = createInitialState(1);

  it('estoqueTotal e identico antes e depois de plantar', () => {
    const depois = step(inicial, [colocar('quarry', 0, 0)]);
    expect(estoqueTotal(depois)).toEqual(estoqueTotal(inicial));
  });

  it('cada predio que ja existia mantem o MESMO objeto de estoque (nada foi debitado)', () => {
    const depois = step(inicial, [colocar('quarry', 0, 0)]);
    for (const id of inicial.predios.ordem) {
      const antes = inicial.predios.porId[id];
      const agora = depois.predios.porId[id];
      if (antes?.estado !== 'completo' || agora?.estado !== 'completo') throw new Error(`fixture: '${id}'`);
      expect(agora.estoque).toBe(antes.estoque);
    }
  });

  it('o custo fica pendente na obra: faltam e o custo inteiro', () => {
    const depois = step(inicial, [colocar('quarry', 0, 0)]);
    const { timber, stone } = definicaoDe('quarry');
    const faltam = obraDe(depois, ultimoId(depois)).obra.faltam;
    expect(Object.values(faltam).reduce((a, b) => a + b, 0)).toBe(timber + stone);
  });
});

describe('F07 — obra nao desbloqueia', () => {
  it('plantar um Woodcutter\'s nao libera a Sawmill nem mexe no historico de tipos', () => {
    const inicial = createInitialState(1);
    const depois = step(inicial, [colocar('woodcutters', 0, 0)]);
    expect(estaDesbloqueado(depois, 'sawmill')).toBe(false);
    expect(depois.tiposJaConstruidos).toEqual(inicial.tiposJaConstruidos);
  });
});

describe('F07 — determinismo e pureza com comandos de verdade', () => {
  const inicial = createInitialState(1);

  it('a mesma lista de comandos da o mesmo estado, byte a byte', () => {
    const lista = [colocar('quarry', 0, 0), colocar('woodcutters', 10, 10)];
    expect(JSON.stringify(step(inicial, lista))).toBe(JSON.stringify(step(inicial, lista)));
  });

  it('com save/load no meio, chega ao mesmo JSON (helper canonico da F02, agora com comandos)', () => {
    const { direto, comSave } = compararComESemSave({
      seed: 1,
      totalTicks: 10,
      saveAtTick: 5,
      comandosNoTick: (tick) => {
        if (tick === 0) return [colocar('quarry', 0, 0)];
        if (tick === 7) return [colocar('woodcutters', 10, 10)];
        return [];
      },
    });
    expect(comSave).toBe(direto);
    const final = JSON.parse(direto) as GameState;
    expect(final.predios.ordem.filter((id) => final.predios.porId[id]?.estado === 'obra')).toHaveLength(2);
  });

  it('step nao muta uma lista de comandos congelada com elemento real, nem o estado', () => {
    const comandos = deepFreeze([colocar('quarry', 0, 0)]);
    const congelado = deepFreeze(createInitialState(1));
    expect(() => step(congelado, comandos)).not.toThrow();
  });

  it('comando fora da uniao Command faz o step lancar (o default do switch)', () => {
    const invalido = { type: 'Nope' } as unknown as Command;
    expect(() => step(inicial, [invalido])).toThrow(/comando desconhecido/);
  });

  it('a obra atravessa varios ticks intacta e sobrevive ao JSON', () => {
    let estado = step(inicial, [colocar('quarry', 0, 0)]);
    const id = ultimoId(estado);
    const faltamAntes = obraDe(estado, id).obra.faltam;
    for (let i = 0; i < 5; i++) estado = step(estado, []);
    expect(obraDe(estado, id).obra.faltam).toEqual(faltamAntes);
    expect(obraDe(estado, id).hp).toBe(0);
    expect(JSON.parse(JSON.stringify(estado))).toEqual(estado);
  });
});

describe('F07 — o cenario inicial so descreve predio completo', () => {
  it('estadoInicial com estado obra lanca, em vez de fabricar um predio invalido por cast', () => {
    const [primeiro, ...resto] = gameData.economia.estadoInicial.predios;
    if (!primeiro) throw new Error('fixture: cenario sem predio');
    const dados: GameData = {
      ...gameData,
      economia: {
        ...gameData.economia,
        estadoInicial: { ...gameData.economia.estadoInicial, predios: [{ ...primeiro, estado: 'obra' }, ...resto] },
      },
    };
    expect(() => createInitialState(1, dados)).toThrow(/completo/);
  });
});

afterAll(() => {
  const inicial = createInitialState(1);
  const def = definicaoDe('quarry');
  const depois = step(inicial, [colocar('quarry', 0, 0)]);
  const obra = obraDe(depois, ultimoId(depois));
  const segundo = step(depois, [colocar('quarry', 0, 0)]);

  gravarEvidencia('F07', {
    feature: 'F07-posicionar-planta',
    // VERIFICADO por teste headless: os dois casos do aceite escrito no BUILD_PLAN.md.
    aceite: {
      obraComOsMateriaisDoDado: {
        estado: obra.estado,
        hp: obra.hp,
        tipo: obra.tipo,
        faltam: obra.obra.faltam,
        custoEmBuildingsJson: { timber: def.timber, stone: def.stone },
        faltamIgualAoCusto: JSON.stringify(obra.obra.faltam) === JSON.stringify({ timber: def.timber, stone: def.stone }),
      },
      segundoComandoNaMesmaPosicao: {
        prediosDepoisDoPrimeiro: depois.predios.ordem.length,
        prediosDepoisDoSegundo: segundo.predios.ordem.length,
        rejeicoes: rejeicoes(segundo),
      },
    },
    // O ponto que o operador pediu para nao "melhorar": o custo NAO sai no clique.
    custoNaoSaiuNoClique: {
      estoqueAntes: estoqueTotal(inicial),
      estoqueDepois: estoqueTotal(depois),
      iguais: JSON.stringify(estoqueTotal(inicial)) === JSON.stringify(estoqueTotal(depois)),
    },
    obraNaoDesbloqueia: {
      serrariaLiberadaComObraDeWoodcutters: estaDesbloqueado(step(inicial, [colocar('woodcutters', 0, 0)]), 'sawmill'),
    },
    // A exaustividade do switch tem duas camadas: a atribuicao a never em step()
    // e checada pelo typecheck do npm run verify; o throw do default tem teste.
    switchDeStep: {
      exaustividade: 'atribuicao a never, checada pelo typecheck do npm run verify',
      comandoForaDaUniao: 'step lanca (teste)',
    },
    // Verificacao visual e separada, fora do npm run verify (CLAUDE.md §8).
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F07 (test-output/F07-shot.json)',
  });
});
