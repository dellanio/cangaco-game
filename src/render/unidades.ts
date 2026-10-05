/**
 * As unidades na tela (F10). O render LE o estado e desenha: a posicao de cada tick vem de
 * `posicaoDaUnidade` (funcao pura do estado, em `sim/selectors.ts`) — o tile onde a unidade
 * esta mais a fracao do passo em curso. A F11a acrescenta por cima a interpolacao ENTRE ticks
 * (`interpolacao.ts`, com o `alfa` do laco): o que se desenha e o meio-termo entre a posicao
 * do tick anterior e a do atual. A posicao do tick anterior e memoria de RENDER (como o `Map`
 * de containers), nunca estado de jogo.
 *
 * Placeholder do CLAUDE.md §9: um retangulo por unidade. Se a unidade leva carga
 * (`fsmData.carga`), o nome da mercadoria aparece em cima. `desenhados` e memoria de render
 * local — handle dos objetos que esta camada criou, nao estado de jogo (§10).
 *
 * F-D4: sob o retangulo vai o OFICIO (`nome-de-unidade.ts`, vindo do tema pelo tipo neutro),
 * no lugar do id, que nao dizia nada ao jogador. Vai FORA do quadrado por medida, nao por
 * gosto: o quadrado tem meio tile (32 px) e o rotulo mais largo do tema passa dele — o
 * roteiro da F-D4 mede as duas coisas e o item do BUILD_PLAN registra a decisao. O id segue
 * na ponte de debug (`UnidadeRenderizada.id`), que e por onde os roteiros identificam unidade.
 *
 * F20c acrescenta o marcador de fome, mais acima que o da carga: quem decide se ele acende e
 * `temMarcadorDeFome` (`marcador-de-fome.ts`, reexportacao do predicado da sim), nunca um
 * limiar digitado aqui.
 *
 * F-SPR: com arte no manifesto (`tipo: "unidade"`, um arquivo por pose e direcao), o
 * retangulo da lugar ao sprite; sem arte, o retangulo continua, que e o placeholder do §9.
 * A direcao sai do passo entre o tick anterior e o atual (a mesma memoria da interpolacao),
 * e parada a unidade mantem a ultima. Quantas direcoes o tipo tem vem de `data/units.json`
 * (`direcoes-de-sprite.ts`). O `anchor` do arquivo cai na posicao desenhada da unidade, e a
 * imagem sai no tamanho do arquivo: nenhuma conta de lado ou de tile decide o tamanho.
 *
 * Este arquivo NAO importa `sim/data` (so `mapa.ts` e `predios.ts` podem, teste estrutural da
 * F04): a paleta vem do tema e a posicao do selector.
 */
import Phaser from 'phaser';
import temaSertao from '../../data/theme-sertao.json';
import {
  depthDeY, gridToScreenCentro, deslocamentoDaUnidade, ESCALA_DO_MUNDO, LADO_DA_UNIDADE_EM_TILES,
  PROFUNDIDADE_DOS_NOMES,
} from './grid';
import { criarMemoriaDePosicoes, interpolarPosicao } from './interpolacao';
import { criarMemoriaDaEspera } from './espera-na-fila';
import {
  ALTURA_DA_CARGA_EM_LADOS, ALTURA_DA_FOME_EM_LADOS, temMarcadorDeFome,
} from './marcador-de-fome';
import { nomeDaUnidade } from './nome-de-unidade';
import { rotuloDaCarga } from './rotulo-da-carga';
import { COR_DA_PLACA_DO_ICONE, marcaDaCarga } from './icone-da-mercadoria';
import { corDoBando } from './cor-do-bando';
import { direcoesDoTipo } from './direcoes-de-sprite';
import { alvoDaDirecao } from './direcao-de-unidade';
import { spriteDaUnidade, POSE_PARADO } from './manifesto';
import type { Direcao } from './manifesto';
import { iconesDoJogo, manifestoDoJogo } from './sprites';
import { posicaoDaUnidade } from '../sim/selectors';
import { fracaoDeCondicao } from '../sim/condicao';
import { inimigosForaDaVista } from './nevoa';
import { unidadesInvisiveis } from './visibilidade';
import type { GameState } from '../sim/state';
import type { LuzDoRelevo } from './camada-de-relevo';
import configAnimacao from '../../data/animacao-unidade.json';
import tempo from '../../data/time.json';
import { depuracaoDeUnidade, quadroDoAndar, quadroPeloTempo, somarDistancia, spriteDoAtlas, tempoDeAnimacao, unidadeNaVista } from './animacao-de-unidade';
import { depuracaoRegistrada } from './registro-de-depuracao';
import type { PontoEmTiles } from './interpolacao';
import type { SpriteAnimado } from './animacao-de-unidade';
import { mesclarManifestos } from './animacao-de-unidade';
import { assetDaCamada } from './manifesto';
import { peDoSprite } from './pe-do-sprite';
import { atualizarVirada, iniciarVirada } from './virada-de-unidade';
import type { MemoriaDaVirada } from './virada-de-unidade';
import { acaoDaUnidade, animacaoComCarga, direcaoDoTrabalho } from './acao-de-unidade';
import dadosDaCargaNasMaos from '../../data/carga-nas-maos.json';
import { pontoDaCargaNasMaos } from './carga-nas-maos';
import { animacaoDoGesto, colheitaNasMaos, deslocamentoDoTrabalho } from './gesto-do-trabalho';
import type { GestoDoTrabalho } from './gesto-do-trabalho';
import { caixaDeTipoNoMapa } from './predios';
import dadosDoGesto from '../../data/gesto-do-trabalho.json';

