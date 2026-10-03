// Assinatura de tipos para tools/publicar-regra.js.
export function podePublicar(fatos: {
  readonly head: string;
  readonly tags: readonly string[];
  readonly arvoreLimpa: boolean;
  readonly selo: unknown;
  readonly build: unknown;
}): { ok: boolean; problemas: string[]; versao: string | null };
export function argumentosDoButler(dist: string, alvo: string, versao: string): string[];
export function versaoDasTags(tags: readonly string[]): string | null;
export const CANAL: string;
