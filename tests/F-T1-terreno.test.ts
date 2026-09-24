/**
 * F-T1 — a camada de terreno base: o mapa versionado, a porta unica de leitura
 * (`sim/mapa.ts`), o motivo `terreno` do `canPlace` e os QUATRO custos do A*.
 *
 * As quatro pernas do aceite estao em quatro `describe`, na ordem do
 * BUILD_PLAN. A quarta (nada do que esta de pe quebra) nao e um caso deste
 * arquivo — e a suite inteira continuar verde SEM mudar fixture; o que fica
 * aqui e o guarda que explica POR QUE ela continua, e o numero na evidencia.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gameData } from '../src/sim/data';
import { TERRENOS_DE_MAPA } from '../src/sim/data/terrenos';
import type { GameData, MapaData, TerrenoDeMapa } from '../src/sim/data/types';
import { tipoDoTile, ehTransponivel, custoDoTerreno } from '../src/sim/mapa';
import { canPlace } from '../src/sim/placement';
import { canPlaceRoad } from '../src/sim/estradas';
import { buscarCaminho, zerarEstatisticasDeBusca, estatisticasDeBusca } from '../src/sim/pathfinding';
import type { Caminho } from '../src/sim/pathfinding';
import { inicial, tile } from './helpers/jobs-cenario';
import { gravarEvidencia } from './helpers/evidence';
import { validarTudo } from '../tools/data-rules.js';

const { largura: LARGURA, altura: ALTURA } = gameData.terreno.mapaPadrao;

/** Um mapa sintetico com a legenda do mapa de verdade — a legenda e dado, e
 *  reescrever uma aqui so criaria um segundo vocabulario para divergir. */
function mapaDe(linhas: readonly string[], id = 'sintetico'): MapaData {
  return {
    id,
    largura: (linhas[0] as string).length,
    altura: linhas.length,
    linhas,
    legenda: gameData.mapa.legenda,
  };
}

/** O mesmo dado com outro mapa. `mapaPadrao` acompanha: o carregador exige que
 *  os dois batam, e um teste que os separasse estaria provando um estado que o
 *  jogo nao alcanca. */
function dadosComMapa(mapa: MapaData): GameData {
  return {
    ...gameData,
    mapa,
    terreno: { ...gameData.terreno, mapaPadrao: { largura: mapa.largura, altura: mapa.altura } },
  };
}

/** O char de um tipo na legenda do mapa de verdade. */
function charDe(tipo: TerrenoDeMapa): string {
  const par = Object.entries(gameData.mapa.legenda).find(([, t]) => t === tipo);
  if (!par) throw new Error(`a legenda do mapa nao tem char para '${tipo}'`);
  return par[0] as string;
}

const GRAMA = charDe('grama');
const AGUA = charDe('agua');

/** Mapa do tamanho do de verdade, todo grama: a LINHA DE BASE das medicoes. */
const MAPA_LISO = mapaDe(new Array(ALTURA).fill(GRAMA.repeat(LARGURA)), 'liso');
const DADOS_LISOS = dadosComMapa(MAPA_LISO);

function tamanhoDe(id: string): readonly [number, number] {
  const def = gameData.predios.find((p) => p.id === id);
  const [l, a] = def?.tamanho ?? [];
  if (l === undefined || a === undefined) throw new Error(`sem tamanho para '${id}'`);
  return [l, a];
}

// --- perna 1 ---------------------------------------------------------------

