import visual from '../../data/culturas-visual.json';
import type { EstagioDaCultura } from './crescimento';
import { chaveDeTextura } from './manifesto';

/** Arte juvenil é opcional; ausência conserva o desenho anterior. */
export function texturaDoEstagioDaCultura(
  tipo: string, estagio: EstagioDaCultura | null, madura: string,
  existe: (chave: string) => boolean,
): { chave: string; juvenil: boolean } {
  const chave = estagio !== null && estagio !== 'pronto'
    ? chaveDeTextura('recurso', tipo, estagio) : null;
  return tipo === 'corn' && chave !== null && existe(chave)
    ? { chave, juvenil: true } : { chave: madura, juvenil: false };
}

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
