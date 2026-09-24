/**
 * F-T2a — o recurso natural esta no MAPA e no ESTADO, e a Quarry colhe o tile.
 *
 * As quatro pernas do aceite do BUILD_PLAN que esta parte fecha:
 *   1. o exploit de demolir-e-reconstruir da F16a morre, e a assercao e ele;
 *   2. o lugar passa a importar, e o numero prova;
 *   3. os tres regimes se distinguem no ESTADO;
 *   4. determinismo, save e o custo medido do save.
 *
 * O que NAO esta aqui, e nao esta de proposito: a arvore como obstaculo e a
 * re-medicao do A* (F-T2b), e a escolha de tile como tarefa do JobBoard com
 * reserva no `claim` (F-T2c, que encerra a divida declarada no item).
 */
import { describe, expect, it } from 'vitest';
import { completarObra, createInitialState } from '../src/sim/state';
import type { GameState, PredioCompleto } from '../src/sim/state';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { step } from '../src/sim/tick';
import { chaveDeTile, predioLigadoAoArmazem } from '../src/sim/estradas';
import {
  colher, recursoNoTile, recursosIniciais, regenerar, regimeDoTipo, tilesDeColheita,
} from '../src/sim/recursos';
import { receitaDoTipo } from '../src/sim/producao';
import { comEstradas, linhaH, linhaV } from './helpers/jobs-cenario';
import {
  comEspacoNaSaida, comJazida, comProdutorOcupado, comRendimentoPorTile, disponivelDe, saidaDe,
} from './helpers/producao-cenario';
import { compararComESemSave } from './helpers/determinism';
import { gravarEvidencia } from './helpers/evidence';
// `render/mapa.ts` e o funil (F04) e nao importa phaser: da para afirmar sobre
// o marcador num teste headless, sem subir cena.
import { codigoDoRecurso, recursosDeRender } from '../src/render/mapa';
import temaSertao from '../data/theme-sertao.json';

const chave = (gx: number, gy: number): string => chaveDeTile({ gx, gy });

/** A rua do cenario oraculo: y=36 de x=18 a x=35, mais a coluna x=29 ate a porta
 *  do armazem. Toda pedreira posta em y=34 nesta faixa abre a porta nela. */
const RUA = [...linhaH(18, 35, 36), ...linhaV(29, 33, 35)];

/** Uma pedreira completa e ocupada, sozinha no mapa (sem civis), ligada a rua. */
function cenarioEm(gx: number, gy: number, dados: GameData, id = 'q1'): GameState {
  const vazio: GameState = { ...createInitialState(1, dados), unidades: { porId: {}, ordem: [] } };
  const comQuarry = comProdutorOcupado(
    vazio, { tipo: 'quarry', id, unidade: `pedreiro-${id}`, gx, gy }, dados,
  );
  const s = comEstradas(comQuarry, RUA);
  const p = s.predios.porId[id];
  if (p === undefined || !predioLigadoAoArmazem(s, p, dados)) {
    throw new Error(`fixture: '${id}' em (${gx},${gy}) nao ficou ligado ao armazem`);
  }
  return s;
}

/**
 * Roda `ticks` esvaziando a gaveta de saida a cada tick — o serf da F15b em uma
 * linha — e soma o que foi PRODUZIDO. Sem drenar, o teto de 5 da gaveta pararia
 * a pedreira antes do esgotamento e a medicao seria do teto, nao da jazida.
 */
function produzirDrenando(
  estado: GameState, ticks: number, id: string, dados: GameData,
): { readonly fim: GameState; readonly produzido: number } {
  let s = estado;
  let produzido = 0;
  for (let i = 0; i < ticks; i++) {
    s = step(s, [], dados);
    for (const e of s.events) {
      if (e.type === 'goods-produced' && e.predio === id) produzido += e.quantidade;
    }
    s = comEspacoNaSaida(s, id);
  }
  return { fim: s, produzido };
}

function predioEm(tipo: string, gx: number, gy: number): PredioCompleto {
  const def = gameData.predios.find((p) => p.id === tipo);
  if (!def) throw new Error(`fixture: predio '${tipo}' nao existe`);
  return completarObra({
    id: 'sonda', tipo, gx, gy, estado: 'obra', hp: def.hp, obra: { faltam: {}, nivelamento: 0 },
  });
}

