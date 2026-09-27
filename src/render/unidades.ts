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
} from './grid';
import { criarMemoriaDePosicoes, interpolarPosicao } from './interpolacao';
import {
  ALTURA_DA_CARGA_EM_LADOS, ALTURA_DA_FOME_EM_LADOS, temMarcadorDeFome,
} from './marcador-de-fome';
import { nomeDaUnidade } from './nome-de-unidade';
import { direcoesDoTipo } from './direcoes-de-sprite';
import { direcaoDoPasso, spriteDaUnidade, POSE_PARADO } from './manifesto';
import type { Direcao } from './manifesto';
import { manifestoDoJogo } from './sprites';
import { posicaoDaUnidade } from '../sim/selectors';
import { fracaoDeCondicao } from '../sim/condicao';
import type { GameState } from '../sim/state';

/** O que a camada desenhou de uma unidade, para o roteiro afirmar (`window.__cangaco`). */
export interface UnidadeRenderizada {
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
  /** F20c — a condicao de 0 a 1 (`fracaoDeCondicao`), para o roteiro afirmar o limiar contra
   *  `data/condition.json` em vez de contra um numero escrito no roteiro. */
  readonly fracaoDeCondicao: number;
  /** F-D4 — o oficio escrito sob a unidade, vindo do tema pelo `tipo`. */
  readonly nome: string;
  /** F-SPR — a direcao para onde ela olha, ou null se o tipo nao declara `direcoesDeSprite`. */
  readonly direcao: Direcao | null;
  /** F-SPR — a chave da textura desenhada, ou null quando e o retangulo (placeholder). */
  readonly sprite: string | null;
  /**
   * F-D4 — largura DESENHADA desse rotulo, em px de mundo. E o que permite o roteiro afirmar
   * o encaixe com uma medida em vez de com uma impressao: o quadrado da unidade tem
   * `tilePx * LADO_DA_UNIDADE_EM_TILES` de lado, e o rotulo do oficio nao cabe dentro dele.
   */
  readonly larguraDoRotuloPx: number;
}

export interface CamadaDeUnidades {
  /** `alfa`: fracao do tick em curso (`Laco.alfa()`), em [0, 1]. */
  atualizar(estado: GameState | null, alfa: number): readonly UnidadeRenderizada[];
}

/**
 * Acima disto (em tiles, 2D) entre o tick anterior e o atual a unidade NAO interpola, assenta.
 * Apresentacao, nao balanceamento: a 10 Hz uma unidade a pe anda ~0,2 tile por tick, entao 2 tiles
 * so aparece em reposicionamento (unidade nova, caminho refeito) ou num quadro que rodou varios
 * passos de uma vez.
 */
const SALTO_MAXIMO_EM_TILES = 2;

/**
 * Onde o nome do oficio fica ABAIXO do centro da unidade, em multiplos do lado dela. O
 * quadrado vai ate 0,5 lado; o resto e a folga entre a borda e a primeira linha do texto.
 * Apresentacao, nao balanceamento.
 */
const ALTURA_DO_NOME_EM_LADOS = 0.6;

const cor = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

/** A cor do marcador de fome vem do tema por NOME da paleta (`marcadores.fome.cor`). */
const corDoMarcadorDeFome: string = (
  temaSertao.paleta as Record<string, string>
)[temaSertao.marcadores.fome.cor] ?? temaSertao.paleta.terraQueimada;

interface Desenhado {
  readonly container: Phaser.GameObjects.Container;
  readonly retangulo: Phaser.GameObjects.Rectangle;
  /** F-SPR — criado na primeira vez que a arte resolve; memoria de render. */
  imagem: Phaser.GameObjects.Image | null;
  /** F-SPR — a ultima direcao do passo; parada, a unidade continua olhando para ela. */
  direcao: Direcao;
  readonly nome: Phaser.GameObjects.Text;
  readonly marcadorDeCarga: Phaser.GameObjects.Text;
  readonly marcadorDeFome: Phaser.GameObjects.Text;
}

