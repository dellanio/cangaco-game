/**
 * A estrada no chao e a previa do arrasto. Nada aqui decide: a camada desenha o que
 * `GameState.estradas` diz, e a previa PERGUNTA `canPlaceRoad` a `sim/` e pinta o
 * resultado — verde se o trecho pode, vermelho se nao. Nenhum comando sai daqui: um
 * arrasto vira comando ao soltar, em `input/`.
 */
import Phaser from 'phaser';
import temaSertao from '../../data/theme-sertao.json';
import type { GameState } from '../sim/state';
import { canPlaceRoad, ehEstrada, pontesDiagonais, tilesOrdenados } from '../sim/estradas';
import type { TileDeGrid } from '../sim/estradas';
import type { ModoDaFerramenta } from '../input/ferramenta';
import { gridToScreen, ESCALA_DO_MUNDO } from './grid';

// Acima do chao (depth 0) e abaixo dos predios (depth = y em px, >= dezenas de
// milhares aqui) e da planta/prévia.
const DEPTH_DA_ESTRADA = 1;
const DEPTH_DA_PREVIA = 999_998;
const COR_PODE = 0x5fbf5a;
const COR_NAO_PODE = 0xd64b3f;
const OPACIDADE_DA_PREVIA = 0.55;
/** Meia-diagonal da ponte, em fracao do tile. Cobre o pinch sem engordar a rua. */
const RAIO_DA_PONTE = 0.34;

/** O que a cena publica em `window.__cangaco.previaDeEstrada`. */
export interface PreviaDeEstrada {
  readonly modo: 'estrada' | 'demolir-estrada';
  /** Estrada: tiles distintos do trecho. Demolicao: tiles que SAO estrada. */
  readonly tiles: number;
  readonly valida: boolean;
  /** Pedra que o trecho custaria (estrada); 0 na demolicao. */
  readonly custo: number;
  readonly motivo: string | null;
}

export interface CamadaDeEstradas {
  /** Redesenha SO quando `estradas` ou o conjunto de predios mudou de referencia;
   *  devolve quantos tiles ha. Predio entra na conta porque e ele que tapa quina
   *  e desfaz uma ponte diagonal (F18e). */
  atualizar(estado: GameState | null): number;
}

/**
 * O losango que fecha o canto entre dois tiles de estrada em diagonal. Sem ele a
 * rua diagonal aparece como uma fila de quadrados que se tocam por um ponto —
 * desenho que contradiz a sim, onde o passo existe e custa
 * `movimento.ticksPorTileDiagonal`.
 */
function desenharPonte(
  grafico: Phaser.GameObjects.Graphics, a: TileDeGrid, b: TileDeGrid, tilePx: number,
): void {
  // o canto compartilhado e o canto do tile mais a noroeste dos dois, deslocado de um tile
  const noroeste = { gx: Math.min(a.gx, b.gx), gy: Math.min(a.gy, b.gy) };
  const canto = gridToScreen(noroeste, tilePx, ESCALA_DO_MUNDO);
  const x = canto.x + tilePx;
  const y = canto.y + tilePx;
  const r = tilePx * RAIO_DA_PONTE;
  grafico.fillPoints([
    new Phaser.Geom.Point(x - r, y), new Phaser.Geom.Point(x, y - r),
    new Phaser.Geom.Point(x + r, y), new Phaser.Geom.Point(x, y + r),
  ], true);
}

export function criarCamadaDeEstradas(cena: Phaser.Scene, tilePx: number): CamadaDeEstradas {
  const cor = Phaser.Display.Color.HexStringToColor(temaSertao.paleta.terra).color;
  const grafico = cena.add.graphics();
  grafico.setDepth(DEPTH_DA_ESTRADA);
  let desenhada: GameState['estradas'] | null = null;
  let desenhadaComPredios: GameState['predios']['ordem'] | null = null;
  let quantidade = 0;

  return {
    atualizar(estado) {
      const estradas = estado?.estradas ?? {};
      const ordem = estado?.predios.ordem ?? null;
      if (estradas !== desenhada || ordem !== desenhadaComPredios) {
        const tiles = tilesOrdenados(estradas);
        grafico.clear();
        grafico.fillStyle(cor, 1);
        for (const tile of tiles) {
          const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
          grafico.fillRect(canto.x, canto.y, tilePx, tilePx);
        }
        if (estado !== null) {
          for (const [a, b] of pontesDiagonais(estado)) desenharPonte(grafico, a, b, tilePx);
        }
        desenhada = estradas;
        desenhadaComPredios = ordem;
        quantidade = tiles.length;
      }
      return quantidade;
    },
  };
}

export interface PreviaDoArrasto {
  /** Devolve a previa desenhada agora, ou `null` se nao ha arrasto. */
  atualizar(
    trecho: readonly TileDeGrid[] | null, modo: ModoDaFerramenta, estado: GameState | null,
  ): PreviaDeEstrada | null;
}

export function criarPreviaDeEstrada(cena: Phaser.Scene, tilePx: number): PreviaDoArrasto {
  const grafico = cena.add.graphics();
  grafico.setDepth(DEPTH_DA_PREVIA);
  let haviaPrevia = false;

  function pintar(tiles: readonly TileDeGrid[], cor: number): void {
    grafico.fillStyle(cor, OPACIDADE_DA_PREVIA);
    for (const tile of tiles) {
      const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
      grafico.fillRect(canto.x, canto.y, tilePx, tilePx);
    }
    // a previa mostra o trecho como ele vai ficar: os passos diagonais do arrasto
    // (`tilesEntre`, 8-conectado) ganham a mesma ponte da rua ja assentada
    for (let i = 1; i < tiles.length; i++) {
      const a = tiles[i - 1];
      const b = tiles[i];
      if (a === undefined || b === undefined) continue;
      // so o par que é de fato um passo diagonal: na demolicao a lista vem filtrada
      // e dois vizinhos na lista podem estar longe um do outro
      if (Math.abs(a.gx - b.gx) === 1 && Math.abs(a.gy - b.gy) === 1) desenharPonte(grafico, a, b, tilePx);
    }
  }

  return {
    atualizar(trecho, modo, estado) {
      if (trecho === null || estado === null || (modo !== 'estrada' && modo !== 'demolir-estrada')) {
        if (haviaPrevia) grafico.clear();
        haviaPrevia = false;
        return null;
      }
      grafico.clear();
      haviaPrevia = true;

      const distintos = [...new Map(trecho.map((t) => [`${t.gx},${t.gy}`, t])).values()];

      if (modo === 'demolir-estrada') {
        const removiveis = distintos.filter((t) => ehEstrada(estado.estradas, t));
        pintar(removiveis, COR_NAO_PODE);
        return { modo, tiles: removiveis.length, valida: removiveis.length > 0, custo: 0, motivo: null };
      }

      const resposta = canPlaceRoad(estado, trecho);
      pintar(distintos, resposta.ok ? COR_PODE : COR_NAO_PODE);
      if (!resposta.ok && resposta.tile !== null) {
        // o tile culpado, com contorno, para o jogador ver ONDE nao pode
        const canto = gridToScreen(resposta.tile, tilePx, ESCALA_DO_MUNDO);
        grafico.lineStyle(3, 0xede3d0, 1);
        grafico.strokeRect(canto.x + 1, canto.y + 1, tilePx - 2, tilePx - 2);
      }
      return {
        modo,
        tiles: distintos.length,
        valida: resposta.ok,
        custo: resposta.ok ? resposta.custoEmPedra : 0,
        motivo: resposta.ok ? null : resposta.motivo,
      };
    },
  };
}
