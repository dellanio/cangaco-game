export interface RefDoPush { readonly refLocal: string; readonly shaLocal: string; readonly refRemota: string; readonly shaRemoto: string }
export function lerRefs(texto: string): RefDoPush[];
export function lerSelo(texto: string | null | undefined): Record<string, unknown> | null;
export interface GitDoPush { ehAncestral(a: string, b: string): boolean; emRefRemota(a: string): boolean }
export function decidirPush(
  textoDoSelo: string | null | undefined, refs: readonly RefDoPush[], textoDoSeloRapido?: string | null, git?: GitDoPush,
): { ok: boolean; motivo: string };