export function criarCamadaDeUnidades(cena: Phaser.Scene, tilePx: number): CamadaDeUnidades {
  const desenhados = new Map<string, Desenhado>();
  const memoria = criarMemoriaDePosicoes();
  const lado = tilePx * LADO_DA_UNIDADE_EM_TILES;

  function criar(tipo: string): Desenhado {
    const ehSerf = tipo === 'serf';
    const retangulo = cena.add.rectangle(0, 0, lado, lado, cor(ehSerf ? temaSertao.paleta.ocre : temaSertao.paleta.couro), 1);
    retangulo.setStrokeStyle(2, cor(temaSertao.paleta.madeira));
    // O texto e do JOGADOR: vem do tema pelo tipo neutro, nunca digitado aqui. `setOrigin(0.5, 0)`
    // ancora pelo TOPO, entao a folga sob o quadrado nao depende do tamanho da fonte.
    const rotulo = cena.add.text(0, lado * ALTURA_DO_NOME_EM_LADOS, nomeDaUnidade(tipo), {
      fontSize: '11px', color: temaSertao.paleta.cal, backgroundColor: '#2c1d12', padding: { x: 2, y: 0 },
    });
    rotulo.setOrigin(0.5, 0);
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
    const container = cena.add.container(0, 0, [retangulo, rotulo, marcadorDeCarga, marcadorDeFome]);
    return { container, retangulo, imagem: null, direcao: 's', nome: rotulo, marcadorDeCarga, marcadorDeFome };
  }

  /** F-SPR — troca o retangulo pelo sprite quando a arte resolve, e volta quando nao. */
  function desenharSprite(item: Desenhado, tipo: string, direcoes: 4 | 8 | null): string | null {
    const carregada = (chave: string): boolean => cena.textures.exists(chave);
    const sprite = spriteDaUnidade(manifestoDoJogo, tipo, POSE_PARADO, item.direcao, direcoes, carregada);
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
    item.imagem.setOrigin(sprite.entrada.anchor[0], sprite.entrada.anchor[1]);
    item.imagem.setFlipX(sprite.espelhar);
    item.imagem.setVisible(true);
    return sprite.chave;
  }

  /**
   * Mantém os nomes completos do tema, mas impede que unidades próximas
   * imprimam um rótulo por cima do outro. A primeira linha continua na posição
   * histórica; só quem colide desce para a próxima linha livre.
   */
  function organizarRotulos(): void {
    const ocupados: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const itens = [...desenhados.entries()].sort(([idA, a], [idB, b]) => (
      a.container.y - b.container.y
      || a.container.x - b.container.x
      || idA.localeCompare(idB)
    ));
    const baseY = lado * ALTURA_DO_NOME_EM_LADOS;
    const folga = 2;

    for (const [, item] of itens) {
      item.nome.setY(baseY);
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

      item.nome.setY(y0 - item.container.y);
      ocupados.push({ x0, y0, x1, y1: y0 + altura });
    }
  }

  return {
    atualizar(estado, alfa) {
      if (estado === null) return [];
      const vivas = new Set(estado.unidades.ordem);
      for (const [id, item] of desenhados) {
        if (!vivas.has(id)) {
          item.container.destroy();
          desenhados.delete(id);
          memoria.esquecer(id);
        }
      }
      const renderizadas: UnidadeRenderizada[] = [];
      for (const id of estado.unidades.ordem) {
        const unidade = estado.unidades.porId[id];
        if (!unidade) continue;
        let item = desenhados.get(id);
        if (!item) {
          item = criar(unidade.tipo);
          desenhados.set(id, item);
        }
        const posicao = posicaoDaUnidade(estado, unidade);
        const anterior = memoria.observar(id, estado.tick, posicao);
        const desenhada = interpolarPosicao(anterior, posicao, alfa, SALTO_MAXIMO_EM_TILES);
        const direcoes = direcoesDoTipo(unidade.tipo);
        if (direcoes !== null) {
          item.direcao = direcaoDoPasso(posicao.gx - anterior.gx, posicao.gy - anterior.gy, direcoes) ?? item.direcao;
        }
        const sprite = desenharSprite(item, unidade.tipo, direcoes);
        const centro = gridToScreenCentro(desenhada, tilePx, ESCALA_DO_MUNDO);
        // F18f: duas unidades no mesmo tile caem no mesmo pixel e a de cima esconde a de baixo
        // inteira. O desvio e de DESENHO: some ao pixel e ao depth (assim a que desenha mais ao
        // sul segue na frente), nunca a posicao do tick, que continua sendo `posicao`.
        const desvio = deslocamentoDaUnidade(id, tilePx, ESCALA_DO_MUNDO);
        item.container.setPosition(centro.x + desvio.x, centro.y + desvio.y);
        item.container.setDepth(depthDeY(centro.y + desvio.y));
        const carga = unidade.fsmData.carga ?? null;
        item.marcadorDeCarga.setText(carga ?? '');
        item.marcadorDeCarga.setVisible(carga !== null);
        const comFome = temMarcadorDeFome(unidade);
        item.marcadorDeFome.setVisible(comFome);
        renderizadas.push({
          id, tipo: unidade.tipo, gx: posicao.gx, gy: posicao.gy,
          gxDesenhado: desenhada.gx, gyDesenhado: desenhada.gy, fsm: unidade.fsm, carga,
          deslocamentoPx: { x: desvio.x, y: desvio.y },
          marcadorDeFome: comFome, fracaoDeCondicao: fracaoDeCondicao(unidade),
          nome: item.nome.text, larguraDoRotuloPx: item.nome.width,
          direcao: direcoes === null ? null : item.direcao, sprite,
        });
      }
    organizarRotulos();
      return renderizadas;
    },
  };
}
