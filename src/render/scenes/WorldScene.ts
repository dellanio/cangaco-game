// A cena so le o estado (aqui, so gameData/tema e o GameState via ponte) e
// desenha. Nada de logica de jogo (CLAUDE.md §10): nenhuma decisao de regra
// mora aqui, so apresentacao.
import Phaser from 'phaser';
import temaSertao from '../../../data/theme-sertao.json';
import { configDoMapa } from '../mapa';
import { gridToScreen, screenToGrid, depthDeY, tileDentroDoMapa } from '../grid';
import type { Tile } from '../grid';
import { publicarEstadoDebug } from '../debug';
import type { EstadoDebug, PredioNoDebug, RelogioVisivel } from '../debug';
import { aparenciaDoPredio, ordemDasMercadorias } from '../predios';
import { medidorDaObra } from '../medidor-obra';
import type { LinhaDoMedidor } from '../medidor-obra';
import { canteiroDaObra, chaveDoCanteiro } from '../nivelamento-obra';
import type { CanteiroDaObra } from '../nivelamento-obra';
import {
  contagemDeEstagios, estagioDaObra, estaEmObra, ORDEM_DOS_ESTAGIOS,
} from '../estagio-obra';
import type { EstagioDaObra } from '../estagio-obra';
import { centroDaVila } from '../../sim/selectors';
import type { EstadoDePredio, GameState, Predio } from '../../sim/state';
import type { PonteDeEstado } from '../ponte';
import type { Ferramenta } from '../../input/ferramenta';
import type { EntradaDoMapa } from '../../input/colocar';
import { criarPlantaFantasma } from '../planta-fantasma';
import { criarCamadaDeEstradas, criarPreviaDeEstrada } from '../estradas';
import { criarCamadaDeUnidades } from '../unidades';
import { assetDoPredio, arquivoDoEstagio, chaveDaTextura } from '../manifesto';
import type { EntradaDeAsset } from '../manifesto';
import { manifestoDoJogo, texturasParaCarregar } from '../sprites';

const CHAVE_TEXTURA_GRAMA = 'tile-grama';

export class WorldScene extends Phaser.Scene {
  private readonly desenhados = new Map<
    string,
    {
      readonly estado: EstadoDePredio;
      readonly estagio: EstagioDaObra;
      /** F17b — os `entregue` do medidor em texto, na chave do diff (ver `atualizarPredios`). */
      readonly assinatura: string;
      readonly objeto: Phaser.GameObjects.Container;
    }
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