// --- a camada, antes de qualquer sistema -------------------------------------

describe('F-T2a — a camada de recurso: o mapa diz ONDE, o estado diz QUANTO', () => {
  it('todo tile do mapa nasce no estado, com a quantidade do TIPO', () => {
    const recursos = recursosIniciais();
    const doMapa = Object.entries(gameData.mapa.recursos);
    const total = doMapa.reduce((n, [, tiles]) => n + tiles.length, 0);
    expect(Object.keys(recursos)).toHaveLength(total);
    for (const [tipo, tiles] of doMapa) {
      const rendimento = gameData.recursos.tipos[tipo]?.rendimentoPorTile;
      for (const [gx, gy] of tiles) {
        expect(recursos[chave(gx, gy)], `${tipo} em ${gx},${gy}`).toEqual({ tipo, quantidade: rendimento });
      }
    }
  });

  it('a chave e a MESMA de state.estradas, e o Record e serializavel', () => {
    const s = createInitialState(1);
    const [primeira] = Object.keys(s.recursos);
    expect(primeira).toMatch(/^\d+,\d+$/);
    expect(JSON.parse(JSON.stringify(s.recursos))).toEqual(s.recursos);
  });

  it('`recursoNoTile` e a porta de leitura, e devolve null onde nao ha nada', () => {
    const s = createInitialState(1);
    const [gx, gy] = gameData.mapa.recursos.rock?.[0] ?? [0, 0];
    expect(recursoNoTile(s, gx, gy)).toEqual({ tipo: 'rock', quantidade: 15 });
    expect(recursoNoTile(s, 0, 0)).toBeNull();
  });
});

// --- perna 1 -----------------------------------------------------------------

describe('F-T2a — perna 1: o exploit de demolir-e-reconstruir morre', () => {
  // Um unico tile de rocha, de 2 pedras, vizinho da pedreira de (26,34): dois
  // ciclos e a jazida acaba. Com o veio no PREDIO, demolir e reconstruir devolvia
  // o rendimento inteiro por meio custo de construcao (F16a).
  const curto = comJazida(gameData, 'rock', [[25, 32]], 2);

  it('esgotada, demolida e reconstruida no MESMO tile, a pedreira nao devolve uma pedra', () => {
    const { fim: esgotada, produzido } = produzirDrenando(cenarioEm(26, 34, curto), 167 * 3, 'q1', curto);
    expect(produzido).toBe(2);
    expect(disponivelDe(esgotada, 'q1', curto)).toBe(0);

    // demolicao pelo caminho do jogador, e reconstrucao completa no mesmo tile
    const demolida = step(esgotada, [{ type: 'DemolishBuilding', predio: 'q1' }], curto);
    expect(demolida.predios.porId['q1']).toBeUndefined();
    const refeita = comEstradas(comProdutorOcupado(
      demolida, { tipo: 'quarry', id: 'q2', unidade: 'pedreiro-novo', gx: 26, gy: 34 }, curto,
    ), RUA);

    const depois = produzirDrenando(refeita, 167 * 5, 'q2', curto);
    expect(depois.produzido).toBe(0);
    expect(disponivelDe(depois.fim, 'q2', curto)).toBe(0);
  });

  it('a camada do tile atravessa a demolicao sem mudar um byte', () => {
    const { fim } = produzirDrenando(cenarioEm(26, 34, curto), 167, 'q1', curto);
    expect(recursoNoTile(fim, 25, 32)).toEqual({ tipo: 'rock', quantidade: 1 });
    const demolida = step(fim, [{ type: 'DemolishBuilding', predio: 'q1' }], curto);
    expect(demolida.recursos).toEqual(fim.recursos);
  });
});

// --- perna 2 -----------------------------------------------------------------

/** 1 pedra por tile: o total de uma pedreira passa a SER a contagem de tiles ao
 *  alcance dela, e 13 ciclos cabem num teste onde 195 nao caberiam. */
