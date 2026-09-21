/**
 * Contrato de depuracao publicado em `window` pela cena. Existe para o
 * runner de screenshot (Playwright) afirmar sobre o estado do app — "o mouse
 * esta sobre o tile (10,7)", "a camera bateu no limite" — em vez de adivinhar
 * por pixel. Toca `window`: por isso vive em `render/`, nunca em `sim/`
 * (invariante 1, CLAUDE.md §2).
 */
import type { Tile } from './grid';
import type { EstadoDaPlanta } from './planta-fantasma';
import type { PreviaDeEstrada } from './estradas';
import type { UnidadeRenderizada } from './unidades';

export interface EstadoDebug {
  /** false ate a cena terminar o primeiro desenho. O roteiro espera por isto
   *  antes de fotografar — sem isso a captura sai do canvas em branco. */
  pronto: boolean;
  tileSobMouse: Tile | null;
  camera: { readonly scrollX: number; readonly scrollY: number };
  /** Quantos tiles o tilemap desenhou de fato. Prova que o culling nativo do
   *  Phaser esta ligado: deve ficar bem abaixo de largura*altura do mapa. */
  tilesRenderizados: number;
  /** Quantos predios do GameState a cena tem desenhados agora (obras incluidas). */
  prediosRenderizados: number;
  /** Quantos deles estao em obra (F07): a marcacao no chao. */
  obrasRenderizadas: number;
  /** Quantos tiles de estrada (F08) a cena tem desenhados agora. */
  estradasRenderizadas: number;
  /** A previa do arrasto de estrada em curso, ou null. `custo` e a pedra que o
   *  trecho custaria; `valida` e o que `canPlaceRoad` respondeu. */
  previaDeEstrada: PreviaDeEstrada | null;
  /** Onde a cena centralizou a camera na abertura, em unidades de tile. Nao
   *  e `Tile` (render/grid.ts): pode ser fracionario (33, 31.5, ver
   *  sim/selectors.ts PontoEmTiles) e nao indexa o mapa. */
  centroDaVila: { readonly gx: number; readonly gy: number } | null;
  /** A planta fantasma desenhada agora, ou null se escondida. `valida` e o
   *  que `canPlace` respondeu; `motivo` e o porque quando nao pode. */
  plantaFantasma: EstadoDaPlanta | null;
  /** Predio que a ferramenta carrega (src/input/ferramenta.ts), ou null. */
  ferramentaAtiva: string | null;
  /** O tick do estado que a cena desenha agora. */
  tick: number;
  /** As unidades desenhadas agora (F10), na posicao que o selector `posicaoDaUnidade`
   *  devolveu — FRACIONARIA no meio de um passo. O roteiro afirma sobre isto. */
  unidadesRenderizadas: readonly UnidadeRenderizada[];
  /**
   * PONTE DE HARNESS DA F10 — nasce marcada para morrer.
   *
   * Roda `passos` ticks da sim (`sessao.passo()` `passos` vezes). Existe so para o roteiro de
   * screenshot mover o serf antes de haver o laco de 10 Hz (F11): nao e laco, nao ha timer,
   * tecla nem botao, nao e superficie de jogador. Ele ESCREVE NO ESTADO a partir do `window`
   * do jogo real, e por isso tem prazo: a F11 decide se ele SOME ou se VIRA pausar/retomar do
   * timer (decisao pendente registrada no item F11 do BUILD_PLAN.md). Nao usar em codigo de
   * jogo, nem em `ui/` nem em `input/`.
   */
  avancar: (passos: number) => void;
}

declare global {
  interface Window {
    __cangaco?: EstadoDebug;
  }
}

/**
 * Cria o objeto e o publica em `window.__cangaco`. Devolve a MESMA
 * referencia: a cena muta os campos ao vivo (pointermove, drag de camera),
 * e quem le `window.__cangaco` sempre ve o estado atual sem republicar.
 */
export function publicarEstadoDebug(avancar: (passos: number) => void): EstadoDebug {
  const estado: EstadoDebug = {
    pronto: false,
    tileSobMouse: null,
    camera: { scrollX: 0, scrollY: 0 },
    tilesRenderizados: 0,
    prediosRenderizados: 0,
    obrasRenderizadas: 0,
    estradasRenderizadas: 0,
    previaDeEstrada: null,
    centroDaVila: null,
    plantaFantasma: null,
    ferramentaAtiva: null,
    tick: 0,
    unidadesRenderizadas: [],
    avancar,
  };
  window.__cangaco = estado;
  return estado;
}
