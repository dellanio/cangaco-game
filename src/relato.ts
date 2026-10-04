/**
 * I-ENTREGA-PLAYTEST — o relato de quem testou: um arquivo que a PESSOA baixa e manda ao operador.
 * Nada sai da maquina sozinho.
 *
 * Laco externo, TypeScript puro, sem DOM (como `arquivo-da-partida.ts`): o teste o roda headless. O
 * relato leva EXATAMENTE os campos de `CAMPOS_DO_RELATO`, e a tela diz o que leva a partir da mesma
 * lista (`ui/relato.ts`): o que o arquivo leva e o que a tela diz nao tem como divergir. O save
 * dentro dele e o save de sempre (`sim/save.ts`), e por isso o relato carrega de volta no jogo.
 */
import type { GameState } from './sim/state';
import { LADO_DO_JOGADOR } from './sim/state';
import type { GameData } from './sim/data/types';
import { gameData } from './sim/data';
import { carregar, salvar } from './sim/save';
import { NIVEL_PADRAO } from './sim/ia';

/** Os campos do relato, na ordem em que a tela os anuncia. Nenhum outro. */
export const CAMPOS_DO_RELATO = ['save', 'commit', 'nivel', 'texto'] as const;
export type CampoDoRelato = (typeof CAMPOS_DO_RELATO)[number];

export interface Relato {
  /** O save de sempre (`salvar`). */
  readonly save: string;
  /** O commit do build que a pessoa jogou. */
  readonly commit: string;
  /** O nivel do adversario, ou `null` no jogo sem adversario. */
  readonly nivel: string | null;
  /** O que a pessoa escreveu. */
  readonly texto: string;
}

/** O nivel do adversario na partida: o do primeiro lado de IA, ou `null` sem IA. */
export function nivelDaIA(estado: GameState): string | null {
  const lados = Object.keys(estado.ia ?? {}).filter((l) => l !== String(LADO_DO_JOGADOR)).sort();
  const primeiro = lados[0];
  if (primeiro === undefined) return null;
  return estado.ia?.[primeiro]?.nivel ?? NIVEL_PADRAO;
}

/** O relato desta partida. Pura. */
export function relatoDaPartida(estado: GameState, commit: string, texto: string, dados: GameData = gameData): Relato {
  return { save: salvar(estado, dados), commit, nivel: nivelDaIA(estado), texto };
}

/** O arquivo do relato: JSON com os campos de `CAMPOS_DO_RELATO`, nessa ordem. Pura. */
export function textoDoRelato(relato: Relato): string {
  return JSON.stringify(Object.fromEntries(CAMPOS_DO_RELATO.map((c) => [c, relato[c]])), null, 2);
}

/** O nome do arquivo que a pessoa baixa. */
export function nomeDoArquivoDoRelato(relato: Relato, estado: GameState): string {
  return `relato-${relato.commit}-tick-${estado.tick}.json`;
}

export type LeituraDoRelato =
  | { readonly ok: true; readonly relato: Relato; readonly estado: GameState }
  | { readonly ok: false; readonly motivo: string };

/** Le um arquivo de relato e carrega o save de dentro. Campo a mais, a menos ou de outro tipo e
 *  recusado; o save recusado pelo jogo tambem (o motivo e o do `carregar`). */
export function lerRelato(arquivo: string, dados: GameData = gameData): LeituraDoRelato {
  let cru: unknown;
  try {
    cru = JSON.parse(arquivo);
  } catch {
    return { ok: false, motivo: 'o arquivo nao e JSON' };
  }
  if (cru === null || typeof cru !== 'object' || Array.isArray(cru)) return { ok: false, motivo: 'o arquivo nao e um relato' };
  const o = cru as Record<string, unknown>;
  const chaves = Object.keys(o).sort();
  if (JSON.stringify(chaves) !== JSON.stringify([...CAMPOS_DO_RELATO].sort())) return { ok: false, motivo: 'o arquivo nao e um relato' };
  if (typeof o['save'] !== 'string' || typeof o['commit'] !== 'string' || typeof o['texto'] !== 'string'
    || (o['nivel'] !== null && typeof o['nivel'] !== 'string')) return { ok: false, motivo: 'o arquivo nao e um relato' };
  const relato: Relato = { save: o['save'], commit: o['commit'], nivel: o['nivel'] as string | null, texto: o['texto'] };
  try {
    return { ok: true, relato, estado: carregar(relato.save, dados) };
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : String(e) };
  }
}