describe('F-T1 — a recusa nomeia o terreno', () => {
  // O `motivo: 'terreno'` existe em `placement.ts` desde a F06, declarado e
  // INALCANCAVEL: nao havia terreno. Esta e a primeira vez que ele sai.
  const lago = { gx: 92, gy: 46 };

  it('o centro do lago do mapa padrao e agua mesmo (a premissa do caso)', () => {
    expect(tipoDoTile(lago.gx, lago.gy)).toBe('agua');
    expect(ehTransponivel(lago.gx, lago.gy)).toBe(false);
    expect(custoDoTerreno(lago.gx, lago.gy, false)).toBeNull();
  });

  it('canPlace em cima da agua recusa por `terreno`, nao por `sobreposicao`', () => {
    expect(canPlace(inicial, 'quarry', lago.gx, lago.gy)).toEqual({ ok: false, motivo: 'terreno' });
  });

  it('o mesmo tile, no mapa liso, aceita — a recusa e do terreno e de mais nada', () => {
    expect(canPlace(inicial, 'quarry', lago.gx, lago.gy, DADOS_LISOS)).toEqual({ ok: true });
  });

  it('footprint em terra e porta na agua recusa por `porta-sem-saida`: um rotulo por causa', () => {
    // A porta e a linha logo ABAIXO do footprint (sul). Aqui o predio inteiro
    // esta em grama e so a saida da no molhado — dizer `terreno` nos dois casos
    // juntaria duas causas opostas sob um rotulo so.
    const [l, a] = tamanhoDe('quarry');
    const linhas: string[] = [];
    for (let gy = 0; gy < 20; gy += 1) {
      linhas.push(gy === 5 + a ? GRAMA.repeat(4) + AGUA.repeat(l + 2) + GRAMA.repeat(20 - 6 - l) : GRAMA.repeat(20));
    }
    const dados = dadosComMapa(mapaDe(linhas, 'porta-na-agua'));
    expect(canPlace(inicial, 'quarry', 5, 5, dados)).toEqual({ ok: false, motivo: 'porta-sem-saida' });
    expect(canPlace(inicial, 'quarry', 12, 5, dados)).toEqual({ ok: true });
  });

  it('estrada tambem recusa por `terreno` — e por isso o A* de estrada nao precisa checar', () => {
    expect(canPlaceRoad(inicial, [tile(lago.gx, lago.gy)]))
      .toEqual({ ok: false, motivo: 'terreno', tile: tile(lago.gx, lago.gy) });
  });
});

// --- perna 2 ---------------------------------------------------------------

/** Os dois lados do lago, na latitude do centro dele. */
const OESTE = tile(74, 46);
const LESTE = tile(110, 46);

describe('F-T1 — o caminho desvia, e desiste', () => {
  it('as duas pontas estao em terreno pisavel (a premissa do caso)', () => {
    expect(ehTransponivel(OESTE.gx, OESTE.gy)).toBe(true);
    expect(ehTransponivel(LESTE.gx, LESTE.gy)).toBe(true);
  });

  it('com o lago no meio: o caminho existe, nao pisa em agua, e custa mais que no mapa liso', () => {
    const comTerreno = buscarCaminho(inicial, OESTE, [LESTE], 'livre');
    const noLiso = buscarCaminho(inicial, OESTE, [LESTE], 'livre', DADOS_LISOS);
    expect(comTerreno).not.toBeNull();
    expect(noLiso).not.toBeNull();

    const molhados = (comTerreno as Caminho).tiles.filter((t) => tipoDoTile(t.gx, t.gy) === 'agua');
    expect(molhados).toEqual([]);
    expect((comTerreno as Caminho).custo).toBeGreaterThan((noLiso as Caminho).custo);
  });

  it('com a agua fechando a passagem: o A* devolve null, nao um caminho por cima', () => {
    // Coluna de agua de ponta a ponta: nao ha por onde contornar.
    const linhas: string[] = [];
    for (let gy = 0; gy < 24; gy += 1) {
      linhas.push(GRAMA.repeat(12) + AGUA + GRAMA.repeat(11));
    }
    const dados = dadosComMapa(mapaDe(linhas, 'passagem-fechada'));
    expect(buscarCaminho(inicial, tile(4, 12), [tile(20, 12)], 'livre', dados)).toBeNull();
    // A mesma viagem, com um vao de um tile na coluna, passa: o `null` acima e
    // da agua e nao de a busca ter parado de funcionar.
    const comVao = [...linhas];
    comVao[12] = GRAMA.repeat(24);
    const abertos = dadosComMapa(mapaDe(comVao, 'passagem-aberta'));
    expect(buscarCaminho(inicial, tile(4, 12), [tile(20, 12)], 'livre', abertos)).not.toBeNull();
  });
});

