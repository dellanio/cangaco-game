/** Peixe vivo pertence à água; sua quantidade continua apenas no estado lido. */
export function recursoSubmerso(id: string): boolean {
  return id === 'fish';
}
