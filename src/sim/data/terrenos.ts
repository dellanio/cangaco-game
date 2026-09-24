import type { TerrenoDeMapa } from './types';

/**
 * F-T1 — os tipos de terreno de mapa, em valor de execucao e em ORDEM FIXA.
 * A uniao `TerrenoDeMapa` so existe em tempo de compilacao; esta lista e o que
 * o carregador confere contra a legenda do mapa e o que `sim/mapa.ts` usa como
 * codigo numerico por tile (o indice nesta lista).
 *
 * A ordem importa e nao pode ser rearranjada por gosto: ela e o codigo. Se
 * fosse derivada da legenda de cada mapa, dois mapas dariam codigos diferentes
 * ao mesmo terreno e a tabela de custo (que e por `GameData`, nao por mapa)
 * deixaria de casar com a grade (que e por mapa).
 *
 * Modulo proprio, e nao uma constante dentro de `loader.ts`, para que
 * `sim/mapa.ts` a importe sem depender do carregador.
 */
export const TERRENOS_DE_MAPA: readonly TerrenoDeMapa[] = [
  'grama', 'campoArado', 'areia', 'agua', 'rocha', 'montanha',
];
