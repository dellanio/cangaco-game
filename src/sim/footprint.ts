import type { Predio } from './state';
import type { GameData } from './data/types';

/**
 * Retangulo em tiles, MEIO-ABERTO: cobre `[x0, x1) x [y0, y1)`. Um predio 3x3
 * em (29,30) e `{ x0: 29, y0: 30, x1: 32, y1: 33 }` — `x1`/`y1` sao a borda,
 * nao o ultimo tile. E por isso que dois predios encostados nao se sobrepoem.
 */
export interface CaixaEmTiles {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Footprint de um TIPO de predio posto com o canto superior esquerdo em
 *  (gx, gy). `null` se o tipo nao existe no dado ou nao tem `tamanho`. */
export function caixaDeTipo(
  tipo: string, gx: number, gy: number, dados: GameData,
): CaixaEmTiles | null {
  const def = dados.predios.find((p) => p.id === tipo);
  const [largura, altura] = def?.tamanho ?? [];
  if (largura === undefined || altura === undefined) return null;
  return { x0: gx, y0: gy, x1: gx + largura, y1: gy + altura };
}

export function caixaDoPredio(predio: Predio, dados: GameData): CaixaEmTiles | null {
  return caixaDeTipo(predio.tipo, predio.gx, predio.gy, dados);
}

/** Meio-aberto dos dois lados: encostar (`a.x1 === b.x0`) NAO e sobrepor. */
export function caixasSeSobrepoem(a: CaixaEmTiles, b: CaixaEmTiles): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}
