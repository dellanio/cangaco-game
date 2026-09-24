/**
 * F18b — o tamanho do mapa e DADO. Plano em `docs/planos/F18b-mapa-grande.md`.
 *
 * O guarda permanente desta feature nao e o numero medido (§8: medida e
 * evidencia da sessao): e que a simulacao inteira roda em QUALQUER tamanho
 * declarado, inclusive um retangulo que nao e potencia de dois. Foi uma
 * presuncao de 64 escondida numa fixture que travou esta mudanca de mapa; este
 * arquivo e o que acusa a proxima.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import { createInitialState } from '../src/sim/state';
import { step } from '../src/sim/tick';
import { buscarCaminho, tileAndavel } from '../src/sim/pathfinding';
import { configDoMapa } from '../src/render/mapa';
import { gravarEvidencia } from './helpers/evidence';

function dadosCom(largura: number, altura: number): GameData {
  return { ...gameData, terreno: { ...gameData.terreno, mapaPadrao: { largura, altura } } };
}

/** 97x61 e o caso que importa: retangular, e nenhum dos dois lados e potencia de
 *  dois. Se algum codigo presumir quadrado, potencia de dois ou o valor
 *  publicado, e aqui que quebra. */
const TAMANHOS: readonly (readonly [number, number])[] = [
  [64, 64], [128, 128], [256, 256], [97, 61],
];

describe('F18b — o mapa publicado', () => {
  it('data/terrain.json publica 128x128, e o render espelha', () => {
    expect(gameData.terreno.mapaPadrao).toEqual({ largura: 128, altura: 128 });
    expect(configDoMapa.largura).toBe(gameData.terreno.mapaPadrao.largura);
    expect(configDoMapa.altura).toBe(gameData.terreno.mapaPadrao.altura);
  });

  it('a area jogavel quadruplicou em relacao ao 64x64 da Fase A', () => {
    const { largura, altura } = gameData.terreno.mapaPadrao;
    expect(largura * altura).toBe(4 * 64 * 64);
  });

  it('a vila inicial cabe no mapa com folga, e nao encosta em borda nenhuma', () => {
    // A decisao registrada da F18b: a vila NAO se move, e ocupa o quadrante
    // noroeste. O que precisa valer e que ela nao esta na borda — a folga menor
    // (29 tiles a oeste) e maior que a vila inteira da F17 (dez tiles).
    const { largura, altura } = gameData.terreno.mapaPadrao;
    for (const p of gameData.economia.estadoInicial.predios) {
      expect(p.gx, `${p.id} a oeste`).toBeGreaterThan(10);
      expect(p.gy, `${p.id} ao norte`).toBeGreaterThan(10);
      expect(p.gx, `${p.id} a leste`).toBeLessThan(largura - 10);
      expect(p.gy, `${p.id} ao sul`).toBeLessThan(altura - 10);
    }
  });
});

describe('F18b — GUARDA: nada presume o tamanho do mapa', () => {
  it.each(TAMANHOS)('o estado inicial nasce e anda em %ix%i', (largura, altura) => {
    const dados = dadosCom(largura, altura);
    let estado = createInitialState(gameData.economia.estadoInicial.semente, dados);
    for (let t = 0; t < 30; t += 1) estado = step(estado, [], dados);
    expect(estado.tick).toBe(30);
    expect(estado.predios.ordem.length).toBeGreaterThan(0);
    expect(estado.unidades.ordem.length).toBeGreaterThan(0);
  });

  it.each(TAMANHOS)('a borda e a do dado DECLARADO, nao a do publicado: %ix%i', (largura, altura) => {
    const dados = dadosCom(largura, altura);
    const estado = createInitialState(1, dados);
    const dentro = { gx: largura - 1, gy: altura - 1 };
    const fora = { gx: largura, gy: altura - 1 };
    expect(buscarCaminho(estado, dentro, [dentro], 'livre', dados)?.custo).toBe(0);
    expect(buscarCaminho(estado, dentro, [fora], 'livre', dados)).toBeNull();

    // A borda e checada em DOIS lugares: o filtro de alvos de `buscarCaminho` e o
    // `tileAndavel` de cada vizinho expandido. As duas linhas acima so exercitam o
    // primeiro. Esta anda de verdade rente a borda mais distante — o trecho que so
    // existe no mapa DECLARADO — e passa pelo segundo, inclusive pelo indice
    // `gy * largura + gx` com que ele le o mapa de footprints.
    const cantoA = { gx: largura - 3, gy: altura - 1 };
    const cantoB = { gx: largura - 1, gy: altura - 1 };
    expect(buscarCaminho(estado, cantoA, [cantoB], 'livre', dados)?.custo).toBeGreaterThan(0);

    // E a TERCEIRA borda: `tileAndavel` nao passa por `buscarCaminho`, e e ela que
    // quatro sistemas consultam antes de o civil pisar no proximo tile.
    expect(tileAndavel(estado, cantoB, 'livre', dados), 'o canto do mapa declarado').toBe(true);
    expect(tileAndavel(estado, fora, 'livre', dados), 'a coluna fora do mapa').toBe(false);
  });

  it('o tamanho do estado serializado NAO cresce com a area do mapa', () => {
    const bytes = TAMANHOS.map(([l, a]) => JSON.stringify(createInitialState(1, dadosCom(l, a))).length);
    // `GameState` nao guarda tile: os quatro sao o MESMO numero, nao "parecidos".
    expect(new Set(bytes).size).toBe(1);
  });

  it('grava a evidencia do aceite', () => {
    const { largura, altura } = gameData.terreno.mapaPadrao;
    gravarEvidencia('F18b', {
      feature: 'F18b-mapa-grande',
      mapaPadrao: gameData.terreno.mapaPadrao,
      areaEmTiles: largura * altura,
      areaAntesDaFeature: 64 * 64,
      vilaInicial: gameData.economia.estadoInicial.predios.map((p) => ({ id: p.id, gx: p.gx, gy: p.gy })),
      folgaDaVilaAteABorda: gameData.economia.estadoInicial.predios.map((p) => ({
        id: p.id, oeste: p.gx, norte: p.gy, leste: largura - p.gx, sul: altura - p.gy,
      })),
      porTamanho: TAMANHOS.map(([l, a]) => ({
        mapa: `${l}x${a}`,
        bytesDoEstadoInicial: JSON.stringify(createInitialState(1, dadosCom(l, a))).length,
      })),
    });
  });
});
