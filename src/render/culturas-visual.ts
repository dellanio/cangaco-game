import visual from '../../data/culturas-visual.json';
import type { EstagioDaCultura } from './crescimento';

/** Dimensoes de tela: o pe continua no limite sul do mesmo tile. */
export function geometriaDaCultura(tipo: string, estagio: EstagioDaCultura | null, tilePx: number) {
  const escalas: Readonly<Record<string, { largura: number; altura: number }>> = visual.escalaMadura;
  const escala = estagio === 'pronto' ? escalas[tipo] : undefined;
  return {
    largura: tilePx * (escala?.largura ?? 1),
    altura: tilePx * (escala?.altura ?? 1),
    peX: tilePx / 2,
    peY: tilePx,
    emPe: escala !== undefined,
  };
}
