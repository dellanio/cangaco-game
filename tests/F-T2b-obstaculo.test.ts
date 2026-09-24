/**
 * F-T2b — A ARVORE E OBSTACULO, e o A* foi re-medido.
 *
 * Perna 5 do aceite da F-T2 (BUILD_PLAN). Quatro blocos, na ordem do item:
 *   1. o dado manda, e quem bloqueia esta EM PE;
 *   2. o passo reprova nas duas metades da mesma regra (A* e rede de estradas);
 *   3. a camada derivada nao mata o cache de caminho a cada colheita;
 *   4. a re-medicao: busca curta e longa, mapa sem floresta contra mapa com a
 *      floresta do mapa padrao, us E nos expandidos.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameState, RecursoNoTile } from '../src/sim/state';
import type { GameData, MapaData } from '../src/sim/data/types';
import { canPlaceRoad, chaveDeTile, indiceDeEstradas } from '../src/sim/estradas';
import { ehTransponivel } from '../src/sim/mapa';
import {
  bloqueadoPorRecurso, camadaDeBloqueio, colher, recursoBloqueiaPasso, recursoNoTile,
} from '../src/sim/recursos';
import {
  buscarCaminho, nosExpandidos, tileAndavel, zerarEstatisticasDeBusca,
} from '../src/sim/pathfinding';
import { comEstradas, inicial, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';

const chave = (gx: number, gy: number): string => chaveDeTile(tile(gx, gy));

/** Um estado com a camada de recurso DECLARADA aqui: o caso e sobre o
 *  obstaculo, e um mapa de verdade tem arvore onde ele quiser. */
function comRecursos(entradas: Record<string, RecursoNoTile>): GameState {
  return { ...inicial, recursos: entradas };
}

const SEM_RECURSOS: GameState = comRecursos({});

/** Uma faixa de grama livre, longe da vila e sem recurso no mapa: e onde os
 *  casos plantam a propria arvore. Conferida por assercao antes de usar. */
const FAIXA = { x0: 8, y0: 60, largura: 14 };

describe('F-T2b — o cenario dos casos e o que eles dizem ser', () => {
  it('a faixa dos casos e transponivel e nao tem recurso do mapa', () => {
    for (let dx = 0; dx < FAIXA.largura; dx += 1) {
      for (let dy = -2; dy <= 2; dy += 1) {
        const [gx, gy] = [FAIXA.x0 + dx, FAIXA.y0 + dy];
        expect(ehTransponivel(gx, gy), `(${gx},${gy}) da faixa dos casos`).toBe(true);
        expect(recursoNoTile(inicial, gx, gy), `(${gx},${gy}) da faixa dos casos`).toBeNull();
      }
    }
  });
});

describe('F-T2b — quem bloqueia sai do DADO, e esta em pe', () => {
  it('a arvore bloqueia; a rocha e o cardume nao', () => {
    expect(recursoBloqueiaPasso({ tipo: 'tree', quantidade: 4 })).toBe(true);
    expect(recursoBloqueiaPasso({ tipo: 'rock', quantidade: 15 })).toBe(false);
    expect(recursoBloqueiaPasso({ tipo: 'fish', quantidade: 20 })).toBe(false);
  });

  it('a arvore CORTADA deixa passar — cortado nao e inexistente', () => {
    expect(recursoBloqueiaPasso({ tipo: 'tree', quantidade: 0 })).toBe(false);
    expect(recursoBloqueiaPasso(null)).toBe(false);
  });

  it('quem bloqueia vem de data/resources.json, e o teste nao digita o id', () => {
    // A guarda e estrutural: ela nao afirma "tree bloqueia", ela afirma que o
    // conjunto que o runtime usa E o conjunto que o dado declara. Trocar o
    // `bloqueiaPasso` de um tipo em `data/` muda os dois lados juntos.
    const doDado = Object.entries(gameData.recursos.tipos)
      .filter(([, def]) => def.bloqueiaPasso).map(([id]) => id).sort();
    const doRuntime = Object.keys(gameData.recursos.tipos)
      .filter((id) => recursoBloqueiaPasso({ tipo: id, quantidade: 1 })).sort();
    expect(doRuntime).toEqual(doDado);
    expect(doDado.length).toBeGreaterThan(0); // senao os dois lados seriam vazios e iguais
  });

  it('tipo que o dado nao conhece nao bloqueia (save de outra versao)', () => {
    expect(recursoBloqueiaPasso({ tipo: 'inventado', quantidade: 9 })).toBe(false);
  });
});