  /** F17f — o primeiro carregamento de asset do projeto. Enfileira SO o que o
   *  manifesto declara e o bundler resolveu (`texturasParaCarregar`): um
   *  caminho inventado viraria 404, e o runner de screenshot reprova a feature
   *  inteira por erro de console. Predio sem entrada nao aparece aqui e cai no
   *  retangulo do §9, que e comportamento normal.
   *
   *  Roda antes de `create()`, entao toda textura ja existe quando o primeiro
   *  `atualizarPredios` pergunta por ela.
   */
  preload(): void {
    for (const textura of texturasParaCarregar()) {
      this.load.image(textura.chave, textura.url);
    }
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
      // F13b: a fila de treino, crua, para o roteiro afirmar sobre o ESTADO e nao
      // sobre o que o painel escreveu. Leitura, como todo o resto daqui.
      estado.filaDeTreino = this.ponte.atual?.treino ?? {};
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

  /** Diff por id, estagio, assinatura do medidor (F17b) E leitura do canteiro
   *  (F17d) contra o que ja esta desenhado: id novo cria, id sumido
   *  destroi, mesmo id no mesmo estagio nao mexe. O estagio (F11c: `estagio-obra.ts`)
   *  entra na chave, nao so o `estado` — uma obra que so avanca de `hp` (F17e:
   *  estrutura -> paredes -> cobertura -> completo) mantem o id e precisa ser
   *  redesenhada; `hp` sozinho
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
    const porEstagio = contagemDeEstagios();
    // F16b: o recorte cru do estado para o roteiro. Montado aqui porque este laco
    // ja percorre `predios.ordem` — e e `ordem`, nunca `Object.keys` (contrato da
    // F05a). Nao entra em sprite: e ponte de harness, nao estado guardado no render.
    const doEstado: Record<string, PredioNoDebug> = {};
    const medidores: Record<string, readonly LinhaDoMedidor[]> = {};
    // F17d: o canteiro de cada obra, para o roteiro. Mesmo criterio de `medidores`.
    const canteiros: Record<string, CanteiroDaObra> = {};
    // F17f: com que textura cada predio foi desenhado, ou null quando caiu no
    // retangulo. O roteiro afirma sobre isto, nunca por pixel.
    const sprites: Record<string, string | null> = {};
    for (const id of estadoDoJogo.predios.ordem) {
      const predio = estadoDoJogo.predios.porId[id];
      if (!predio) continue;
      doEstado[id] = {
        tipo: predio.tipo,
        estado: predio.estado,
        gx: predio.gx,
        gy: predio.gy,
        pausado: predio.estado === 'completo' ? predio.pausado : false,
        ocupante: predio.estado === 'completo' ? predio.ocupante : null,
      };
      const aparencia = aparenciaDoPredio(predio.tipo);
      // F17d: o canteiro so existe para obra, como o medidor — predio completo nao
      // tem `obra.nivelamento`.
      // F17e: ele vem ANTES do estagio porque a fronteira marcacao/fundacao e a
      // unica das seis que olha o terreno, e nao o `hp`.
      const canteiro = predio.estado === 'obra'
        ? canteiroDaObra(
          predio.obra.nivelamento, aparencia.alvoDeNivelamento, aparencia.largura * aparencia.altura,
        )
        : null;
      if (canteiro !== null) canteiros[id] = canteiro;
      const estagio = estagioDaObra(
        predio.hp, aparencia.hpTotal, canteiro === null || canteiro.nivelada,
      );
      porEstagio[estagio] += 1;
      sprites[id] = this.spriteDoPredio(predio.tipo, estagio)?.chave ?? null;
      // F17b: o medidor so existe para obra. Predio completo nao tem `obra.faltam`
      // (uniao discriminada em `sim/state.ts`) e nem pergunta de material pendente.
      const linhas = predio.estado === 'obra'
        ? medidorDaObra(predio.obra.faltam, aparencia.custo, ordemDasMercadorias)
        : [];
      if (predio.estado === 'obra') medidores[id] = linhas;
      // D3: material que chega nao mexe em `estado` nem em `estagio` — o `hp` so sobe
      // depois, com o martelo. Sem a assinatura na chave, o medidor nasceria certo no
      // primeiro desenho e congelaria ali para sempre.
      // O mesmo D3, agora para o nivelamento: aplainar o chao nao mexe em `estado`
      // nem em `estagio`. Sem a leitura do canteiro na chave, ele nasceria certo no
      // primeiro desenho e congelaria ali para sempre — e uma foto unica passaria
      // assim mesmo. A fracao entra QUANTIZADA em oitavos (`chaveDoCanteiro`):
      // redesenho limitado a 8 por tile, e chave testavel, em vez de um float
      // diferente a cada tick.
      const assinatura = `${linhas.map((l) => l.entregue).join(',')}|${chaveDoCanteiro(canteiro)}`;
      const existente = this.desenhados.get(id);
      if (existente && existente.estado === predio.estado && existente.estagio === estagio
        && existente.assinatura === assinatura) continue;
      existente?.objeto.destroy();
      this.desenhados.set(id, {
        estado: predio.estado, estagio, assinatura,
        objeto: this.criarPredio(predio, estagio, linhas, canteiro, tilePx),
      });
    }
    debug.prediosRenderizados = this.desenhados.size;
    debug.prediosDoEstado = doEstado;
    // F11c: um predio 'completo' tem hp === hpTotal, entao estagio 'completo' aqui NAO
    // e so a obra que acabou de martelar o ultimo golpe — inclui todo predio de pe. A
    // contagem que corresponde ao antigo `obrasRenderizadas` e a soma dos estagios EM
    // OBRA; publicamos os seis separados para o roteiro afirmar por estagio
    // (tools/shots/F11c.js, tools/shots/F17e.js), sem adivinhar por pixel.
    // F17e: a soma vem da MESMA lista que nomeia os estagios — somar chave por chave
    // aqui seria a segunda lista, e e dela que a primeira diverge.
    debug.obrasRenderizadas = ORDEM_DOS_ESTAGIOS
      .filter(estaEmObra)
      .reduce((total, e) => total + porEstagio[e], 0);
    debug.estagiosDeObraRenderizados = porEstagio;
    debug.medidoresDeObra = medidores;
    debug.canteirosDeObra = canteiros;
    debug.spritesDePredio = sprites;
  }

  /** F17f — a chave de textura de um (tipo, estagio), ou `null` quando esse
   *  desenho nao existe: predio fora do manifesto, estagio sem arquivo, ou
   *  arquivo que o loader nao trouxe. `null` significa retangulo, e retangulo
   *  e comportamento normal (§9), nao falha.
   *
   *  Uma funcao so para quem pergunta (`atualizarPredios`, que publica em
   *  `debug.spritesDePredio`) e para quem desenha (`criarPredio`): duas contas
   *  para a mesma coisa e como o roteiro passa a afirmar sobre algo que a tela
   *  nao mostra.
   */
  private spriteDoPredio(
    tipo: string, estagio: EstagioDaObra,
  ): { readonly chave: string; readonly entrada: EntradaDeAsset } | null {
    const entrada = assetDoPredio(manifestoDoJogo, tipo);
    if (!entrada) return null;
    if (!arquivoDoEstagio(entrada, estagio)) return null;
    const chave = chaveDaTextura(entrada.id, estagio);
    return this.textures.exists(chave) ? { chave, entrada } : null;
  }

  /** Placeholder do §9: retangulo do tamanho do footprint com o nome
   *  tematico escrito por cima. Sem PNG em assets/base/, isto e o desenho
   *  definitivo desta sessao, nao uma falha. Uma OBRA (F07) e a marcacao no
   *  chao; a F11c divide essa fase em tres estagios derivados do `hp`
   *  (`estagio-obra.ts`): marcacao (nada martelado), madeira (em obra) e
   *  completo (o predio de pe, sem rotulo extra). */
  private criarPredio(
    predio: Predio, estagio: EstagioDaObra, linhas: readonly LinhaDoMedidor[],
    canteiro: CanteiroDaObra | null, tilePx: number,
  ): Phaser.GameObjects.Container {
    const { largura, altura, nome } = aparenciaDoPredio(predio.tipo);
    const canto = gridToScreen({ gx: predio.gx, gy: predio.gy }, tilePx);
    const larguraPx = largura * tilePx;
    const alturaPx = altura * tilePx;

    const sprite = this.spriteDoPredio(predio.tipo, estagio);
    const corpo = sprite === null
      ? this.desenharPlaceholder(estagio, nome, larguraPx, alturaPx)
      : [this.desenharSprite(sprite.chave, sprite.entrada, larguraPx, alturaPx)];

    // O canteiro vai PRIMEIRO no container: ele e o chao, e o corpo da obra fica
    // por cima. O medidor da F17b continua por ultimo.
    const container = this.add.container(canto.x, canto.y, [
      ...this.desenharCanteiro(canteiro, largura, tilePx),
      ...corpo,
      ...this.desenharMedidor(linhas, larguraPx, alturaPx, canteiro === null || canteiro.nivelada),
    ]);
    container.setDepth(depthDeY(canto.y + alturaPx));
    return container;
  }

  /** F17f — o sprite, ancorado pela BORDA INFERIOR do footprint: `anchor`
   *  `[0.5, 1]` no meio da linha de baixo do retangulo de chao. E a ancoragem
   *  que faz o predio pousar no grid; ancorar pelo centro o faria flutuar meio
   *  tile acima sempre que a arte nao tiver a altura do footprint.
   *
   *  Escala por UM fator, o da largura. Dois fatores esticariam a arte: a fonte
   *  e 3:2 (192x128 para um footprint 3x3), e a altura do sprite NAO e a do
   *  footprint. Derivar a escala do `larguraPx` corrente, e nao de um numero
   *  fixo, e o que faz isto sobreviver ao zoom sem tocar neste codigo.
   *
   *  O predio ocupar so a parte de baixo do quadrado de chao e consequencia da
   *  perspectiva isometrica da arte de hoje — divergencia conhecida do §9.3,
   *  registrada no `origem.nota` do manifesto e a substituir.
   */
  private desenharSprite(
    chave: string, entrada: EntradaDeAsset, larguraPx: number, alturaPx: number,
  ): Phaser.GameObjects.Image {
    const imagem = this.add.image(larguraPx / 2, alturaPx, chave);
    imagem.setOrigin(entrada.anchor[0], entrada.anchor[1]);
    imagem.setScale(larguraPx / entrada.tamanho[0]);
    return imagem;
  }

  /** O placeholder do §9, intocado desde a F11c: retangulo do tamanho do
   *  footprint com o nome tematico por cima. Continua sendo o desenho de 27 dos
   *  28 predios, e continua NAO sendo falha. */
  private desenharPlaceholder(
    estagio: EstagioDaObra, nome: string, larguraPx: number, alturaPx: number,
  ): Phaser.GameObjects.GameObject[] {
    // F17e: a uniao passou de tres valores a seis. Aqui o desenho ainda e o da
    // F11c (chao / em obra / de pe) — quem da silhueta propria a cada um dos seis
    // e a tarefa seguinte desta feature.
    const emObra = estaEmObra(estagio);
    const alfa = estagio === 'marcacao' ? 0.15 : emObra ? 0.4 : 1;
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
    return [retangulo, rotulo];
  }

  /** F17d — o canteiro: um retangulo de terra aplainada por tile ja nivelado, na
   *  ordem em que o laborer aplaina (linha a linha, da esquerda para a direita).
   *  O tile em curso entra parcial, pela fracao QUANTIZADA em oitavos que a chave
   *  do diff tambem carrega (`nivelamento-obra.ts`) — desenhar a fracao continua
   *  aqui criaria mudanca visivel que a chave nao ve, e o canteiro congelaria na
   *  tela sem nenhum teste reprovar.
   *
   *  Placeholder geometrico (§9), como o medidor da F17b. A pergunta que ele
   *  responde ("esta obra ja pode receber material, ou ainda esta sendo
   *  preparada?") e de longe, sem clicar. Vazio para predio completo.
   *
   *  Cor e opacidade sao DESENHO, nao balanceamento: ficam aqui, como o resto do
   *  placeholder ja fica (§2.3 fala de custo, tempo, capacidade e proporcao). */
  private desenharCanteiro(
    canteiro: CanteiroDaObra | null, larguraEmTiles: number, tilePx: number,
  ): Phaser.GameObjects.GameObject[] {
    if (canteiro === null || canteiro.tilesTotais <= 0) return [];
    const COR = 0x8a6a4a;
    const OPACIDADE = 0.55;
    const OITAVOS = 8;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    const porLinha = Math.max(1, larguraEmTiles);
    const bloco = (n: number, largura: number): void => {
      if (largura <= 0) return;
      const coluna = n % porLinha;
      const fileira = Math.floor(n / porLinha);
      // origem no canto superior esquerdo do tile: o tile em curso enche da
      // esquerda para a direita, e nao a partir do centro
      const r = this.add.rectangle(coluna * tilePx, fileira * tilePx, largura, tilePx,
        COR, OPACIDADE);
      r.setOrigin(0, 0);
      objetos.push(r);
    };
    for (let n = 0; n < canteiro.tilesProntos; n++) bloco(n, tilePx);
    bloco(canteiro.tilesProntos, (canteiro.oitavosDoTileEmCurso / OITAVOS) * tilePx);
    return objetos;
  }

  /** F17b — o medidor de material: uma fileira por material do custo, um bloco
   *  por unidade, cheio = ja entregue. Placeholder geometrico (§9). A pergunta
   *  que ele responde ("falta pedra ou falta tabua?") e de longe, sem clicar;
   *  o painel da F16b so responde depois de selecionar. Vazio para predio
   *  completo, e ai o container fica igual ao de antes desta feature.
   *  Os blocos entram no MESMO container do retangulo: um `destroy()` continua
   *  limpando tudo, e o diff de `atualizarPredios` nao precisa saber deles. */
  private desenharMedidor(
    linhas: readonly LinhaDoMedidor[], larguraPx: number, alturaPx: number, aceso: boolean,
  ): Phaser.GameObjects.GameObject[] {
    const LADO = 8;
    const VAO = 2;
    // F17d: enquanto o terreno esta sendo aplainado a obra ainda NAO recebe
    // material — o medidor fica esmaecido, nunca escondido. Escondido mudaria o
    // que o roteiro da F17b conta; esmaecido responde "ainda nao e a vez dele"
    // sem apagar o denominador que o jogador ja aprendeu a ler.
    const OPACIDADE = aceso ? 1 : 0.3;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    linhas.forEach((linha, i) => {
      const larguraDaFileira = linha.total * LADO + (linha.total - 1) * VAO;
      const x0 = (larguraPx - larguraDaFileira) / 2 + LADO / 2;
      // de baixo para cima: a ultima fileira encosta no pe do retangulo
      const y = alturaPx - 6 - (linhas.length - 1 - i) * (LADO + VAO);
      for (let n = 0; n < linha.total; n++) {
        const cheio = n < linha.entregue;
        const bloco = this.add.rectangle(x0 + n * (LADO + VAO), y, LADO, LADO,
          0xede3d0, (cheio ? 1 : 0) * OPACIDADE);
        bloco.setStrokeStyle(1, 0xede3d0, (cheio ? 1 : 0.5) * OPACIDADE);
        objetos.push(bloco);
      }
    });
    return objetos;
  }
}