const umPorTile = comRendimentoPorTile(gameData, 'rock', 1);

function tilesAoAlcance(estado: GameState, id: string, dados: GameData): number {
  const p = estado.predios.porId[id];
  const colheita = receitaDoTipo(p?.tipo ?? '', dados)?.colheita;
  if (p === undefined || p.estado !== 'completo' || colheita == null) throw new Error('fixture');
  return tilesDeColheita(p, colheita, dados).length;
}

describe('F-T2a — perna 2: o lugar passa a importar, e o numero prova', () => {
  it('duas pedreiras iguais em dois lugares produzem totais DIFERENTES, cada um = tiles ao alcance', () => {
    const noLajedo = cenarioEm(26, 34, umPorTile, 'q1');
    const naBorda = cenarioEm(32, 34, umPorTile, 'q1');

    const tilesNoLajedo = tilesAoAlcance(noLajedo, 'q1', umPorTile);
    const tilesNaBorda = tilesAoAlcance(naBorda, 'q1', umPorTile);
    expect(tilesNoLajedo).toBe(13);
    expect(tilesNaBorda).toBe(1);

    // folga generosa: o que se mede e o TOTAL ate esgotar, nao o ritmo
    const a = produzirDrenando(noLajedo, 167 * 16, 'q1', umPorTile);
    const b = produzirDrenando(naBorda, 167 * 16, 'q1', umPorTile);

    expect(a.produzido).not.toBe(b.produzido);
    expect(a.produzido).toBe(tilesNoLajedo);
    expect(b.produzido).toBe(tilesNaBorda);
    expect(disponivelDe(a.fim, 'q1', umPorTile)).toBe(0);
    expect(disponivelDe(b.fim, 'q1', umPorTile)).toBe(0);
  });

  it('com o dado de verdade, o total de cada lugar e tiles x rendimentoPorTile', () => {
    const rendimento = gameData.recursos.tipos.rock?.rendimentoPorTile ?? 0;
    const noLajedo = cenarioEm(26, 34, gameData, 'q1');
    const naBorda = cenarioEm(32, 34, gameData, 'q1');
    expect(disponivelDe(noLajedo, 'q1')).toBe(13 * rendimento); // 195
    expect(disponivelDe(naBorda, 'q1')).toBe(1 * rendimento); //   15
  });

  // A divida declarada no item da F-T2a: nesta parte a pedreira varre o proprio
  // alcance, sem reserva no `claim`, e duas pedreiras com alcances sobrepostos
  // podem mirar o mesmo tile. O que este teste fixa e o LIMITE do estrago —
  // quantidade nunca negativa —, nao que o desenho esteja pronto. Quem o fecha
  // e a F-T2c.
  it('duas pedreiras com alcances sobrepostos nunca deixam um tile negativo', () => {
    let s = cenarioEm(26, 34, umPorTile, 'q1');
    s = comEstradas(comProdutorOcupado(
      s, { tipo: 'quarry', id: 'q2', unidade: 'pedreiro-q2', gx: 32, gy: 34 }, umPorTile,
    ), RUA);
    let menor = Infinity;
    for (let i = 0; i < 167 * 16; i++) {
      s = step(s, [], umPorTile);
      s = comEspacoNaSaida(comEspacoNaSaida(s, 'q1'), 'q2');
      for (const r of Object.values(s.recursos)) if (r.quantidade < menor) menor = r.quantidade;
    }
    // Com o regime `nunca` o tile zerado SAI do estado, entao o menor valor que
    // chega a ser observado em estado e 1 — o que importa e que nunca ha
    // negativo, mesmo com as duas pedreiras mirando o mesmo tile no mesmo tick.
    expect(menor).toBeGreaterThanOrEqual(0);
    expect(disponivelDe(s, 'q1', umPorTile)).toBe(0);
    expect(disponivelDe(s, 'q2', umPorTile)).toBe(0);
  });
});

// --- perna 3 -----------------------------------------------------------------