describe('F-T2b — o passo reprova: o A*', () => {
  const y = FAIXA.y0;
  const de = tile(FAIXA.x0, y);
  const ate = tile(FAIXA.x0 + 4, y);

  it('sem arvore, o caminho e reto', () => {
    const caminho = buscarCaminho(SEM_RECURSOS, de, [ate], 'livre');
    expect(caminho?.tiles.length).toBe(4);
    expect(caminho?.tiles.every((t) => t.gy === y)).toBe(true);
  });

  it('com a arvore no meio, o caminho DESVIA — e continua existindo', () => {
    const comArvore = comRecursos({ [chave(FAIXA.x0 + 2, y)]: { tipo: 'tree', quantidade: 4 } });
    const caminho = buscarCaminho(comArvore, de, [ate], 'livre');
    expect(caminho).not.toBeNull();
    expect(caminho?.tiles.some((t) => t.gy !== y), 'saiu da linha reta').toBe(true);
    expect(caminho?.tiles.some((t) => t.gx === FAIXA.x0 + 2 && t.gy === y)).toBe(false);
  });

  it('a mesma arvore CORTADA deixa o caminho reto de volta', () => {
    const cortada = comRecursos({ [chave(FAIXA.x0 + 2, y)]: { tipo: 'tree', quantidade: 0 } });
    expect(buscarCaminho(cortada, de, [ate], 'livre')?.tiles.length).toBe(4);
  });

  it('a rocha no meio NAO desvia: quem bloqueia e o dado, nao "ter recurso"', () => {
    const comRocha = comRecursos({ [chave(FAIXA.x0 + 2, y)]: { tipo: 'rock', quantidade: 15 } });
    expect(buscarCaminho(comRocha, de, [ate], 'livre')?.tiles.length).toBe(4);
  });

  it('a parede de arvore fecha: sem caminho e `null`, nao caminho por cima', () => {
    const parede: Record<string, RecursoNoTile> = {};
    for (let gy = 0; gy < gameData.terreno.mapaPadrao.altura; gy += 1) {
      parede[chave(FAIXA.x0 + 2, gy)] = { tipo: 'tree', quantidade: 4 };
    }
    expect(buscarCaminho(comRecursos(parede), de, [ate], 'livre')).toBeNull();
  });

  it('`tileAndavel` diz o mesmo que o A* — os quatro sistemas perguntam a ela', () => {
    const comArvore = comRecursos({ [chave(FAIXA.x0 + 2, y)]: { tipo: 'tree', quantidade: 4 } });
    expect(tileAndavel(comArvore, tile(FAIXA.x0 + 2, y), 'livre')).toBe(false);
    expect(tileAndavel(SEM_RECURSOS, tile(FAIXA.x0 + 2, y), 'livre')).toBe(true);
  });

  it('a arvore na quina proibe a diagonal', () => {
    const dg = tile(FAIXA.x0, y);
    const alvo = tile(FAIXA.x0 + 1, y + 1);
    expect(buscarCaminho(SEM_RECURSOS, dg, [alvo], 'livre')?.tiles.length).toBe(1);
    const quinas = comRecursos({
      [chave(FAIXA.x0 + 1, y)]: { tipo: 'tree', quantidade: 4 },
      [chave(FAIXA.x0, y + 1)]: { tipo: 'tree', quantidade: 4 },
    });
    const contornado = buscarCaminho(quinas, dg, [alvo], 'livre');
    expect(contornado).not.toBeNull();
    expect(contornado?.tiles.length).toBeGreaterThan(1);
  });
});

