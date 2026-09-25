/**
 * Tipos de `geometria-da-abertura.mjs`, escritos a mao: `tools/` fica fora do
 * `tsconfig.include` e o projeto nao tem `allowJs`, entao e este arquivo que
 * torna o modulo importavel do lado TS sem afrouxar nada no compilador.
 * Se a assinatura la mudar, este arquivo tem de mudar junto — o teste estrutural
 * `tests/F-T4b-geometria.test.ts` e quem acusa se as duas pontas divergirem.
 */

export declare const TIPOS_DA_ABERTURA: readonly string[];

export interface CaixaDePredio {
  readonly gx: number;
  readonly gy: number;
  readonly largura: number;
  readonly altura: number;
}

export interface TamanhoEmTiles {
  readonly largura: number;
  readonly altura: number;
}

export interface PlantaDaGeometria {
  readonly tipo: string;
  readonly gx: number;
  readonly gy: number;
}

export interface TileDaGeometria {
  readonly gx: number;
  readonly gy: number;
}

export interface EntradaDaGeometria {
  readonly armazem: CaixaDePredio;
  readonly escola: CaixaDePredio;
  readonly tamanhoDe: (tipo: string) => TamanhoEmTiles;
  /** O tile tem recurso que recusa obra E estrada (`recursoBloqueiaConstrucao`). */
  readonly bloqueia: (gx: number, gy: number) => boolean;
}

export interface GeometriaDaAbertura {
  readonly yRua: number;
  readonly gyDaFila: number;
  readonly plantas: readonly PlantaDaGeometria[];
  readonly rua: readonly TileDaGeometria[];
}

export declare function geometriaDaAbertura(entrada: EntradaDaGeometria): GeometriaDaAbertura;