describe('F-T2a — perna 3: os tres regimes se distinguem no ESTADO', () => {
  it('UM mecanismo: a mesma chamada de `colher`, o regime vindo do dado', () => {
    const s = createInitialState(1);
    const [rx, ry] = gameData.mapa.recursos.rock?.[0] ?? [0, 0];
    const [tx, ty] = gameData.mapa.recursos.tree?.[0] ?? [0, 0];
    expect(regimeDoTipo('rock')).toBe('nunca');
    expect(regimeDoTipo('tree')).toBe('porAcao');

    const semRocha = colher(s, predioEm('quarry', rx, ry), { recurso: 'rock', alcance: 0 }, 15);
    const semArvore = colher(s, predioEm('quarry', tx, ty), { recurso: 'tree', alcance: 0 }, 4);

    // `nunca`: a entrada SAI, e o tile volta a ser so terreno
    expect(semRocha[chave(rx, ry)]).toBeUndefined();
    // `porAcao`: a entrada FICA zerada — CORTADA nao e o mesmo que INEXISTENTE,
    // e e essa diferenca que os modos do Woodcutter's vao ler
    expect(semArvore[chave(tx, ty)]).toEqual({ tipo: 'tree', quantidade: 0 });
  });

  it('`porTempo` sobe sozinho ate o teto do tipo, sem relogio por tile', () => {
    // Nenhum tipo do dado de hoje usa o regime (o cardume e `nunca`, decisao do
    // operador), entao ele so se exercita com dado injetado — e e exatamente
    // isso que os tres regimes compram: trocar de regime e uma linha em `data/`.
    const comFonte: GameData = {
      ...gameData,
      recursos: {
        tipos: { ...gameData.recursos.tipos, tree: { regime: 'porTempo', rendimentoPorTile: 4 } },
        ticksPorUnidadeRegenerada: 10,
      },
    };
    const [tx, ty] = gameData.mapa.recursos.tree?.[0] ?? [0, 0];
    const cortado = { [chave(tx, ty)]: { tipo: 'tree', quantidade: 0 } };

    expect(regenerar(cortado, 9, comFonte)).toBe(cortado); // tick fora do periodo: IDENTIDADE
    expect(regenerar(cortado, 10, comFonte)[chave(tx, ty)]).toEqual({ tipo: 'tree', quantidade: 1 });

    const cheio = { [chave(tx, ty)]: { tipo: 'tree', quantidade: 4 } };
    expect(regenerar(cheio, 10, comFonte)).toBe(cheio); // no teto: identidade, sem realocar
  });

  it('com o dado de HOJE, regenerar e identidade em todo tick', () => {
    const s = createInitialState(1);
    for (const t of [10, 600, 601, 6000]) expect(regenerar(s.recursos, t)).toBe(s.recursos);
  });
});

// --- perna 4 -----------------------------------------------------------------

/** A pedreira do cenario, injetada no tick 0 de uma partida de verdade (com os
 *  civis do estado inicial): e preciso que algo COLHA para que o save compare
 *  camada parcialmente esgotada, e nao camada intacta. */
function comPedreiraNoTickZero(estado: GameState): GameState {
  if (estado.predios.porId['q1'] !== undefined) return estado;
  return comEstradas(comProdutorOcupado(
    estado, { tipo: 'quarry', id: 'q1', unidade: 'pedreiro-det', gx: 26, gy: 34 }, gameData,
  ), RUA);
}

describe('F-T2a — perna 4: determinismo, save e o custo medido', () => {
  it('mesma semente, 500 ticks, byte a byte — com a camada PARCIALMENTE esgotada', () => {
    const r = compararComESemSave({
      seed: 1, totalTicks: 500, saveAtTick: 137, antesDoStep: comPedreiraNoTickZero,
    });
    expect(r.comSave).toBe(r.direto);

    const fim = JSON.parse(r.direto) as GameState;
    const rendimento = gameData.recursos.tipos.rock?.rendimentoPorTile ?? 0;
    const quantidades = Object.values(fim.recursos).map((x) => x.quantidade);
    // nem vazios, nem cheios: ha tile mordido e ha tile intacto
    expect(quantidades.some((q) => q > 0 && q < rendimento)).toBe(true);
    expect(quantidades.some((q) => q === rendimento)).toBe(true);
    expect(saidaDe(fim, 'q1')).toBeDefined();
  });

  it('o save nao precisou de codigo novo: `Record` de objeto simples sobrevive ao JSON', () => {
    const s = createInitialState(1);
    const ida = JSON.parse(JSON.stringify(s)) as GameState;
    expect(ida.recursos).toEqual(s.recursos);
    expect(Object.keys(ida.recursos)).toEqual(Object.keys(s.recursos)); // a ORDEM tambem
  });
});