describe('F-T2b — o passo reprova: a rede de estradas, a outra metade', () => {
  const y = FAIXA.y0;

  it('a arvore na quina corta a diagonal da rua tambem', () => {
    // Duas ruas que so se tocam pela diagonal, com arvore nas duas quinas: a
    // rede tem de ver DOIS componentes, e nao um. E o que mantem a propriedade
    // da F10 (A* por estrada <=> `isConnected`) valendo com floresta.
    const tiles = [tile(FAIXA.x0, y), tile(FAIXA.x0 + 1, y + 1)];
    expect(indiceDeEstradas(comEstradas(SEM_RECURSOS, tiles)).quantidade).toBe(1);

    const comArvore = comEstradas(comRecursos({
      [chave(FAIXA.x0 + 1, y)]: { tipo: 'tree', quantidade: 4 },
      [chave(FAIXA.x0, y + 1)]: { tipo: 'tree', quantidade: 4 },
    }), tiles);
    expect(indiceDeEstradas(comArvore).quantidade).toBe(2);
  });

  it('a estrada nao se assenta sobre arvore em pe, e o motivo tem nome proprio', () => {
    const alvo = tile(FAIXA.x0 + 2, y);
    const comArvore = comRecursos({ [chaveDeTile(alvo)]: { tipo: 'tree', quantidade: 4 } });
    const recusa = canPlaceRoad(comArvore, [alvo]);
    expect(recusa.ok).toBe(false);
    expect(recusa.ok === false && recusa.motivo).toBe('recurso');
    expect(recusa.ok === false && recusa.tile).toEqual(alvo);
  });

  it('sobre a MESMA arvore cortada, e sobre rocha, a estrada passa', () => {
    const alvo = tile(FAIXA.x0 + 2, y);
    const cortada = comRecursos({ [chaveDeTile(alvo)]: { tipo: 'tree', quantidade: 0 } });
    expect(canPlaceRoad(cortada, [alvo]).ok).toBe(true);
    const rocha = comRecursos({ [chaveDeTile(alvo)]: { tipo: 'rock', quantidade: 15 } });
    expect(canPlaceRoad(rocha, [alvo]).ok).toBe(true);
  });
});

