/**
 * I-TELA-COMENSAIS-NA-BODEGA — quem esta `comendo` aparece sentado a mesa da Bodega. A sim nao muda e nao
 * sabe que existe mesa: a refeicao dura (I-COMIDA-REFEICAO-COM-TEMPO) e a tela le quem esta comendo.
 *
 * Aritmetica pura, como `animais.ts`: o estado e os lugares chegam por parametro, a cena so desenha, e o teste
 * afirma em Node. Plano em `docs/planos/2026-10-15-comensais-na-bodega.md`.
 */
import type { LugarDeComensal } from './manifesto';
import { LACOS_DO_COMENSAL, LACO_DO_COMENSAL } from './manifesto-camadas';
import type { GameState, Predio } from '../sim/state';
import { FSM_COMENDO } from '../sim/condicao';

/** Ticks de jogo por quadro do comensal: 3 (1,2 s por garfada nos 4 quadros, a 10 Hz). O trabalho anda a 1 tick por
 *  quadro, rapido demais para quem come. Constante de TELA: a sim nao le. */
export const TICKS_POR_QUADRO_DO_COMENSAL = 3;

export interface ComensalNaMesa {
  /** O lugar, de 0 a `lugares.length - 1`. */
  readonly i: number;
  readonly unidade: string;
  readonly lugar: LugarDeComensal;
}

/** A unidade come NESTA Bodega: esta `comendo` encostada no lote dela (a sim a para no tile da chegada). */
function comeAqui(predio: Predio, gx: number, gy: number, largura: number, altura: number): boolean {
  return gx >= predio.gx - 1 && gx <= predio.gx + largura && gy >= predio.gy - 1 && gy <= predio.gy + altura;
}

/**
 * Os comensais de uma Bodega completa, na ordem de `unidades.ordem`, um por lugar. Com mais gente comendo do que
 * lugares, os de sobra continuam dentro (invisiveis, como hoje): a sim nao tem teto de assentos.
 */
export function comensaisDaBodega(
  estado: Pick<GameState, 'unidades'>, predio: Predio, footprint: readonly [number, number],
  lugares: readonly LugarDeComensal[],
): ComensalNaMesa[] {
  if (predio.estado !== 'completo' || lugares.length === 0) return [];
  const r: ComensalNaMesa[] = [];
  for (const id of estado.unidades.ordem) {
    if (r.length >= lugares.length) break;
    const u = estado.unidades.porId[id];
    if (u === undefined || u.fsm !== FSM_COMENDO || u.lado !== predio.lado) continue;
    if (!comeAqui(predio, u.gx, u.gy, footprint[0], footprint[1])) continue;
    const lugar = lugares[r.length];
    if (lugar !== undefined) r.push({ i: r.length, unidade: id, lugar });
  }
  return r;
}

/** O quadro do laco do comensal no lugar `i` (1..4). Anda com o tick; a defasagem por lugar evita que a mesa
 *  inteira leve a colher a boca junta. */
export function quadroDoComensal(tick: number, i: number): number {
  const n = LACOS_DO_COMENSAL[LACO_DO_COMENSAL] ?? 1;
  return ((Math.floor(Math.max(0, tick) / TICKS_POR_QUADRO_DO_COMENSAL) + i) % n) + 1;
}
