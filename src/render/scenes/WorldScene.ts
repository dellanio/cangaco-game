// A cena so le o estado (aqui, so gameData/tema e o GameState via ponte) e
// desenha. Nada de logica de jogo (CLAUDE.md §10): nenhuma decisao de regra
// mora aqui, so apresentacao.
import Phaser from 'phaser';
import temaSertao from '../../../data/theme-sertao.json';
import { configDoMapa } from '../mapa';
import { gridToScreen, screenToGrid, depthDeY, tileDentroDoMapa } from '../grid';
import type { Tile } from '../grid';
import { publicarEstadoDebug } from '../debug';
import type { EstadoDebug, RelogioVisivel } from '../debug';
import { aparenciaDoPredio } from '../predios';
import { estagioDaObra } from '../estagio-obra';
import type { EstagioDaObra } from '../estagio-obra';
import { centroDaVila } from '../../sim/selectors';
import type { EstadoDePredio, GameState, Predio } from '../../sim/state';
import type { PonteDeEstado } from '../ponte';
import type { Ferramenta } from '../../input/ferramenta';
import type { EntradaDoMapa } from '../../input/colocar';
import { criarPlantaFantasma } from '../planta-fantasma';
import { criarCamadaDeEstradas, criarPreviaDeEstrada } from '../estradas';
import { criarCamadaDeUnidades } from '../unidades';

const CHAVE_TEXTURA_GRAMA = 'tile-grama';

export class WorldScene extends Phaser.Scene {
  private readonly desenhados = new Map<
    string, { readonly estado: EstadoDePredio; readonly estagio: EstagioDaObra; readonly objeto: Phaser.GameObjects.Container }
  >();

  constructor(
    private readonly ponte: PonteDeEstado,
    private readonly ferramenta: Ferramenta,
    private readonly entrada: EntradaDoMapa,
    /** O relogio (F11a): a cena le o `alfa` para interpolar e o publica em `window.__cangaco`. */
    private readonly relogio: RelogioVisivel,
  ) {
    super('world');
  }

  create(): void {
    const { tilePx, largura, altura, larguraPx, alturaPx } = configDoMapa;
    const estado = publicarEstadoDebug(this.relogio);

    this.criarTexturaDeGrama(tilePx);
    const camadaChao = this.criarTilemap(tilePx, largura, altura);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, larguraPx, alturaPx);

    const estadoDoJogo = this.ponte.atual;
    if (estadoDoJogo) {
      const centro = centroDaVila(estadoDoJogo);
      camera.centerOn(centro.gx * tilePx, centro.gy * tilePx);
      estado.centroDaVila = centro;
      this.atualizarPredios(estadoDoJogo, tilePx, estado);
    }

