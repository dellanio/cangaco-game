/**
 * As unidades na tela (F10). O render LE o estado e desenha: a posicao de cada tick vem de
 * `posicaoDaUnidade` (funcao pura do estado, em `sim/selectors.ts`) — o tile onde a unidade
 * esta mais a fracao do passo em curso. A F11a acrescenta por cima a interpolacao ENTRE ticks
 * (`interpolacao.ts`, com o `alfa` do laco): o que se desenha e o meio-termo entre a posicao
 * do tick anterior e a do atual. A posicao do tick anterior e memoria de RENDER (como o `Map`
 * de containers), nunca estado de jogo.
 *
 * Placeholder do CLAUDE.md §9: um retangulo com o id da unidade. Se a unidade leva carga
 * (`fsmData.carga`), o nome da mercadoria aparece em cima. `desenhados` e memoria de render
 * local — handle dos objetos que esta camada criou, nao estado de jogo (§10).
 *
 * Este arquivo NAO importa `sim/data` (so `mapa.ts` e `predios.ts` podem, teste estrutural da
 * F04): a paleta vem do tema e a posicao do selector.
 */
import Phaser from 'phaser';
import temaSertao from '../../data/theme-sertao.json';
import { depthDeY, gridToScreenCentro } from './grid';
import { criarMemoriaDePosicoes, interpolarPosicao } from './interpolacao';
import { posicaoDaUnidade } from '../sim/selectors';
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
}

export interface CamadaDeUnidades {
  /** `alfa`: fracao do tick em curso (`Laco.alfa()`), em [0, 1]. */
  atualizar(estado: GameState | null, alfa: number): readonly UnidadeRenderizada[];
}

/** Lado do quadrado da unidade, como fracao do tile (apresentacao, nao regra de jogo). */
const LADO_EM_TILES = 0.5;

/**
 * Acima disto (em tiles, 2D) entre o tick anterior e o atual a unidade NAO interpola, assenta.
 * Apresentacao, nao balanceamento: a 10 Hz uma unidade a pe anda ~0,2 tile por tick, entao 2 tiles
 * so aparece em reposicionamento (unidade nova, caminho refeito) ou num quadro que rodou varios
 * passos de uma vez.
 */
const SALTO_MAXIMO_EM_TILES = 2;

const cor = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;

interface Desenhado {
  readonly container: Phaser.GameObjects.Container;
  readonly marcadorDeCarga: Phaser.GameObjects.Text;
}

export function criarCamadaDeUnidades(cena: Phaser.Scene, tilePx: number): CamadaDeUnidades {
  const desenhados = new Map<string, Desenhado>();
  const memoria = criarMemoriaDePosicoes();
  const lado = tilePx * LADO_EM_TILES;

  function criar(id: string, tipo: string): Desenhado {
    const ehSerf = tipo === 'serf';
    const retangulo = cena.add.rectangle(0, 0, lado, lado, cor(ehSerf ? temaSertao.paleta.ocre : temaSertao.paleta.couro), 1);
    retangulo.setStrokeStyle(2, cor(temaSertao.paleta.madeira));
    const rotulo = cena.add.text(0, 0, id, { fontSize: '11px', color: '#2c1d12' });
    rotulo.setOrigin(0.5, 0.5);
    const marcadorDeCarga = cena.add.text(0, -lado * 0.9, '', {
      fontSize: '11px', color: '#ede3d0', backgroundColor: '#2c1d12', padding: { x: 3, y: 1 },
    });
    marcadorDeCarga.setOrigin(0.5, 0.5);
    marcadorDeCarga.setVisible(false);
    const container = cena.add.container(0, 0, [retangulo, rotulo, marcadorDeCarga]);
    return { container, marcadorDeCarga };
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
          item = criar(id, unidade.tipo);
          desenhados.set(id, item);
        }
        const posicao = posicaoDaUnidade(estado, unidade);
        const anterior = memoria.observar(id, estado.tick, posicao);
        const desenhada = interpolarPosicao(anterior, posicao, alfa, SALTO_MAXIMO_EM_TILES);
        const centro = gridToScreenCentro(desenhada, tilePx);
        item.container.setPosition(centro.x, centro.y);
        item.container.setDepth(depthDeY(centro.y));
        const carga = unidade.fsmData.carga ?? null;
        item.marcadorDeCarga.setText(carga ?? '');
        item.marcadorDeCarga.setVisible(carga !== null);
        renderizadas.push({
          id, tipo: unidade.tipo, gx: posicao.gx, gy: posicao.gy,
          gxDesenhado: desenhada.gx, gyDesenhado: desenhada.gy, fsm: unidade.fsm, carga,
        });
      }
      return renderizadas;
    },
  };
}
