import type { RecursoNoTile } from '../sim/state';

/** Relação visual entre a cultura da cana e o seu chão. */
export const CHAO_DA_CANA = 'campoCana';

export function chaoDaRoca(recurso: RecursoNoTile | undefined): typeof CHAO_DA_CANA | null {
  // O recurso persiste com quantidade zero enquanto a cultura está em pousio.
  return recurso?.tipo === 'grapes' ? CHAO_DA_CANA : null;
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
