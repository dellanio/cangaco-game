// A cena so le o estado (aqui, so gameData/tema e o GameState via ponte) e
// desenha. Nada de logica de jogo (CLAUDE.md §10): nenhuma decisao de regra
// mora aqui, so apresentacao.
import Phaser from 'phaser';
import temaSertao from '../../../data/theme-sertao.json';
import { codigoDoRecurso, configDoMapa, recursosDeRender, terrenoDeRender } from '../mapa';
import {
  gridToScreen, screenToGrid, depthDeY, tileDentroDoMapa, ESCALA_DO_MUNDO,
} from '../grid';
import { proximoNivel, mundoSobPonto, scrollAncorado } from '../zoom';
import type { Navegacao } from '../../input/navegacao';
import type { Tile } from '../grid';
import { publicarEstadoDebug } from '../debug';
import type { EstadoDebug, PilhaNoDebug, PredioNoDebug, QuadroNoDebug, RelogioVisivel } from '../debug';
import { aparenciaDoPredio, corDaPilha, dadosDasPilhas, dadosDoTrabalho, ordemDasMercadorias } from '../predios';
import { pilhasDoPredio, posicoesNaPilha } from '../pilhas';
import type { PilhaDesenhada } from '../pilhas';
import { areaDoTrabalho, quadroDaFumaca, quadroDeTrabalho } from '../trabalho';
import type { QuadroDeTrabalho } from '../trabalho';
import { ESTADO_DA_PILHA, ID_DA_FUMACA } from '../manifesto-camadas';
import { medidorDaObra } from '../medidor-obra';
import type { LinhaDoMedidor } from '../medidor-obra';
import { canteiroDaObra, chaveDoCanteiro } from '../nivelamento-obra';
import type { CanteiroDaObra } from '../nivelamento-obra';
import {
  chaveDaRevelacao, contagemDeEstagios, estagioDaObra, estaEmObra, ORDEM_DOS_ESTAGIOS, revelacaoDaObra,
} from '../estagio-obra';
import type { EstagioDaObra, Fracao, RevelacaoDaObra } from '../estagio-obra';
import { centroDaVila } from '../../sim/selectors';
import { tileDeChave } from '../../sim/estradas';
import type { EstadoDePredio, GameState, Predio } from '../../sim/state';
import type { PonteDeEstado } from '../ponte';
import type { Ferramenta } from '../../input/ferramenta';
import type { EntradaDoMapa } from '../../input/colocar';
import { criarPlantaFantasma } from '../planta-fantasma';
import { criarCamadaDeEstradas, criarPreviaDeEstrada } from '../estradas';
import { criarCamadaDeCampos, criarPreviaDeCampo } from '../campos';
import { criarCamadaDeUnidades } from '../unidades';
import {
  assetDoPredio, arquivoDoEstagio, chaveDaTextura, chaveDeTextura, desenhoDoRecurso, temParDeRevelacao,
  texturaDaCamada, ESTADO_DO_TERRENO,
} from '../manifesto';
import type { ChaveDaRevelacao, DesenhoDoRecurso, EntradaDeAsset, TexturaCarregada } from '../manifesto';
import { manifestoDoJogo, texturasParaCarregar } from '../sprites';

const CHAVE_TEXTURA_TERRENO = 'tiles-terreno';
const CHAVE_TEXTURA_RECURSO = 'tiles-recurso';
// Acima do chao (0) e abaixo da estrada (1, `render/estradas.ts`): a rua que o
// jogador assentou cobre o marcador, como cobre o chao. O recurso continua no
// estado; quem o le e a simulacao, nao o pixel.
const DEPTH_DOS_RECURSOS = 0.5;
/** F-VIVO-a — o dado das pilhas, com as ancoras do manifesto. Montado uma vez. */
const DADOS_DAS_PILHAS = dadosDasPilhas(manifestoDoJogo);
/** F-VIVO-b — o dado do quadro de trabalho, com as ancoras do manifesto. Montado uma vez. */
const DADOS_DO_TRABALHO = dadosDoTrabalho(manifestoDoJogo);
/** F-VIVO-a — o lado de UMA unidade da pilha, em tiles. O brief dizia 1/4; com
 *  1/4 as quatro pilhas do armazem (3 tiles de base) se sobrepoem, com 1/5 cabem.
 *  Desenho, nao balanceamento: fica aqui, como o resto do placeholder. */
const LADO_DA_UNIDADE_EM_TILES = 1 / 5;

/** F17e — a cara de cada estagio no placeholder geometrico (§9). `altura` e a
 *  fracao da altura do footprint que o volume ocupa, ancorado no PE: sao os tres
 *  patamares que distinguem estrutura, paredes e cobertura de longe. `marcacao`
 *  nao tem volume nenhum — e o lote marcado no chao, e so.
 *
 *  Cor e opacidade sao DESENHO, nao balanceamento, como ja valia para o canteiro
 *  da F17d e para o medidor da F17b (§2.3 fala de custo, tempo, capacidade e
 *  proporcao). O `Record` exige os seis: acrescentar um estagio a uniao quebra a
 *  compilacao aqui, e nao silenciosamente na tela. */
interface CaraDoEstagio {
  readonly altura: number;
  readonly cor: number;
  readonly opacidade: number;
}
const CARA_DO_ESTAGIO: Record<EstagioDaObra, CaraDoEstagio> = {
  marcacao: { altura: 0, cor: 0x6b4a33, opacidade: 0 },
  fundacao: { altura: 1 / 6, cor: 0x8a6a4a, opacidade: 0.6 },
  estrutura: { altura: 1 / 3, cor: 0xa9763f, opacidade: 0.55 },
  paredes: { altura: 2 / 3, cor: 0x9a968c, opacidade: 0.75 },
  cobertura: { altura: 1, cor: 0x7a4a33, opacidade: 0.9 },
  completo: { altura: 1, cor: 0x6b4a33, opacidade: 1 },
};

export class WorldScene extends Phaser.Scene {
  /** F-T2a — o ultimo CODIGO pintado por tile de recurso, para o diff do
   *  POST_RENDER. Memoria de render local da cena, como `desenhados`: a verdade
   *  continua em `state.recursos`, e isto aqui so evita repintar 883 tiles a
   *  cada frame para mudar um. */
  private readonly recursosDesenhados = new Map<string, number>();

