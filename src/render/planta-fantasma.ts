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
import { previaDeAlcance } from './alcance-de-colheita';
import type { PreviaDeAlcance } from './alcance-de-colheita';
import { gridToScreen, ESCALA_DO_MUNDO } from './grid';
import type { Ponto, Tile } from './grid';

// Cores de apresentacao. O vermelho e o do lenco do bando_a em
// data/theme-sertao.json; o verde e o da mesma familia da paleta do mapa.
const COR_PODE = 0x5fbf5a;
const COR_NAO_PODE = 0xd64b3f;
const OPACIDADE = 0.55;
// Acima dos predios (depth por y) e abaixo do highlight de tile.
const DEPTH_DA_PLANTA = 999_999;
// F-TP — a moldura do alcance fica ABAIXO da planta (o jogador precisa ver a
// planta por cima) e o rotulo ACIMA de tudo, para nao sumir sob ela.
const DEPTH_DA_MOLDURA = DEPTH_DA_PLANTA - 1;
const DEPTH_DO_ROTULO = DEPTH_DA_PLANTA + 1;
// Preenchimento quase transparente: a moldura tem de deixar VER os marcadores
// de recurso que ela esta contando. Se escondesse a rocha, contaria sozinha.
const OPACIDADE_DA_MOLDURA = 0.16;

const corDe = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

/** O que a cena publica em `window.__cangaco.plantaFantasma`. */
export interface EstadoDaPlanta {
  readonly tipo: string;
  readonly gx: number;
  readonly gy: number;
  readonly valida: boolean;
  readonly motivo: MotivoDeRecusa | null;
  /**
   * F-TP — o que este predio vai achar ao alcance, se plantado aqui. `null`
   * quando a receita dele nao tem `colheita` (armazem, escola, serraria): quem
   * nao colhe do mapa nao ganha moldura nenhuma.
   *
   * E previa, nao recusa: `valida` continua sendo so a resposta de `canPlace`, e
   * `tiles: 0` nao impede o clique. Plantar longe do recurso e escolha legitima
   * do jogador — o item so pede que ele veja o que esta escolhendo.
   */
  readonly alcance: PreviaDeAlcance | null;
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
  let moldura: Phaser.GameObjects.Rectangle | null = null;
  let rotulo: Phaser.GameObjects.Text | null = null;
  let tipoDesenhado: string | null = null;
  let ultimaChave = '';
  let ultimoEstado: GameState | null = null;
  let ultimoResultado: EstadoDaPlanta | null = null;

  function esconderAlcance(): void {
    moldura?.setVisible(false);
    rotulo?.setVisible(false);
  }

  function esconder(): null {
    retangulo?.setVisible(false);
    esconderAlcance();
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

  /** A moldura e o rotulo nascem na primeira vez que um predio que colhe passa
   *  pelo cursor. Predio sem colheita nunca os cria. */
  function desenharAlcance(previa: PreviaDeAlcance, cantoDaPlanta: Ponto): void {
    const { moldura: caixa } = previa;
    const cor = corDe(previa.cor);
    const canto = gridToScreen({ gx: caixa.x0, gy: caixa.y0 }, tilePx, ESCALA_DO_MUNDO);
    const largura = (caixa.x1 - caixa.x0) * tilePx * ESCALA_DO_MUNDO;
    const altura = (caixa.y1 - caixa.y0) * tilePx * ESCALA_DO_MUNDO;

    if (moldura === null) {
      moldura = cena.add.rectangle(0, 0, largura, altura, cor, OPACIDADE_DA_MOLDURA);
      moldura.setOrigin(0, 0);
      moldura.setDepth(DEPTH_DA_MOLDURA);
    }
    moldura.setPosition(canto.x, canto.y);
    moldura.setSize(largura, altura);
    // A cor e a do RECURSO, nunca vermelha: vermelho neste arquivo ja significa
    // "nao pode", e a previa nao recusa nada.
    moldura.setFillStyle(cor, OPACIDADE_DA_MOLDURA);
    moldura.setStrokeStyle(2, cor, 0.9);
    moldura.setVisible(true);

    if (rotulo === null) {
      rotulo = cena.add.text(0, 0, '', {
        fontSize: '13px', color: '#ede3d0', backgroundColor: '#2c1d12', padding: { x: 4, y: 2 },
      });
      rotulo.setOrigin(0, 1);
      rotulo.setDepth(DEPTH_DO_ROTULO);
    }
    // O rotulo cola na PLANTA, nao na moldura. Com alcance 6 e tile de 64 px a
    // moldura mede 15x14 tiles e o canto dela quase sempre cai fora do quadro —
    // o numero sumiria justamente quando o jogador mais precisa dele. A planta
    // esta sob o cursor, entao esta sempre na tela.
    rotulo.setPosition(cantoDaPlanta.x, cantoDaPlanta.y - 4);
    // Tamanho FIXO na tela: o rotulo e um objeto de mundo, entao afastar a
    // camera o encolheria junto com o mapa — e afastar e exatamente o que o
    // jogador faz para ver a moldura inteira, com alcance 6 e tile de 64 px.
    rotulo.setScale(1 / cena.cameras.main.zoom);
    rotulo.setText(previa.rotulo);
    rotulo.setVisible(true);
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
      const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
      desenho.setPosition(canto.x, canto.y);
      desenho.setFillStyle(resposta.ok ? COR_PODE : COR_NAO_PODE, OPACIDADE);
      desenho.setVisible(true);

      // F-TP — o alcance de colheita, quando o predio colhe. Nenhum id de
      // predio aqui: quem decide e ter `colheita` na receita, e a conta e a
      // MESMA que a simulacao usa (ver `alcance-de-colheita.ts`).
      const alcance = previaDeAlcance(estado, predioAtivo, tile.gx, tile.gy);
      if (alcance === null) esconderAlcance();
      else desenharAlcance(alcance, canto);

      ultimaChave = chave;
      ultimoEstado = estado;
      ultimoResultado = {
        tipo: predioAtivo, gx: tile.gx, gy: tile.gy,
        valida: resposta.ok, motivo: resposta.ok ? null : resposta.motivo,
        alcance,
      };
      return ultimoResultado;
    },
  };
}
