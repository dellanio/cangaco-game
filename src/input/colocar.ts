import type { Command } from '../sim/commands';
import type { Ferramenta } from './ferramenta';

/** O tile clicado, em coordenada de grid. Mesma forma do `Tile` de
 *  `render/grid.ts`, sem importa-lo: `input/` nao depende de `render/`. */
export interface TileClicado {
  readonly gx: number;
  readonly gy: number;
}

export interface EntradaDoMapa {
  aoClicar(tile: TileClicado): void;
}

/**
 * Do clique no mapa ao comando. Com uma ferramenta ativa, emite `PlaceBlueprint`
 * para o tile clicado; sem ferramenta, nao faz nada.
 *
 * Emite SEMPRE que ha ferramenta, mesmo sobre um lugar que a sim vai recusar: a
 * decisao e de `sim/` (`canPlace`, dentro do `step`). A planta verde/vermelha da
 * F06 e so consultiva, e a sim devolve o motivo em `command-rejected`.
 *
 * A ferramenta SEGUE ativa depois do clique — o jogador planta varios predios em
 * sequencia (e a estrada da F08 exige isso). Quem a encerra e o `Esc`.
 */
export function criarEntradaDoMapa(
  ferramenta: Ferramenta, emitir: (comando: Command) => void,
): EntradaDoMapa {
  return {
    aoClicar(tile) {
      const predio = ferramenta.predioAtivo;
      if (predio === null) return;
      emitir({ type: 'PlaceBlueprint', buildingId: predio, gx: tile.gx, gy: tile.gy });
    },
  };
}
