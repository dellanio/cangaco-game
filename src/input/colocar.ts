import type { Command } from '../sim/commands';
import type { Ferramenta } from './ferramenta';
import { tilesEntre } from './arrasto';

/** O tile do ponteiro, em coordenada de grid. Mesma forma do `Tile` de
 *  `render/grid.ts`, sem importa-lo: `input/` nao depende de `render/`. */
export interface TileClicado {
  readonly gx: number;
  readonly gy: number;
}

/**
 * Do mouse no mapa ao comando. A cena entrega so o TILE de cada evento; quem decide
 * o que aquilo significa e a ferramenta ativa.
 *
 *  - modo `predio` (F07): `aoClicar` emite `PlaceBlueprint` na hora. Arrastar e
 *    soltar nao fazem nada.
 *  - modo `estrada` / `demolir-estrada` (F08): um ARRASTO e UM comando, emitido ao
 *    soltar (`PlaceRoad` / `DemolishRoad`). Enquanto arrasta so ha previa
 *    (`trecho()`), que mora aqui — estado de interface, fora do `GameState`.
 *
 * `aoClicar` e o botao esquerdo apertado; o nome ficou da F07.
 */
export interface EntradaDoMapa {
  aoClicar(tile: TileClicado): void;
  aoArrastar(tile: TileClicado): void;
  aoSoltar(tile: TileClicado): void;
  /** O ponteiro saiu do canvas com o botao apertado: CANCELA o arrasto, sem emitir. */
  aoSairDoMapa(): void;
  /** O trecho que esta sendo arrastado, em ordem; `null` fora de um arrasto. */
  trecho(): readonly TileClicado[] | null;
}

/**
 * Sempre emite quando ha ferramenta, mesmo sobre um lugar que a sim vai recusar: a
 * decisao e de `sim/` (`canPlace` / `canPlaceRoad`, dentro do `step`). A planta e a
 * previa verde/vermelha sao so consultivas, e a sim devolve o motivo em
 * `command-rejected`.
 *
 * A ferramenta SEGUE ativa depois de emitir — o jogador planta varios predios e
 * arrasta varias estradas em sequencia. Quem a encerra e o `Esc`.
 *
 * Preencher o caminho: um `mousemove` rapido pula tiles, e uma estrada com buraco nao
 * conecta. Cada amostra e ligada a anterior por `tilesEntre` (4-conectada).
 *
 * SAIR DO CANVAS CANCELA o arrasto (padrao conservador): fora do canvas o Chromium
 * para de entregar `mousemove` (achado da F06), entao o ultimo trecho conhecido estaria
 * truncado num ponto que o jogador nao escolheu, e gastar pedra nisso em silencio e
 * pior que cancelar. Se o playtest mostrar irritacao, a troca para "confirma ate onde
 * chegou" e uma linha: chamar `soltar` em vez de descartar, em `aoSairDoMapa`.
 */
export function criarEntradaDoMapa(
  ferramenta: Ferramenta, emitir: (comando: Command) => void,
): EntradaDoMapa {
  let arrasto: TileClicado[] | null = null;

  // Trocar de ferramenta, ou `Esc`, no meio do arrasto o cancela.
  ferramenta.aoMudar(() => {
    arrasto = null;
  });

  function estender(tile: TileClicado): void {
    if (arrasto === null) return;
    const ultimo = arrasto[arrasto.length - 1];
    if (ultimo === undefined) return;
    arrasto.push(...tilesEntre(ultimo, tile).slice(1));
  }

  return {
    aoClicar(tile) {
      if (ferramenta.modo === 'predio' && ferramenta.predioAtivo !== null) {
        emitir({ type: 'PlaceBlueprint', buildingId: ferramenta.predioAtivo, gx: tile.gx, gy: tile.gy });
      } else if (ferramenta.modo === 'estrada' || ferramenta.modo === 'demolir-estrada') {
        arrasto = [tile];
      }
    },
    aoArrastar(tile) {
      estender(tile);
    },
    aoSoltar(tile) {
      if (arrasto === null) return;
      estender(tile);
      const tiles = arrasto;
      arrasto = null;
      emitir({ type: ferramenta.modo === 'demolir-estrada' ? 'DemolishRoad' : 'PlaceRoad', tiles });
    },
    aoSairDoMapa() {
      arrasto = null;
    },
    trecho() {
      return arrasto === null ? null : [...arrasto];
    },
  };
}
