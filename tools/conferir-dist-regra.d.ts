// Assinatura de tipos para tools/conferir-dist-regra.js.
export interface ArquivoDoDist { readonly caminho: string; readonly sha256: string; readonly bytes: number }
export interface ArquivoDaBase { readonly caminho: string; readonly sha256: string }
export function conferirDist(entrada: {
  readonly dist: readonly ArquivoDoDist[];
  readonly base: readonly ArquivoDaBase[];
  readonly manifesto: Record<string, unknown> | null;
}): { problemas: string[]; arquivos: number; bytes: number };
export const MODULOS_DE_DEPURACAO: readonly string[];
