import type { RecursoNoTile } from '../sim/state';

/** Relação visual entre a cultura da cana e o seu chão. */
export const CHAO_DA_CANA = 'campoCana';
/** I-TELA-CHAO-DA-ROCA-DO-MILHO — o chão do milho: a terra arada (`campoArado`), a mesma do mapa. */
export const CHAO_DO_MILHO = 'campoArado';
/** Os chãos da roça, na ordem da tira da camada (o índice dá o bloco de 4 variantes). */
export const CHAOS_DA_ROCA = [CHAO_DA_CANA, CHAO_DO_MILHO] as const;
export type ChaoDaRoca = (typeof CHAOS_DA_ROCA)[number];

export function chaoDaRoca(recurso: RecursoNoTile | undefined): ChaoDaRoca | null {
  // O recurso persiste com quantidade zero enquanto a cultura está em pousio.
  if (recurso?.tipo === 'grapes') return CHAO_DA_CANA;
  // I-TELA-CHAO-DA-ROCA-DO-MILHO: o roçado de milho do jogador não tem o terreno arado do mapa
  return recurso?.tipo === 'corn' ? CHAO_DO_MILHO : null;
}

/** O índice do tile na tira da camada: o bloco do chão e a variante (1 a 4) pela posição. */
export function indiceDoChao(chao: ChaoDaRoca, gx: number, gy: number): number {
  return 1 + CHAOS_DA_ROCA.indexOf(chao) * 4 + ((gx * 17 + gy * 31) & 3);
}

export interface QuadroDoChaoDaCana {
  readonly tick: number;
  readonly vista: string;
  readonly partida: object | null;
}
/** Recursos mudam no tick. A camera so invalida a contagem dos tiles desenhados. */
export function quadroDoChaoDaCanaMudou(
  anterior: QuadroDoChaoDaCana | null, atual: QuadroDoChaoDaCana,
): { readonly varrerRecursos: boolean; readonly contarVista: boolean } {
  const varrerRecursos = anterior === null || anterior.tick !== atual.tick || anterior.partida !== atual.partida;
  return { varrerRecursos, contarVista: varrerRecursos || anterior.vista !== atual.vista };
}
