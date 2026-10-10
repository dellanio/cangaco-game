/**
 * I-PRODUCAO-ACUDE-AGUA — a agua do Acude, a cada tick (plano docs/planos/2026-10-05-acude-e-clima.md,
 * etapa 4). Nas estacoes de entrada (`acude.estacoesDeEntrada`, ids do ciclo do clima) o Acude completo
 * ganha 1 unidade a cada `ticksPorEntrada`; sempre perde 1 a cada `ticksPorEvaporacao`. O nivel fica entre 0 e
 * a capacidade. O ritmo e pelo resto do tick, sem acumulador no estado: inteiro e deterministico.
 */
import type { GameData } from '../data/types';
import type { GameState, Predio, PredioCompleto } from '../state';
import { ID_DO_ACUDE } from '../state';
import { estacaoNoTick, multiplicadorNoTick } from '../clima';
import { fazendasQueConsomem } from '../acude';

/** O Acude completo (o unico predio com `agua`). */
export function ehAcudeCompleto(p: Predio | undefined): p is PredioCompleto {
  return p !== undefined && p.estado === 'completo' && p.tipo === ID_DO_ACUDE;
}

/** O nivel do Acude depois do tick `tick` (o NOVO tick do `step`, o mesmo do evento da estacao): a entrada,
 *  a evaporacao e o consumo das fazendas que ele irriga (I-PRODUCAO-ACUDE-IRRIGACAO: so com a estacao
 *  abaixo do teto da irrigacao, que e quando ela muda alguma coisa), no teto e no zero. Pura. */
export function proximoNivel(state: GameState, acude: PredioCompleto, tick: number, dados: GameData): number {
  const a = dados.acude;
  let agua = acude.agua ?? 0;
  const estacao = dados.clima.ligado ? estacaoNoTick(tick, dados) : null;
  if (estacao !== null && a.estacoesDeEntrada.includes(estacao) && tick % a.ticksPorEntrada === 0) agua += 1;
  if (tick % a.ticksPorEvaporacao === 0) agua -= 1;
  if (dados.clima.ligado && multiplicadorNoTick(tick, dados) < a.tetoDoMultiplicador && tick % a.ticksPorConsumo === 0) {
    agua -= fazendasQueConsomem(state, acude, dados);
  }
  return Math.max(0, Math.min(a.capacidade, agua));
}

export function sistemaDoAcude(state: GameState, tick: number, dados: GameData): GameState {
  let porId: Record<string, Predio> | null = null;
  for (const id of state.predios.ordem) {
    const p = state.predios.porId[id];
    if (!ehAcudeCompleto(p)) continue;
    const agua = proximoNivel(state, p, tick, dados);
    if (agua === p.agua) continue;
    porId ??= { ...state.predios.porId };
    porId[id] = { ...p, agua };
  }
  return porId === null ? state : { ...state, predios: { ...state.predios, porId } };
}
