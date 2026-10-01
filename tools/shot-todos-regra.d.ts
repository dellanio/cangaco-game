export const MEMORIA_MINIMA_MB: number;
export function listarRoteiros(arquivos: readonly string[]): string[];
export function deveParar(memoriaLivreMb: number | null | undefined, minimoMb?: number): boolean;
