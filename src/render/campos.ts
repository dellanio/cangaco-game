/**
 * F18i — O CANTEIRO DO CAMPO na tela, e a previa do arrasto que o desenha ou o apaga.
 *
 * Irma de `render/estradas.ts`, e pelo mesmo motivo: nada aqui decide. A camada desenha
 * o que `GameState.camposPlanejados` diz, e a previa PERGUNTA `canPlowField` a `sim/` e
 * pinta a resposta. Nenhum comando sai daqui — um arrasto vira `PlowField` ou
 * `UnplanField` ao soltar, em `input/colocar.ts`.
 *
 * O CAMPO PRONTO nao e desenhado aqui: o tile arado e recurso, e quem o pinta e a
 * camada de marcadores de recurso da F-T2a (`recursosVisiveis`). Este arquivo so o
 * CONTA, para o roteiro poder afirmar a soma dos dois conjuntos num numero — e por isso
 * o campo de debug dele se chama `NoEstado`, e nao `Renderizados`.
 */
import Phaser from 'phaser';
import type { GameState } from '../sim/state';
import type { TileDeGrid } from '../sim/estradas';
import { canPlowField, culturasAraveis, ehCampoPlanejado, tilesPlanejadosParaArar } from '../sim/campos';
import type { ModoDaFerramenta } from '../input/ferramenta';
import { corDoRecurso } from './mapa';
import { gridToScreen, ESCALA_DO_MUNDO } from './grid';

// Acima do marcador de recurso (0.5) e da estrada (1): canteiro de campo e
// estrada nao podem ocupar o mesmo tile (`canPlowField` recusa por `'estrada'`),
// entao a ordem entre os dois e so convencao. Abaixo dos predios e da previa.
const DEPTH_DO_CANTEIRO = 2;
const DEPTH_DA_PREVIA = 999_997;
const COR_PODE = 0x5fbf5a;
const COR_NAO_PODE = 0xd64b3f;
const OPACIDADE_DA_PREVIA = 0.55;
/** Translucido, como o canteiro da estrada: "aqui vai roca, ainda nao e roca". */
const OPACIDADE_DO_CANTEIRO = 0.35;
const ESPESSURA_DO_CONTORNO = 2;
/** Quantos sulcos por tile. E o que separa o canteiro do campo do canteiro da
 *  estrada de longe, sem depender de cor: um e liso, o outro tem leira. */
const SULCOS_POR_TILE = 3;

/** O que a cena publica em `window.__cangaco.previaDeCampo`. */
export interface PreviaDeCampo {
  readonly modo: 'campo' | 'apagar-campo';
  /** A cultura da ferramenta (id neutro), ou `null` na borracha. */
  readonly cultura: string | null;
  /** Arar: tiles distintos do trecho. Apagar: tiles que ESTAO no canteiro. */
  readonly tiles: number;
  readonly valida: boolean;
  readonly motivo: string | null;
}

/** Os dois conjuntos do campo. A soma e o que o jogador mandou plantar. */
export interface ContagemDeCampos {
  /** Tiles de canteiro que ESTA camada desenhou agora. */
  readonly planejados: number;
  /** Tiles de cultura aravel em `state.recursos` — campo pronto, incluindo as
   *  manchas que vieram do mapa. Contado, nao desenhado (ver o cabecalho). */
  readonly prontos: number;
}

export interface CamadaDeCampos {
  /** Redesenha SO quando `camposPlanejados` mudou de referencia, e reconta os prontos
   *  so quando `recursos` mudou de referencia. */
  atualizar(estado: GameState | null): ContagemDeCampos;
}

/** Sulcos horizontais dentro do tile: o desenho de terra revirada. */
function desenharSulcos(
  grafico: Phaser.GameObjects.Graphics, canto: { x: number; y: number }, tilePx: number,
): void {
  const passo = tilePx / (SULCOS_POR_TILE + 1);
  for (let i = 1; i <= SULCOS_POR_TILE; i += 1) {
    const y = canto.y + passo * i;
    grafico.lineBetween(canto.x + 2, y, canto.x + tilePx - 2, y);
  }
}

