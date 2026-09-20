/**
 * A planta que segue o mouse. Nada aqui decide: a cena entrega (predio ativo,
 * tile sob o mouse, estado do jogo) e este arquivo PERGUNTA `canPlace` a
 * `sim/` e pinta o resultado — verde se pode, vermelho se nao. O retangulo e
 * derivado a cada chamada; nao guarda regra nem estado de jogo, e some sozinho
 * quando a ferramenta volta a `null` (Esc). Nenhum comando sai daqui: o clique
 * que posiciona e a F07.
 */
import Phaser from 'phaser';
import type { GameState } from '../sim/state';
import { canPlace } from '../sim/placement';
import type { MotivoDeRecusa } from '../sim/placement';
import { aparenciaDoPredio } from './predios';
import { gridToScreen } from './grid';
import type { Tile } from './grid';

// Cores de apresentacao. O vermelho e o do lenco do bando_a em
// data/theme-sertao.json; o verde e o da mesma familia da paleta do mapa.
const COR_PODE = 0x5fbf5a;
const COR_NAO_PODE = 0xd64b3f;
const OPACIDADE = 0.55;
// Acima dos predios (depth por y) e abaixo do highlight de tile.
const DEPTH_DA_PLANTA = 999_999;

/** O que a cena publica em `window.__cangaco.plantaFantasma`. */
export interface EstadoDaPlanta {
  readonly tipo: string;
  readonly gx: number;
  readonly gy: number;
  readonly valida: boolean;
  readonly motivo: MotivoDeRecusa | null;
}

export interface PlantaFantasma {
  /** Devolve o estado da planta desenhada, ou `null` se ela esta escondida
   *  (sem ferramenta, ponteiro fora do mapa ou sem estado ainda). */
  atualizar(
    predioAtivo: string | null, tile: Tile | null, estado: GameState | null,
  ): EstadoDaPlanta | null;
}

export function criarPlantaFantasma(cena: Phaser.Scene, tilePx: number): PlantaFantasma {
  let retangulo: Phaser.GameObjects.Rectangle | null = null;
  let tipoDesenhado: string | null = null;
  let ultimaChave = '';
  let ultimoEstado: GameState | null = null;
  let ultimoResultado: EstadoDaPlanta | null = null;

  function esconder(): null {
    retangulo?.setVisible(false);
    ultimaChave = '';
    ultimoEstado = null;
    ultimoResultado = null;
    return null;
  }

  function garantirRetangulo(tipo: string): Phaser.GameObjects.Rectangle {
    if (retangulo !== null && tipoDesenhado === tipo) return retangulo;
    retangulo?.destroy();
    const { largura, altura } = aparenciaDoPredio(tipo);
    retangulo = cena.add.rectangle(0, 0, largura * tilePx, altura * tilePx, COR_PODE, OPACIDADE);
    retangulo.setOrigin(0, 0);
    retangulo.setStrokeStyle(3, 0xede3d0, 1);
    retangulo.setDepth(DEPTH_DA_PLANTA);
    tipoDesenhado = tipo;
    return retangulo;
  }

  return {
    atualizar(predioAtivo, tile, estado) {
      if (predioAtivo === null || tile === null || estado === null) return esconder();

      // Mesma entrada, mesma resposta: nao pergunta nem repinta de novo.
      const chave = `${predioAtivo}|${tile.gx},${tile.gy}`;
      if (chave === ultimaChave && estado === ultimoEstado && ultimoResultado !== null) {
        return ultimoResultado;
      }

      const resposta = canPlace(estado, predioAtivo, tile.gx, tile.gy);
      const desenho = garantirRetangulo(predioAtivo);
      const canto = gridToScreen(tile, tilePx);
      desenho.setPosition(canto.x, canto.y);
      desenho.setFillStyle(resposta.ok ? COR_PODE : COR_NAO_PODE, OPACIDADE);
      desenho.setVisible(true);

      ultimaChave = chave;
      ultimoEstado = estado;
      ultimoResultado = {
        tipo: predioAtivo, gx: tile.gx, gy: tile.gy,
        valida: resposta.ok, motivo: resposta.ok ? null : resposta.motivo,
      };
      return ultimoResultado;
    },
  };
}