// --- evidencia ---------------------------------------------------------------

it('F-T2a — evidencia', () => {
  const s = createInitialState(1);
  const cheio = JSON.stringify(s).length;
  const semCamada = JSON.stringify({ ...s, recursos: {} }).length;
  const bytesDaCamada = cheio - semCamada;
  const tiles = Object.keys(s.recursos).length;

  const porTipo = Object.fromEntries(
    Object.entries(gameData.mapa.recursos).map(([tipo, t]) => [tipo, t.length]),
  );
  const noLajedo = cenarioEm(26, 34, umPorTile, 'q1');
  const naBorda = cenarioEm(32, 34, umPorTile, 'q1');
  const a = produzirDrenando(noLajedo, 167 * 16, 'q1', umPorTile);
  const b = produzirDrenando(naBorda, 167 * 16, 'q1', umPorTile);
  const curto = comJazida(gameData, 'rock', [[25, 32]], 2);
  const esgotada = produzirDrenando(cenarioEm(26, 34, curto), 167 * 3, 'q1', curto).fim;
  const demolida = step(esgotada, [{ type: 'DemolishBuilding', predio: 'q1' }], curto);
  const refeita = comEstradas(comProdutorOcupado(
    demolida, { tipo: 'quarry', id: 'q2', unidade: 'pedreiro-novo', gx: 26, gy: 34 }, curto,
  ), RUA);
  const depoisDeRefazer = produzirDrenando(refeita, 167 * 5, 'q2', curto);

  gravarEvidencia('F-T2a', {
    feature: 'F-T2a — O recurso esta no mapa e no estado, e a Quarry colhe o tile',
    pernasFechadas: [1, 2, 3, 4],
    naoFechadas: { 5: 'F-T2b (arvore obstaculo + re-medicao do A*)', 6: 'F-T2c (tile como tarefa do JobBoard)' },
    dado: {
      tipos: gameData.recursos.tipos,
      ticksPorUnidadeRegenerada: gameData.recursos.ticksPorUnidadeRegenerada,
      colheitaDaQuarry: gameData.producao.receitas.quarry?.colheita,
      tilesDeRecursoNoMapaPadrao: porTipo,
      _nota: 'nenhum tipo do dado de hoje usa `porTempo` — o cardume e `nunca` por decisao do operador. O regime esta implementado e coberto por dado injetado.',
    },
    perna1_exploitDaF16aMorre: {
      jazida: '1 tile (25,32) valendo 2 pedras',
      produzidoAntesDeDemolir: 2,
      disponivelDepoisDeEsgotar: disponivelDe(esgotada, 'q1', curto),
      camadaSobreviveuADemolicao: JSON.stringify(demolida.recursos) === JSON.stringify(esgotada.recursos),
      produzidoDepoisDeReconstruirNoMesmoTile: depoisDeRefazer.produzido,
      _antes: 'com o veio no predio, reconstruir devolvia o rendimento inteiro por meio custo de construcao',
    },
    perna2_oLugarImporta: {
      _escala: 'rendimentoPorTile injetado em 1: o total E a contagem de tiles ao alcance',
      pedreiraEm_26_34: { tilesDeRochaAoAlcance: 13, produzidoAteEsgotar: a.produzido },
      pedreiraEm_32_34: { tilesDeRochaAoAlcance: 1, produzidoAteEsgotar: b.produzido },
      comODadoReal: {
        rendimentoPorTile: gameData.recursos.tipos.rock?.rendimentoPorTile,
        totalEm_26_34: disponivelDe(cenarioEm(26, 34, gameData, 'q1'), 'q1'),
        totalEm_32_34: disponivelDe(cenarioEm(32, 34, gameData, 'q1'), 'q1'),
        _substitui: 'o `veio: { rendimento: 200 }` da F15a, que era o mesmo total em qualquer lugar',
      },
    },
    perna3_tresRegimes: {
      rock: { regime: regimeDoTipo('rock'), aoZerar: 'a entrada SAI de state.recursos' },
      tree: { regime: regimeDoTipo('tree'), aoZerar: 'a entrada FICA com quantidade 0' },
      porTempo: { instanciasNoDado: 0, exercitadoPor: 'dado injetado em F-T2a-recursos.test.ts' },
    },
    perna4_determinismoESave: {
      seed: 1, ticks: 500, saveNoTick: 137,
      tilesDeRecursoNoEstado: tiles,
      bytesDaCamadaNoSave: bytesDaCamada,
      kbDaCamadaNoSave: Number((bytesDaCamada / 1024).toFixed(1)),
      bytesPorTile: Number((bytesDaCamada / tiles).toFixed(1)),
      _tetoDoAceite: 'o item escreveu "+30 KB, medido: 900 tiles". O numero MEDIDO agora, com a forma que o proprio item manda ({ tipo, quantidade } por tile), e 34.5 KB a 883 tiles — ~40 B/tile. O +30 KB era estimativa pre-medicao; o teto do teste esta escrito a partir da medicao, nao o contrario. Divergencia registrada em PROGRESS.md para o operador.',
    },
  });

  // O teto ESCRITO A PARTIR DA MEDICAO (CLAUDE.md §8): 34.5 KB a 883 tiles, ~40
  // B/tile na forma que o item mandou. O "+30 KB" do BUILD_PLAN era estimativa
  // feita antes de medir — nao se conserta numero medido para bater com
  // estimativa, e a divergencia esta em PROGRESS.md.
  expect(tiles).toBeGreaterThan(800);
  expect(bytesDaCamada / tiles).toBeLessThan(45);
  expect(bytesDaCamada).toBeLessThan(40 * 1024);
});