export function criarCamadaDeCampos(cena: Phaser.Scene, tilePx: number): CamadaDeCampos {
  const grafico = cena.add.graphics();
  grafico.setDepth(DEPTH_DO_CANTEIRO);
  const araveis = new Set(culturasAraveis());
  let desenhado: GameState['camposPlanejados'] | null = null;
  let contado: GameState['recursos'] | null = null;
  let contagem: ContagemDeCampos = { planejados: 0, prontos: 0 };

  return {
    atualizar(estado) {
      const planejados = estado?.camposPlanejados ?? {};
      const recursos = estado?.recursos ?? {};
      if (planejados === desenhado && recursos === contado) return contagem;

      let prontos = contagem.prontos;
      if (recursos !== contado) {
        prontos = 0;
        for (const recurso of Object.values(recursos)) {
          if (recurso !== undefined && araveis.has(recurso.tipo)) prontos += 1;
        }
        contado = recursos;
      }

      let planejadosDesenhados = contagem.planejados;
      if (planejados !== desenhado) {
        const canteiro = tilesPlanejadosParaArar(planejados);
        grafico.clear();
        for (const { tile, recurso } of canteiro) {
          const cor = Phaser.Display.Color.HexStringToColor(corDoRecurso(recurso)).color;
          const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
          grafico.fillStyle(cor, OPACIDADE_DO_CANTEIRO);
          grafico.fillRect(canto.x, canto.y, tilePx, tilePx);
          grafico.lineStyle(ESPESSURA_DO_CONTORNO, cor, 1);
          grafico.strokeRect(canto.x + 1, canto.y + 1, tilePx - 2, tilePx - 2);
          desenharSulcos(grafico, canto, tilePx);
        }
        desenhado = planejados;
        planejadosDesenhados = canteiro.length;
      }

      contagem = { planejados: planejadosDesenhados, prontos };
      return contagem;
    },
  };
}

export interface PreviaDoArrastoDeCampo {
  /** A previa desenhada agora, ou `null` se nao ha arrasto de campo. */
  atualizar(
    trecho: readonly TileDeGrid[] | null, modo: ModoDaFerramenta, cultura: string | null,
    estado: GameState | null,
  ): PreviaDeCampo | null;
}

export function criarPreviaDeCampo(cena: Phaser.Scene, tilePx: number): PreviaDoArrastoDeCampo {
  const grafico = cena.add.graphics();
  grafico.setDepth(DEPTH_DA_PREVIA);
  let haviaPrevia = false;

  function pintar(tiles: readonly TileDeGrid[], cor: number): void {
    grafico.fillStyle(cor, OPACIDADE_DA_PREVIA);
    for (const tile of tiles) {
      const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
      grafico.fillRect(canto.x, canto.y, tilePx, tilePx);
    }
  }

  return {
    atualizar(trecho, modo, cultura, estado) {
      const daRoca = modo === 'campo' || modo === 'apagar-campo';
      if (trecho === null || estado === null || !daRoca) {
        if (haviaPrevia) grafico.clear();
        haviaPrevia = false;
        return null;
      }
      grafico.clear();
      haviaPrevia = true;

      const distintos = [...new Map(trecho.map((t) => [`${t.gx},${t.gy}`, t])).values()];

      if (modo === 'apagar-campo') {
        // So o que a borracha de fato apaga: tile de CANTEIRO. Campo ja arado nao
        // entra aqui — pinta-lo seria a tela prometer o que `UnplanField` nao faz.
        const apagaveis = distintos.filter((t) => ehCampoPlanejado(estado.camposPlanejados, t));
        pintar(apagaveis, COR_NAO_PODE);
        return {
          modo, cultura: null, tiles: apagaveis.length, valida: apagaveis.length > 0, motivo: null,
        };
      }
      if (cultura === null) {
        grafico.clear();
        haviaPrevia = false;
        return null;
      }

      const resposta = canPlowField(estado, cultura, distintos);
      pintar(distintos, resposta.ok ? COR_PODE : COR_NAO_PODE);
      if (!resposta.ok && resposta.tile !== null) {
        // o tile culpado, com contorno, para o jogador ver ONDE nao pode
        const canto = gridToScreen(resposta.tile, tilePx, ESCALA_DO_MUNDO);
        grafico.lineStyle(3, 0xede3d0, 1);
        grafico.strokeRect(canto.x + 1, canto.y + 1, tilePx - 2, tilePx - 2);
      }
      return {
        modo,
        cultura,
        tiles: distintos.length,
        valida: resposta.ok,
        motivo: resposta.ok ? null : resposta.motivo,
      };
    },
  };
}
