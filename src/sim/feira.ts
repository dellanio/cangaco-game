/**
 * F35 — a regra da FEIRA num lugar so: a ordem ativa, o que falta de A, por que nao
 * troca, e o teto de serfs. O gerador de insumo, o sistema de troca, o claim e o painel
 * perguntam AQUI.
 */
import type { GameState, Predio, PredioCompleto } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

export const ID_DA_FEIRA = 'marketplace';

export type MotivoDeRecusaDeTroca =
  | 'predio-nao-e-feira'
  | 'mesma-mercadoria'
  | 'mercadoria-desconhecida'
  | 'quantidade-invalida';

export type PorQueNaoTroca = 'sem-ordem' | 'ordem-cumprida' | 'sem-mercadoria';

export const ehFeiraCompleta = (p: Predio | undefined): p is PredioCompleto =>
  p !== undefined && p.estado === 'completo' && p.tipo === ID_DA_FEIRA;

/** A ordem que ainda tem troca por fazer, ou `null`. */
export function trocaAtiva(p: PredioCompleto): NonNullable<PredioCompleto['troca']> | null {
  return p.troca !== undefined && p.troca.feitas < p.troca.quantidade ? p.troca : null;
}

/** Quanto de A a feira ainda quer TER na entrada: `taxa x` as trocas que faltam. */
export function alvoDaFeira(p: PredioCompleto, mercadoria: string, dados: GameData = gameData): number {
  const t = trocaAtiva(p);
  if (t === null || t.da !== mercadoria) return 0;
  return dados.economia.marketplace.taxa * (t.quantidade - t.feitas);
}

/** Por que a feira nao troca AGORA (`null` quando troca neste tick). `sem-mercadoria`: a
 *  entrada nao tem `taxa` de A. O painel diz isto. */
export function porQueNaoTroca(p: PredioCompleto, dados: GameData = gameData): PorQueNaoTroca | null {
  if (p.troca === undefined) return 'sem-ordem';
  const t = trocaAtiva(p);
  if (t === null) return 'ordem-cumprida';
  return (p.estoque.entrada[t.da] ?? 0) >= dados.economia.marketplace.taxa ? null : 'sem-mercadoria';
}

export function motivoDaRecusaDeTroca(
  state: GameState, predio: string, da: string, para: string, quantidade: number, dados: GameData = gameData,
): MotivoDeRecusaDeTroca | null {
  if (!ehFeiraCompleta(state.predios.porId[predio])) return 'predio-nao-e-feira';
  if (!Number.isInteger(quantidade) || quantidade < 0) return 'quantidade-invalida';
  if (quantidade === 0) return null; // cancelar nao olha as mercadorias
  if (da === para) return 'mesma-mercadoria';
  const m = dados.economia.mercadorias;
  if (!m.includes(da) || !m.includes(para)) return 'mercadoria-desconhecida';
  return null;
}

/** F35 — quantas tarefas EM CURSO (reclamada ou carregando) tem a feira `predio` como
 *  origem ou destino. O claim recusa a proxima quando chega a `maxSerfs`. */
export function serfsNaFeira(state: GameState, predio: string): number {
  let n = 0;
  for (const id of state.jobs.tarefas.ordem) {
    const t = state.jobs.tarefas.porId[id];
    if (t === undefined || t.estado === 'aberta') continue;
    const origem = 'origem' in t ? t.origem : undefined;
    const destino = 'destino' in t ? t.destino : undefined;
    if (origem === predio || destino === predio) n += 1;
  }
  return n;
}
