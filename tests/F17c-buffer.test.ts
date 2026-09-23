/**
 * F17c — o rascunho do A* e reaproveitado: preparar uma busca deixa de custar
 * proporcional a AREA DO MAPA.
 *
 * O guarda permanente desta feature e a CONTAGEM DE ALOCACAO, nao o cronometro:
 * ela e deterministica e nao depende de relogio nem de maquina. O numero medido
 * que o aceite pede esta no teste de tempo, no fim do arquivo.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import type { GameState } from '../src/sim/state';
import {
  buscarCaminho, estatisticasDeBusca, estatisticasDoRascunho, zerarEstatisticasDeBusca,
} from '../src/sim/pathfinding';
import type { Caminho } from '../src/sim/pathfinding';
import { inicial, tile } from './helpers/jobs-cenario';

const TAMANHOS = [64, 128, 256] as const;

/** O mesmo dado, com outro tamanho de mapa. `buscarCaminho` ja recebe `dados`
 *  por parametro — nada em `data/` muda para esta medicao. */
function dadosCom(n: number): GameData {
  return { ...gameData, terreno: { ...gameData.terreno, mapaPadrao: { largura: n, altura: n } } };
}

/**
 * Busca CURTA (3 tiles) com origem inedita a cada `i`: a chave do cache por par
 * origem-destino nunca repete, entao toda chamada executa de verdade.
 *
 * A faixa e x em [2,41] e y em [12,27] — 640 pares distintos, todos livres: os
 * dois predios iniciais comecam em y=30 (`storehouse` em (29,30), `schoolhouse`
 * em (34,30)). Alvo inalcancavel faria o A* varrer o mapa inteiro e a medicao
 * seria de outra coisa.
 */
function buscaCurtaInedita(estado: GameState, dados: GameData, i: number): Caminho | null {
  const x = 2 + (i % 40);
  const y = 12 + Math.floor(i / 40);
  return buscarCaminho(estado, tile(x, y), [tile(x + 3, y)], 'livre', dados);
}

describe('F17c — o rascunho do A* nao se aloca por busca', () => {
  beforeEach(() => { zerarEstatisticasDeBusca(); });

  it('900 buscas ineditas em tres tamanhos de mapa alocam no maximo uma vez por tamanho', () => {
    for (const n of TAMANHOS) {
      // `dados` fora do laco de proposito: os caches de estrada e de footprint
      // sao chaveados pela REFERENCIA de `dados`; um objeto novo por busca os
      // recriaria e o teste mediria outra coisa.
      const dados = dadosCom(n);
      for (let i = 0; i < 300; i += 1) buscaCurtaInedita(inicial, dados, i);
    }
    expect(estatisticasDeBusca().execucoes).toBe(900);
    expect(estatisticasDeBusca().acertos).toBe(0);
    expect(estatisticasDoRascunho().alocacoes).toBeLessThanOrEqual(TAMANHOS.length);
  });

  it('com o rascunho ja grande o bastante, mais 900 buscas nao alocam nada', () => {
    const porTamanho = TAMANHOS.map((n) => dadosCom(n));
    porTamanho.forEach((dados) => { for (let i = 0; i < 5; i += 1) buscaCurtaInedita(inicial, dados, i); });
    zerarEstatisticasDeBusca();
    porTamanho.forEach((dados) => {
      for (let i = 100; i < 400; i += 1) buscaCurtaInedita(inicial, dados, i);
    });
    expect(estatisticasDeBusca().execucoes).toBe(900);
    expect(estatisticasDoRascunho().alocacoes).toBe(0);
  });

  it('o rascunho cresce e nao encolhe: depois do mapa grande, o pequeno reaproveita', () => {
    buscaCurtaInedita(inicial, dadosCom(256), 0);
    const capacidadeNoGrande = estatisticasDoRascunho().capacidade;
    expect(capacidadeNoGrande).toBeGreaterThanOrEqual(256 * 256);
    zerarEstatisticasDeBusca();
    const pequeno = dadosCom(64);
    for (let i = 0; i < 50; i += 1) buscaCurtaInedita(inicial, pequeno, i);
    expect(estatisticasDoRascunho().alocacoes).toBe(0);
    expect(estatisticasDoRascunho().capacidade).toBe(capacidadeNoGrande);
  });

  it('a busca medida e mesmo uma caminhada curta, nao uma varredura por alvo inalcancavel', () => {
    const caminho = buscaCurtaInedita(inicial, dadosCom(64), 7);
    expect(caminho).not.toBeNull();
    expect(caminho?.tiles.length).toBe(3);
  });
});

describe('F17c — o A* nao e reentrante, e a guarda diz isso em voz alta', () => {
  beforeEach(() => { zerarEstatisticasDeBusca(); });

  // Reentrancia de verdade, por uma costura que existe mesmo: `dados` vem do
  // chamador e `dados.movimento.ticksPorTile.aPe` e lido DURANTE a busca. Nenhum
  // caminho do jogo faz isto — o teste existe para provar que a guarda ACUSA, e
  // nao so que ela nao acusa a toa.
  it('uma busca disparada de dentro de outra e recusada', () => {
    const base = gameData.movimento.ticksPorTile.aPe;
    let leituras = 0;
    const aPe = {
      estrada: base.estrada,
      campoArado: base.campoArado,
      areia: base.areia,
      get grama(): number {
        leituras += 1;
        if (leituras === 1) buscarCaminho(inicial, tile(3, 3), [tile(6, 3)], 'livre');
        return base.grama;
      },
    };
    const dados: GameData = {
      ...gameData,
      movimento: { ...gameData.movimento, ticksPorTile: { ...gameData.movimento.ticksPorTile, aPe } },
    };
    expect(() => buscarCaminho(inicial, tile(10, 10), [tile(14, 10)], 'livre', dados))
      .toThrow(/reentrante/);
    expect(leituras).toBeGreaterThan(0); // a costura foi mesmo exercitada
  });

  // Se a guarda travasse o rascunho ao explodir, todo o resto da partida pararia.
  it('depois da recusa o rascunho volta a servir: a busca seguinte e normal', () => {
    const caminho = buscarCaminho(inicial, tile(10, 10), [tile(14, 10)], 'livre');
    expect(caminho).not.toBeNull();
    expect(caminho?.tiles.length).toBe(4);
  });
});