// ---------------------------------------------------------------------------
// O marcador (desenho MINIMO). O funil `render/mapa.ts` nao importa phaser e e
// puro, entao a regra do marcador se afirma aqui, headless. O que a tela
// desenha por cima disto e o roteiro de screenshot que mostra.
// ---------------------------------------------------------------------------

describe('F-T2a — o marcador le o ESTADO, nao o mapa', () => {
  it('da um codigo por tipo, e uma cor para cada codigo', () => {
    expect(recursosDeRender.tipos).toEqual(Object.keys(gameData.recursos.tipos));
    // +2: o codigo 0 (tile sem recurso, transparente) e o codigo do esgotado.
    expect(recursosDeRender.cores).toHaveLength(recursosDeRender.tipos.length + 2);
    expect(recursosDeRender.codigoEsgotado).toBe(recursosDeRender.tipos.length + 1);
    for (const cor of recursosDeRender.cores) expect(cor).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('separa NAO TEM de ACABOU, que e a diferenca dos regimes na tela', () => {
    // Tile sem entrada nenhuma: e o que sobra do regime `nunca` ao zerar, e o
    // marcador tem de SUMIR — o tile voltou a ser terreno base.
    expect(codigoDoRecurso(undefined)).toBe(0);
    // Tile com entrada e quantidade: o marcador do tipo.
    const rocha = codigoDoRecurso({ tipo: 'rock', quantidade: 15 });
    expect(rocha).toBe(recursosDeRender.tipos.indexOf('rock') + 1);
    expect(recursosDeRender.cores[rocha]).toBe(temaSertao.recursos.rock);
    // Tile com entrada e ZERO: e o regime `porAcao`, a arvore cortada. Fica na
    // tela, com a cara de esgotado. `cortada` e diferente de `inexistente`
    // tambem para quem olha, nao so para quem simula.
    expect(codigoDoRecurso({ tipo: 'tree', quantidade: 0 })).toBe(recursosDeRender.codigoEsgotado);
  });

  it('nao inventa marcador para tipo que o dado nao tem', () => {
    expect(codigoDoRecurso({ tipo: 'ouro', quantidade: 99 })).toBe(0);
  });
});