  /** F-SPR — como cada CODIGO de recurso se desenha, resolvido uma vez no `create`
   *  (a arte ja chegou no `preload`). Indice e o codigo, como na tira. */
  private desenhoPorCodigo: readonly DesenhoDoRecurso[] = [];

  /** F-SPR — o sprite de vegetacao de pe por tile, para o diff. Memoria de render,
   *  como `recursosDesenhados`: a verdade continua em `state.recursos`. */
  private readonly vegetacaoDesenhada = new Map<string, Phaser.GameObjects.Image>();

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
    /** F-D2 — a navegacao por teclado. A cena PERGUNTA; quem escuta tecla e
     *  `input/navegacao.ts`, que nao conhece camera nenhuma. */
    private readonly navegacao: Navegacao,
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
  /**
   * F-D2 — o unico `update()` da cena, e ele NAO e logica de jogo (§10): mexe
   * em camera, que e render puro e nao entra no `GameState`. A regra que o §10
   * protege e outra — simulacao dentro do quadro do navegador —, e ela continua
   * valendo: quem faz o tempo passar e o laco (`src/laco.ts`).
   *
   * Aqui tambem nao ha `deltaMs` fixo: a camera anda no relogio de parede, e
   * nao no tick. E por isso que a velocidade dela e px por segundo real, e a
   * velocidade de jogo (1x, 2x, 3x) nao a acelera.
   */
  update(_tempo: number, deltaMs: number): void {
    const camera = this.cameras.main;
    const { dx, dy } = this.navegacao.avancar(deltaMs);
    if (dx !== 0 || dy !== 0) {
      // Dividido pelo zoom pelo mesmo motivo do arrasto: o dado esta em px de
      // mundo, e ampliado 2x o mesmo px de mundo cobre 2 px de tela. O clamp
      // continua sendo o `setBounds` da F04, que age no preRender — nada aqui
      // precisa conhecer as bordas do mapa.
      camera.scrollX += dx / camera.zoom;
      camera.scrollY += dy / camera.zoom;
    }

    // O gesto do `Espaco` e invisivel sem isto: o jogador segura, nada muda na
    // tela, e ele conclui que a tecla nao faz nada (foi o que aconteceu com o
    // botao do meio, que ninguem achou sozinho).
    const cursor = this.navegacao.espacoApertado
      ? (this.input.activePointer.isDown ? 'grabbing' : 'grab')
      : '';
    if (this.game.canvas.style.cursor !== cursor) this.game.canvas.style.cursor = cursor;
  }

  preload(): void {
    for (const textura of texturasParaCarregar()) {
      this.load.image(textura.chave, textura.url);
    }
  }

  create(): void {
    const { tilePx, largura, altura, larguraPx, alturaPx } = configDoMapa;
    const estado = publicarEstadoDebug(this.relogio);

    // F-SPR — o loader so conhece o que o manifesto declarou e o bundler achou;
    // `exists` e a unica pergunta que os resolvedores de `manifesto.ts` fazem ao Phaser.
    const carregada: TexturaCarregada = (chave) => this.textures.exists(chave);
    const texturaDoTerreno = this.criarTexturaDeTerreno(tilePx, carregada, estado);
    const camadaChao = this.criarTilemap(tilePx, largura, altura, texturaDoTerreno);
    const texturaDoRecurso = this.criarTexturaDeRecurso(tilePx, carregada, estado);
    const camadaDeRecursos = this.criarCamadaDeRecursos(tilePx, largura, altura, texturaDoRecurso);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, larguraPx, alturaPx);
    // F18a: o nivel de abertura vem do dado, e hoje e 1. Nao e detalhe — todo
    // roteiro de screenshot ja validado calcula a posicao do tile no canvas
    // assumindo escala 1, e continua valendo enquanto o inicial for 1.
    let nivelDeZoom = configDoMapa.zoom.inicial;
    camera.setZoom(nivelDeZoom);

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
    const camadaDeCampos = criarCamadaDeCampos(this, tilePx);
    const previaDeCampo = criarPreviaDeCampo(this, tilePx);
    const camadaDeUnidades = criarCamadaDeUnidades(this, tilePx);
    // Ultimo tile valido sob o ponteiro. Efemero: some no gameout e nunca entra
    // no GameState (a planta e estado de interface, ver input/ferramenta.ts).
    let tileAtual: Tile | null = null;

    const highlight = this.add.graphics();
    highlight.lineStyle(3, 0xede3d0, 1);
    highlight.strokeRect(1, 1, tilePx - 2, tilePx - 2);
    highlight.setDepth(1_000_000); // sempre por cima
    highlight.setVisible(false);

