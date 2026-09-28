/**
 * C2b — onde um projetil esta NA TELA, entre o lancamento e a chegada. Aritmetica pura:
 * le so o TIPO do projetil (a sim decide voo e chegada; aqui so se interpola), sem Phaser.
 * A fracao usa o `alfa` do relogio (F11a), o mesmo que interpola as unidades; o arco e a
 * parabola do KaM (`KM_Projectiles.pas:386-388`: `sin(fracao * pi)`).
 */
import type { Projetil } from '../sim/state';

/** Altura do arco, em tiles, por tile de distancia. Constante de desenho, nao de regra. */
export const ALTURA_DO_ARCO = 0.2;

export interface PosicaoDoProjetil {
  /** Em tiles, fracionario: o CENTRO do tile e `gx + 0.5`. */
  readonly gx: number;
  readonly gy: number;
  /** Quanto acima do chao, em tiles (0 nas pontas). */
  readonly altura: number;
  /** De 0 (lancado) a 1 (chegando). */
  readonly fracao: number;
}

/** `centroDaOrigem`, em tiles fracionarios: de onde o desenho sai quando nao e o centro do
 *  tile de origem (a pedra sai do meio do lote da torre). */
export function posicaoDoProjetil(
  p: Projetil, alfa: number, centroDaOrigem?: { readonly gx: number; readonly gy: number },
): PosicaoDoProjetil {
  const voo = Math.max(1, p.voo);
  const fracao = Math.min(1, Math.max(0, (voo - p.restantes + alfa) / voo));
  const de = centroDaOrigem ?? { gx: p.origem.gx + 0.5, gy: p.origem.gy + 0.5 };
  const para = { gx: p.alvoTile.gx + 0.5, gy: p.alvoTile.gy + 0.5 };
  const distancia = Math.hypot(para.gx - de.gx, para.gy - de.gy);
  return {
    gx: de.gx + (para.gx - de.gx) * fracao,
    gy: de.gy + (para.gy - de.gy) * fracao,
    altura: ALTURA_DO_ARCO * distancia * Math.sin(Math.PI * fracao),
    fracao,
  };
}