// --- perna 3 ---------------------------------------------------------------

// A mesma caminhada curta e inedita da F17c, movida para a faixa de terreno
// VARIADO (o mapa liso e a linha de base). Origem inedita a cada `i`: o cache
// por par origem-destino nunca acerta, entao toda chamada executa de verdade.
const FAIXA = { x0: 66, y0: 60, colunas: 40 };
const AQUECIMENTO = 100;
const BUSCAS = 400;

function buscaCurtaInedita(dados: GameData, i: number): Caminho | null {
  const x = FAIXA.x0 + (i % FAIXA.colunas);
  const y = FAIXA.y0 + Math.floor(i / FAIXA.colunas);
  return buscarCaminho(inicial, tile(x, y), [tile(x + 3, y)], 'livre', dados);
}

/** Todos os tiles que a medicao pisa, no mapa de verdade. */
function tilesDaFaixa(): { pisaveis: boolean; tipos: Set<TerrenoDeMapa> } {
  const tipos = new Set<TerrenoDeMapa>();
  let pisaveis = true;
  for (let i = 0; i < AQUECIMENTO + BUSCAS; i += 1) {
    const x = FAIXA.x0 + (i % FAIXA.colunas);
    const y = FAIXA.y0 + Math.floor(i / FAIXA.colunas);
    for (let dx = 0; dx <= 3; dx += 1) {
      const tipo = tipoDoTile(x + dx, y);
      if (tipo !== null) tipos.add(tipo);
      if (!ehTransponivel(x + dx, y)) pisaveis = false;
    }
  }
  return { pisaveis, tipos };
}

// Teto FROUXO, pelo mesmo motivo escrito na F17c: microbench em maquina
// compartilhada oscila, e a protecao deterministica desta feature nao e o
// cronometro — sao os casos das pernas 1 e 2 e a contagem de alocacao que a
// F17c ja roda em todo `npm run verify`. O numero medido vai para
// `test-output/F-T1.json`; se este teto vier a reprovar, a correcao e alarga-lo
// COM O NUMERO MEDIDO ao lado, nunca `skip` (CLAUDE.md §10).
// MEDIDO nesta sessao, com os dois JIT aquecidos: 6,1 us por busca no mapa
// liso contra 7,4 us no mapa com terreno — razao 1,22. O teto de 2,5 fica
// acima do ruido e ainda acusaria uma leitura por vizinho que custasse o dobro
// do que esta medido.
const RAZAO_MAXIMA = 2.5;

/** Preenchido pela medicao e despejado na evidencia. */
const medida = { usPorBuscaNoLiso: 0, usPorBuscaComTerreno: 0, razao: 0 };

