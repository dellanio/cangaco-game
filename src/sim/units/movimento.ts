/**
 * O movimento compartilhado por qualquer unidade com FSM (serf, e agora laborer — F11c).
 * Extraido de `systems/serfs.ts` sem mudar corpo: era privado ali, ganhou o segundo
 * consumidor (PROGRESS.md previa "extrair la, quando houver o segundo consumidor").
 *
 * `fsmData.caminho` (tiles a andar, sem o atual) e `fsmData.progresso` (ticks no passo em
 * curso). O passo custa `custoDoPasso` (dado); ao completa-lo a unidade passa ao tile seguinte.
 */
import type { DadosDaFsm, GameEvent, GameState, Predio, Unidade } from '../state';
import type { GameData } from '../data/types';
import type { TileDeGrid } from '../estradas';
import { custoDoPasso, passoAndavel } from '../pathfinding';
import { classeDaUnidade } from '../condicao';
import { colisaoCivilLigada, passoCivil } from '../colisao';
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

/** Troca um predio no estado. Era privado em `systems/laborers.ts` (F11c) e
 *  subiu aqui ao ganhar o segundo consumidor (F14), como `andar`/`chegou`
 *  subiram de `systems/serfs.ts`. */
export function comPredio(state: GameState, predio: Predio): GameState {
  return { ...state, predios: { ...state.predios, porId: { ...state.predios.porId, [predio.id]: predio } } };
}

export const noTile = (u: Unidade): TileDeGrid => ({ gx: u.gx, gy: u.gy });

export const ocioso = (u: Unidade): Unidade => ({ ...u, fsm: 'ocioso', fsmData: {} });

export function ficarOcioso(state: GameState, u: Unidade, eventos: readonly GameEvent[] = []): Passo {
  return { state: comUnidade(state, ocioso(u)), events: eventos };
}

/** C5 — algum OUTRO militar esta no tile? (GDD §6.4: "militares colidem"; civil nao conta.) */
function temOutroMilitar(state: GameState, tile: TileDeGrid, quem: string, dados: GameData): boolean {
  for (const id of state.unidades.ordem) {
    if (id === quem) continue;
    const o = state.unidades.porId[id];
    if (o !== undefined && o.gx === tile.gx && o.gy === tile.gy && classeDaUnidade(o.tipo, dados) === 'militar') return true;
  }
  return false;
}

const VIZINHOS_8: readonly TileDeGrid[] = [
  { gx: 0, gy: -1 }, { gx: 1, gy: -1 }, { gx: 1, gy: 0 }, { gx: 1, gy: 1 },
  { gx: 0, gy: 1 }, { gx: -1, gy: 1 }, { gx: -1, gy: 0 }, { gx: -1, gy: -1 },
];

/** C5 — o militar que esta PARADO (sem caminho) no tile, ou null. */
function militarParadoEm(state: GameState, tile: TileDeGrid, quem: string, dados: GameData): Unidade | null {
  for (const id of state.unidades.ordem) {
    if (id === quem) continue;
    const o = state.unidades.porId[id];
    if (o !== undefined && o.gx === tile.gx && o.gy === tile.gy && classeDaUnidade(o.tipo, dados) === 'militar'
      && (o.fsmData.caminho ?? []).length === 0) return o;
  }
  return null;
}

/**
 * C5 — o DESVIO do KaM ("Go around busy units", `AVOID_TIMEOUT`): uma busca em largura do
 * tile atual ao destino que trata os tiles de militares como bloqueados, numa caixa que cobre
 * os dois com `margemDoDesvioMilitar` tiles de folga (limite de busca). Vizinhanca 8 em ordem
 * fixa, passo pelo `passoAndavel` do A*: deterministico. Devolve o caminho SEM o tile atual,
 * ou `null` se nao ha como contornar dentro da caixa.
 */
