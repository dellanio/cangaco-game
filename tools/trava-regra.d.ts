export interface DonoDaTrava { readonly id: string; readonly branch: string; readonly inicio: string; readonly comando?: string }
export const LIMITE_DE_ABANDONO_MS: number;
export function caminhoDaTrava(env?: Record<string, string | undefined>): string;
export function lerTrava(caminho: string): DonoDaTrava | null;
export function abandonada(trava: DonoDaTrava | null, agoraMs: number, limiteMs?: number): boolean;
export function tentarPegar(caminho: string, dono: DonoDaTrava, agoraMs: number, limiteMs?: number):
  { ok: true } | { ok: false; dona: DonoDaTrava | null };
export function soltar(caminho: string, id: string): boolean;