describe('F-T1 — o custo do A* foi remedido, nao estimado', () => {
  it('a faixa medida e pisavel e tem mais de um tipo de terreno (senao a medicao e de outra coisa)', () => {
    const { pisaveis, tipos } = tilesDaFaixa();
    expect(pisaveis).toBe(true);
    expect(tipos.size).toBeGreaterThan(1);
  });

  it('a busca curta com terreno nao custa mais que o teto contra o mapa liso', () => {
    // Cada rodada recebe um `dados` NOVO (mesmo mapa, outra referencia): o cache
    // de caminho do A* e chaveado por `dados`, entao sem isto a segunda rodada
    // mediria acerto de cache, nao busca. Trocar a referencia nao paga
    // decodificacao de mapa de novo — a grade e cacheada pelo `MapaData`, que
    // continua o mesmo objeto.
    const medir = (fabrica: () => GameData): number => {
      const dados = fabrica();
      for (let i = 0; i < AQUECIMENTO; i += 1) buscaCurtaInedita(dados, i);
      zerarEstatisticasDeBusca();
      const t0 = performance.now();
      for (let i = AQUECIMENTO; i < AQUECIMENTO + BUSCAS; i += 1) buscaCurtaInedita(dados, i);
      const ms = performance.now() - t0;
      expect(estatisticasDeBusca().execucoes).toBe(BUSCAS); // cache frio: mediu busca, nao acerto
      expect(estatisticasDeBusca().acertos).toBe(0);
      return (ms * 1000) / BUSCAS;
    };
    // Duas rodadas, e vale a SEGUNDA de cada um: na primeira, quem mede depois
    // herda o JIT ja aquecido de quem mediu antes, e a razao sai do lugar (a
    // primeira corrida deu 0,59 — o mapa com terreno "mais barato" que o liso,
    // que e leitura da ordem, nao do custo).
    const liso0 = (): GameData => dadosComMapa(MAPA_LISO);
    const terreno0 = (): GameData => ({ ...gameData });
    medir(liso0);
    medir(terreno0);
    const liso = medir(liso0);
    const comTerreno = medir(terreno0);
    medida.usPorBuscaNoLiso = Math.round(liso * 10) / 10;
    medida.usPorBuscaComTerreno = Math.round(comTerreno * 10) / 10;
    medida.razao = Math.round((comTerreno / liso) * 100) / 100;
    expect(comTerreno / liso).toBeLessThan(RAZAO_MAXIMA);
  });
});

// --- guardas ---------------------------------------------------------------

/** Todo tipo de terreno que o mapa padrao tem, contado por varredura — nao pela
 *  `contagemPorTipo` que o gerador escreveu no arquivo (essa e afirmacao do
 *  gerador; esta e leitura pela porta que o jogo usa). */
function contagemVarrida(): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const tipo of TERRENOS_DE_MAPA) contagem[tipo] = 0;
  for (let gy = 0; gy < ALTURA; gy += 1) {
    for (let gx = 0; gx < LARGURA; gx += 1) {
      const tipo = tipoDoTile(gx, gy);
      if (tipo !== null) contagem[tipo] = (contagem[tipo] as number) + 1;
    }
  }
  return contagem;
}

function arquivosDeRenderQueLeemSimMapa(): string[] {
  const pendentes = ['src/render'];
  const encontrados: string[] = [];
  while (pendentes.length > 0) {
    const dir = pendentes.pop() as string;
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const caminho = join(dir, entrada.name);
      if (entrada.isDirectory()) pendentes.push(caminho);
      else if (entrada.name.endsWith('.ts') && !caminho.endsWith(join('render', 'mapa.ts'))
        && /from\s+['"].*sim\/mapa['"]/.test(readFileSync(caminho, 'utf-8'))) {
        encontrados.push(caminho);
      }
    }
  }
  return encontrados;
}

