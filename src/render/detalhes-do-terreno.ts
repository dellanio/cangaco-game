/** O detalhe legado pertence ao placeholder; a arte carregada ja pinta o tile. */
export function terrenoRecebeDetalhe(tipo: string, temArte: readonly string[]): boolean {
  return !temArte.includes(tipo);
}
