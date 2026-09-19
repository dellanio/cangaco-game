// A cena so le o estado (aqui, so gameData/tema) e desenha. Nada de logica de
// jogo (CLAUDE.md §10): nenhuma decisao de regra mora aqui, so apresentacao.
import Phaser from 'phaser';
import temaSertao from '../../../data/theme-sertao.json';
import { configDoMapa } from '../mapa';
import { gridToScreen, screenToGrid, depthDeY, tileDentroDoMapa } from '../grid';
import type { Tile } from '../grid';
import { publicarEstadoDebug } from '../debug';

const CHAVE_TEXTURA_GRAMA = 'tile-grama';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('world');
  }

  create(): void {
    const { tilePx, largura, altura, larguraPx, alturaPx } = configDoMapa;
    const estado = publicarEstadoDebug();

    this.criarTexturaDeGrama(tilePx);
    const camadaChao = this.criarTilemap(tilePx, largura, altura);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, larguraPx, alturaPx);

    // Dois marcadores placeholder verticais, sobrepostos de proposito, so
    // para exercitar o depth sorting por y — nao entram no GameState (§10):
    // sao render puro, como o retangulo com o id escrito que o §9 descreve.
    this.criarMarcadorPlaceholder(6, 8, tilePx, 0xb4562f);
    this.criarMarcadorPlaceholder(6, 9, tilePx, 0x5a3f2b);

    const highlight = this.add.graphics();
    highlight.lineStyle(3, 0xede3d0, 1);
    highlight.strokeRect(1, 1, tilePx - 2, tilePx - 2);
    highlight.setDepth(1_000_000); // sempre por cima
    highlight.setVisible(false);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        const dx = pointer.x - pointer.prevPosition.x;
        const dy = pointer.y - pointer.prevPosition.y;
        camera.scrollX -= dx;
        camera.scrollY -= dy;
      }

      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx);
      if (tileDentroDoMapa(tile, largura, altura)) {
        const canto = gridToScreen(tile, tilePx);
        highlight.setPosition(canto.x, canto.y);
        highlight.setVisible(true);
        estado.tileSobMouse = tile;
      } else {
        highlight.setVisible(false);
        estado.tileSobMouse = null;
      }
    });

    // POST_RENDER, nao update(): o clamp de camera.setBounds acontece dentro
    // do preRender do proprio ciclo de desenho (depois de update()). Ler
    // scrollX/scrollY aqui garante o valor ja limitado, nao um instantaneo a
    // meio de frame — e o que faz "arrastar alem da borda" ser verificavel.
    this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      estado.camera = { scrollX: camera.scrollX, scrollY: camera.scrollY };
      estado.tilesRenderizados = camadaChao.tilesDrawn;
      estado.pronto = true;
    });
  }

  private criarTexturaDeGrama(tilePx: number): void {
    const cor = Phaser.Display.Color.HexStringToColor(temaSertao.paleta.verdeCaatinga).color;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(cor, 1);
    g.fillRect(0, 0, tilePx, tilePx);
    g.lineStyle(1, 0x000000, 0.08);
    g.strokeRect(0, 0, tilePx, tilePx);
    g.generateTexture(CHAVE_TEXTURA_GRAMA, tilePx, tilePx);
    g.destroy();
  }

  private criarTilemap(tilePx: number, largura: number, altura: number): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('grama', CHAVE_TEXTURA_GRAMA, tilePx, tilePx, 0, 0);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset de grama.');
    const camada = mapa.createBlankLayer('chao', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada de chao.');
    camada.fill(0, 0, 0, largura, altura);
    return camada;
  }

  private criarMarcadorPlaceholder(gx: number, gy: number, tilePx: number, cor: number): void {
    const centro = gridToScreen({ gx, gy }, tilePx);
    const largura = tilePx * 0.5;
    const altura = tilePx * 1.4;
    const marcador = this.add.rectangle(
      centro.x + tilePx / 2, centro.y + tilePx - altura / 2, largura, altura, cor,
    );
    marcador.setDepth(depthDeY(centro.y + tilePx));
  }
}
