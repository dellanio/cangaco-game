import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { Command } from '../src/sim/commands';
import type { GameEvent, GameState } from '../src/sim/state';
import { createInitialState } from '../src/sim/state';
import { estaDesbloqueado, registrarConclusoes } from '../src/sim/desbloqueio';
import { opcoesDoMenuBuild } from '../src/sim/selectors';
import { step } from '../src/sim/tick';
import { comEstradas, linhaH, linhaV, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const inicial = createInitialState(1);

const concluido = (predio: string, tipo: string): GameEvent =>
  ({ type: 'building-completed', predio, tipo });

/** Os ids liberados AGORA, calculados do dado — nunca uma lista digitada. */
const liberados = (e: GameState): string[] =>
  gameData.predios.filter((p) => estaDesbloqueado(e, p.id)).map((p) => p.id);

describe('F12 — registrarConclusoes: a dobra dos eventos do tick', () => {
  it('tick sem building-completed devolve o MESMO estado (identidade, nao copia)', () => {
    const soTick: GameEvent = { type: 'tick-advanced', tick: 1 };
    expect(registrarConclusoes(inicial, [soTick])).toBe(inicial);
    // storehouse ja esta no historico: o evento chega, e o estado nao se move
    expect(registrarConclusoes(inicial, [soTick, concluido('p1', 'storehouse')])).toBe(inicial);
  });

  it('um building-completed acrescenta o tipo e libera os filhos dele', () => {
    const depois = registrarConclusoes(inicial, [concluido('p7', 'woodcutters')]);
    expect(depois.tiposJaConstruidos).toEqual([...inicial.tiposJaConstruidos, 'woodcutters']);
    expect(estaDesbloqueado(inicial, 'sawmill')).toBe(false);
    expect(estaDesbloqueado(depois, 'sawmill')).toBe(true);
  });

  it('dois eventos no mesmo tick registram os dois, na ordem dos eventos', () => {
    const depois = registrarConclusoes(inicial, [
      concluido('p7', 'woodcutters'), concluido('p8', 'quarry'),
    ]);
    expect(depois.tiposJaConstruidos)
      .toEqual([...inicial.tiposJaConstruidos, 'woodcutters', 'quarry']);
  });

  it('dois eventos do MESMO tipo no mesmo tick registram uma vez so', () => {
    const depois = registrarConclusoes(inicial, [
      concluido('p7', 'woodcutters'), concluido('p8', 'woodcutters'),
    ]);
    expect(depois.tiposJaConstruidos).toEqual([...inicial.tiposJaConstruidos, 'woodcutters']);
  });

  it('nao muta o estado recebido', () => {
    const congelado = Object.freeze({
      ...inicial, tiposJaConstruidos: Object.freeze([...inicial.tiposJaConstruidos]),
    }) as GameState;
    const antes = liberados(congelado);
    registrarConclusoes(congelado, [concluido('p7', 'woodcutters')]);
    expect(liberados(congelado)).toEqual(antes);
  });
});

describe('F12 — o step() consome o evento', () => {
  it('um tick sem conclusao nao mexe no historico', () => {
    const depois = step(inicial, []);
    expect(depois.tiposJaConstruidos).toEqual(inicial.tiposJaConstruidos);
  });

  it('o historico sobrevive ao tick e o desbloqueio vale para o tick seguinte', () => {
    // Nao se fabrica o evento: o aceite, abaixo, o produz pelo caminho real. Aqui
    // prova-se so que `step` PRESERVA o historico movido e que `canPlace` o enxerga.
    const comConclusao = registrarConclusoes(inicial, [concluido('p7', 'woodcutters')]);
    const depois = step(comConclusao, []);
    expect(depois.tiposJaConstruidos).toContain('woodcutters');
    expect(estaDesbloqueado(depois, 'sawmill')).toBe(true);
  });
});

/**
 * O aceite do BUILD_PLAN, nos quatro passos que ele escreve. O cenario e montado pelo
 * caminho REAL: `PlaceBlueprint` de verdade para cada predio e `step()` para conduzir
 * cada obra ate `'completo'`. Nenhum `PredioCompleto` e fabricado por fixture — e disso
 * que o passo 3 do aceite depende, e so a F11c (FSM do laborer) tornou possivel.
 *
 * As ESTRADAS vem de fixture de proposito: o aceite nao fala delas, e `PlaceRoad` debita
 * pedra por tile — amarrar o teste de desbloqueio ao preco da estrada faria um
 * rebalanceamento futuro quebrar a F12 por um motivo que nao e dela.
 */
describe('F12 — aceite headless do BUILD_PLAN', () => {
  const LENHADOR = { gx: 26, gy: 34 }; // woodcutters [3,2] -> x 26..28, y 34..35; porta y=36
  const SERRARIA = { gx: 24, gy: 38 }; // sawmill     [4,2] -> x 24..27, y 38..39; porta y=40
  const ARMAZEM_2 = { gx: 20, gy: 34 }; // storehouse [3,3] -> x 20..22, y 34..36; longe das ruas
  const RUAS = [
    ...linhaV(29, 33, 40), // desce da porta do armazem (29,33)
    tile(28, 36), // entra na porta do lenhador
    ...linhaH(27, 29, 40), // corre a oeste ate a porta da serraria (27,40)
  ];

  const plantar = (buildingId: string, p: { gx: number; gy: number }): Command =>
    ({ type: 'PlaceBlueprint', buildingId, gx: p.gx, gy: p.gy });

  const opcao = (e: GameState, id: string) => opcoesDoMenuBuild(e).find((o) => o.id === id);
  const doTipo = (e: GameState, tipo: string) =>
    e.predios.ordem.map((id) => e.predios.porId[id]).find((p) => p?.tipo === tipo);
  /** Quantos armazens existem — `doTipo` acharia sempre o da abertura. */
  const armazens = (e: GameState): number =>
    e.predios.ordem.filter((id) => e.predios.porId[id]?.tipo === 'storehouse').length;

  /** Os filhos DIRETOS de um pai, tirados do dado — nunca uma lista digitada. */
  const filhosDe = (pai: string): string[] =>
    gameData.predios.filter((p) => p.desbloqueadoPor === pai).map((p) => p.id);

  type Corrida = {
    readonly estado: GameState; readonly tick: number;
    readonly semEvento: number[]; readonly semCrescimento: number[];
  };

  /** Roda ate a obra daquele tipo ficar `'completo'`, conferindo a invariante por tick. */
  function conduzir(inicio: GameState, tipo: string): Corrida {
    let atual = inicio;
    const semEvento: number[] = []; // o historico cresceu sem ninguem anunciar
    const semCrescimento: number[] = []; // anunciaram tipo novo e o historico nao o contem
    for (let i = 0; i < 2000 && doTipo(atual, tipo)?.estado !== 'completo'; i += 1) {
      const antes = atual.tiposJaConstruidos;
      atual = step(atual, []);
      const anunciados = atual.events
        .filter((e): e is Extract<GameEvent, { type: 'building-completed' }> => e.type === 'building-completed')
        .map((e) => e.tipo);
      if (atual.tiposJaConstruidos.length > antes.length && anunciados.length === 0) {
        semEvento.push(atual.tick);
      }
      const novos = anunciados.filter((t) => !antes.includes(t));
      if (novos.some((t) => !atual.tiposJaConstruidos.includes(t))) semCrescimento.push(atual.tick);
    }
    return { estado: atual, tick: atual.tick, semEvento, semCrescimento };
  }

  const base = comEstradas(createInitialState(1), RUAS);

  let comObraDoLenhador: GameState;
  let lenhador: Corrida;
  let recusasAoPlantar: readonly GameEvent[] = [];
  let serraria: Corrida;
  let comSegundoArmazem: GameState;

  beforeAll(() => {
    // 2. posiciona o Woodcutter's pela UI (PlaceBlueprint)
    comObraDoLenhador = step(base, [plantar('woodcutters', LENHADOR)]);
    // 3. conduz a obra ate 'completo' so pelo step()
    lenhador = conduzir(comObraDoLenhador, 'woodcutters');
    // 4. repete o elo: agora a Sawmill esta liberada e pode ser plantada
    const comObraDaSerraria = step(lenhador.estado, [plantar('sawmill', SERRARIA)]);
    recusasAoPlantar = comObraDaSerraria.events.filter((e) => e.type === 'command-rejected');
    serraria = conduzir(comObraDaSerraria, 'sawmill');
    // 5. o elo do BUG-002: com a Serraria de pe, o armazem ADICIONAL pode ser plantado
    comSegundoArmazem = step(serraria.estado, [plantar('storehouse', ARMAZEM_2)]);
  });

  it('1. o seletor do menu Build mostra a Sawmill bloqueada, exigindo o Woodcutter\'s', () => {
    expect(opcao(base, 'sawmill')?.desbloqueado).toBe(false);
    expect(opcao(base, 'sawmill')?.requer).toBe('woodcutters');
    expect(opcao(base, 'woodcutters')?.desbloqueado).toBe(true); // o pai ja e plantavel
  });

  it('2. com a obra do Woodcutter\'s ainda pendente, a Sawmill continua bloqueada', () => {
    expect(doTipo(comObraDoLenhador, 'woodcutters')?.estado).toBe('obra');
    expect(opcao(comObraDoLenhador, 'sawmill')?.desbloqueado).toBe(false);
    expect(comObraDoLenhador.tiposJaConstruidos).toEqual(base.tiposJaConstruidos);
  });

  it('3. concluida a obra pelo step(), a Sawmill libera e o conjunto cresce pelos filhos diretos', () => {
    expect(doTipo(lenhador.estado, 'woodcutters')?.estado).toBe('completo');
    expect(opcao(lenhador.estado, 'sawmill')?.desbloqueado).toBe(true);
    expect(opcao(lenhador.estado, 'sawmill')?.requer).toBe(null);
    // o conjunto cresceu EXATAMENTE pelos filhos diretos, calculados do dado
    expect(new Set(liberados(lenhador.estado)))
      .toEqual(new Set([...liberados(base), ...filhosDe('woodcutters')]));
    expect(lenhador.semEvento).toEqual([]);
    expect(lenhador.semCrescimento).toEqual([]);
  });

  it('4. repete o elo: a Sawmill concluida libera a Farm e os demais filhos dela', () => {
    expect(recusasAoPlantar).toEqual([]); // liberada de verdade: o comando NAO foi recusado
    expect(doTipo(serraria.estado, 'sawmill')?.estado).toBe('completo');
    expect(filhosDe('sawmill')).toContain('farm'); // o elo que o aceite nomeia existe no dado
    expect(estaDesbloqueado(serraria.estado, 'farm')).toBe(true);
    expect(new Set(liberados(serraria.estado)))
      .toEqual(new Set([...liberados(lenhador.estado), ...filhosDe('sawmill')]));
    expect(serraria.semEvento).toEqual([]);
    expect(serraria.semCrescimento).toEqual([]);
  });

  it('5. o elo que faltava (BUG-002): a Serraria libera o armazem ADICIONAL, e ele planta', () => {
    // GDD §5.2: o armazem da abertura vem de pe, o segundo exige Serraria. Antes
    // o dado dizia `desbloqueadoPor: null` e, com `menuBuildInicial` vazio, um
    // segundo armazem era impossivel em qualquer ordem de construcao.
    expect(filhosDe('sawmill')).toContain('storehouse');
    expect(opcao(base, 'storehouse')?.desbloqueado).toBe(false);
    expect(opcao(base, 'storehouse')?.requer).toBe('sawmill');
    expect(opcao(serraria.estado, 'storehouse')?.desbloqueado).toBe(true);

    expect(armazens(serraria.estado)).toBe(1); // so o da abertura
    expect(comSegundoArmazem.events.filter((e) => e.type === 'command-rejected')).toEqual([]);
    expect(armazens(comSegundoArmazem)).toBe(2);
  });

  afterAll(() => {
    const ordenado = (ids: readonly string[]): string => JSON.stringify([...ids].sort());
    gravarEvidencia('F12', {
      feature: 'F12-desbloqueio',
      // VERIFICADO por teste headless: o aceite escrito no BUILD_PLAN.md.
      aceite: {
        sawmillBloqueadaNoInicio: opcao(base, 'sawmill')?.desbloqueado === false,
        sawmillRequerNoInicio: opcao(base, 'sawmill')?.requer ?? null,
        obraDoLenhadorPendente: doTipo(comObraDoLenhador, 'woodcutters')?.estado ?? null,
        sawmillBloqueadaComObraPendente: opcao(comObraDoLenhador, 'sawmill')?.desbloqueado === false,
        lenhadorFicouCompleto: doTipo(lenhador.estado, 'woodcutters')?.estado === 'completo',
        tickDoLenhador: lenhador.tick,
        sawmillLiberadaAposConclusao: opcao(lenhador.estado, 'sawmill')?.desbloqueado === true,
        filhosDiretosDeWoodcutters: filhosDe('woodcutters'),
        liberadosCresceramExatamentePelosFilhosDoLenhador:
          ordenado(liberados(lenhador.estado))
          === ordenado([...liberados(base), ...filhosDe('woodcutters')]),
        serrariaPlantadaSemRecusa: recusasAoPlantar.length === 0,
        serrariaFicouCompleta: doTipo(serraria.estado, 'sawmill')?.estado === 'completo',
        tickDaSerraria: serraria.tick,
        farmLiberada: estaDesbloqueado(serraria.estado, 'farm'),
        // BUG-002, fechado em 2026-09-23: o armazem ADICIONAL e filho da Serraria
        armazemAdicionalRequerNoInicio: opcao(base, 'storehouse')?.requer ?? null,
        armazemAdicionalLiberadoPelaSerraria: estaDesbloqueado(serraria.estado, 'storehouse'),
        armazensAntesDoSegundo: armazens(serraria.estado),
        armazensDepoisDoSegundo: armazens(comSegundoArmazem),
        filhosDiretosDeSawmill: filhosDe('sawmill'),
        liberadosCresceramExatamentePelosFilhosDaSerraria:
          ordenado(liberados(serraria.estado))
          === ordenado([...liberados(lenhador.estado), ...filhosDe('sawmill')]),
        // a guarda que veio da F11c, agora como invariante por tick:
        ticksComCrescimentoSemEvento: [...lenhador.semEvento, ...serraria.semEvento],
        ticksComEventoNovoSemCrescimento: [...lenhador.semCrescimento, ...serraria.semCrescimento],
        historicoFinal: serraria.estado.tiposJaConstruidos,
      },
    });
  });
});
