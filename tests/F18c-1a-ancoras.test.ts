/**
 * F18c-1a — as ancoras dos cenarios andam com o mundo.
 *
 * Os helpers de cenario (`producao-cenario.ts`, `fome-cenario.ts`) escrevem
 * deslocamento a partir de uma ancora (`helpers/ancoras.ts`). Este arquivo prova a
 * propriedade de que isso depende: transladado o mundo em memoria — mapa com
 * faixa de grama a oeste e ao norte, recursos e vila deslocados juntos —, toda
 * ancora se desloca do MESMO K. A prova de ponta a ponta, com a suite inteira, e
 * `tools/transladar-mundo.js`; esta e a que roda em todo `verify`.
 */
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/sim/data';
import type { GameData } from '../src/sim/data/types';
import {
  ancoraDaSerra, ancoraDaVila, ancoraDoLagamar, ancoraDoLagoPequeno, ancoraDoLajedo, ancoraDoRocadoDoNorte,
} from './helpers/ancoras';
import { comJazida, pedreiraDaVila, rochaDaPedreiraDaVila } from './helpers/producao-cenario';

const K = 32;

/** O mundo inteiro +k, num mapa k maior: a mesma operacao do instrumento, em memoria. */
function transladado(dados: GameData, k: number): GameData {
  const { mapa } = dados;
  const grama = Object.keys(mapa.legenda).find((c) => mapa.legenda[c] === 'grama');
  if (grama === undefined) throw new Error('a legenda do mapa nao tem grama');
  const largura = mapa.largura + k;
  const ini = dados.economia.estadoInicial;
  return {
    ...dados,
    economia: {
      ...dados.economia,
      estadoInicial: { ...ini, predios: ini.predios.map((p) => ({ ...p, gx: p.gx + k, gy: p.gy + k })) },
    },
    mapa: {
      ...mapa,
      largura,
      altura: mapa.altura + k,
      linhas: [
        ...Array.from({ length: k }, () => grama.repeat(largura)),
        ...mapa.linhas.map((l) => grama.repeat(k) + l),
      ],
      recursos: Object.fromEntries(Object.entries(mapa.recursos).map(
        ([r, tiles]) => [r, tiles.map(([x, y]) => [x + k, y + k] as const)],
      )),
    },
  };
}

const ANCORAS = {
  vila: ancoraDaVila,
  lajedo: ancoraDoLajedo,
  lagoPequeno: ancoraDoLagoPequeno,
  lagamar: ancoraDoLagamar,
  rocadoDoNorte: ancoraDoRocadoDoNorte,
  serra: ancoraDaSerra,
} as const;

describe('F18c-1a — as ancoras andam com o mundo', () => {
  const mundo = transladado(gameData, K);

  it.each(Object.entries(ANCORAS))('%s: transladado o mundo +K, a ancora anda +K', (_, ancora) => {
    const antes = ancora(gameData);
    expect(ancora(mundo)).toEqual({ gx: antes.gx + K, gy: antes.gy + K });
  });

  it('o lajedo vem do mapa publicado: a jazida injetada por `comJazida` nao arrasta a pedreira', () => {
    // A jazida de um tile e o caso que a F15a e a F22 usam. Se a ancora lesse o
    // `dados` do teste, a mancha passaria a ser esse tile, e a pedreira sairia da rua.
    const umTile = comJazida(gameData, 'rock', [rochaDaPedreiraDaVila()], 2);
    expect(ancoraDoLajedo(umTile)).not.toEqual(ancoraDoLajedo(gameData));
    expect(pedreiraDaVila()).toEqual({
      gx: ancoraDoLajedo(gameData).gx + 4, gy: ancoraDoLajedo(gameData).gy + 5,
    });
  });

  it('o tile de rocha da pedreira da vila e rocha no mapa publicado', () => {
    const [gx, gy] = rochaDaPedreiraDaVila();
    expect(gameData.mapa.recursos['rock']?.some(([x, y]) => x === gx && y === gy)).toBe(true);
  });
});