describe('F-T2b — a camada derivada nao mata o cache a cada colheita', () => {
  const daRocha = chave(FAIXA.x0, FAIXA.y0);
  const daArvore = chave(FAIXA.x0 + 2, FAIXA.y0);

  it('mexer so na ROCHA troca `state.recursos` e NAO troca a camada', () => {
    const antes = comRecursos({
      [daRocha]: { tipo: 'rock', quantidade: 15 },
      [daArvore]: { tipo: 'tree', quantidade: 4 },
    });
    const camadaAntes = camadaDeBloqueio(antes);
    const depois = { ...antes, recursos: { ...antes.recursos, [daRocha]: { tipo: 'rock', quantidade: 9 } } };
    expect(depois.recursos, 'referencia nova de recursos').not.toBe(antes.recursos);
    expect(camadaDeBloqueio(depois), 'MESMA camada').toBe(camadaAntes);
  });

  it('cortar a ARVORE troca a camada — senao o obstaculo nunca sumiria', () => {
    const antes = comRecursos({ [daArvore]: { tipo: 'tree', quantidade: 4 } });
    const camadaAntes = camadaDeBloqueio(antes);
    const depois = comRecursos({ [daArvore]: { tipo: 'tree', quantidade: 0 } });
    expect(camadaAntes.bloqueados).toBe(1);
    expect(camadaDeBloqueio(depois)).not.toBe(camadaAntes);
    expect(camadaDeBloqueio(depois).bloqueados).toBe(0);
  });

  it('`colher` de verdade, no mapa de verdade, preserva a camada', () => {
    // O caso que motivou a camada derivada: a pedreira colhe TODO tick, e cada
    // colheita devolve `recursos` novo. Se a camada trocasse junto, o cache de
    // caminho do A* morreria a cada tick de pedreira.
    const pedreira = Object.values(inicial.predios.porId)
      .find((p) => p !== undefined && p.tipo === 'quarry' && p.estado === 'completo');
    const receita = gameData.producao.receitas.quarry ?? null;
    const colheita = receita === null ? null : receita.colheita;
    expect(colheita, 'a quarry tem colheita no dado').not.toBeNull();
    const camadaAntes = camadaDeBloqueio(inicial);
    if (pedreira !== undefined && pedreira.estado === 'completo' && colheita !== null) {
      const recursos = colher(inicial, pedreira, colheita, 1);
      expect(recursos, 'colheu de verdade').not.toBe(inicial.recursos);
      expect(camadaDeBloqueio({ recursos })).toBe(camadaAntes);
    }
    // Sem pedreira na vila inicial, o equivalente pelo mesmo caminho: tirar
    // uma unidade de um tile de rocha do MAPA nao pode mexer na camada.
    const [rx, ry] = gameData.mapa.recursos.rock?.[0] ?? [0, 0];
    const semUmaPedra = { ...inicial.recursos, [chave(rx, ry)]: { tipo: 'rock', quantidade: 14 } };
    expect(camadaDeBloqueio({ recursos: semUmaPedra })).toBe(camadaAntes);
  });

  it('a mesma referencia de `recursos` devolve a mesma camada (memo)', () => {
    const estado = comRecursos({ [daArvore]: { tipo: 'tree', quantidade: 4 } });
    expect(camadaDeBloqueio(estado)).toBe(camadaDeBloqueio(estado));
  });

  it('`bloqueadoPorRecurso` fora da grade e `false`, nao estouro', () => {
    const camada = camadaDeBloqueio(SEM_RECURSOS);
    expect(bloqueadoPorRecurso(camada, -1, 0)).toBe(false);
    expect(bloqueadoPorRecurso(camada, camada.largura, 0)).toBe(false);
    expect(bloqueadoPorRecurso(camada, 0, camada.altura)).toBe(false);
  });
});

// --- bloco 4: a re-medicao ---------------------------------------------------
//
// A F-T1 mediu o A* num mapa em que NENHUM tile era obstaculo: o unico jeito de
// fechar passagem era terreno. A F-D3 pos 16 tiles de arvore no patio dos
// cenarios e floresta no mapa inteiro, entao a pergunta da F-T1 — "quanto o mapa
// de verdade custa contra o mapa liso" — foi refeita aqui com a floresta em pe.
//
// Tres eixos, porque respondem a tres perguntas diferentes:
//   curta  — busca de 3 tiles com o corredor livre. Mede o que a checagem por
//            vizinho custa em TODA busca do jogo, tenha arvore por perto ou nao.
//   longa  — atravessa o mapa. Mede se a floresta alonga o caminho ou alarga a
//            frente de busca.
//   desvio — busca de 3 tiles com arvore DENTRO do corredor, contra os MESMOS
//            pares sem floresta. Mede o que o obstaculo custa quando ele
//            realmente atrapalha. E o eixo em que a floresta aperta.
//
// O relogio e ruidoso e o teto dele fica frouxo, como na F-T1 e na F17c. O que
// vira guarda ESTRITA e a contagem de nos expandidos: ela e funcao pura do
// estado e do mapa, nao da maquina, e portanto reprova de verdade.

const GRAMA_DO_MAPA = Object.entries(gameData.mapa.legenda)
  .find(([, tipo]) => tipo === 'grama')?.[0] ?? 'g';

const MAPA_LISO: MapaData = {
  id: 'liso-F-T2b',
  largura: gameData.terreno.mapaPadrao.largura,
  altura: gameData.terreno.mapaPadrao.altura,
  linhas: Array(gameData.terreno.mapaPadrao.altura)
    .fill(GRAMA_DO_MAPA.repeat(gameData.terreno.mapaPadrao.largura)),
  legenda: gameData.mapa.legenda,
  recursos: {},
};