    // F18a — zoom pela roda do mouse (GDD 2.1), em passos discretos do dado.
    // Rolar para CIMA (deltaY < 0) aproxima. Nada disto vira comando nem toca
    // o GameState: zoom e camera, e `src/sim/` nao sabe que ele existe.
    this.input.on('wheel', (
      pointer: Phaser.Input.Pointer, _objetos: unknown[], _dx: number, dy: number,
    ) => {
      const proximo = proximoNivel(configDoMapa.zoom.niveis, nivelDeZoom, dy < 0 ? +1 : -1);
      if (proximo === nivelDeZoom) return; // ja esta na ponta: nao mexe em nada

      // Ancoragem no cursor: o tile sob o ponteiro nao pode se mexer.
      //
      // `camera.getWorldPoint` NAO serve aqui: ele mistura o zoom novo com a
      // matriz velha, que so e reconstruida no preRender seguinte. Chamado em
      // volta do setZoom, devolve um hibrido e a correcao sai errada (medido:
      // o tile sob o cursor pulava de (33,32) para (49,50) indo de 1 a 0.5).
      // A aritmetica vive em `render/zoom.ts`, pura e testada headless; o
      // roteiro da F18a e quem prova que ela bate com o que o Phaser desenha.
      const ancoraX = camera.x + camera.width * camera.originX;
      const ancoraY = camera.y + camera.height * camera.originY;
      const origemX = camera.width * camera.originX;
      const origemY = camera.height * camera.originY;
      const mundoX = mundoSobPonto(camera.scrollX, pointer.x, ancoraX, origemX, nivelDeZoom);
      const mundoY = mundoSobPonto(camera.scrollY, pointer.y, ancoraY, origemY, nivelDeZoom);

      nivelDeZoom = proximo;
      camera.setZoom(nivelDeZoom);
      camera.scrollX = scrollAncorado(mundoX, pointer.x, ancoraX, origemX, nivelDeZoom);
      camera.scrollY = scrollAncorado(mundoY, pointer.y, ancoraY, origemY, nivelDeZoom);
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // F-D2: o botao do meio continua sendo camera, e o `Espaco` segurado
      // passa a ser camera TAMBEM — com qualquer botao, e independente da
      // ferramenta na mao (padrao de editor). Nada foi removido: quem ja sabia
      // do botao do meio nao perde o gesto.
      const arrastandoCamera = pointer.middleButtonDown()
        || (this.navegacao.espacoApertado && pointer.isDown);
      if (arrastandoCamera) {
        // Dividido pelo zoom: o ponteiro anda em px de TELA, e o scroll conta
        // px de MUNDO. Sem a divisao, o mapa ampliado escorregaria do cursor.
        const dx = (pointer.x - pointer.prevPosition.x) / camera.zoom;
        const dy = (pointer.y - pointer.prevPosition.y) / camera.zoom;
        camera.scrollX -= dx;
        camera.scrollY -= dy;
      }

      // F18a: ESCALA_DO_MUNDO, e nao o nivel de zoom. `getWorldPoint` JA
      // inverteu o zoom da camera; passar o nivel aqui dividiria duas vezes e
      // o clique erraria o tile em todo nivel diferente de 1. O highlight
      // tambem e objeto de mundo: a camera o amplia sozinha.
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx, ESCALA_DO_MUNDO);
      if (tileDentroDoMapa(tile, largura, altura)) {
        const canto = gridToScreen(tile, tilePx, ESCALA_DO_MUNDO);
        highlight.setPosition(canto.x, canto.y);
        estado.tileSobMouse = tile;
        tileAtual = tile;
        // botao esquerdo apertado: e um arrasto (estrada); o botao do meio e a camera
        // F-D2: com o `Espaco` segurado o botao esquerdo tambem e camera, e
        // puxar estrada sem querer e exatamente o que o aceite 3 proibe.
        if (pointer.leftButtonDown() && !this.navegacao.espacoApertado) {
          this.entrada.aoArrastar(tile);
        }
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
    // Sem isto, todo clique direito no mapa abre o menu de contexto do
    // navegador por cima do jogo e o gesto abaixo nunca chega a ser util. So o
    // canvas: no HUD e no painel o menu do navegador continua normal.
    this.input.mouse?.disableContextMenu();

    // F-D2 (higiene, nao urgencia): sem isto o botao do meio abre o icone de
    // autoscroll do navegador por cima do jogo, e o arrasto de camera vira uma
    // briga entre dois gestos de rolagem. So no canvas.
    this.game.canvas.addEventListener('mousedown', (evento: MouseEvent) => {
      if (evento.button === 1) evento.preventDefault();
    });

    // Botao direito: a cena so ENCAMINHA o gesto. Quem decide se ele larga a
    // ferramenta ou sobra para a ordem militar da F26 e `input/colocar.ts`
    // (BUG-A) — a cena nao conhece a ferramenta ativa e nao deve conhecer.
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.entrada.aoClicarDireito();
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      // F-D2, aceite 3: com o `Espaco` segurado o clique e o comeco de um
      // arrasto de camera, e nao a planta descendo no tile.
      if (this.navegacao.espacoApertado) return;
      // F18a: ESCALA_DO_MUNDO — `getWorldPoint` ja desfez o zoom (ver pointermove).
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx, ESCALA_DO_MUNDO);
      if (tileDentroDoMapa(tile, largura, altura)) this.entrada.aoClicar(tile);
    });

    // Soltar o botao esquerdo: fecha o arrasto no tile do ponteiro. Solto fora do mapa
    // (canvas maior que o mapa) cancela, como sair do canvas.
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonReleased()) return;
      if (this.navegacao.espacoApertado) return;
      // F18a: ESCALA_DO_MUNDO — `getWorldPoint` ja desfez o zoom (ver pointermove).
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx, ESCALA_DO_MUNDO);
      if (tileDentroDoMapa(tile, largura, altura)) this.entrada.aoSoltar(tile);
      else this.entrada.aoSairDoMapa();
    });

    // POST_RENDER, nao update(): o clamp de camera.setBounds acontece dentro
    // do preRender do proprio ciclo de desenho (depois de update()). Ler
    // scrollX/scrollY aqui garante o valor ja limitado, nao um instantaneo a
    // meio de frame — e o que faz "arrastar alem da borda" ser verificavel.
    this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      // F18a: o zoom sai daqui pelo mesmo motivo que o scroll — e no preRender
      // que o clamp de setBounds acontece, entao este e o valor ja limitado.
      estado.camera = { scrollX: camera.scrollX, scrollY: camera.scrollY, zoom: camera.zoom };
      // F-D2: o roteiro afirma o teto sobre este numero, em vez de cronometrar
      // pixel entre dois quadros e brigar com o relogio do navegador.
      estado.navegacao = {
        espacoApertado: this.navegacao.espacoApertado,
        velocidade: this.navegacao.velocidade,
      };
      estado.tilesRenderizados = camadaChao.tilesDrawn;
      estado.terrenoVisivel = this.contarTerrenoVisivel(camadaChao);
      // F-T2a: a camada de recurso se repinta do ESTADO a cada frame (por diff),
      // e nao uma vez no create como a de terreno. E a diferenca que o item pede:
      // onde ha rocha e imutavel, quanto sobrou nao e, e o jogador tem de ver o
      // tile esgotar.
      estado.recursosVisiveis = this.atualizarRecursos(camadaDeRecursos);
      estado.vegetacaoRenderizada = this.vegetacaoDesenhada.size;
      estado.pronto = true;
      if (this.ponte.atual) this.atualizarPredios(this.ponte.atual, tilePx, estado);

      // Ferramenta ativa -> a planta pergunta canPlace e pinta; sem ferramenta
      // volta o highlight de tile. O render pergunta, nao decide.
      estado.ferramentaAtiva = this.ferramenta.predioAtivo;
      estado.plantaFantasma = planta.atualizar(this.ferramenta.predioAtivo, tileAtual, this.ponte.atual);
      highlight.setVisible(tileAtual !== null && this.ferramenta.predioAtivo === null);

      // Estrada (F08): desenha o que o estado diz — rua de pe e canteiro (F18d-2) — e a
      // previa do arrasto em curso.
      const estradas = camadaDeEstradas.atualizar(this.ponte.atual ?? null);
      estado.estradasRenderizadas = estradas.dePe;
      estado.estradasPlanejadasRenderizadas = estradas.planejadas;
      estado.pedraNoCanteiroNoEstado = Object.values(this.ponte.atual?.pedraNoCanteiro ?? {})
        .reduce((a, n) => a + n, 0);
      estado.previaDeEstrada = previaDeEstrada.atualizar(this.entrada.trecho(), this.ferramenta.modo, this.ponte.atual);

      // Campo (F18i): o canteiro que o jogador desenhou, e a previa do arrasto de arar
      // ou de apagar. O campo PRONTO nao passa por aqui — e marcador de recurso (F-T2a);
      // esta camada so o conta, para a soma dos dois fechar num numero.
      const campos = camadaDeCampos.atualizar(this.ponte.atual ?? null);
      estado.camposPlanejadosRenderizados = campos.planejados;
      estado.camposProntosNoEstado = campos.prontos;
      estado.previaDeCampo = previaDeCampo.atualizar(
        this.entrada.trecho(), this.ferramenta.modo, this.ferramenta.culturaAtiva, this.ponte.atual,
      );

      // Unidades (F10): a posicao de cada tick vem do estado (selector puro); a F11a interpola
      // ENTRE ticks com o alfa do laco. O render so le o relogio, nunca o move.
      estado.tick = this.ponte.atual?.tick ?? 0;
      // F13b: a fila de treino, crua, para o roteiro afirmar sobre o ESTADO e nao
      // sobre o que o painel escreveu. Leitura, como todo o resto daqui.
      estado.filaDeTreino = this.ponte.atual?.treino ?? {};
      estado.unidadesRenderizadas = camadaDeUnidades.atualizar(this.ponte.atual, this.relogio.alfa());
    });
  }

  /**
   * F-T1 (desenho MINIMO) — uma tira de N quadrados, um por tipo de terreno, na
   * ordem do codigo que vem do funil `render/mapa.ts`. Vira tileset de N tiles,
   * entao o INDICE DO TILE E O CODIGO DO TERRENO: pintar e `putTileAt(codigo)`,
   * sem nenhuma tabela paralela na cena.
   *
   * Uma cor chapada por tipo e o escopo inteiro do desenho desta feature. Sem
   * textura, sem transicao de borda, sem arte — o suficiente para a tela nao
   * mentir: o jogador ve a agua antes de a construcao ser recusada por ela.
   *
   * F-SPR — a cor chapada continua sendo o placeholder; o tipo que tem textura no
   * manifesto (`tipo: "terreno"`) tem a celula dele trocada pela imagem, e so ela.
   * Devolve a chave da tira que vira tileset.
   */
  private criarTexturaDeTerreno(tilePx: number, carregada: TexturaCarregada, debug: EstadoDebug): string {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    terrenoDeRender.cores.forEach((hex, codigo) => {
      g.fillStyle(Phaser.Display.Color.HexStringToColor(hex).color, 1);
      g.fillRect(codigo * tilePx, 0, tilePx, tilePx);
      g.lineStyle(1, 0x000000, 0.08);
      g.strokeRect(codigo * tilePx, 0, tilePx, tilePx);
    });
    g.generateTexture(CHAVE_TEXTURA_TERRENO, tilePx * terrenoDeRender.cores.length, tilePx);
    g.destroy();
    const arte = terrenoDeRender.tipos.map(
      (id) => texturaDaCamada(manifestoDoJogo, 'terreno', id, ESTADO_DO_TERRENO, carregada),
    );
    debug.arteDasCamadas = {
      ...debug.arteDasCamadas,
      terreno: terrenoDeRender.tipos.filter((_id, codigo) => arte[codigo] !== null),
    };
    return this.sobreporArteNaTira(CHAVE_TEXTURA_TERRENO, tilePx, arte, []);
  }

  /**
   * F-SPR — a tira de placeholder com as celulas que tem arte trocadas pela imagem,
   * redimensionada para o tile (o `tamanho` do arquivo nao entra: textura de tile
   * cobre exatamente um tile, e so). `vazias` sao celulas limpas — o recurso que
   * virou sprite de vegetacao nao pode deixar o marcador por baixo da arvore.
   *
   * Sem nenhuma arte, devolve a propria tira e nada muda: o placeholder de hoje e
   * o fallback, pixel a pixel.
   */
  private sobreporArteNaTira(
    chaveDaTira: string, tilePx: number, arte: readonly (string | null)[], vazias: readonly number[],
  ): string {
    if (arte.every((c) => c === null) && vazias.length === 0) return chaveDaTira;
    const base = this.textures.get(chaveDaTira).getSourceImage() as HTMLCanvasElement;
    const chave = `${chaveDaTira}:arte`;
    const tira = this.textures.createCanvas(chave, base.width, base.height);
    if (!tira) throw new Error(`WorldScene: falha ao criar a tira '${chave}'.`);
    const ctx = tira.getContext();
    ctx.drawImage(base, 0, 0);
    for (const codigo of vazias) ctx.clearRect(codigo * tilePx, 0, tilePx, tilePx);
    arte.forEach((chaveDaArte, codigo) => {
      if (chaveDaArte === null) return;
      const imagem = this.textures.get(chaveDaArte).getSourceImage() as HTMLImageElement;
      ctx.clearRect(codigo * tilePx, 0, tilePx, tilePx);
      ctx.drawImage(imagem, codigo * tilePx, 0, tilePx, tilePx);
    });
    tira.refresh();
    return chave;
  }

  /**
   * F-T2a (desenho MINIMO) — a tira de marcadores, no mesmo esquema da tira de
   * terreno: indice do tile E o codigo que vem de `codigoDoRecurso`. O codigo 0
   * fica VAZIO de proposito — e o tile sem recurso nenhum, e ele tem de deixar o
   * chao aparecer.
   *
   * Marcador, nao preenchimento: um losango pequeno no centro do tile. Cobrir o
   * tile inteiro esconderia o terreno por baixo, e a F-T1 existe justamente para
   * o jogador ler o terreno. Arte de recurso e decisao humana (§9); isto e a
   * forma geometrica que diz "tem alguma coisa aqui" ate la.
   *
   * F-SPR — o recurso com textura no manifesto troca o losango pela imagem; o que
   * e VEGETACAO (`tipo: "vegetacao"`) deixa a celula vazia e vira sprite em pe
   * (`pintarVegetacao`). O esgotado continua marcador. Devolve a chave da tira.
   */
  private criarTexturaDeRecurso(tilePx: number, carregada: TexturaCarregada, debug: EstadoDebug): string {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    const meio = tilePx / 2;
    const raio = Math.max(2, Math.round(tilePx * 0.3));
    recursosDeRender.cores.forEach((hex, codigo) => {
      if (codigo === 0) return; // tile vazio: nada desenhado, chao a mostra
      const x = codigo * tilePx + meio;
      g.fillStyle(Phaser.Display.Color.HexStringToColor(hex).color, 1);
      g.fillPoints([
        new Phaser.Geom.Point(x, meio - raio), new Phaser.Geom.Point(x + raio, meio),
        new Phaser.Geom.Point(x, meio + raio), new Phaser.Geom.Point(x - raio, meio),
      ], true);
      g.lineStyle(1, 0x000000, 0.35);
      g.strokePoints([
        new Phaser.Geom.Point(x, meio - raio), new Phaser.Geom.Point(x + raio, meio),
        new Phaser.Geom.Point(x, meio + raio), new Phaser.Geom.Point(x - raio, meio),
      ], true, true);
    });
    g.generateTexture(CHAVE_TEXTURA_RECURSO, tilePx * recursosDeRender.cores.length, tilePx);
    g.destroy();
    // Codigo 0 e o esgotado ficam fora: vazio e marcador unico, sem entrada propria.
    this.desenhoPorCodigo = recursosDeRender.cores.map((_cor, codigo): DesenhoDoRecurso => {
      const id = recursosDeRender.tipos[codigo - 1];
      if (codigo === 0 || codigo === recursosDeRender.codigoEsgotado || id === undefined) return { como: 'marcador' };
      return desenhoDoRecurso(manifestoDoJogo, id, carregada);
    });
    const arte = this.desenhoPorCodigo.map((d) => (d.como === 'textura' ? d.chave : null));
    const vazias = this.desenhoPorCodigo.flatMap((d, codigo) => (d.como === 'vegetacao' ? [codigo] : []));
    const idsCom = (como: DesenhoDoRecurso['como']): string[] => this.desenhoPorCodigo.flatMap(
      (d, codigo) => (d.como === como ? [recursosDeRender.tipos[codigo - 1] as string] : []),
    );
    debug.arteDasCamadas = { ...debug.arteDasCamadas, recurso: idsCom('textura'), vegetacao: idsCom('vegetacao') };
    return this.sobreporArteNaTira(CHAVE_TEXTURA_RECURSO, tilePx, arte, vazias);
  }

  private criarCamadaDeRecursos(
    tilePx: number, largura: number, altura: number, textura: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('recurso', textura, tilePx, tilePx, 0, 0);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset de recurso.');
    const camada = mapa.createBlankLayer('recursos', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada de recursos.');
    camada.setDepth(DEPTH_DOS_RECURSOS);
    // Comeca vazia: quem a preenche e o diff do POST_RENDER, a partir do estado.
    return camada;
  }

  /** F-T2a — repinta SO o que mudou desde o ultimo frame e devolve a contagem
   *  visivel. Tile que saiu de `state.recursos` (regime `nunca`, que apaga a
   *  entrada ao zerar) volta a 0 e o marcador some; tile que ficou com
   *  quantidade 0 (regime `porAcao`) vira o codigo de esgotado. Os dois casos
   *  sao "acabou" na tela, e o estado e que diz qual e qual. */
  private atualizarRecursos(camada: Phaser.Tilemaps.TilemapLayer): Record<string, number> {
    const recursos = this.ponte.atual?.recursos ?? {};
    for (const [chave, recurso] of Object.entries(recursos)) {
      const codigo = codigoDoRecurso(recurso);
      if (this.recursosDesenhados.get(chave) === codigo) continue;
      const { gx, gy } = tileDeChave(chave);
      camada.putTileAt(codigo, gx, gy);
      this.recursosDesenhados.set(chave, codigo);
      this.pintarVegetacao(chave, codigo);
    }
    for (const chave of [...this.recursosDesenhados.keys()]) {
      if (recursos[chave] !== undefined) continue;
      const { gx, gy } = tileDeChave(chave);
      camada.putTileAt(0, gx, gy);
      this.recursosDesenhados.delete(chave);
      this.pintarVegetacao(chave, 0);
    }
    return this.contarRecursosVisiveis(camada);
  }

  /** F-SPR — poe, troca ou tira o sprite de vegetacao de um tile, pelo codigo que a
   *  camada acabou de receber. O `anchor` do manifesto cai no meio da borda de BAIXO
   *  do tile, como o do predio no footprint; a imagem sai no tamanho do arquivo e pode
   *  transbordar o tile — por isso e sprite, e nao celula da tira. Depth pelo pe: a
   *  unidade no tile de cima passa atras, a do tile de baixo passa na frente. */
  private pintarVegetacao(chave: string, codigo: number): void {
    const desenho = this.desenhoPorCodigo[codigo];
    const atual = this.vegetacaoDesenhada.get(chave);
    if (desenho?.como !== 'vegetacao') {
      atual?.destroy();
      this.vegetacaoDesenhada.delete(chave);
      return;
    }
    if (atual?.texture.key === desenho.chave) return;
    atual?.destroy();
    const { tilePx } = configDoMapa;
    const canto = gridToScreen(tileDeChave(chave), tilePx, ESCALA_DO_MUNDO);
    const pe = { x: canto.x + tilePx / 2, y: canto.y + tilePx };
    const imagem = this.add.image(pe.x, pe.y, desenho.chave)
      .setOrigin(desenho.entrada.anchor[0], desenho.entrada.anchor[1])
      .setDepth(depthDeY(pe.y));
    this.vegetacaoDesenhada.set(chave, imagem);
  }

  /** Lido de volta da camada desenhada, como `contarTerrenoVisivel`: o roteiro
   *  afirma sobre o que a cena TEM na tela, nao sobre o dado que a alimentou. */
  private contarRecursosVisiveis(camada: Phaser.Tilemaps.TilemapLayer): Record<string, number> {
    const vista = this.cameras.main.worldView;
    const contagem: Record<string, number> = {};
    for (const tipo of recursosDeRender.tipos) contagem[tipo] = 0;
    contagem.esgotado = 0;
    for (const tile of camada.getTilesWithinWorldXY(vista.x, vista.y, vista.width, vista.height)) {
      if (tile.index <= 0) continue;
      const chave = tile.index === recursosDeRender.codigoEsgotado
        ? 'esgotado' : recursosDeRender.tipos[tile.index - 1];
      if (chave !== undefined) contagem[chave] = (contagem[chave] as number) + 1;
    }
    return contagem;
  }

  private criarTilemap(
    tilePx: number, largura: number, altura: number, textura: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('terreno', textura, tilePx, tilePx, 0, 0);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset de terreno.');
    const camada = mapa.createBlankLayer('chao', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada de chao.');
    // Preenche com o codigo 0 e so visita o que difere: no mapa base a grande
    // maioria dos tiles e grama, e `fill` custa uma passada contra as duas de
    // um `putTileAt` por tile.
    camada.fill(0, 0, 0, largura, altura);
    const { codigos, largura: larguraDoTerreno, altura: alturaDoTerreno } = terrenoDeRender;
    for (let gy = 0; gy < Math.min(altura, alturaDoTerreno); gy += 1) {
      for (let gx = 0; gx < Math.min(largura, larguraDoTerreno); gx += 1) {
        const codigo = codigos[gy * larguraDoTerreno + gx] as number;
        if (codigo !== 0) camada.putTileAt(codigo, gx, gy);
      }
    }
    return camada;
  }

  /** F-T1 — quantos tiles de cada tipo de terreno estao DENTRO da vista da
   *  camera agora, lidos de volta da camada desenhada (nao do dado que a
   *  alimentou). E sobre isto que o roteiro de screenshot afirma; pixel, nunca
   *  (§8). */
  private contarTerrenoVisivel(camada: Phaser.Tilemaps.TilemapLayer): Record<string, number> {
    const vista = this.cameras.main.worldView;
    const contagem: Record<string, number> = {};
    for (const tipo of terrenoDeRender.tipos) contagem[tipo] = 0;
    for (const tile of camada.getTilesWithinWorldXY(vista.x, vista.y, vista.width, vista.height)) {
      const tipo = terrenoDeRender.tipos[tile.index];
      if (tipo !== undefined) contagem[tipo] = (contagem[tipo] as number) + 1;
    }
    return contagem;
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
    // F-VIVO-a: o que cada pilha desenhou, da MESMA lista que vai para `criarPredio`.
    const pilhasNoDebug: Record<string, readonly PilhaNoDebug[]> = {};
    // F-VIVO-b: o quadro de trabalho de cada predio animando, da MESMA chamada do desenho.
    const quadrosNoDebug: Record<string, QuadroNoDebug> = {};
    // F17g: as obras desenhadas pela revelacao, da MESMA conta que vai para `criarPredio`.
    const revelacoes: Record<string, RevelacaoDaObra> = {};
    for (const id of estadoDoJogo.predios.ordem) {
      const predio = estadoDoJogo.predios.porId[id];
      if (!predio) continue;
      doEstado[id] = {
        tipo: predio.tipo,
        estado: predio.estado,
        gx: predio.gx,
        gy: predio.gy,
        hp: predio.hp,
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
      // F17g: obra de predio com o PAR carregado e revelada pelo `hp`; sem o par,
      // os seis estagios de antes. Predio de pe continua o `completo` inteiro.
      const par = predio.estado === 'obra' ? this.parDeRevelacao(predio.tipo) : null;
      const revelacao = par === null
        ? null
        : revelacaoDaObra(
          predio.hp, aparencia.hpTotal, aparencia.custo['timber'] ?? 0, aparencia.custo['stone'] ?? 0,
        );
      if (par === null || revelacao === null) {
        porEstagio[estagio] += 1;
        sprites[id] = this.spriteDoPredio(predio.tipo, estagio)?.chave ?? null;
      } else {
        revelacoes[id] = revelacao;
        sprites[id] = par.madeira.chave;
      }
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
      // F-VIVO-a: a pilha muda sem mexer em estado nem em estagio (o serf entrega,
      // o padeiro assa), entao ela entra na chave pelo mesmo motivo do medidor. So
      // o que se DESENHA entra: quantidade acima de 5 nao redesenha nada.
      const pilhas = pilhasDoPredio(predio, DADOS_DAS_PILHAS);
      if (pilhas.length > 0) {
        pilhasNoDebug[id] = pilhas.map((x) => ({
          gaveta: x.gaveta, mercadoria: x.mercadoria, n: x.n, sprite: this.texturaDaPilha(x.mercadoria) !== null,
        }));
      }
      const chaveDasPilhas = pilhas.map((x) => `${x.mercadoria}:${x.n}`).join(',');
      // F-VIVO-b: o quadro muda a cada tick de trabalho sem mexer em estado nem em
      // estagio — entra na chave pelo mesmo motivo da pilha. Predio parado da `null`
      // e a chave congela: e isso que faz o parado nao redesenhar.
      const ocupante = predio.estado === 'completo' && predio.ocupante !== null
        ? estadoDoJogo.unidades.porId[predio.ocupante] ?? null
        : null;
      const quadro = quadroDeTrabalho(predio, ocupante, estadoDoJogo.tick, DADOS_DO_TRABALHO);
      const fumaca = quadroDaFumaca(predio, ocupante, estadoDoJogo.tick, DADOS_DO_TRABALHO);
      if (quadro !== null) {
        quadrosNoDebug[id] = { ...quadro, sprite: this.texturaDoQuadro(predio.tipo, quadro) !== null };
      }
      const chaveDoTrabalho = `${quadro === null ? '-' : `${quadro.laco}_${quadro.n}`}/${fumaca ?? '-'}`;
      // F17g: cada martelada muda a revelacao sem mudar o estagio de fallback.
      const chaveDoCorpo = revelacao === null ? '-' : chaveDaRevelacao(revelacao);
      const assinatura = `${linhas.map((l) => l.entregue).join(',')}|${chaveDoCanteiro(canteiro)}|${chaveDasPilhas}|${chaveDoTrabalho}|${chaveDoCorpo}`;
      const existente = this.desenhados.get(id);
      if (existente && existente.estado === predio.estado && existente.estagio === estagio
        && existente.assinatura === assinatura) continue;
      existente?.objeto.destroy();
      this.desenhados.set(id, {
        estado: predio.estado, estagio, assinatura,
        objeto: this.criarPredio(predio, estagio, revelacao, linhas, canteiro, pilhas, quadro, fumaca, tilePx),
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
      .reduce((total, e) => total + porEstagio[e], 0) + Object.keys(revelacoes).length;
    debug.estagiosDeObraRenderizados = porEstagio;
    debug.revelacaoDasObras = revelacoes;
    debug.medidoresDeObra = medidores;
    debug.canteirosDeObra = canteiros;
    debug.spritesDePredio = sprites;
    debug.pilhasDesenhadas = pilhasNoDebug;
    debug.quadrosDeTrabalho = quadrosNoDebug;
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
    tipo: string, estagio: EstagioDaObra | ChaveDaRevelacao,
  ): { readonly chave: string; readonly entrada: EntradaDeAsset } | null {
    const entrada = assetDoPredio(manifestoDoJogo, tipo);
    if (!entrada) return null;
    if (!arquivoDoEstagio(entrada, estagio)) return null;
    const chave = chaveDaTextura(entrada.id, estagio);
    return this.textures.exists(chave) ? { chave, entrada } : null;
  }

  /** F17g — as duas texturas da revelacao, ou `null` quando falta uma: sem o par
   *  no manifesto E no loader, a obra fica nos seis estagios (decisao do operador).
   *  A mesma pergunta para quem publica no debug e para quem desenha. */
  private parDeRevelacao(tipo: string): {
    readonly madeira: { readonly chave: string; readonly entrada: EntradaDeAsset };
    readonly pedra: { readonly chave: string; readonly entrada: EntradaDeAsset };
  } | null {
    const entrada = assetDoPredio(manifestoDoJogo, tipo);
    if (!entrada || !temParDeRevelacao(entrada)) return null;
    const madeira = this.spriteDoPredio(tipo, 'madeira');
    const pedra = this.spriteDoPredio(tipo, 'completo');
    return madeira && pedra ? { madeira, pedra } : null;
  }

  /** Placeholder do §9: retangulo do tamanho do footprint com o nome
   *  tematico escrito por cima. Sem PNG em assets/base/, isto e o desenho
   *  definitivo desta sessao, nao uma falha. Uma OBRA (F07) e a marcacao no
   *  chao; a F11c divide essa fase em tres estagios derivados do `hp`
   *  (`estagio-obra.ts`): marcacao (nada martelado), madeira (em obra) e
   *  completo (o predio de pe, sem rotulo extra). */
  private criarPredio(
    predio: Predio, estagio: EstagioDaObra, revelacao: RevelacaoDaObra | null,
    linhas: readonly LinhaDoMedidor[],
    canteiro: CanteiroDaObra | null, pilhas: readonly PilhaDesenhada[],
    quadro: QuadroDeTrabalho | null, fumaca: number | null, tilePx: number,
  ): Phaser.GameObjects.Container {
    const { largura, altura, nome } = aparenciaDoPredio(predio.tipo);
    const canto = gridToScreen({ gx: predio.gx, gy: predio.gy }, tilePx, ESCALA_DO_MUNDO);
    const larguraPx = largura * tilePx;
    const alturaPx = altura * tilePx;

    const sprite = this.spriteDoPredio(predio.tipo, estagio);
    // F17g: com revelacao, madeira embaixo e pedra (o `completo`) por cima.
    const par = revelacao === null ? null : this.parDeRevelacao(predio.tipo);
    const corpo = revelacao !== null && par !== null
      ? [
        ...this.desenharRevelado(par.madeira, revelacao.madeira, larguraPx, alturaPx),
        ...this.desenharRevelado(par.pedra, revelacao.pedra, larguraPx, alturaPx),
      ]
      : sprite === null
        ? this.desenharPlaceholder(estagio, nome, larguraPx, alturaPx)
        : [this.desenharSprite(sprite.chave, sprite.entrada, larguraPx, alturaPx)];
    // F-VIVO-a: a fracao da ancora e do sprite `completo` (brief §4a). Sem ele, do lote.
    const completo = this.spriteDoPredio(predio.tipo, 'completo');
    const caixa = completo === null
      ? { x: 0, y: 0, w: larguraPx, h: alturaPx }
      : this.caixaDoSprite(completo.entrada, larguraPx, alturaPx);

    // O canteiro vai PRIMEIRO no container: ele e o chao, e o corpo da obra fica
    // por cima. O medidor da F17b continua por ultimo.
    const container = this.add.container(canto.x, canto.y, [
      ...this.desenharCanteiro(canteiro, largura, tilePx),
      ...corpo,
      ...this.desenharTrabalho(predio.tipo, quadro, fumaca, caixa),
      ...this.desenharPilhas(pilhas, caixa, tilePx),
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

  /** F17g — uma imagem do par recortada DE BAIXO PARA CIMA pela fracao: a obra
   *  sobe do chao. O recorte e no quadro da textura (px do arquivo); escala e
   *  ancoragem continuam as de `desenharSprite`. Fracao zero nao desenha nada. */
  private desenharRevelado(
    sprite: { readonly chave: string; readonly entrada: EntradaDeAsset }, fracao: Fracao,
    larguraPx: number, alturaPx: number,
  ): Phaser.GameObjects.Image[] {
    const [num, den] = fracao;
    if (num <= 0) return [];
    const imagem = this.desenharSprite(sprite.chave, sprite.entrada, larguraPx, alturaPx);
    const visivel = imagem.height * num / den;
    imagem.setCrop(0, imagem.height - visivel, imagem.width, visivel);
    return [imagem];
  }

  /** F-VIVO-a — o retangulo que o sprite ocupa dentro do container, pela mesma
   *  ancoragem e escala de `desenharSprite`. */
  private caixaDoSprite(
    entrada: EntradaDeAsset, larguraPx: number, alturaPx: number,
  ): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    const escala = larguraPx / entrada.tamanho[0];
    const w = entrada.tamanho[0] * escala;
    const h = entrada.tamanho[1] * escala;
    return { x: larguraPx / 2 - w * entrada.anchor[0], y: alturaPx - h * entrada.anchor[1], w, h };
  }

  /** F-VIVO-a — a textura da unidade de uma mercadoria, ou `null` (quadrado do §9). */
  private texturaDaPilha(mercadoria: string): string | null {
    const chave = chaveDeTextura('pilha', mercadoria, ESTADO_DA_PILHA);
    return this.textures.exists(chave) ? chave : null;
  }

  /** F-VIVO-b — a textura de um quadro de trabalho, ou `null` (retangulo do §9). */
  private texturaDoQuadro(tipo: string, quadro: QuadroDeTrabalho): string | null {
    const chave = chaveDeTextura('trabalho', tipo, `${quadro.laco}_${quadro.n}`);
    return this.textures.exists(chave) ? chave : null;
  }

  /** F-VIVO-b — o quadro de trabalho na `area` da ancora (ou na padrao), com o
   *  tamanho exato da area (brief §4a). Sem PNG, um retangulo com `<laco>_<n>`
   *  escrito. A fumaca so existe no ponto DECLARADO; sem PNG, um circulo claro que
   *  sobe com o quadro. O corpo do predio nao muda: o placeholder dele fica como era. */
  private desenharTrabalho(
    tipo: string, quadro: QuadroDeTrabalho | null, fumaca: number | null,
    caixa: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  ): Phaser.GameObjects.GameObject[] {
    const objetos: Phaser.GameObjects.GameObject[] = [];
    const ancoras = DADOS_DO_TRABALHO.ancoras[tipo];
    if (quadro !== null) {
      const [x0, y0, x1, y1] = areaDoTrabalho(ancoras);
      const x = caixa.x + caixa.w * x0;
      const y = caixa.y + caixa.h * y0;
      const w = caixa.w * (x1 - x0);
      const h = caixa.h * (y1 - y0);
      const textura = this.texturaDoQuadro(tipo, quadro);
      if (textura !== null) {
        const imagem = this.add.image(x, y, textura);
        imagem.setOrigin(0, 0);
        imagem.setDisplaySize(w, h);
        objetos.push(imagem);
      } else {
        const fundo = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x2c1d12, 0.55);
        fundo.setStrokeStyle(1, 0xf2d6a2);
        const rotulo = this.add.text(x + w / 2, y + h / 2, `${quadro.laco}_${quadro.n}`, {
          fontFamily: 'monospace', fontSize: '11px', color: '#f2d6a2',
        });
        rotulo.setOrigin(0.5, 0.5);
        objetos.push(fundo, rotulo);
      }
    }
    const ponto = ancoras?.trabalho?.fumaca;
    if (fumaca !== null && ponto !== undefined) {
      const x = caixa.x + caixa.w * ponto[0];
      const y = caixa.y + caixa.h * ponto[1];
      const chave = chaveDeTextura('trabalho', ID_DA_FUMACA, `${ID_DA_FUMACA}_${fumaca}`);
      if (this.textures.exists(chave)) {
        const imagem = this.add.image(x, y, chave);
        imagem.setOrigin(0.5, 1);
        objetos.push(imagem);
      } else {
        objetos.push(this.add.circle(x, y - fumaca * 2, 3 + fumaca / 2, 0xd8d0c0, 0.7));
      }
    }
    return objetos;
  }

  /** F-VIVO-a — as pilhas: `n` unidades por ponto, tres embaixo e dois em cima
   *  (`posicoesNaPilha`), com o pe da pilha no ponto. PNG quando o manifesto tem a
   *  `pilha` da mercadoria; senao um quadrado com a cor do tema. */
  private desenharPilhas(
    pilhas: readonly PilhaDesenhada[],
    caixa: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
    tilePx: number,
  ): Phaser.GameObjects.GameObject[] {
    const lado = tilePx * LADO_DA_UNIDADE_EM_TILES;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    for (const pilha of pilhas) {
      const px = caixa.x + caixa.w * pilha.ponto[0];
      const py = caixa.y + caixa.h * pilha.ponto[1];
      const textura = this.texturaDaPilha(pilha.mercadoria);
      const cor = Phaser.Display.Color.HexStringToColor(corDaPilha(pilha.mercadoria)).color;
      for (const [dx, dy] of posicoesNaPilha(pilha.n)) {
        const x = px + dx * lado;
        const y = py + dy * lado - lado / 2;
        if (textura !== null) {
          const imagem = this.add.image(x, y + lado / 2, textura);
          imagem.setOrigin(0.5, 1);
          imagem.setDisplaySize(lado, lado * (imagem.height / imagem.width));
          objetos.push(imagem);
        } else {
          const unidade = this.add.rectangle(x, y, lado - 1, lado - 1, cor, 1);
          unidade.setStrokeStyle(1, 0x2c1d12);
          objetos.push(unidade);
        }
      }
    }
    return objetos;
  }

  /** O placeholder do §9: o lote e o volume que sobe nele. A F11c desenhava o
   *  mesmo retangulo com tres opacidades; a F17e da a cada um dos seis estagios
   *  uma silhueta propria — contorno vazado sempre, volume em tres patamares de
   *  altura e uma cor por camada. Continua sendo o desenho de 27 dos 28 predios,
   *  e continua NAO sendo falha. */
  private desenharPlaceholder(
    estagio: EstagioDaObra, nome: string, larguraPx: number, alturaPx: number,
  ): Phaser.GameObjects.GameObject[] {
    const emObra = estaEmObra(estagio);
    const cara = CARA_DO_ESTAGIO[estagio];
    const objetos: Phaser.GameObjects.GameObject[] = [];

    // O lote, sempre: e o que diz ao jogador quanto chao a obra vai ocupar,
    // inclusive quando ainda nao ha volume nenhum em cima dele.
    const lote = this.add.rectangle(larguraPx / 2, alturaPx / 2, larguraPx, alturaPx, cara.cor, 0);
    lote.setStrokeStyle(2, emObra ? 0xede3d0 : 0x2c1d12);
    objetos.push(lote);

    // O volume, ancorado no PE do footprint: a obra sobe do chao para cima, e nao
    // cresce a partir do meio.
    if (cara.altura > 0) {
      const altura = alturaPx * cara.altura;
      objetos.push(this.add.rectangle(
        larguraPx / 2, alturaPx - altura / 2, larguraPx, altura, cara.cor, cara.opacidade,
      ));
    }

    const texto = emObra ? `${nome}\n(${temaSertao.obra[estagio]})` : nome;
    const rotulo = this.add.text(larguraPx / 2, alturaPx / 2, texto, {
      fontSize: '14px',
      color: '#ede3d0',
      align: 'center',
      wordWrap: { width: larguraPx - 8 },
    });
    rotulo.setOrigin(0.5, 0.5);
    objetos.push(rotulo);
    return objetos;
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
