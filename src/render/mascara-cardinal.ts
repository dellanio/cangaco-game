/**
 * Convencao comum das familias conectaveis do render: N=1, L=2, S=4, O=8.
 * O chamador decide o significado da conexao (margem, material vizinho ou
 * recurso contiguo); esta funcao apenas transforma os quatro vizinhos em 0..15.
 */
export const VIZINHOS_CARDINAIS = [
  { dx: 0, dy: -1, bit: 1 },
  { dx: 1, dy: 0, bit: 2 },
  { dx: 0, dy: 1, bit: 4 },
  { dx: -1, dy: 0, bit: 8 },
] as const;

export function mascaraCardinal(
  conecta: (dx: number, dy: number) => boolean,
): number {
  return VIZINHOS_CARDINAIS.reduce((mascara, vizinho) => (
    conecta(vizinho.dx, vizinho.dy) ? mascara | vizinho.bit : mascara
  ), 0);
}
