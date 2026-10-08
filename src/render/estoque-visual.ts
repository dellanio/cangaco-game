import dados from '../../data/estoque-visual.json';

export function ladoPadraoDoEstoque(tilePx: number): number {
  return tilePx * dados.ladoEmTiles;
}

/** Tamanho usado tanto no desenho real quanto na evidencia publicada. */
export function ladoDaMercadoriaNoEstoque(tipo: string, mercadoria: string, ladoPadrao: number): number {
  const porPredio: Readonly<Record<string, Readonly<Record<string, number>> | undefined>> = dados.escalaPorPredio;
  return ladoPadrao * (porPredio[tipo]?.[mercadoria] ?? dados.escalaPadrao);
}