/** O mesmo dado com outro mapa; `mapaPadrao` acompanha porque o carregador
 *  exige que os dois batam (mesmo molde da F-T1). */
function dadosComMapa(mapa: MapaData): GameData {
  return {
    ...gameData,
    mapa,
    terreno: { ...gameData.terreno, mapaPadrao: { largura: mapa.largura, altura: mapa.altura } },
  };
}

const ehArvore = (gx: number, gy: number): boolean =>
  recursoBloqueiaPasso(recursoNoTile(inicial, gx, gy));

/** Toda partida (gx,gy) cujo corredor de 3 tiles ate (gx+3,gy) pisa terreno
 *  transponivel e cujas pontas nao sao arvore. Varredura em ordem fixa: a
 *  amostra e a mesma em toda maquina. */
function partidasDoMapa(): { limpas: [number, number][]; comArvore: [number, number][] } {
  const { largura, altura } = gameData.terreno.mapaPadrao;
  const limpas: [number, number][] = [];
  const comArvore: [number, number][] = [];
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx + 3 < largura; gx += 1) {
      // Pelas PONTAS primeiro: alvo em cima de arvore nao tem solucao, e busca
      // sem solucao varre a componente alcancavel inteira — a media viraria
      // media de flood fill (medido: 11x e 24x na faixa da F17c), que e outro
      // fenomeno e nao o custo do obstaculo.
      if (!tileAndavel(inicial, tile(gx, gy), 'livre')) continue;
      if (!tileAndavel(inicial, tile(gx + 3, gy), 'livre')) continue;
      if (!ehTransponivel(gx + 1, gy) || !ehTransponivel(gx + 2, gy)) continue;
      if (ehArvore(gx + 1, gy) || ehArvore(gx + 2, gy)) comArvore.push([gx, gy]);
      else if (tileAndavel(inicial, tile(gx + 1, gy), 'livre')
        && tileAndavel(inicial, tile(gx + 2, gy), 'livre')) limpas.push([gx, gy]);
    }
  }
  return { limpas, comArvore };
}

const { limpas: PARTIDAS_LIMPAS, comArvore: PARTIDAS_COM_ARVORE } = partidasDoMapa();

/** 500 partidas espalhadas pelo mapa inteiro, por passo fixo sobre a varredura:
 *  origem inedita a cada `i`, entao o cache por par nunca acerta. */
const AMOSTRA_CURTA: [number, number][] = Array.from({ length: 500 }, (_, i) =>
  PARTIDAS_LIMPAS[Math.floor((i * PARTIDAS_LIMPAS.length) / 500)] ?? [0, 0]);
const AQUECIMENTO = 100;

// Dos corredores com arvore no meio, os que AINDA tem solucao. O resto nao e
// "busca mais cara": e origem e alvo em componentes diferentes — a arvore
// tampou a unica passagem. Eles saem da medida (senao mediriam flood fill) e
// entram na evidencia pelo numero, que e o que responde "o mapa fecha mais".
const DESVIOS = PARTIDAS_COM_ARVORE.filter(([gx, gy]) =>
  buscarCaminho(inicial, tile(gx, gy), [tile(gx + 3, gy)], 'livre') !== null);
const CORREDORES_TAMPADOS = PARTIDAS_COM_ARVORE.length - DESVIOS.length;

interface Medida { usPorBusca: number; nosPorBusca: number; nulos: number }

const arredondar = (x: number, casas = 2): number => {
  const f = 10 ** casas;
  return Math.round(x * f) / f;
};

/** Uma rodada de busca curta. `fabrica` devolve um `dados` NOVO (mesmo mapa,
 *  outra referencia) porque o cache de caminho e chaveado por `dados`: sem isso
 *  a segunda rodada mediria acerto de cache e nao busca (F-T1). */