const gestoDoTrabalho = dadosDoGesto as unknown as GestoDoTrabalho;
import type { CargaNasMaos } from './carga-nas-maos';
import type { MemoriaDeAcao } from './acao-de-unidade';
import dadosDoPensamento from '../../data/pensamento.json';
import { mercadoriaDoBalao, pensamentoNaTela } from './pensamento';
import type { ConfigDoPensamento, Pensamento } from './pensamento';
import { chaveDoIcone } from './icone-da-mercadoria';

/** O que a camada desenhou de uma unidade, para o roteiro afirmar (`window.__cangaco`). */
export interface UnidadeRenderizada {
  readonly direcaoLogica?: Direcao | null;
  readonly animacao?: string;
  readonly inicioDaAcao?: number;
  readonly quadro?: number;
  readonly frame?: string;
  readonly distanciaAnimada?: number;
  /** Borda inferior do recorte realmente desenhado, relativa ao container. */
  readonly peY?: number;
  readonly espelhado?: boolean;
  readonly id: string;
  readonly tipo: string;
  /** Posicao do TICK, em tiles, FRACIONARIA no meio de um passo. Deterministica: e o que os
   *  roteiros afirmam, e nao muda com o relogio de parede. */
  readonly gx: number;
  readonly gy: number;
  /** Posicao DESENHADA: a do tick interpolada com o tick anterior pelo `alfa`. Com o jogo
   *  pausado (alfa 1) e igual a `gx/gy`. */
  readonly gxDesenhado: number;
  readonly gyDesenhado: number;
  readonly fsm: string;
  /** A mercadoria que ela leva, ou null. */
  readonly carga: string | null;
  /** C-IA-03c — o lado da unidade e a cor de bando com que o rotulo foi pintado. */
  readonly lado: number;
  readonly corDoBando: string;
  /** BUG-O — o nome do tema da carga, ou null. Com icone (D-TELA-03a) o texto nao se desenha,
   *  mas o nome continua aqui: e o que o jogador leria. */
  readonly rotuloDaCarga: string | null;
  /** D-TELA-03a — como a carga foi desenhada: `icone` (D-ARTE-01) ou `texto` (o BUG-O); null sem carga. */
  readonly marcaDaCarga: 'icone' | 'texto' | null;
  /**
   * F18f — o quanto o desenho sai do centro do tile, em px de mundo. Nao e posicao de
   * jogo: `gx/gy` continuam sendo o tile, e e por eles que os roteiros medem caminho e
   * interpolacao. Este campo existe para o roteiro conseguir provar que duas unidades no
   * MESMO tile nao caem no mesmo pixel — sem ele, "separou" e "empilhou" sao iguais na
   * ponte de debug.
   */
  readonly deslocamentoPx: { readonly x: number; readonly y: number };
  /**
   * F20c — o marcador de fome esta ACESO neste quadro? E o que a camada desenhou, nao uma
   * segunda conta: sai do mesmo `temMarcadorDeFome` que liga o objeto na tela.
   */
  readonly marcadorDeFome: boolean;
  /** I-TELA-BALAO-DE-PENSAMENTO — o balao aceso agora: a mercadoria, ou `comer`, `construir`,
   *  `casa`; null sem balao. `balaoComo` diz se ele mostrou o icone ou o texto do tema. */
  readonly pensamento?: string | null;
  readonly balaoComo?: 'icone' | 'texto' | null;
  /** F20c — a condicao de 0 a 1 (`fracaoDeCondicao`), para o roteiro afirmar o limiar contra
   *  `data/condition.json` em vez de contra um numero escrito no roteiro. */
  readonly fracaoDeCondicao: number;
  /** F-D4 — o oficio escrito sob a unidade, vindo do tema pelo `tipo`. */
  readonly nome: string;
  /** F-SPR — a direcao para onde ela olha, ou null se o tipo nao declara `direcoesDeSprite`. */
  readonly direcao: Direcao | null;
  /** F-SPR — a chave da textura desenhada, ou null quando e o retangulo (placeholder). */
  readonly sprite: string | null;
  /** C-TELA-04 — o retangulo do CORPO desenhado (a imagem), em px de mundo relativos ao
   *  centro desenhado; null no placeholder, que cabe no quadrado. E o que o jogador mira. */
  readonly corpoPx: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number } | null;
  /**
   * F-D4 — largura DESENHADA desse rotulo, em px de mundo. E o que permite o roteiro afirmar
   * o encaixe com uma medida em vez de com uma impressao: o quadrado da unidade tem
   * `tilePx * LADO_DA_UNIDADE_EM_TILES` de lado, e o rotulo do oficio nao cabe dentro dele.
   */
  readonly larguraDoRotuloPx: number;
  /** BUG-X — a camada DESENHOU a unidade? `false` e o especialista dentro de casa ou o
   *  comensal dentro da Bodega (`visibilidade.ts`). Segue na lista para o roteiro achar o
   *  id; o acerto pula. */
  readonly visivel: boolean;
  /** BUG-Z — a profundidade do nome (a camada dos nomes) e a do corpo (o y da unidade), e se o
   *  nome esta aceso. O roteiro afirma o nome acima de todo corpo, pela medida. */
  readonly profundidadeDoNome: number;
  readonly profundidadeDoCorpo: number;
  readonly nomeVisivel: boolean;
}

