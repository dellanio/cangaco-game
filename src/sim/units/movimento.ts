/**
 * O movimento compartilhado por qualquer unidade com FSM (serf, e agora laborer — F11c).
 * Extraido de `systems/serfs.ts` sem mudar corpo: era privado ali, ganhou o segundo
 * consumidor (PROGRESS.md previa "extrair la, quando houver o segundo consumidor").
 *
 * `fsmData.caminho` (tiles a andar, sem o atual) e `fsmData.progresso` (ticks no passo em
 * curso). O passo custa `custoDoPasso` (dado); ao completa-lo a unidade passa ao tile seguinte.
 */
import type { DadosDaFsm, GameEvent, GameState, Unidade } from '../state';
import type { GameData } from '../data/types';
import type { TileDeGrid } from '../estradas';
import { custoDoPasso } from '../pathfinding';
import type { ResultadoDeSistema } from '../systems/jobs';

type Passo = ResultadoDeSistema;

/** Monta `fsmData` OMITINDO o que falta (o JSON perderia um `undefined`; e o tipo o proibe). */
export function dadosDaFsm(d: {
  readonly tarefa?: string; readonly carga?: string; readonly caminho?: readonly TileDeGrid[];
  readonly progresso?: number; readonly armazem?: string;
}): DadosDaFsm {
  return {
    ...(d.tarefa === undefined ? {} : { tarefa: d.tarefa }),
    ...(d.carga === undefined ? {} : { carga: d.carga }),
    ...(d.caminho === undefined ? {} : { caminho: [...d.caminho] }),
    ...(d.progresso === undefined ? {} : { progresso: d.progresso }),
    ...(d.armazem === undefined ? {} : { armazem: d.armazem }),
  };
}

export function comUnidade(state: GameState, unidade: Unidade): GameState {
  return { ...state, unidades: { ...state.unidades, porId: { ...state.unidades.porId, [unidade.id]: unidade } } };
}

export const noTile = (u: Unidade): TileDeGrid => ({ gx: u.gx, gy: u.gy });

export const ocioso = (u: Unidade): Unidade => ({ ...u, fsm: 'ocioso', fsmData: {} });

export function ficarOcioso(state: GameState, u: Unidade, eventos: readonly GameEvent[] = []): Passo {
  return { state: comUnidade(state, ocioso(u)), events: eventos };
}

/** Um tick de movimento: acumula 1 de progresso; ao completar o passo, a unidade passa ao tile seguinte. */
export function andar(state: GameState, u: Unidade, dados: GameData): Unidade {
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0];
  if (proximo === undefined) return u;
  const progresso = (u.fsmData.progresso ?? 0) + 1;
  if (progresso < custoDoPasso(state.estradas, noTile(u), proximo, dados)) {
    return { ...u, fsmData: { ...u.fsmData, progresso } };
  }
  return { ...u, gx: proximo.gx, gy: proximo.gy, fsmData: { ...u.fsmData, caminho: caminho.slice(1), progresso: 0 } };
}

export const chegou = (u: Unidade): boolean => (u.fsmData.caminho ?? []).length === 0;
