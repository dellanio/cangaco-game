/**
 * I-CLIMA-ESTACAO — a estacao do ano, FUNCAO DO TICK (plano em docs/planos/2026-10-05-acude-e-clima.md).
 * Sem estado no `GameState`: o ciclo de `data/clima.json`, ja em ticks desde o carregamento, se repete
 * desde o tick 0. Puro e deterministico; o render e a interface leem as mesmas funcoes.
 */
import { gameData } from './data';
import type { GameData } from './data/types';
import type { GameEvent } from './state';

/** A fase do ciclo no tick: o indice dela, o id, quantos ticks ja passaram nela e quantos faltam. */
export interface FaseDoClima {
  readonly indice: number;
  readonly id: string;
  readonly decorrido: number;
  readonly falta: number;
}

/** O tamanho do ciclo inteiro, em ticks. */
export function ticksDoCiclo(dados: GameData = gameData): number {
  return dados.clima.ciclo.reduce((soma, f) => soma + f.ticks, 0);
}

/** A fase do ciclo no tick, ou `null` com o clima desligado. */
export function faseNoTick(tick: number, dados: GameData = gameData): FaseDoClima | null {
  const { clima } = dados;
  if (!clima.ligado || clima.ciclo.length === 0) return null;
  const total = ticksDoCiclo(dados);
  let resto = ((tick % total) + total) % total;
  for (let indice = 0; indice < clima.ciclo.length; indice++) {
    const fase = clima.ciclo[indice]!;
    if (resto < fase.ticks) return { indice, id: fase.id, decorrido: resto, falta: fase.ticks - resto };
    resto -= fase.ticks;
  }
  return null;
}

/** A estacao no tick (o id da fase), ou `null` com o clima desligado. */
export function estacaoNoTick(tick: number, dados: GameData = gameData): string | null {
  return faseNoTick(tick, dados)?.id ?? null;
}

/** A fracao do ciclo inteiro no tick, de 0 (inclusive) a 1 (exclusive): o relogio do sol a le. */
export function fracaoDoCiclo(tick: number, dados: GameData = gameData): number | null {
  if (faseNoTick(tick, dados) === null) return null;
  const total = ticksDoCiclo(dados);
  return (((tick % total) + total) % total) / total;
}

/** O multiplicador de crescimento da estacao no tick (1 com o clima desligado). */
export function multiplicadorNoTick(tick: number, dados: GameData = gameData): number {
  const fase = faseNoTick(tick, dados);
  return fase === null ? 1 : dados.clima.ciclo[fase.indice]!.multiplicadorDeCrescimento;
}

/**
 * I-CLIMA-CRESCIMENTO — quantos ticks o tile semeado em `semeadoEm` leva para amadurecer: o tempo do
 * tipo dividido pelo multiplicador da estacao DA SEMEADURA, arredondado (so as `culturas` do clima).
 */
export function ticksParaAmadurecer(
  tipo: string, ticksDeCrescer: number, semeadoEm: number, dados: GameData = gameData,
): number {
  if (!dados.clima.ligado || !dados.clima.culturas.includes(tipo)) return ticksDeCrescer;
  return Math.round(ticksDeCrescer / multiplicadorNoTick(semeadoEm, dados));
}

/** O evento do tick: `season-changed` quando a estacao do tick e outra que a do tick anterior. */
export function eventoDaEstacao(tick: number, dados: GameData = gameData): GameEvent | null {
  const agora = estacaoNoTick(tick, dados);
  if (agora === null || tick <= 0) return null;
  return agora === estacaoNoTick(tick - 1, dados) ? null : { type: 'season-changed', estacao: agora };
}
