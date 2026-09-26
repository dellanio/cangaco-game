/**
 * A estrada no chao — de pe e desenhada — e a previa do arrasto. Nada aqui decide: a
 * camada desenha o que `GameState.estradas` e `GameState.estradasPlanejadas` dizem, e a
 * previa PERGUNTA `canPlaceRoad` a `sim/` e pinta o resultado — verde se o trecho pode,
 * vermelho se nao. Nenhum comando sai daqui: um arrasto vira comando ao soltar, em
 * `input/`.
 */
import Phaser from 'phaser';
import temaSertao from '../../data/theme-sertao.json';
import type { GameState } from '../sim/state';
import { canPlaceRoad, ehEstrada, pontesDiagonais, tilesOrdenados } from '../sim/estradas';
import type { TileDeGrid } from '../sim/estradas';
import type { ModoDaFerramenta } from '../input/ferramenta';
import { gridToScreen, ESCALA_DO_MUNDO } from './grid';
import { chaveDeTextura } from './manifesto';

// Acima do chao (depth 0) e abaixo dos predios (depth = y em px, >= dezenas de
// milhares aqui) e da planta/prévia.
const DEPTH_DA_ESTRADA = 1;
const DEPTH_DA_PREVIA = 999_998;
const COR_PODE = 0x5fbf5a;
const COR_NAO_PODE = 0xd64b3f;
const OPACIDADE_DA_PREVIA = 0.55;
/** O canteiro e a mesma terra, translucida: "aqui vai rua, ainda nao e rua". */
const OPACIDADE_DO_CANTEIRO = 0.3;
const ESPESSURA_DO_CANTEIRO = 2;
/** Meia-diagonal da ponte, em fracao do tile. Cobre o pinch sem engordar a rua. */
const RAIO_DA_PONTE = 0.34;
const ID_DA_ESTRADA = 'estrada';
const ESTADO_DA_DIAGONAL = 'diagonal';

/**
 * Bits N/L/S/O da familia raster. So vizinho cardinal muda o corpo do tile;
 * ligacoes diagonais continuam vindo de `pontesDiagonais`, dona da regra da quina.
 */
const CONEXOES_CARDINAIS = [
  { dx: 0, dy: -1, bit: 1 },
  { dx: 1, dy: 0, bit: 2 },
  { dx: 0, dy: 1, bit: 4 },
  { dx: -1, dy: 0, bit: 8 },
] as const;

export function mascaraDaEstrada(
  estradas: GameState['estradas'], tile: TileDeGrid,
): number {
  return CONEXOES_CARDINAIS.reduce((mascara, conexao) => (
    ehEstrada(estradas, { gx: tile.gx + conexao.dx, gy: tile.gy + conexao.dy })
      ? mascara | conexao.bit
      : mascara
  ), 0);
}

function chaveDaEstrada(estado: string): string {
  return chaveDeTextura('estrada', ID_DA_ESTRADA, estado);
}

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

/** Os dois conjuntos desenhados agora. A soma e o traçado inteiro que o jogador ve. */
export interface ContagemDeEstradas {
  readonly dePe: number;
  readonly planejadas: number;
}

export interface CamadaDeEstradas {
  /** Redesenha SO quando `estradas`, `estradasPlanejadas` ou o conjunto de predios
   *  mudou de referencia; devolve a contagem dos dois conjuntos. Predio entra na conta
   *  porque e ele que tapa quina e desfaz uma ponte diagonal (F18e). */
  atualizar(estado: GameState | null): ContagemDeEstradas;
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

/**
 * A camada do chao: a rua de pe e o canteiro dela, no mesmo grafico e do mesmo tick.
 *
 * O canteiro (F18d-1b) e terra translucida com contorno, e **nao** ganha ponte
 * diagonal: a ponte e o desenho de "ha passagem por aqui", e tile planejado nao liga
 * nada ate o laborer assentar. Desenhar a ponte nele seria a tela afirmando uma ligacao
 * que a sim nega — e `pontesDiagonais` continua sendo a unica dona da regra da quina.
 */
export function criarCamadaDeEstradas(cena: Phaser.Scene, tilePx: number): CamadaDeEstradas {
  const cor = Phaser.Display.Color.HexStringToColor(temaSertao.paleta.terra).color;
  const corDoContorno = Phaser.Display.Color.HexStringToColor(temaSertao.paleta.terraQueimada).color;
  const grafico = cena.add.graphics();
  grafico.setDepth(DEPTH_DA_ESTRADA);
  let imagens: Phaser.GameObjects.Image[] = [];
  let desenhada: GameState['estradas'] | null = null;
  let desenhadoOCanteiro: GameState['estradasPlanejadas'] | null = null;
  let desenhadaComPredios: GameState['predios']['ordem'] | null = null;
  let contagem: ContagemDeEstradas = { dePe: 0, planejadas: 0 };

  return {
    atualizar(estado) {
      const estradas = estado?.estradas ?? {};
      const planejadas = estado?.estradasPlanejadas ?? {};
      const ordem = estado?.predios.ordem ?? null;
      if (estradas !== desenhada || planejadas !== desenhadoOCanteiro || ordem !== desenhadaComPredios) {
        const tiles = tilesOrdenados(estradas);
        const canteiro = tilesOrdenados(planejadas);
        grafico.clear();
        for (const imagem of imagens) imagem.destroy();
        imagens = [];

        const desenharImagem = (
          chave: string, x: number, y: number, origemX: number, origemY: number,
        ): boolean => {
          if (!cena.textures.exists(chave)) return false;
          imagens.push(cena.add.image(x, y, chave)
            .setOrigin(origemX, origemY)
            .setDisplaySize(tilePx, tilePx)
            .setDepth(DEPTH_DA_ESTRADA));
          return true;
        };

        grafico.fillStyle(cor, OPACIDADE_DO_CANTEIRO);
        grafico.lineStyle(ESPESSURA_DO_CANTEIRO, corDoContorno, 1);
        for (const tile of canteiro) {
          const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
          grafico.fillRect(canto.x, canto.y, tilePx, tilePx);
          grafico.strokeRect(canto.x + 1, canto.y + 1, tilePx - 2, tilePx - 2);
        }

        grafico.fillStyle(cor, 1);
        for (const tile of tiles) {
          const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
          const mascara = mascaraDaEstrada(estradas, tile);
          if (!desenharImagem(chaveDaEstrada(`m${mascara}`), canto.x, canto.y, 0, 0)) {
            grafico.fillRect(canto.x, canto.y, tilePx, tilePx);
          }
        }
        if (estado !== null) {
          for (const [a, b] of pontesDiagonais(estado)) {
            const noroeste = { gx: Math.min(a.gx, b.gx), gy: Math.min(a.gy, b.gy) };
            const canto = gridToScreen(noroeste, tilePx, ESCALA_DO_MUNDO);
            if (!desenharImagem(
              chaveDaEstrada(ESTADO_DA_DIAGONAL),
              canto.x + tilePx, canto.y + tilePx, 0.5, 0.5,
            )) {
              desenharPonte(grafico, a, b, tilePx);
            }
          }
        }

        desenhada = estradas;
        desenhadoOCanteiro = planejadas;
        desenhadaComPredios = ordem;
        contagem = { dePe: tiles.length, planejadas: canteiro.length };
      }
      return contagem;
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
