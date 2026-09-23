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
import type { EstagioDaObra } from './estagio-obra';
import type { ItemDeFila } from '../sim/state';

/** O recorte de um predio que o roteiro le. Nao e `Predio`: so o que a tela
 *  precisa afirmar, para a ponte nao virar copia do GameState. */
export interface PredioNoDebug {
  readonly tipo: string;
  readonly estado: 'obra' | 'completo';
  readonly gx: number;
  readonly gy: number;
  readonly pausado: boolean;
  readonly ocupante: string | null;
}

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
  /** F16b — os predios do tick desenhado, por id, na leitura CRUA do estado. E o
   *  que o roteiro usa para achar o predio que quer clicar (a quarry que acabou
   *  de subir nao tem id fixo) e para afirmar sobre ocupante e pausa sem
   *  perguntar ao painel — o painel e justamente o que esta sendo provado. */
  prediosDoEstado: Readonly<Record<string, PredioNoDebug>>;
  /** Quantos deles estao em obra (F07): marcacao + madeira, F11c. */
  obrasRenderizadas: number;
  /** F11c: a mesma contagem acima, quebrada por estagio (`estagio-obra.ts`) — o
   *  roteiro de screenshot afirma sobre isto, nunca por pixel (§8). */
  estagiosDeObraRenderizados: Readonly<Record<EstagioDaObra, number>>;
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
  /** F13b — `GameState.treino` do tick desenhado: a fila de cada escola, por id de
   *  PREDIO. E o que o roteiro le quando o aceite pede "a fila no estado". */
  filaDeTreino: Readonly<Record<string, readonly ItemDeFila[]>>;
  /** As unidades desenhadas agora (F10), na posicao DO TICK que o selector `posicaoDaUnidade`
   *  devolveu — FRACIONARIA no meio de um passo, deterministica. O roteiro afirma sobre isto.
   *  A posicao interpolada (F11a) vem em `gxDesenhado/gyDesenhado`. */
  unidadesRenderizadas: readonly UnidadeRenderizada[];
  /** O laco de tempo esta pausado (F11a). Le o valor vivo do relogio, nao o do ultimo quadro. */
  readonly pausado: boolean;
  /** A velocidade de jogo atual (1x, 2x, 3x), valor vivo. */
  readonly velocidade: number;
  /** A fracao do tick em curso que a interpolacao esta usando, em [0, 1]. Vale 1 pausado. */
  readonly alfaDeInterpolacao: number;
  /**
   * Controle do relogio para o roteiro de screenshot (F11a; antes, a ponte `avancar` da F10).
   * Escrevem no estado a partir do `window` do jogo real, entao sao HARNESS: nao usar em codigo
   * de jogo, nem em `ui/` nem em `input/`. O runner abre a pagina com `?pausado`, e o roteiro que
   * quer tempo passando usa `avancar`, que LANCA se o timer estiver rodando — o que impede um
   * passo manual de disputar a sessao com o acumulador. (Decisao na Nota da F11a, BUILD_PLAN.)
   */
  pausar: () => void;
  retomar: () => void;
  avancar: (passos: number) => void;
}

/**
 * O que o render precisa saber do relogio: ler e, para o harness, mandar. E o `Laco`
 * (`src/laco.ts`) visto por uma interface estreita, para `render/` nao importar o laco externo.
 */
export interface RelogioVisivel {
  readonly pausado: boolean;
  readonly velocidade: number;
  alfa(): number;
  pausar(): void;
  retomar(): void;
  avancar(passos: number): void;
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
export function publicarEstadoDebug(relogio: RelogioVisivel): EstadoDebug {
  const estado: EstadoDebug = {
    pronto: false,
    tileSobMouse: null,
    camera: { scrollX: 0, scrollY: 0 },
    tilesRenderizados: 0,
    prediosRenderizados: 0,
    prediosDoEstado: {},
    obrasRenderizadas: 0,
    estagiosDeObraRenderizados: { marcacao: 0, madeira: 0, completo: 0 },
    estradasRenderizadas: 0,
    previaDeEstrada: null,
    centroDaVila: null,
    plantaFantasma: null,
    ferramentaAtiva: null,
    tick: 0,
    filaDeTreino: {},
    unidadesRenderizadas: [],
    // getters: sempre o valor vivo do relogio, sem esperar o proximo POST_RENDER
    get pausado() {
      return relogio.pausado;
    },
    get velocidade() {
      return relogio.velocidade;
    },
    get alfaDeInterpolacao() {
      return relogio.alfa();
    },
    pausar: () => relogio.pausar(),
    retomar: () => relogio.retomar(),
    avancar: (passos) => relogio.avancar(passos),
  };
  window.__cangaco = estado;
  return estado;
}