describe('F-T1 — guardas', () => {
  it('todo terreno do vocabulario tem instancia no mapa padrao: nenhum custo fica sem leitor', () => {
    const contagem = contagemVarrida();
    for (const tipo of TERRENOS_DE_MAPA) {
      expect(contagem[tipo], `o mapa padrao nao tem nenhum tile de '${tipo}'`).toBeGreaterThan(0);
    }
  });

  it('os quatro custos de `custoDeMovimento` e os intransponiveis sao todos exercidos', () => {
    const comCusto = Object.keys(gameData.movimento.ticksPorTile.aPe).filter((t) => t !== 'estrada');
    const contagem = contagemVarrida();
    for (const tipo of comCusto) expect(contagem[tipo]).toBeGreaterThan(0);
    // `predio` esta em `intransponivel` e NAO e terreno de mapa: quem bloqueia
    // por predio e a ocupacao em `state.predios`, tile a tile. Fora daqui pelo
    // mesmo motivo que em `tools/data-rules.js` — vocabulario de mapa e uma
    // coisa, vocabulario de bloqueio e outra.
    const terrenosBarrados = gameData.terreno.intransponivel.filter((t) => t !== 'predio');
    expect(terrenosBarrados.length).toBeGreaterThan(0);
    for (const tipo of terrenosBarrados) expect(contagem[tipo]).toBeGreaterThan(0);
  });

  it('nenhum arquivo de src/render/ alem do funil mapa.ts importa ../sim/mapa', () => {
    expect(arquivosDeRenderQueLeemSimMapa()).toEqual([]);
  });

  it('a regra de mapa do validate:data ACUSA — nao so deixa de acusar a toa', () => {
    const nomes = ['time', 'buildings', 'production', 'units', 'combat', 'condition',
      'delivery', 'terrain', 'economy', 'maps/sertao-128'];
    const dados: Record<string, unknown> = {};
    for (const nome of nomes) dados[nome] = JSON.parse(readFileSync(`data/${nome}.json`, 'utf8'));
    expect(validarTudo(dados)).toEqual([]);

    const mapa = dados['maps/sertao-128'] as { linhas: string[]; largura: number };
    const daVila = (linhas: string[]): string[] => {
      const copia = [...linhas];
      copia[30] = AGUA.repeat(mapa.largura); // afoga a vila inicial de economy.json
      return copia;
    };
    const quebrados: Record<string, unknown>[] = [
      { ...dados, 'maps/sertao-128': { ...mapa, linhas: daVila(mapa.linhas) } },
      { ...dados, 'maps/sertao-128': { ...mapa, linhas: mapa.linhas.slice(0, -1) } },
      { ...dados, 'maps/sertao-128': { ...mapa, linhas: mapa.linhas.map((l, i) => (i === 3 ? `${l}g` : l)) } },
    ];
    for (const caso of quebrados) {
      expect(validarTudo(caso).filter((e: string) => e.startsWith('mapa/')).length).toBeGreaterThan(0);
    }
  });
});

afterAll(() => {
  const contagem = contagemVarrida();
  const comTerreno = buscarCaminho(inicial, OESTE, [LESTE], 'livre');
  const noLiso = buscarCaminho(inicial, OESTE, [LESTE], 'livre', DADOS_LISOS);
  gravarEvidencia('F-T1', {
    feature: 'F-T1-terreno-base',
    mapa: {
      id: gameData.mapa.id,
      largura: gameData.mapa.largura,
      altura: gameData.mapa.altura,
      contagemVarridaPelaPortaUnica: contagem,
      fonte: 'data/maps/sertao-128.json (emitido por tools/gerar-mapa.js, semente no arquivo)',
    },
    pernaUm: {
      tileDeAgua: { gx: 92, gy: 46 },
      canPlace: canPlace(inicial, 'quarry', 92, 46),
      canPlaceNoMesmoTileComMapaLiso: canPlace(inicial, 'quarry', 92, 46, DADOS_LISOS),
    },
    pernaDois: {
      de: OESTE,
      para: LESTE,
      custoComTerreno: comTerreno?.custo ?? null,
      custoNoMapaLiso: noLiso?.custo ?? null,
      tilesDeAguaNoCaminho: (comTerreno?.tiles ?? []).filter((t) => tipoDoTile(t.gx, t.gy) === 'agua').length,
      passagemFechadaDevolveNull: true,
    },
    pernaTres: {
      oQueSeMede: 'a mesma caminhada de 3 tiles da F17c, em faixa de terreno variado, contra o mesmo mapa todo grama',
      buscasPorMapa: BUSCAS,
      rodadasPorMapa: 2,
      oQueEntra: 'a segunda rodada de cada mapa, com os dois JIT ja aquecidos',
      ...medida,
      tetoDoTeste: RAZAO_MAXIMA,
    },
    pernaQuatro: {
      comoFoiObtida: 'a suite inteira verde sem mudar fixture; o mapa e que nasce com a vila e a moldura em grama',
      regiaoProtegida: 'quadrante noroeste ate o tile 71 + moldura de 8 tiles em volta do mapa',
    },
  });
});
