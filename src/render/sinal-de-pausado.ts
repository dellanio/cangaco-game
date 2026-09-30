/**
 * D-TELA-07 — o sinal de pausado no mapa (BUILD_PLAN.md, "D-TELA-07").
 *
 * Desde a D3 (2026-10-01) a casa pausada mostra o ocioso com o homem dentro, igual a casa
 * sem insumo (F-VIVO-e). O que separa as duas na tela e esta placa: duas barras de pausa e
 * a palavra que o painel ja mostra para o mesmo estado (`painelPredio.pausado`, do tema).
 * Placeholder geometrico do §9 ate haver arte.
 *
 * Pura e sem Phaser: o teste afirma a regra e a geometria em Node, e a cena desenha e publica
 * na ponte a MESMA caixa que esta funcao devolve.
 */
import temaSertao from '../../data/theme-sertao.json';
import type { Predio } from '../sim/state';

/** O texto da placa, do tema. `sim/` nunca le o tema; so a tela. */
export const TEXTO_DO_SINAL_DE_PAUSADO: string = temaSertao.painelPredio.pausado;

/** O predio mostra a placa: completo e pausado pelo jogador (F16c). Obra nao pausa. */
export function temSinalDePausado(predio: Predio): boolean {
  return predio.estado === 'completo' && predio.pausado;
}

export interface CaixaEmPx { readonly x: number; readonly y: number; readonly w: number; readonly h: number }

/**
 * A placa em px do container do predio: centrada na largura do corpo, colada no alto dele, e
 * nunca mais larga que o corpo menos uma margem. Altura e largura sao frações do tile, como a
 * bandeira do bando (`desenharBandeira`): dado de tela, nao balanceamento.
 */
export function caixaDoSinalDePausado(corpo: CaixaEmPx, tilePx: number): CaixaEmPx {
  const margem = tilePx * 0.06;
  const h = tilePx * 0.34;
  const w = Math.min(tilePx * 1.5, corpo.w - 2 * margem);
  return { x: corpo.x + (corpo.w - w) / 2, y: corpo.y + margem, w, h };
}
