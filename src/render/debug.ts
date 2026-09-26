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
import type { PreviaDeCampo } from './campos';
import type { UnidadeRenderizada } from './unidades';
import { contagemDeEstagios } from './estagio-obra';
import type { EstagioDaObra } from './estagio-obra';
import type { LinhaDoMedidor } from './medidor-obra';
import type { CanteiroDaObra } from './nivelamento-obra';
import type { ItemDeFila } from '../sim/state';
import { ATALHOS, GESTOS } from '../input/atalhos';

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
  /** F18a: `zoom` e o nivel da camera, nao um fator de desenho. O roteiro
   *  afirma sobre ele — nunca sobre pixel. */
  camera: { readonly scrollX: number; readonly scrollY: number; readonly zoom: number };
  /** F-D2: o estado da navegacao por teclado AGORA. `velocidade` em px de mundo
   *  por segundo — e sobre ela que o roteiro afirma o teto do dado, sem
   *  cronometrar pixel entre quadros. */
  navegacao: { readonly espacoApertado: boolean; readonly velocidade: number };
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
  /** Quantos deles estao em obra (F07): a soma dos cinco estagios EM OBRA
   *  (F17e); o `completo` fica de fora. */
  obrasRenderizadas: number;
  /** F11c: a mesma contagem acima, quebrada pelos SEIS estagios da F17e
   *  (`estagio-obra.ts`) — o roteiro de screenshot afirma sobre isto, nunca por
   *  pixel (§8). */
  estagiosDeObraRenderizados: Readonly<Record<EstagioDaObra, number>>;
  /** F17b — o medidor de cada OBRA desenhada agora, por id: quanto de cada
   *  material chegou e quanto o predio custa. Obra apenas; predio completo nao
   *  entra. O roteiro afirma sobre isto em vez de contar bloco por pixel (§8). */
  medidoresDeObra: Readonly<Record<string, readonly LinhaDoMedidor[]>>;
  /** F17d — o canteiro de cada OBRA desenhada agora, por id: quantos tiles do
   *  footprint ja foram aplainados, a fracao do tile em curso em oitavos e se o
   *  terreno acabou. Obra apenas, mesmo criterio de `medidoresDeObra`. E o que
   *  permite ao roteiro medir o canteiro ENCHENDO contra a primeira leitura, em
   *  vez de so conferir que ele nasceu certo — um canteiro congelado passaria
   *  numa foto unica (§8). */
  canteirosDeObra: Readonly<Record<string, CanteiroDaObra>>;
  /** F17f — com que TEXTURA cada predio foi desenhado agora, por id, ou `null`
   *  quando ele caiu no retangulo do §9 (sem entrada no manifesto, sem arquivo
   *  para o estagio, ou textura que o loader nao trouxe). Os dois lados na
   *  mesma estrutura: e assim que o roteiro prova que sprite e placeholder
   *  convivem, sem olhar pixel (§8). */
  spritesDePredio: Readonly<Record<string, string | null>>;
  /** F-T1 — quantos tiles de cada TIPO DE TERRENO estao dentro da vista da
   *  camera agora, lidos de volta da camada de chao ja desenhada. E o que
   *  permite ao roteiro afirmar "a camera esta em cima do lago" sem olhar
   *  pixel: a agua aparece na contagem, ou a tela esta mentindo. Vazio ate o
   *  primeiro POST_RENDER. */
  terrenoVisivel: Readonly<Record<string, number>>;
  /** F-T2a — quantos tiles de cada RECURSO estao dentro da vista da camera
   *  agora, lidos de volta da camada de marcadores. A chave e o id neutro do
   *  recurso (`rock`, `tree`, `fish`) mais `esgotado`, que e o tile que ja foi
   *  colhido ate o fim e ficou (regime `porAcao`). E sobre esta contagem que o
   *  roteiro afirma que o jogador VE a rocha antes de plantar a pedreira, e que
   *  a ve sumir depois — sem olhar pixel (§8). Vazio ate o primeiro
   *  POST_RENDER. */
  recursosVisiveis: Readonly<Record<string, number>>;
  /** F-SPR — os ids que resolveram ARTE do manifesto em cada camada de tile, lidos
   *  uma vez no `create` (a arte chega no `preload`). Lista vazia e o placeholder de
   *  hoje — cor chapada e marcador —, que e comportamento normal (§9). Vegetacao e o
   *  recurso que virou sprite em pe, e nao celula da tira. */
  arteDasCamadas: {
    readonly terreno: readonly string[];
    readonly recurso: readonly string[];
    readonly vegetacao: readonly string[];
  };
  /** F-SPR — quantos sprites de vegetacao a cena tem de pe agora (mapa inteiro). */
  vegetacaoRenderizada: number;
  /** Quantos tiles de estrada DE PE (F08) a cena tem desenhados agora. */
  estradasRenderizadas: number;
  /** F18d-2 — quantos tiles de CANTEIRO (`estradasPlanejadas`, F18d-1b) a cena tem
   *  desenhados agora: traçado que o jogador desenhou e o laborer ainda nao assentou.
   *  Os dois numeros juntos sao o que o roteiro afirma: o arrasto planeja, o tempo
   *  ergue, e a soma fecha em todo passo. */
  estradasPlanejadasRenderizadas: number;
  /** F18g — quanta pedra um serf ja entregou no canteiro e nenhum laborer assentou
   *  (soma de `state.pedraNoCanteiro`). `NoEstado` porque nao e desenhada: existe para
   *  o roteiro fechar a conta da pedra — a que saiu do armazem e a de pe, mais esta,
   *  mais a que esta na mao de serf. */
  pedraNoCanteiroNoEstado: number;
  /** A previa do arrasto de estrada em curso, ou null. `custo` e a pedra que o
   *  trecho custaria; `valida` e o que `canPlaceRoad` respondeu. */
  previaDeEstrada: PreviaDeEstrada | null;
  /** F18i — quantos tiles de CANTEIRO DE CAMPO a cena tem desenhados agora: terra
   *  que o jogador marcou e o laborer ainda nao arou. */
  camposPlanejadosRenderizados: number;
  /** F18i — quantos tiles de cultura aravel existem em `state.recursos`: campo
   *  PRONTO, contando as manchas que ja vinham do mapa. `NoEstado` e nao
   *  `Renderizados` porque quem desenha o tile arado e a camada de marcadores de
   *  recurso (`recursosVisiveis`), que conta so o que esta na vista da camera —
   *  este numero e do estado inteiro. E com ele que o roteiro fecha a soma:
   *  planejado que vira arado sai de um e entra no outro. */
  camposProntosNoEstado: number;
  /** F18i — a previa do arrasto de campo em curso (arar ou apagar), ou null.
   *  `valida` e o que `canPlowField` respondeu; na borracha, e "ha canteiro aqui". */
  previaDeCampo: PreviaDeCampo | null;
  /** Onde a cena centralizou a camera na abertura, em unidades de tile. Nao
   *  e `Tile` (render/grid.ts): pode ser fracionario (33, 31.5, ver
   *  sim/selectors.ts PontoEmTiles) e nao indexa o mapa. */
  centroDaVila: { readonly gx: number; readonly gy: number } | null;
  /** A planta fantasma desenhada agora, ou null se escondida. `valida` e o
   *  que `canPlace` respondeu; `motivo` e o porque quando nao pode. */
  plantaFantasma: EstadoDaPlanta | null;
  /** Predio que a ferramenta carrega (src/input/ferramenta.ts), ou null. */
  ferramentaAtiva: string | null;
  /**
   * F-D1 — o INVENTARIO de atalhos, publicado cru. E o que o roteiro compara com
   * a lista que a tela de ajuda mostra: a tela nao pode filtrar nem acrescentar.
   * Nao muda durante a partida — e uma constante de modulo, publicada aqui so
   * porque o roteiro nao consegue importar TypeScript.
   */
  atalhos: {
    readonly teclado: readonly { readonly id: string; readonly teclas: readonly string[] }[];
    readonly gestos: readonly string[];
  };
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
    camera: { scrollX: 0, scrollY: 0, zoom: 1 },
    navegacao: { espacoApertado: false, velocidade: 0 },
    tilesRenderizados: 0,
    prediosRenderizados: 0,
    prediosDoEstado: {},
    obrasRenderizadas: 0,
    estagiosDeObraRenderizados: contagemDeEstagios(),
    medidoresDeObra: {},
    canteirosDeObra: {},
    spritesDePredio: {},
    terrenoVisivel: {},
    recursosVisiveis: {},
    arteDasCamadas: { terreno: [], recurso: [], vegetacao: [] },
    vegetacaoRenderizada: 0,
    estradasRenderizadas: 0,
    estradasPlanejadasRenderizadas: 0,
    pedraNoCanteiroNoEstado: 0,
    previaDeEstrada: null,
    camposPlanejadosRenderizados: 0,
    camposProntosNoEstado: 0,
    previaDeCampo: null,
    centroDaVila: null,
    plantaFantasma: null,
    ferramentaAtiva: null,
    atalhos: {
      teclado: ATALHOS.map((a) => ({ id: a.id, teclas: a.teclas })),
      gestos: GESTOS.map((g) => g.id),
    },
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