function medirCurta(estado: GameState, fabrica: () => GameData): Medida {
  const dados = fabrica();
  const busca = (i: number): unknown => {
    const [gx, gy] = AMOSTRA_CURTA[i] ?? [0, 0];
    return buscarCaminho(estado, tile(gx, gy), [tile(gx + 3, gy)], 'livre', dados);
  };
  for (let i = 0; i < AQUECIMENTO; i += 1) busca(i);
  zerarEstatisticasDeBusca();
  let nulos = 0;
  const t0 = performance.now();
  for (let i = AQUECIMENTO; i < AMOSTRA_CURTA.length; i += 1) if (busca(i) === null) nulos += 1;
  const ms = performance.now() - t0;
  const n = AMOSTRA_CURTA.length - AQUECIMENTO;
  return { usPorBusca: (ms * 1000) / n, nosPorBusca: nosExpandidos() / n, nulos };
}

const REPETICOES_LONGAS = 12;
const ALVO_LONGO = tile(110, 50);

/** Travessia do mapa. Origem inedita a cada repeticao (coluna x=10), de novo
 *  para o cache nunca acertar — e sem refazer `dados`, que custaria a remontagem
 *  da grade dentro da medida. */
function medirLonga(estado: GameState, dados: GameData): Medida {
  for (let k = 0; k < REPETICOES_LONGAS; k += 1) {
    buscarCaminho(estado, tile(9, 6 + k), [ALVO_LONGO], 'livre', dados);
  }
  zerarEstatisticasDeBusca();
  let nulos = 0;
  const t0 = performance.now();
  for (let k = 0; k < REPETICOES_LONGAS; k += 1) {
    if (buscarCaminho(estado, tile(10, 6 + k), [ALVO_LONGO], 'livre', dados) === null) nulos += 1;
  }
  const ms = performance.now() - t0;
  return {
    usPorBusca: (ms * 1000) / REPETICOES_LONGAS,
    nosPorBusca: nosExpandidos() / REPETICOES_LONGAS,
    nulos,
  };
}

/** Os pares em que a arvore esta DENTRO do corredor, rodados nos dois mundos. */
function medirDesvio(estado: GameState, fabrica: () => GameData): Medida {
  const rodar = (dados: GameData): number => {
    let nulos = 0;
    for (const [gx, gy] of DESVIOS) {
      if (buscarCaminho(estado, tile(gx, gy), [tile(gx + 3, gy)], 'livre', dados) === null) nulos += 1;
    }
    return nulos;
  };
  rodar(fabrica());
  const dados = fabrica();
  zerarEstatisticasDeBusca();
  const t0 = performance.now();
  const nulos = rodar(dados);
  const ms = performance.now() - t0;
  const n = DESVIOS.length;
  return { usPorBusca: (ms * 1000) / n, nosPorBusca: nosExpandidos() / n, nulos };
}

// TETOS. O do relogio e frouxo, pelo motivo da F17c: microbench em maquina
// compartilhada oscila, e a protecao deterministica desta feature sao os casos
// dos blocos 1 a 3. O de NOS EXPANDIDOS e estrito: a contagem e funcao pura do
// estado e do mapa, igual em toda maquina, e reprova mesmo.
//
// MEDIDO nesta sessao (128x128, 350 tiles de arvore, 400 buscas curtas, 12
// travessias, 45 desvios). Os NOS, que sao deterministicos:
//   curta   4,00 nos no mapa liso contra 4,22 com floresta — razao 1,05. A
//           floresta nao aparece: o corredor limpo nao esbarra nela.
//   longa   5685 nos no liso contra 5620 com floresta — razao 0,99. Custo do
//           caminho 710 liso / 734 sem floresta / 738 com.
//   desvio  4,00 nos sem floresta contra 12,16 com — razao 3,04. E aqui que a
//           arvore custa: quando ela esta NO caminho, a busca curta expande
//           tres vezes mais.
// O relogio, na mesma corrida: curta 7,0 us e longa 8,6 ms nos dois mundos;
// desvio 8,4 us contra 21,7 (2,58). O numero do relogio oscila de corrida para
// corrida — a do liso saiu em 23 us de puro JIT frio numa delas — e por isso
// ele so tem teto frouxo. O valor de cada corrida vai para
// `test-output/F-T2b.json`.
//
// RESPOSTA: o teto de 2,5 da F-T1 NAO aperta no eixo dela (busca qualquer
// contra o mapa liso: 1,05 no pior dos dois eixos herdados). Ele nao vale para
// o desvio, que e eixo novo, mede outra coisa e tem teto proprio.
//
// O que a floresta fechou de verdade nao e tempo, e TOPOLOGIA: dos 67 corredores
// de 3 tiles com arvore no meio, 22 ficaram sem solucao nenhuma — origem e alvo
// em componentes diferentes. Numero na evidencia, em `corredoresTampadosPelaArvore`.
const RAZAO_TEMPO_MAXIMA = 2.5;
const RAZAO_NOS_CURTA_MAXIMA = 1.5;
const RAZAO_NOS_LONGA_MAXIMA = 1.5;
const RAZAO_NOS_DESVIO_MAXIMA = 5;