    const planta = criarPlantaFantasma(this, tilePx);
    const camadaDeEstradas = criarCamadaDeEstradas(this, tilePx);
    const previaDeEstrada = criarPreviaDeEstrada(this, tilePx);
    const camadaDeUnidades = criarCamadaDeUnidades(this, tilePx);
    // Ultimo tile valido sob o ponteiro. Efemero: some no gameout e nunca entra
    // no GameState (a planta e estado de interface, ver input/ferramenta.ts).
    let tileAtual: Tile | null = null;

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
        estado.tileSobMouse = tile;
        tileAtual = tile;
        // botao esquerdo apertado: e um arrasto (estrada); o botao do meio e a camera
        if (pointer.leftButtonDown()) this.entrada.aoArrastar(tile);
      } else {
        estado.tileSobMouse = null;
        tileAtual = null;
      }
    });

    // O canvas so ocupa a celula dele na grade (index.html); ao sair para o HUD
    // ou para o painel o ponteiro deixa de ser do Phaser. Sem isto o ultimo tile
    // ficaria preso, com a planta desenhada onde o jogador nao esta olhando.
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      estado.tileSobMouse = null;
      tileAtual = null;
      // Sair do canvas com o botao apertado CANCELA o arrasto (ver input/colocar.ts).
      this.entrada.aoSairDoMapa();
    });

    // Clique esquerdo: entrega o TILE clicado a input/, que decide se vira comando
    // (so com ferramenta ativa). A cena nao decide nada e nao confia no ultimo
    // pointermove: recalcula o tile do ponteiro no proprio clique.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx);
      if (tileDentroDoMapa(tile, largura, altura)) this.entrada.aoClicar(tile);
    });

    // Soltar o botao esquerdo: fecha o arrasto no tile do ponteiro. Solto fora do mapa
    // (canvas maior que o mapa) cancela, como sair do canvas.
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonReleased()) return;
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx);
      if (tileDentroDoMapa(tile, largura, altura)) this.entrada.aoSoltar(tile);
      else this.entrada.aoSairDoMapa();
    });

    // POST_RENDER, nao update(): o clamp de camera.setBounds acontece dentro
    // do preRender do proprio ciclo de desenho (depois de update()). Ler
    // scrollX/scrollY aqui garante o valor ja limitado, nao um instantaneo a
    // meio de frame — e o que faz "arrastar alem da borda" ser verificavel.
    this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      estado.camera = { scrollX: camera.scrollX, scrollY: camera.scrollY };
      estado.tilesRenderizados = camadaChao.tilesDrawn;
      estado.pronto = true;
      if (this.ponte.atual) this.atualizarPredios(this.ponte.atual, tilePx, estado);

      // Ferramenta ativa -> a planta pergunta canPlace e pinta; sem ferramenta
      // volta o highlight de tile. O render pergunta, nao decide.
      estado.ferramentaAtiva = this.ferramenta.predioAtivo;
      estado.plantaFantasma = planta.atualizar(this.ferramenta.predioAtivo, tileAtual, this.ponte.atual);
      highlight.setVisible(tileAtual !== null && this.ferramenta.predioAtivo === null);

      // Estrada (F08): desenha o que o estado diz e a previa do arrasto em curso.
      estado.estradasRenderizadas = camadaDeEstradas.atualizar(this.ponte.atual?.estradas ?? {});
      estado.previaDeEstrada = previaDeEstrada.atualizar(this.entrada.trecho(), this.ferramenta.modo, this.ponte.atual);

      // Unidades (F10): a posicao de cada tick vem do estado (selector puro); a F11a interpola
      // ENTRE ticks com o alfa do laco. O render so le o relogio, nunca o move.
      estado.tick = this.ponte.atual?.tick ?? 0;
      estado.unidadesRenderizadas = camadaDeUnidades.atualizar(this.ponte.atual, this.relogio.alfa());
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

  /** Diff por id E estagio contra o que ja esta desenhado: id novo cria, id sumido
   *  destroi, mesmo id no mesmo estagio nao mexe. O estagio (F11c: `estagio-obra.ts`)
   *  entra na chave, nao so o `estado` — uma obra que so avanca de `hp` (marcacao ->
   *  madeira, ou vira `'completo'`) mantem o id e precisa ser redesenhada; `hp` sozinho
   *  nao redisparava nada antes desta feature. Sem o diff, redesenhar do zero a cada
   *  chamada recriaria os prédios todo frame. `desenhados` e memoria de render local
   *  da cena — handle do sprite que ela mesma criou, nao estado de jogo guardado em
   *  sprite (§10). */
  private atualizarPredios(estadoDoJogo: GameState, tilePx: number, debug: EstadoDebug): void {
    const vivos = new Set(estadoDoJogo.predios.ordem);
    for (const [id, item] of this.desenhados) {
      if (!vivos.has(id)) {
        item.objeto.destroy();
        this.desenhados.delete(id);
      }
    }
    const porEstagio: Record<EstagioDaObra, number> = { marcacao: 0, madeira: 0, completo: 0 };
    for (const id of estadoDoJogo.predios.ordem) {
      const predio = estadoDoJogo.predios.porId[id];
      if (!predio) continue;
      const estagio = estagioDaObra(predio.hp, aparenciaDoPredio(predio.tipo).hpTotal);
      porEstagio[estagio] += 1;
      const existente = this.desenhados.get(id);
      if (existente && existente.estado === predio.estado && existente.estagio === estagio) continue;
      existente?.objeto.destroy();
      this.desenhados.set(id, { estado: predio.estado, estagio, objeto: this.criarPredio(predio, estagio, tilePx) });
    }
    debug.prediosRenderizados = this.desenhados.size;
    // F11c: um predio 'completo' tem hp === hpTotal, entao estagio 'completo' aqui NAO
    // e so a obra que acabou de martelar o ultimo golpe — inclui todo predio de pe. A
    // contagem que corresponde ao antigo `obrasRenderizadas` (a marcacao no chao) e a
    // soma de marcacao+madeira; publicamos os tres separados para o roteiro afirmar por
    // estagio (tools/shots/F11c.js), sem adivinhar por pixel.
    debug.obrasRenderizadas = porEstagio.marcacao + porEstagio.madeira;
    debug.estagiosDeObraRenderizados = porEstagio;
  }

  /** Placeholder do §9: retangulo do tamanho do footprint com o nome
   *  tematico escrito por cima. Sem PNG em assets/base/, isto e o desenho
   *  definitivo desta sessao, nao uma falha. Uma OBRA (F07) e a marcacao no
   *  chao; a F11c divide essa fase em tres estagios derivados do `hp`
   *  (`estagio-obra.ts`): marcacao (nada martelado), madeira (em obra) e
   *  completo (o predio de pe, sem rotulo extra). */
  private criarPredio(predio: Predio, estagio: EstagioDaObra, tilePx: number): Phaser.GameObjects.Container {
    const { largura, altura, nome } = aparenciaDoPredio(predio.tipo);
    const canto = gridToScreen({ gx: predio.gx, gy: predio.gy }, tilePx);
    const larguraPx = largura * tilePx;
    const alturaPx = altura * tilePx;

    const emObra = estagio === 'marcacao' || estagio === 'madeira';
    const alfa = estagio === 'marcacao' ? 0.15 : estagio === 'madeira' ? 0.4 : 1;
    const retangulo = this.add.rectangle(larguraPx / 2, alturaPx / 2, larguraPx, alturaPx, 0x6b4a33, alfa);
    retangulo.setStrokeStyle(2, emObra ? 0xede3d0 : 0x2c1d12);
    const texto = emObra ? `${nome}\n(${temaSertao.obra[estagio]})` : nome;
    const rotulo = this.add.text(larguraPx / 2, alturaPx / 2, texto, {
      fontSize: '14px',
      color: '#ede3d0',
      align: 'center',
      wordWrap: { width: larguraPx - 8 },
    });
    rotulo.setOrigin(0.5, 0.5);

    const container = this.add.container(canto.x, canto.y, [retangulo, rotulo]);
    container.setDepth(depthDeY(canto.y + alturaPx));
    return container;
  }
}
