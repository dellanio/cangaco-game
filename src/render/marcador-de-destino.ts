// C-TELA-02 (plano em docs/planos/2026-09-29-C-TELA-02-marcador-de-destino.md) — o tile do
// destino de uma ordem de mover fica marcado por um instante e some, como no Civilization.
// Estado de TELA: nao entra no GameState. Puro, sem Phaser: a cena so desenha o que sai daqui.
import type { Tile } from './grid';

export interface MarcadorDeDestino {
  readonly tile: Tile;
  /** O relogio da cena (`scene.time.now`) no clique. */
  readonly desdeMs: number;
}

/** O marcador a desenhar agora, com `fracao` 0 no clique e 1 no fim, ou `null`. */
export function marcadorVisivel(
  marcador: MarcadorDeDestino | null, agoraMs: number, duracaoMs: number,
): { readonly tile: Tile; readonly fracao: number } | null {
  if (marcador === null) return null;
  const decorrido = agoraMs - marcador.desdeMs;
  if (decorrido < 0 || decorrido >= duracaoMs) return null;
  return { tile: marcador.tile, fracao: decorrido / duracaoMs };
}