const medidas: Record<string, unknown> = {};

describe('F-T2b — o A* foi re-medido com a floresta em pe', () => {
  it('a amostra e o que ela diz ser: partidas de sobra, e desvio de verdade', () => {
    expect(PARTIDAS_LIMPAS.length).toBeGreaterThanOrEqual(AMOSTRA_CURTA.length);
    expect(new Set(AMOSTRA_CURTA.map(([gx, gy]) => `${gx},${gy}`)).size)
      .toBe(AMOSTRA_CURTA.length); // origem inedita: o cache por par nunca acerta
    expect(DESVIOS.length, 'ha corredor com arvore no meio e com solucao').toBeGreaterThan(10);
    for (const [gx, gy] of DESVIOS) {
      expect(ehArvore(gx + 1, gy) || ehArvore(gx + 2, gy), `(${gx},${gy})`).toBe(true);
    }
  });

  it('busca curta: o corredor limpo custa o mesmo, com ou sem floresta', () => {
    const liso = (): GameData => dadosComMapa(MAPA_LISO);
    const real = (): GameData => ({ ...gameData });
    // Duas rodadas de cada, e vale a SEGUNDA: na primeira quem mede depois herda
    // o JIT de quem mediu antes e a razao sai do lugar (F-T1).
    medirCurta(SEM_RECURSOS, liso); medirCurta(SEM_RECURSOS, real); medirCurta(inicial, real);
    const noLiso = medirCurta(SEM_RECURSOS, liso);
    const semFloresta = medirCurta(SEM_RECURSOS, real);
    const comFloresta = medirCurta(inicial, real);
    medidas.curta = { noLiso, semFloresta, comFloresta };
    for (const m of [noLiso, semFloresta, comFloresta]) expect(m.nulos).toBe(0);
    expect(comFloresta.usPorBusca / noLiso.usPorBusca).toBeLessThan(RAZAO_TEMPO_MAXIMA);
    expect(comFloresta.nosPorBusca / noLiso.nosPorBusca).toBeLessThan(RAZAO_NOS_CURTA_MAXIMA);
  });

  it('busca longa: atravessar o mapa com floresta nao alarga a frente', () => {
    const noLiso = medirLonga(SEM_RECURSOS, dadosComMapa(MAPA_LISO));
    const semFloresta = medirLonga(SEM_RECURSOS, { ...gameData });
    const comFloresta = medirLonga(inicial, { ...gameData });
    medidas.longa = {
      noLiso: medirLonga(SEM_RECURSOS, dadosComMapa(MAPA_LISO)),
      semFloresta: medirLonga(SEM_RECURSOS, { ...gameData }),
      comFloresta: medirLonga(inicial, { ...gameData }),
      primeiraRodada: { noLiso, semFloresta, comFloresta },
    };
    const m = medidas.longa as Record<string, Medida>;
    for (const arm of [m.noLiso, m.semFloresta, m.comFloresta]) expect(arm?.nulos).toBe(0);
    expect((m.comFloresta?.usPorBusca ?? 0) / (m.noLiso?.usPorBusca ?? 1))
      .toBeLessThan(RAZAO_TEMPO_MAXIMA);
    expect((m.comFloresta?.nosPorBusca ?? 0) / (m.noLiso?.nosPorBusca ?? 1))
      .toBeLessThan(RAZAO_NOS_LONGA_MAXIMA);
  });

  it('desvio: com arvore no corredor a busca expande mais, e o teto e proprio', () => {
    const real = (): GameData => ({ ...gameData });
    medirDesvio(SEM_RECURSOS, real); medirDesvio(inicial, real);
    const semFloresta = medirDesvio(SEM_RECURSOS, real);
    const comFloresta = medirDesvio(inicial, real);
    medidas.desvio = { semFloresta, comFloresta, corredoresTampados: CORREDORES_TAMPADOS };
    expect(semFloresta.nulos).toBe(0);
    expect(comFloresta.nulos).toBe(0);
    // A arvore SEMPRE custa mais que a ausencia dela: se esta razao cair para 1,
    // o A* parou de enxergar o obstaculo e os blocos 1 a 3 e que teriam de
    // acusar. A guarda de baixo e tao importante quanto o teto.
    expect(comFloresta.nosPorBusca / semFloresta.nosPorBusca).toBeGreaterThan(1.5);
    expect(comFloresta.nosPorBusca / semFloresta.nosPorBusca).toBeLessThan(RAZAO_NOS_DESVIO_MAXIMA);
  });
});

