/**
 * I-TELA-MENU-DA-CAMPANHA (plano em docs/planos/2026-10-12-campanha-jogavel.md) — a campanha no laco
 * externo: o progresso do jogador (as fases vencidas, no `localStorage`, fora do save da partida), a
 * lista das fases para o menu e a linha do objetivo para o HUD. TypeScript puro, sem DOM, testavel
 * headless, como a `escolha-da-partida.ts`. Nao toca o estado: so le.
 */
import { rawGameData } from './sim/data';
import type { RawGameData } from './sim/data';
import type { GameData, ObjetivoDaFaseData } from './sim/data/types';
import type { GameState } from './sim/state';
import { faseDaCampanha } from './sim/fase';
import type { Gaveta } from './arquivo-da-partida';
import temaSertao from '../data/theme-sertao.json';

/** A chave do progresso no `localStorage`. */
export const CHAVE_DO_PROGRESSO = 'cangaco.campanha';

/** Uma fase como o menu a mostra. */
export interface ResumoDaFase {
  readonly id: string;
  readonly numero: number;
  readonly local: string;
  readonly titulo: string;
  readonly narrativa: string;
  readonly desafio: string;
}

/** As dez fases em ordem, do dado da campanha. */
export function resumoDasFases(raw: RawGameData = rawGameData): ResumoDaFase[] {
  return [...raw.fases].sort((a, b) => a.fase - b.fase)
    .map((f) => ({ id: f.id, numero: f.fase, local: f.local, titulo: f.titulo, narrativa: f.narrativa, desafio: f.desafio }));
}

/** As fases vencidas, em ordem. Gravacao ausente, ilegivel ou fora do formato conta como nada vencido. */
export function lerProgresso(gaveta: Gaveta | null): number[] {
  if (gaveta === null) return [];
  let texto: string | null;
  try {
    texto = gaveta.getItem(CHAVE_DO_PROGRESSO);
  } catch {
    return [];
  }
  if (texto === null) return [];
  try {
    const cru = JSON.parse(texto) as { vencidas?: unknown };
    if (!Array.isArray(cru.vencidas)) return [];
    return cru.vencidas.filter((n): n is number => Number.isInteger(n) && n >= 1).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/** Grava a fase `numero` como vencida. Navegador sem armazenamento: nao grava, sem erro. */
export function gravarVitoria(gaveta: Gaveta | null, numero: number): void {
  if (gaveta === null) return;
  const vencidas = lerProgresso(gaveta);
  if (vencidas.includes(numero)) return;
  try {
    gaveta.setItem(CHAVE_DO_PROGRESSO, JSON.stringify({ vencidas: [...vencidas, numero].sort((a, b) => a - b) }));
  } catch {
    // armazenamento cheio ou bloqueado: a fase segue jogavel, so nao fica gravada
  }
}

/** A fase abre: a 1 sempre; as outras, com a anterior vencida. */
export function faseAberta(vencidas: readonly number[], numero: number): boolean {
  return numero === 1 || vencidas.includes(numero - 1);
}

/** O id da fase seguinte, ou `null` depois da ultima. */
export function proximaFase(id: string, raw: RawGameData = rawGameData): string | null {
  const atual = raw.fases.find((f) => f.id === id);
  if (atual === undefined) return null;
  return raw.fases.find((f) => f.fase === atual.fase + 1)?.id ?? null;
}

const rotulos = temaSertao.campanha;

/** O nome do lado na fase (o bando), para o texto do objetivo. */
function nomeDoLado(estado: GameState, lado: number | undefined, dados: GameData): string {
  if (estado.fase === undefined || lado === undefined) return '';
  return faseDaCampanha(estado.fase.id, dados).lados.find((l) => l.lado === lado)?.nome ?? '';
}

/** Um objetivo de vitoria em texto do tema (`campanha.objetivos.<tipo>`). */
function textoDoObjetivo(estado: GameState, o: ObjetivoDaFaseData, dados: GameData): string {
  const modelo = (rotulos.objetivos as Readonly<Record<string, string | undefined>>)[o.alvo === 'tropas' ? `${o.tipo}Tropas` : o.tipo] ?? rotulos.objetivos.destruir;
  return modelo.replace('{bando}', nomeDoLado(estado, o.lado, dados)).replace('{ondas}', String(o.ondas ?? 0));
}

/** A linha do objetivo da fase para o HUD, ou `null` fora da campanha. Pura. */
export function objetivoEmTexto(estado: GameState, dados: GameData): string | null {
  if (estado.fase === undefined) return null;
  const fase = faseDaCampanha(estado.fase.id, dados);
  return fase.objetivos.vitoria.map((o) => textoDoObjetivo(estado, o, dados)).join(' · ');
}