function desvio(state: GameState, u: Unidade, destino: TileDeGrid, dados: GameData): readonly TileDeGrid[] | null {
  const ocupado = new Set<string>();
  for (const id of state.unidades.ordem) {
    const o = state.unidades.porId[id];
    if (o !== undefined && id !== u.id && classeDaUnidade(o.tipo, dados) === 'militar') ocupado.add(`${o.gx},${o.gy}`);
  }
  const m = dados.movimento.margemDoDesvioMilitar;
  const x0 = Math.min(u.gx, destino.gx) - m;
  const x1 = Math.max(u.gx, destino.gx) + m;
  const y0 = Math.min(u.gy, destino.gy) - m;
  const y1 = Math.max(u.gy, destino.gy) + m;
  const chave = (t: TileDeGrid): string => `${t.gx},${t.gy}`;
  const veio = new Map<string, TileDeGrid | null>([[chave(u), null]]);
  const fila: TileDeGrid[] = [noTile(u)];
  for (let k = 0; k < fila.length; k += 1) {
    const aqui = fila[k] as TileDeGrid;
    if (aqui.gx === destino.gx && aqui.gy === destino.gy) {
      const caminho: TileDeGrid[] = [];
      for (let t: TileDeGrid | null = aqui; t !== null && chave(t) !== chave(u); t = veio.get(chave(t)) ?? null) caminho.unshift(t);
      return caminho;
    }
    for (const d of VIZINHOS_8) {
      const t = { gx: aqui.gx + d.gx, gy: aqui.gy + d.gy };
      if (t.gx < x0 || t.gx > x1 || t.gy < y0 || t.gy > y1 || veio.has(chave(t)) || ocupado.has(chave(t))) continue;
      if (!passoAndavel(state, aqui, t, 'livre', dados)) continue;
      veio.set(chave(t), aqui);
      fila.push(t);
    }
  }
  return null;
}

/** Um tick de movimento: acumula 1 de progresso; ao completar o passo, a unidade passa ao tile seguinte. */
export function andar(state: GameState, u: Unidade, dados: GameData): Unidade {
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0];
  if (proximo === undefined) return u;
  const custo = custoDoPasso(state.estradas, noTile(u), proximo, dados);
  const progresso = (u.fsmData.progresso ?? 0) + 1;
  if (progresso < custo) {
    return { ...u, fsmData: { ...u.fsmData, progresso } };
  }
  // C5 — militar nao entra em tile de outro militar: segura o passo e conta a espera; passado
  // `ticksDesvioMilitar`, da o passo para o lado (ou, com o DESTINO ocupado, para ali)
  if (classeDaUnidade(u.tipo, dados) === 'militar' && temOutroMilitar(state, proximo, u.id, dados)) {
    const bloqueado = (u.fsmData.bloqueado ?? 0) + 1;
    if (bloqueado >= dados.movimento.ticksDesvioMilitar) {
      const destino = caminho[caminho.length - 1] as TileDeGrid;
      const { bloqueado: _b, ...resto } = u.fsmData;
      void _b;
      // o DESTINO tem um militar PARADO: para ali perto (quem so esta passando, espera-se)
      if (militarParadoEm(state, destino, u.id, dados) !== null && caminho.length === 1) {
        return { ...u, fsmData: { ...resto, caminho: [], progresso: 0 } };
      }
      const contorno = caminho.length === 1 ? null : desvio(state, u, destino, dados);
      return contorno === null || contorno.length === 0
        ? { ...u, fsmData: { ...resto, progresso: custo - 1 } } // tenta de novo depois de outro periodo
        : { ...u, fsmData: { ...resto, caminho: contorno, progresso: 0 } };
    }
    return { ...u, fsmData: { ...u.fsmData, progresso: custo - 1, bloqueado } };
  }
  // D1 — o civil com a colisao civil ligada: troca, espera, desvio e troca forcada
  if (colisaoCivilLigada(dados) && classeDaUnidade(u.tipo, dados) === 'civil') return passoCivil(state, u, custo, dados);
  const { bloqueado: _b, ...semEspera } = u.fsmData;
  void _b;
  return { ...u, gx: proximo.gx, gy: proximo.gy, fsmData: { ...semEspera, caminho: caminho.slice(1), progresso: 0 } };
}

export const chegou = (u: Unidade): boolean => (u.fsmData.caminho ?? []).length === 0;