afterAll(() => {
  gravarEvidencia('F-T2b', {
    feature: 'F-T2b — a arvore e obstaculo',
    mapa: { ...gameData.terreno.mapaPadrao, id: gameData.mapa.id },
    camada: {
      bloqueadosNoMapaInicial: camadaDeBloqueio(inicial).bloqueados,
      tiposQueBloqueiam: Object.entries(gameData.recursos.tipos)
        .filter(([, t]) => t?.bloqueiaPasso === true).map(([id]) => id),
    },
    amostra: {
      corredoresLimpos: PARTIDAS_LIMPAS.length,
      corredoresComArvore: PARTIDAS_COM_ARVORE.length,
      desviosComSolucao: DESVIOS.length,
      corredoresTampadosPelaArvore: CORREDORES_TAMPADOS,
      buscasCurtasMedidas: AMOSTRA_CURTA.length - AQUECIMENTO,
      travessiasMedidas: REPETICOES_LONGAS,
    },
    medidas,
    razoes: {
      curtaTempo: razaoDe('curta', 'usPorBusca'),
      curtaNos: razaoDe('curta', 'nosPorBusca'),
      longaTempo: razaoDe('longa', 'usPorBusca'),
      longaNos: razaoDe('longa', 'nosPorBusca'),
      desvioTempo: razaoDeDesvio('usPorBusca'),
      desvioNos: razaoDeDesvio('nosPorBusca'),
    },
    tetos: {
      tempo: RAZAO_TEMPO_MAXIMA,
      nosCurta: RAZAO_NOS_CURTA_MAXIMA,
      nosLonga: RAZAO_NOS_LONGA_MAXIMA,
      nosDesvio: RAZAO_NOS_DESVIO_MAXIMA,
      tetoDaFT1: 2.5,
    },
  });
});

function razaoDe(eixo: string, campo: keyof Medida): number | null {
  const m = medidas[eixo] as Record<string, Medida> | undefined;
  if (!m?.comFloresta || !m.noLiso) return null;
  return arredondar(m.comFloresta[campo] / m.noLiso[campo]);
}

function razaoDeDesvio(campo: keyof Medida): number | null {
  const m = medidas.desvio as Record<string, Medida> | undefined;
  if (!m?.comFloresta || !m.semFloresta) return null;
  return arredondar(m.comFloresta[campo] / m.semFloresta[campo]);
}