export interface CamadaDeUnidades {
  invalidar(): void;
  readonly animacoesTrabalhadas: number;
  /** `alfa`: fracao do tick em curso (`Laco.alfa()`), em [0, 1]. */
  atualizar(estado: GameState | null, alfa: number): readonly UnidadeRenderizada[];
}

/**
 * Acima disto (em tiles, 2D) entre o tick anterior e o atual a unidade NAO interpola, assenta.
 * Apresentacao, nao balanceamento: a 10 Hz uma unidade a pe anda ~0,2 tile por tick, entao 2 tiles
 * so aparece em reposicionamento (unidade nova, caminho refeito) ou num quadro que rodou varios
 * passos de uma vez.
 */
const SALTO_MAXIMO_EM_TILES = configAnimacao.saltoMaximoTiles;

/**
 * Onde o nome do oficio fica ABAIXO do centro da unidade, em multiplos do lado dela. O
 * quadrado vai ate 0,5 lado; o resto e a folga entre a borda e a primeira linha do texto.
 * Apresentacao, nao balanceamento.
 */
const ALTURA_DO_NOME_EM_LADOS = 0.6;

/** D-TELA-03a — o lado do icone da carga, em multiplos do lado da unidade: 24 px num lado de 32,
 *  o tamanho do arquivo do HUD. Apresentacao, nao balanceamento. */
const LADO_DO_ICONE_DA_CARGA_EM_LADOS = 0.75;
const CONFIG_DO_PENSAMENTO = dadosDoPensamento as ConfigDoPensamento;

const cor = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

/** A cor do marcador de fome vem do tema por NOME da paleta (`marcadores.fome.cor`). */
const corDoMarcadorDeFome: string = (
  temaSertao.paleta as Record<string, string>
)[temaSertao.marcadores.fome.cor] ?? temaSertao.paleta.terraQueimada;

interface Desenhado {
  inicioDaAcao: number;
  virada: MemoriaDaVirada;
  distancia: number;
  ultimaPosicao: PontoEmTiles | null;
  ultimoTickAnimado: number;
  animacao: string;
  /** A acao que o estado pede (antes do gesto): o deslocamento do trabalho le esta. */
  acaoDoTrabalho: string;
  quadro: number;
  spriteAnimado: SpriteAnimado | null;
  readonly container: Phaser.GameObjects.Container;
  readonly retangulo: Phaser.GameObjects.Rectangle;
  /** F-SPR — criado na primeira vez que a arte resolve; memoria de render. */
  imagem: Phaser.GameObjects.Image | null;
  /** F-SPR — a ultima direcao do passo; parada, a unidade continua olhando para ela. */
  direcao: Direcao;
  readonly nome: Phaser.GameObjects.Text;
  readonly marcadorDeCarga: Phaser.GameObjects.Text;
  /** D-TELA-03a — o icone da carga e a placa escura sob ele, criados na primeira carga com icone;
   *  memoria de render. */
  iconeDaCarga: Phaser.GameObjects.Image | null;
  placaDoIcone: Phaser.GameObjects.Rectangle | null;
  readonly marcadorDeFome: Phaser.GameObjects.Text;
  /** I-TELA-BALAO-DE-PENSAMENTO — o balao, criado no primeiro pensamento; memoria de render. */
  balao: { readonly fundo: Phaser.GameObjects.Graphics; readonly icone: Phaser.GameObjects.Image; readonly texto: Phaser.GameObjects.Text } | null;
}

