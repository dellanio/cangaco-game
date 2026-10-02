import type { RecursoNoTile } from '../sim/state';

/** Relação visual entre a cultura da cana e o seu chão. */
export const CHAO_DA_CANA = 'campoCana';

export function chaoDaRoca(recurso: RecursoNoTile | undefined): typeof CHAO_DA_CANA | null {
  // O recurso persiste com quantidade zero enquanto a cultura está em pousio.
  return recurso?.tipo === 'grapes' ? CHAO_DA_CANA : null;
}
