/**
 * D-TELA-07 — o sinal de pausado no mapa (BUILD_PLAN.md, "D-TELA-07").
 *
 * Desde a D3 (2026-10-01) a casa pausada mostra o ocioso com o homem dentro, igual a casa
 * sem insumo (F-VIVO-e). O que separa as duas na tela e esta placa: duas barras de pausa e
 * a palavra do botao de pausar do painel (`painelPredio.pausar`, do tema; decisao do operador,
 * 2026-09-30).
 * Placeholder geometrico do §9 ate haver arte.
 *
 * Pura e sem Phaser: o teste afirma a regra e a geometria em Node, e a cena desenha e publica
 * na ponte a MESMA caixa que esta funcao devolve.
 */
import temaSertao from '../../data/theme-sertao.json';
import type { Predio } from '../sim/state';

/**
 * O rotulo do botao de pausar/retomar do painel do predio (`src/ui/painel-predio.ts`), do tema.
 * E a ORIGEM unica da palavra: o painel chama esta funcao, e a placa usa o rotulo do predio nao
 * pausado. Assim a placa diz o mesmo que o botao, pela mesma string. `sim/` nunca le o tema.
 */
export function rotuloDoBotaoDePausar(pausado: boolean): string {
  return pausado ? temaSertao.painelPredio.retomar : temaSertao.painelPredio.pausar;
}

/** O texto da placa: a palavra do botao de pausar do painel (decisao do operador, 2026-09-30). */
export const TEXTO_DO_SINAL_DE_PAUSADO: string = rotuloDoBotaoDePausar(false);

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