export function criarCamadaDeUnidades(
  cena: Phaser.Scene, tilePx: number,
  /** D-TELA-LUZ-RELEVO — a luz do relevo, ou `null` (o padrao): o tint segue a posicao do pe. */
  luz: LuzDoRelevo | null = null,
  identidadePartida: () => number = () => 0,
  acoes: () => ReadonlyMap<string, MemoriaDeAcao> | undefined = () => undefined,
): CamadaDeUnidades {
  const desenhados = new Map<string, Desenhado>();
  const memoria = criarMemoriaDePosicoes();
  /** BUG-CIVIL-RECUA-NO-DESENHO — dentro do passo o desenho nao volta (o serf espera parado na fila). */
  const espera = criarMemoriaDaEspera();
  const lado = tilePx * LADO_DA_UNIDADE_EM_TILES;
  const depuracao = depuracaoDeUnidade(window.location.search);
  const manifestoAnimado = mesclarManifestos(manifestoDoJogo, depuracao ? depuracaoRegistrada()?.manifesto : undefined);
  let ultimaChaveAnimada = '';
  let animacoesTrabalhadas = 0;
  let identidade = identidadePartida();

  function criar(tipo: string, ladoDaUnidade: number): Desenhado {
    const ehSerf = tipo === 'serf';
    const retangulo = cena.add.rectangle(0, 0, lado, lado, cor(ehSerf ? temaSertao.paleta.ocre : temaSertao.paleta.couro), 1);
    retangulo.setStrokeStyle(2, cor(temaSertao.paleta.madeira));
    // O texto e do JOGADOR: vem do tema pelo tipo neutro, nunca digitado aqui. `setOrigin(0.5, 0)`
    // ancora pelo TOPO, entao a folga sob o quadrado nao depende do tamanho da fonte.
    const rotulo = cena.add.text(0, lado * ALTURA_DO_NOME_EM_LADOS, nomeDaUnidade(tipo), {
      // C-IA-03c: o fundo do rotulo e a cor do BANDO (vermelho o jogador, azul a IA)
      fontSize: '11px', color: temaSertao.paleta.cal, backgroundColor: corDoBando(ladoDaUnidade), padding: { x: 2, y: 0 },
    });
    rotulo.setOrigin(0.5, 0);
    // BUG-Z: o nome nao mora no container da unidade (que se ordena pelo y dela), mas na camada
    // dos nomes, acima de toda unidade: empurrado pelo desencontro, ele nao some atras da fileira
    // da frente. A posicao e a de mundo, posta em `organizarRotulos`
    rotulo.setDepth(PROFUNDIDADE_DOS_NOMES);
    const marcadorDeCarga = cena.add.text(0, -lado * ALTURA_DA_CARGA_EM_LADOS, '', {
      fontSize: '11px', color: '#ede3d0', backgroundColor: '#2c1d12', padding: { x: 3, y: 1 },
    });
    marcadorDeCarga.setOrigin(0.5, 0.5);
    marcadorDeCarga.setVisible(false);
    // F20c: o texto e o do JOGADOR e mora no tema, com a cor por NOME da paleta — nenhum hex
    // e nenhum limiar neste arquivo.
    const marcadorDeFome = cena.add.text(0, -lado * ALTURA_DA_FOME_EM_LADOS, temaSertao.marcadores.fome.rotulo, {
      fontSize: '12px',
      color: temaSertao.paleta.cal,
      backgroundColor: corDoMarcadorDeFome,
      padding: { x: 4, y: 1 },
    });
    marcadorDeFome.setOrigin(0.5, 0.5);
    marcadorDeFome.setVisible(false);
    const container = cena.add.container(0, 0, [retangulo, marcadorDeCarga, marcadorDeFome]);
    return { container, retangulo, imagem: null, direcao: 's', nome: rotulo, marcadorDeCarga, iconeDaCarga: null, placaDoIcone: null, marcadorDeFome, balao: null,
      distancia: 0, ultimaPosicao: null, ultimoTickAnimado: -1, animacao: 'parado', acaoDoTrabalho: 'parado', inicioDaAcao: 0, quadro: 0, spriteAnimado: null,
      virada: iniciarVirada('s', 0) };
  }

  /** F-SPR — troca o retangulo pelo sprite quando a arte resolve, e volta quando nao. */
  function desenharSprite(item: Desenhado, tipo: string, direcoes: 4 | 8 | null): string | null {
    const carregada = (chave: string): boolean => cena.textures.exists(chave);
    const sprite = item.spriteAnimado ?? spriteDaUnidade(manifestoDoJogo, tipo, POSE_PARADO, item.direcao, direcoes, carregada);
    if (item.spriteAnimado && item.imagem?.visible && item.imagem.texture.key === sprite?.chave
      && item.imagem.frame.name === item.spriteAnimado.frame && item.imagem.flipX === sprite?.espelhar) return sprite.chave;
    item.retangulo.setVisible(sprite === null);
    if (sprite === null) {
      item.imagem?.setVisible(false);
      return null;
    }
    if (item.imagem === null) {
      item.imagem = cena.add.image(0, 0, sprite.chave);
      item.container.addAt(item.imagem, 0);
    } else if (item.imagem.texture.key !== sprite.chave) {
      item.imagem.setTexture(sprite.chave);
    }
    if (item.spriteAnimado && item.imagem.frame.name !== item.spriteAnimado.frame) item.imagem.setFrame(item.spriteAnimado.frame);
    item.imagem.setOrigin(sprite.entrada.anchor[0], sprite.entrada.anchor[1]);
    item.imagem.setFlipX(sprite.espelhar);
    item.imagem.setVisible(true);
    return sprite.chave;
  }

  /** D-TELA-03a — a carga: o icone da mercadoria quando existe, senao o texto do BUG-O (o nome
   *  do tema, nunca o id da sim). Sem carga, os dois se apagam. */
  function desenharCarga(item: Desenhado, carga: string): 'icone' | 'texto' {
    const marca = marcaDaCarga(carga, iconesDoJogo, (chave) => cena.textures.exists(chave), rotuloDaCarga);
    item.marcadorDeCarga.setVisible(marca.como === 'texto');
    item.marcadorDeCarga.setText(marca.como === 'texto' ? marca.rotulo : '');
    if (marca.como === 'icone') {
      if (item.iconeDaCarga === null) {
        const ladoDaPlaca = lado * LADO_DO_ICONE_DA_CARGA_EM_LADOS + 4;
        item.placaDoIcone = cena.add.rectangle(0, -lado * ALTURA_DA_CARGA_EM_LADOS, ladoDaPlaca, ladoDaPlaca, COR_DA_PLACA_DO_ICONE, 1);
        item.iconeDaCarga = cena.add.image(0, -lado * ALTURA_DA_CARGA_EM_LADOS, marca.chave);
        item.container.add([item.placaDoIcone, item.iconeDaCarga]);
      } else if (item.iconeDaCarga.texture.key !== marca.chave) {
        item.iconeDaCarga.setTexture(marca.chave);
      }
      // D-ARTE-PIXEL-ART-CIVIS: com a pose de carregar, a mercadoria vai entre as maos, sem placa;
      // sem ela, o icone sobre a cabeca de hoje (D-TELA-03a).
      const config = dadosDaCargaNasMaos as unknown as CargaNasMaos;
      if (item.animacao === 'carregando') {
        const ponto = pontoDaCargaNasMaos(item.direcao, config);
        item.iconeDaCarga.setPosition(ponto.x, ponto.y);
        item.iconeDaCarga.setDisplaySize(config.tamanhoPx, config.tamanhoPx);
        const indice = item.container.getIndex(item.iconeDaCarga);
        const indiceDoCorpo = item.imagem ? item.container.getIndex(item.imagem) : -1;
        if (ponto.atras && indice > indiceDoCorpo && indiceDoCorpo >= 0) item.container.moveBelow(item.iconeDaCarga, item.imagem!);
        if (!ponto.atras && indice < indiceDoCorpo) item.container.moveAbove(item.iconeDaCarga, item.imagem!);
        item.iconeDaCarga.setVisible(true);
        item.placaDoIcone?.setVisible(false);
        return marca.como;
      }
      item.iconeDaCarga.setPosition(0, -lado * ALTURA_DA_CARGA_EM_LADOS);
      if (item.imagem && item.container.getIndex(item.iconeDaCarga) < item.container.getIndex(item.imagem)) {
        item.container.moveAbove(item.iconeDaCarga, item.imagem);
      }
      item.iconeDaCarga.setDisplaySize(lado * LADO_DO_ICONE_DA_CARGA_EM_LADOS, lado * LADO_DO_ICONE_DA_CARGA_EM_LADOS);
    }
    item.iconeDaCarga?.setVisible(marca.como === 'icone');
    item.placaDoIcone?.setVisible(marca.como === 'icone');
    return marca.como;
  }

  /** I-TELA-BALAO-DE-PENSAMENTO — o balao sobre a cabeca: o icone da mercadoria quando existe,
   *  senao o texto do tema. Sem pensamento, ele se apaga. */
  function desenharPensamento(item: Desenhado, pensamento: Pensamento | null): 'icone' | 'texto' | null {
    if (pensamento === null) {
      if (item.balao !== null) {
        item.balao.fundo.setVisible(false);
        item.balao.icone.setVisible(false);
        item.balao.texto.setVisible(false);
      }
      return null;
    }
    const y = -lado * CONFIG_DO_PENSAMENTO.alturaEmLados;
    if (item.balao === null) {
      const fundo = cena.add.graphics();
      const largura = lado * 1.1;
      const altura = lado * 0.8;
      fundo.fillStyle(cor(temaSertao.paleta.cal), 1);
      fundo.lineStyle(2, cor(temaSertao.paleta.madeira), 1);
      fundo.fillEllipse(0, y, largura, altura);
      fundo.strokeEllipse(0, y, largura, altura);
      // as duas bolinhas do balao de pensamento, descendo para a cabeca
      for (const [dx, dy, r] of [[-lado * 0.18, altura * 0.7, lado * 0.09], [-lado * 0.28, altura * 1.05, lado * 0.05]] as const) {
        fundo.fillCircle(dx, y + dy, r);
        fundo.strokeCircle(dx, y + dy, r);
      }
      const icone = cena.add.image(0, y, '__DEFAULT');
      const texto = cena.add.text(0, y, '', { fontSize: '10px', color: temaSertao.paleta.madeira });
      texto.setOrigin(0.5, 0.5);
      item.balao = { fundo, icone, texto };
      item.container.add([fundo, icone, texto]);
    }
    const mercadoria = mercadoriaDoBalao(pensamento, CONFIG_DO_PENSAMENTO);
    const chave = mercadoria === null ? null : chaveDoIcone(mercadoria);
    const comIcone = chave !== null && cena.textures.exists(chave);
    item.balao.fundo.setVisible(true);
    item.balao.icone.setVisible(comIcone);
    item.balao.texto.setVisible(!comIcone);
    if (comIcone) {
      if (item.balao.icone.texture.key !== chave) item.balao.icone.setTexture(chave);
      const ladoDoIcone = lado * CONFIG_DO_PENSAMENTO.ladoDoIconeEmLados;
      item.balao.icone.setDisplaySize(ladoDoIcone, ladoDoIcone);
    } else {
      const rotulos = temaSertao.pensamentos as Readonly<Record<string, string>>;
      item.balao.texto.setText(rotulos[pensamento.tipo] ?? '');
    }
    return comIcone ? 'icone' : 'texto';
  }

  /**
   * Mantém os nomes completos do tema, mas impede que unidades próximas
   * imprimam um rótulo por cima do outro. A primeira linha continua na posição
   * histórica; só quem colide desce para a próxima linha livre.
   */
  function organizarRotulos(): void {
    const ocupados: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const itens = [...desenhados.entries()].filter(([, item]) => item.container.visible).sort(([idA, a], [idB, b]) => (
      a.container.y - b.container.y
      || a.container.x - b.container.x
      || idA.localeCompare(idB)
    ));
    const baseY = lado * ALTURA_DO_NOME_EM_LADOS;
    const folga = 2;

    for (const [, item] of itens) {
      const largura = item.nome.displayWidth;
      const altura = item.nome.displayHeight;
      const x0 = item.container.x - largura / 2;
      const x1 = x0 + largura;
      let y0 = item.container.y + baseY;

      for (;;) {
        const colisoes = ocupados.filter((r) => (
          x0 < r.x1 + folga
          && x1 > r.x0 - folga
          && y0 < r.y1 + folga
          && y0 + altura > r.y0 - folga
        ));
        if (colisoes.length === 0) break;
        y0 = Math.max(...colisoes.map((r) => r.y1 + folga));
      }

      item.nome.setPosition(item.container.x, y0);
      ocupados.push({ x0, y0, x1, y1: y0 + altura });
    }
  }

  return {
    invalidar(){ultimaChaveAnimada='';},
    get animacoesTrabalhadas() { return animacoesTrabalhadas; },
    atualizar(estado, alfa) {
      if (estado === null) return [];
      if(identidade!==identidadePartida()) {
        identidade=identidadePartida();ultimaChaveAnimada='';
        for(const [id,item] of desenhados) {item.container.destroy();item.nome.destroy();memoria.esquecer(id);espera.esquecer(id);}
        desenhados.clear();
      }
      const vista = cena.cameras.main.worldView;
      const chave = `${estado.tick},${alfa},${vista.x},${vista.y},${vista.width},${vista.height}`;
      const mudouAnimacao = chave !== ultimaChaveAnimada;
      ultimaChaveAnimada = chave;
      animacoesTrabalhadas = 0;
      const vivas = new Set(estado.unidades.ordem);
      for (const [id, item] of desenhados) {
        if (!vivas.has(id)) {
          item.container.destroy();
          item.nome.destroy();
          desenhados.delete(id);
          memoria.esquecer(id);
          espera.esquecer(id);
        }
      }
      const renderizadas: UnidadeRenderizada[] = [];
      // F-TELA-NEVOA: o inimigo fora da vista some como o especialista dentro da casa — nao se
      // desenha e o acerto o pula (`naTela`), entao o clique nao o acha
      const invisiveis = new Set([...unidadesInvisiveis(estado), ...inimigosForaDaVista(estado)]);
      const memoriasDeAcao = acoes();
      for (const id of estado.unidades.ordem) {
        const unidade = estado.unidades.porId[id];
        if (!unidade) continue;
        let item = desenhados.get(id);
        if (!item) {
          item = criar(unidade.tipo, unidade.lado);
          const inicial = alvoDaDirecao(unidade.tipo, unidade.direcao, 0, 0, direcoesDoTipo(unidade.tipo));
          if (inicial) { item.direcao = inicial; item.virada = iniciarVirada(inicial, tempoDeAnimacao(estado.tick, alfa)); }
          desenhados.set(id, item);
        }
        const posicao = espera.semRecuo(id, { gx: unidade.gx, gy: unidade.gy, proximo: unidade.fsmData.caminho?.[0] }, posicaoDaUnidade(estado, unidade));
        const anterior = memoria.observar(id, estado.tick, posicao);
        const desenhada = interpolarPosicao(anterior, posicao, alfa, SALTO_MAXIMO_EM_TILES);
        const entradaAnimada = assetDaCamada(manifestoAnimado, 'unidade', unidade.tipo);
        const direcoes = direcoesDoTipo(unidade.tipo);
        if (direcoes !== null && !entradaAnimada?.atlas) {
          item.direcao = alvoDaDirecao(unidade.tipo, unidade.direcao, posicao.gx - anterior.gx, posicao.gy - anterior.gy, direcoes) ?? item.direcao;
        }
        const centro = gridToScreenCentro(desenhada, tilePx, ESCALA_DO_MUNDO);
        const desvio = deslocamentoDaUnidade(id, tilePx, ESCALA_DO_MUNDO);
        if (entradaAnimada?.atlas && mudouAnimacao) {
          const naVista = unidadeNaVista({ x: centro.x + desvio.x, y: centro.y + desvio.y },
            entradaAnimada.tamanho, entradaAnimada.anchor, vista) && !invisiveis.has(id);
          if (naVista) {
            const voltou = estado.tick < item.ultimoTickAnimado;
            if (voltou) {
              item.distancia = 0;
              item.virada = iniciarVirada('s', tempoDeAnimacao(estado.tick, alfa));
            }
            const salto = Math.hypot(posicao.gx - anterior.gx, posicao.gy - anterior.gy) > SALTO_MAXIMO_EM_TILES;
            item.distancia = somarDistancia(item.distancia, voltou ? null : item.ultimaPosicao, desenhada, SALTO_MAXIMO_EM_TILES, salto);
            const andando = posicao.gx !== anterior.gx || posicao.gy !== anterior.gy;
            const acao = acaoDaUnidade(unidade, andando, !invisiveis.has(id)) ?? 'parado';
            const registro = memoriasDeAcao?.get(id);
            if (item.animacao !== acao) item.inicioDaAcao = estado.tick;
            if (registro?.animacao === acao) item.inicioDaAcao = registro.inicio;
            const alvo = acao === 'trabalhar' ? direcaoDoTrabalho(estado, unidade)
              : alvoDaDirecao(unidade.tipo, unidade.direcao, posicao.gx - anterior.gx, posicao.gy - anterior.gy, direcoes);
            item.virada = acao === 'atacar' && alvo ? iniciarVirada(alvo, tempoDeAnimacao(estado.tick, alfa))
              : atualizarVirada(item.virada, alvo, tempoDeAnimacao(estado.tick, alfa), configAnimacao.passoDaViradaTicks);
            item.direcao = item.virada.visivel;
            item.acaoDoTrabalho = acao;
            item.animacao = animacaoDoGesto(estado, unidade,
              animacaoComCarga(acao, Boolean(unidade.fsmData.carga), entradaAnimada.animacoes), entradaAnimada.animacoes, gestoDoTrabalho);
            const animacao = entradaAnimada.animacoes?.[item.animacao];
            item.spriteAnimado = null;
            item.quadro = 0;
            if (animacao) {
              const decorrido = acao === 'atacar' || acao === 'trabalhar'
                ? Math.max(0, tempoDeAnimacao(estado.tick, alfa) - item.inicioDaAcao) : tempoDeAnimacao(estado.tick, alfa);
              item.quadro = acao === 'andar' ? quadroDoAndar(item.distancia, animacao.tilesPorCiclo ?? 1, animacao.quadros)
                : quadroPeloTempo(decorrido, tempo.tickHz, animacao);
              item.spriteAnimado = spriteDoAtlas(manifestoAnimado, unidade.tipo, item.animacao, item.direcao, item.quadro,
                (chave, frame) => cena.textures.exists(chave) && cena.textures.get(chave).has(frame));
            }
            animacoesTrabalhadas++;
          }
          item.ultimaPosicao = desenhada;
          item.ultimoTickAnimado = estado.tick;
        }
        const sprite = desenharSprite(item, unidade.tipo, direcoes);
        // F18f: duas unidades no mesmo tile caem no mesmo pixel e a de cima esconde a de baixo
        // inteira. O desvio e de DESENHO: some ao pixel e ao depth (assim a que desenha mais ao
        // sul segue na frente), nunca a posicao do tick, que continua sendo `posicao`.
        // G-TELA-OBREIRO-POR-TAREFA / G-TELA-ROCEIRO-NO-CAMPO: o desenho de quem trabalha vai para o lugar
        // do trabalho (o roceiro para dentro do campo, o obreiro alguns px para dentro da obra); a
        // posicao logica nao muda.
        const noTrabalho = deslocamentoDoTrabalho(estado, unidade, item.acaoDoTrabalho, gridToScreenCentro({ gx: 1, gy: 0 }, tilePx, ESCALA_DO_MUNDO).x - gridToScreenCentro({ gx: 0, gy: 0 }, tilePx, ESCALA_DO_MUNDO).x, gestoDoTrabalho, caixaDeTipoNoMapa);
        item.container.setPosition(centro.x + desvio.x + noTrabalho.x, centro.y + desvio.y + noTrabalho.y);
        item.container.setDepth(depthDeY(centro.y + desvio.y + noTrabalho.y));
        luz?.tingirPelaPosicao(item.imagem, centro.x + desvio.x + noTrabalho.x, centro.y + desvio.y + noTrabalho.y, `unidade:${id}`);
        const visivel = !invisiveis.has(id);
        item.container.setVisible(visivel);
        item.nome.setVisible(visivel);
        const carga = unidade.fsmData.carga ?? colheitaNasMaos(estado, unidade, gestoDoTrabalho);
        const marca = carga === null ? null : desenharCarga(item, carga);
        if (marca === null) {
          item.marcadorDeCarga.setVisible(false);
          item.iconeDaCarga?.setVisible(false);
          item.placaDoIcone?.setVisible(false);
        }
        const comFome = temMarcadorDeFome(unidade);
        item.marcadorDeFome.setVisible(comFome);
        const pensamento = visivel ? pensamentoNaTela(estado, unidade, CONFIG_DO_PENSAMENTO) : null;
        const balaoComo = desenharPensamento(item, pensamento);
        renderizadas.push({
          id, tipo: unidade.tipo, gx: posicao.gx, gy: posicao.gy,
          gxDesenhado: desenhada.gx, gyDesenhado: desenhada.gy, fsm: unidade.fsm, lado: unidade.lado, corDoBando: corDoBando(unidade.lado), carga, rotuloDaCarga: carga === null ? null : rotuloDaCarga(carga), marcaDaCarga: marca,
          deslocamentoPx: { x: desvio.x, y: desvio.y },
          marcadorDeFome: comFome, fracaoDeCondicao: fracaoDeCondicao(unidade),
          pensamento: pensamento === null ? null : pensamento.tipo === 'mercadoria' ? pensamento.mercadoria : pensamento.tipo, balaoComo,
          nome: item.nome.text, larguraDoRotuloPx: item.nome.width, visivel,
          profundidadeDoNome: item.nome.depth, profundidadeDoCorpo: item.container.depth, nomeVisivel: item.nome.visible,
          direcaoLogica: alvoDaDirecao(unidade.tipo, unidade.direcao, posicao.gx - anterior.gx, posicao.gy - anterior.gy, direcoes),
          direcao: direcoes === null ? null : item.direcao, sprite,
          ...(item.spriteAnimado && item.imagem ? {
            animacao: item.animacao, inicioDaAcao: item.inicioDaAcao, quadro: item.quadro, frame: item.imagem.frame.name,
            distanciaAnimada: item.distancia, espelhado: item.imagem.flipX,
            peY: peDoSprite(item.imagem),
          } : {}),
          corpoPx: sprite === null || item.imagem === null ? null : {
            x0: -item.imagem.originX * item.imagem.displayWidth, y0: -item.imagem.originY * item.imagem.displayHeight,
            x1: (1 - item.imagem.originX) * item.imagem.displayWidth, y1: (1 - item.imagem.originY) * item.imagem.displayHeight,
          },
        });
      }
    organizarRotulos();
      return renderizadas;
    },
  };
}
