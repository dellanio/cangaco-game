import type { AnelDaAgua } from './agua-peixe';
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
import type { EstagioDaObra, RevelacaoDaObra } from './estagio-obra';
import type { LinhaDoMedidor } from './medidor-obra';
import type { CanteiroDaObra } from './nivelamento-obra';
import type { GavetaDaPilha } from './pilhas';
import type { ParticulaDaFumaca } from './fumaca';
import type { EstagioDaCultura } from './crescimento';
import type { ItemDeFila } from '../sim/state';
import { ATALHOS, GESTOS } from '../input/atalhos';
import { custoZerado, type CustoDoQuadro } from './custo-do-quadro';

/** O recorte de um predio que o roteiro le. Nao e `Predio`: so o que a tela
 *  precisa afirmar, para a ponte nao virar copia do GameState. */
export interface PredioNoDebug {
  readonly tipo: string;
  /** C-IA-03c — o dono, e a cor da bandeira desenhada. */
  readonly lado: number;
  readonly corDoBando: string;
  readonly estado: 'obra' | 'completo';
  readonly gx: number;
  readonly gy: number;
  /** F17g — o `hp` cru: o roteiro recalcula a revelacao a partir dele. */
  readonly hp: number;
  readonly pausado: boolean;
  readonly ocupante: string | null;
}

/** F-VIVO-a — uma pilha desenhada, como o roteiro a le. */
export interface PilhaNoDebug {
  readonly gaveta: GavetaDaPilha;
  readonly mercadoria: string;
  readonly n: number;
  /** O PNG `pilha` da mercadoria (F-VIVO-a). */
  readonly sprite: boolean;
  /** D-TELA-03b — o que desenhou a unidade da pilha: o PNG `pilha`, o icone da mercadoria ou o quadrado. */
  readonly fonte: 'pilha' | 'icone' | 'quadrado';
}

/** F-VIVO-b — o quadro de trabalho desenhado, como o roteiro o le. */
export interface QuadroNoDebug {
  readonly laco: string;
  readonly n: number;
  readonly sprite: boolean;
}

/** F-VIVO-e — o quadro do ocioso desenhado (1..8), como o roteiro o le. */
export interface OciosoNoDebug {
  readonly n: number;
  readonly sprite: boolean;
}

/** D-TELA-07 — a placa de pausado desenhada, e o corpo do predio, em px de mundo. */
export interface SinalDePausadoNoDebug {
  readonly texto: string;
  readonly placa: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly corpo: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

/** F-REPL-e — um tile replantado ainda crescendo, como o sprite o desenhou. */
export interface CrescimentoNoDebug {
  readonly estado: string;
  readonly fonte: 'png' | 'placeholder';
  readonly escala: number;
}

/** F-VIVO-c — um animal do curral desenhado: posicao, idade, quadro do laco e se
 *  foi PNG (`sprite`) ou o losango do §9. */
export interface AnimalNoDebug {
  readonly i: number;
  readonly animal: string;
  readonly idade: number;
  readonly quadro: number;
  readonly sprite: boolean;
}

/** F-VIVO-d — o tamanho em px de MUNDO de cada camada de um predio com receita, lido
 *  da mesma geometria que o desenho usa. Na tela e isto vezes `camera.zoom`. */
/** F-ESC (c) — ver `caixasDesenhadas`. */
export interface CaixaDesenhada {
  readonly tipo: string;
  readonly textura: string;
  readonly w: number;
  readonly h: number;
  readonly lote: number;
}

export interface CamadasEmPx {
  readonly tipo: string;
  readonly caso: string;
  /** A caixa do sprite `completo` (o canvas do PNG escalado), ou o lote sem PNG. */
  readonly corpo: readonly [number, number];
  /** A area do quadro de trabalho, ou `null` quando o predio nao anima agora. */
  readonly trabalho: readonly [number, number] | null;
  /** O lado de uma unidade de pilha, ou `null` sem pilha desenhada. */
  readonly pilha: number | null;
  /** O lado de cada animal do curral, ou `null` com o curral vazio. */
  readonly animais: readonly number[] | null;
}

/** D-TELA-LUZ-RELEVO — a luz do relevo, publicada SO quando o relevo foi pedido (flag do dado ou
 *  `?relevo`): com ele desligado, o campo nao existe e o `__cangaco` fica igual ao de antes. */
export interface RelevoNoDebug {
  readonly ativo: true;
  /** O px por degrau em uso (o do dado, ou o `?relevoPx` do roteiro). */
  readonly pxDeMundoPorDegrau: number;
  /** [largura, altura] da grade de VERTICES. */
  readonly vertices: readonly [number, number];
  /** O menor e o maior fator de luz do chao no mapa. */
  readonly faixa: readonly [number, number];
  /** Rotulo -> fator aplicado no tint: 'predio:<id>', 'unidade:<id>', 'vegetacao:<gx,gy>'. O fator
   *  e o do chao sob o pe, ANTES do teto do sprite (o cinza do tint e min(fator, teto)). */
  readonly fatores: Record<string, number>;
  /** Quantas vezes cada rotulo foi tingido: o predio recriado (troca de estagio) e a unidade que
   *  cruza de tile somam um; o roteiro afirma que o tint acompanha a recriacao. */
  readonly tintagens: Record<string, number>;
  /** Quantos `Image` a ultima tintagem do rotulo atingiu: a obra em "marcacao no chao" e so
   *  retangulo e texto (0), e o roteiro espera o sprite antes de afirmar o tint do predio. */
  readonly imagens: Record<string, number>;
}

export interface EstadoDebug {
  /** O renderizador ativo: `tipo` e `game.renderer.type`, `webgl` e `Phaser.WEBGL`. O
   *  roteiro compara os dois sem importar o Phaser. */
  renderizador: { readonly tipo: number; readonly webgl: number };
  /** D-TELA-LUZ-RELEVO — ausente com o relevo desligado. */
  relevo?: RelevoNoDebug;
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
   *  (F17e), mais as obras reveladas (F17g); o `completo` fica de fora. */
  obrasRenderizadas: number;
  /** F11c: a mesma contagem acima, quebrada pelos SEIS estagios da F17e
   *  (`estagio-obra.ts`) — o roteiro de screenshot afirma sobre isto, nunca por
   *  pixel (§8). */
  estagiosDeObraRenderizados: Readonly<Record<EstagioDaObra, number>>;
  /** F17g — as obras de predio com o PAR no manifesto, por id: quanto da madeira
   *  e quanto da pedra a tela revelou, as MESMAS fracoes de `revelacaoDaObra`.
   *  Quem esta aqui nao conta em `estagiosDeObraRenderizados`: e um desenho ou
   *  o outro. */
  revelacaoDasObras: Readonly<Record<string, RevelacaoDaObra>>;
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
  /** Os predios que `?semArte=` tirou do loader (`prediosSemArteDaBusca`): o
   *  roteiro confere que a pagina leu o parametro, em vez de passar calado. */
  prediosSemArte: readonly string[];
  /** F-VIVO-a — as pilhas que a cena DESENHOU agora, por id de predio: gaveta,
   *  mercadoria, quantas unidades e se foi PNG (`sprite`) ou o quadrado do §9. Vem
   *  da mesma lista que o desenho usa (`pilhas.ts`), e so tem predio com pilha. */
  pilhasDesenhadas: Readonly<Record<string, readonly PilhaNoDebug[]>>;
  /** F-VIVO-b — o quadro de trabalho que a cena DESENHOU agora, por id de predio. So
   *  tem predio animando: parado (sem ocupante, sem insumo, saida cheia, pausado) nao
   *  aparece. Vem da mesma chamada que o desenho usa (`trabalho.ts`). */
  quadrosDeTrabalho: Readonly<Record<string, QuadroNoDebug>>;
  /** F-VIVO-e — o ocioso que a cena DESENHOU agora, por id de predio: casa com o ocupante
   *  dentro e sem quadro de trabalho (`quadroOcioso`, `trabalho.ts`). */
  quadrosOciosos: Readonly<Record<string, OciosoNoDebug>>;
  /** F-VIVO-h — o laco `treino` que a cena DESENHOU agora, por id de escola: so escola com
   *  item `treinando` na fila (`quadroDaEscola`, `trabalho.ts`). */
  quadrosDaEscola: Readonly<Record<string, OciosoNoDebug>>;
  /** D-TELA-07 — a placa de pausado que a cena DESENHOU agora, por id de predio: so predio
   *  completo e pausado (`temSinalDePausado`, `sinal-de-pausado.ts`). */
  sinaisDePausado: Readonly<Record<string, SinalDePausadoNoDebug>>;
  /** F-VIVO-c — os animais que a cena DESENHOU agora, por id de predio. So tem
   *  criacao com curral cheio (`animais.ts`); curral vazio nao aparece. */
  animaisDoCurral: Readonly<Record<string, readonly AnimalNoDebug[]>>;
  /** F-VIVO-d — as camadas desenhadas, em px de mundo, por id de predio com receita. */
  camadasEmPx: Readonly<Record<string, CamadasEmPx>>;
  /** F-ESC (c) — a caixa que o sprite do predio COMPLETO ocupa na tela, em px de mundo,
   *  lida de volta da imagem desenhada (`displayWidth`/`displayHeight`), e a largura do
   *  lote. O roteiro confere `h <= teto x lote` com o teto que ele le do manifesto. */
  caixasDesenhadas: Readonly<Record<string, CaixaDesenhada>>;
  /** F28b — quantas pedras de torre a cena desenhou desde que abriu, e a ultima. */
  pedrasDaTorre: number;
  ultimaPedra: { readonly predio: string; readonly alvo: { readonly gx: number; readonly gy: number }; readonly vitima: string } | null;
  /** C2b — os projeteis desenhados neste quadro, com a fracao do voo (0 a 1) e a posicao
   *  em tiles. O roteiro afirma por aqui, nunca pelo pixel. */
  projeteisNoAr: readonly { readonly projetil: string; readonly fracao: number; readonly gx: number; readonly gy: number; readonly altura: number }[];
  /** F26b — as unidades que ganharam o anel de selecao NESTE quadro (lido do desenho). */
  selecaoMilitar: readonly string[];
  /** F26b — a caixa de selecao desenhada agora, em px de mundo, ou `null`. */
  caixaDeSelecao: { readonly a: { readonly x: number; readonly y: number }; readonly b: { readonly x: number; readonly y: number } } | null;
  /** C-TELA-02 — o tile do destino marcado NESTE quadro, ou `null` quando a marca sumiu. */
  marcadorDeDestino: { readonly gx: number; readonly gy: number } | null;
  /** F-T1 — quantos tiles de cada TIPO DE TERRENO estao dentro da vista da
   *  camera agora, lidos de volta da camada de chao ja desenhada. E o que
   *  permite ao roteiro afirmar "a camera esta em cima do lago" sem olhar
   *  pixel: a agua aparece na contagem, ou a tela esta mentindo. Vazio ate o
   *  primeiro POST_RENDER. */
  terrenoVisivel: Readonly<Record<string, number>>;
  /** Agua lida da camada de terreno na vista, depois da troca do tick. */
  variantesDaAguaVisivel: Readonly<Record<string, string>>;
  /** Quantas celulas da camada mudaram no ultimo tick observado. */
  celulasDaAguaTrocadas: number;
  /** Particulas visiveis, inclusive tile para o roteiro conferir agua. */
  poeiraDesenhada: readonly { readonly id: string; readonly tipo: 'poeira' | 'palha'; readonly evento: 'rajada' | 'redemoinho'; readonly gx: number; readonly gy: number }[];
  rajadaNaVista: number;
  /** Total de objetos da camada criados desde o inicio. */
  poolDaPoeira: number;
  aneisDaAgua: readonly AnelDaAgua[];
  poolDosAneis: number;
  trabalhoDosAneisNoQuadro: number;
  /** Particulas visiveis da chamine, por id de predio, em tiles de mundo. */
  fumacaPorPredio: Readonly<Record<string, readonly ParticulaDaFumaca[]>>;
  poolDaFumaca: number;
  /** F-T2a — quantos tiles de cada RECURSO estao dentro da vista da camera
   *  agora, lidos de volta da camada de marcadores. A chave e o id neutro do
   *  recurso (`rock`, `tree`, `fish`) mais `esgotado`, que e o tile que ja foi
   *  colhido ate o fim e ficou (regime `porAcao`). E sobre esta contagem que o
   *  roteiro afirma que o jogador VE a rocha antes de plantar a pedreira, e que
   *  a ve sumir depois — sem olhar pixel (§8). Vazio ate o primeiro
   *  POST_RENDER. */
  recursosVisiveis: Readonly<Record<string, number>>;
  /** Tiles de chao da cana efetivamente desenhados na vista da camera. */
  chaoDaCanaDesenhado: number;
  /** Recursos examinados pelo chao da cana neste quadro; zero no quadro repetido. */
  recursosVarridosPeloChao: number;
  /** F-TR — mascara N/L/S/O de cada tile de `rock` ainda presente. O roteiro
   *  compara antes/depois quando um tile esgota; nao e estado da simulacao. */
  mascarasDoLajedo: Readonly<Record<string, number>>;
  /** F-TR-b — o estado da textura que cada sprite de `rock` DESENHA agora (`m0`..`m15`,
   *  ou `presente` sem a arte da mascara), lido de volta da imagem e nao recalculado.
   *  O roteiro confere contra a mascara que ele mesmo tira do conjunto de rochas. */
  lajedoDesenhado: Readonly<Record<string, string>>;
  /** F-TR — a fonte de cada variante do chao, por tipo de terreno: o arquivo da arte que
   *  a tira recebeu, ou `cor:<hex>` onde ficou o placeholder. Lida uma vez no `create`.
   *  O roteiro afirma que dois tipos nao dividem fonte. */
  texturaDoTerreno: Readonly<Record<string, readonly string[]>>;
  /** F-TR — mascara N/L/S/O de cada tile de transicao dentro da vista, por familia
   *  (`agua`, `areia-grama`, `rocha-grama`), lida de volta das camadas de borda como
   *  `terrenoVisivel`. O roteiro recalcula do mapa e compara. */
  transicoesVisiveis: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** F-REPL-e — o tile de vegetacao replantado que ainda cresce: o estado que o
   *  sprite desenha, se veio de PNG ou do placeholder (a adulta encolhida), e a escala. */
  crescimentoDasArvores: Readonly<Record<string, CrescimentoNoDebug>>;
  /** BUG-W — o estagio que cada tile de CULTURA com relogio desenha agora (o que tem
   *  `semeadoEm`); o tile do mapa, sem relogio, nao entra. O roteiro le daqui. */
  estagiosDasCulturas: Readonly<Record<string, EstagioDaCultura>>;
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
  rochasRenderizadas: number;
  /** D-TELA-VENTO-VEGETACAO — sprites atualizados pelo vento neste quadro. */
  vegetacaoBalancando: number;
  /** Tick em que cada arvore da vista recebeu a ultima rotacao. */
  ticksDaVegetacaoNaVista: Readonly<Record<string, number>>;
  arvoresDoVentoNaVista: Readonly<Record<string, { readonly especie: string; readonly anguloGraus: number }>>;
  custo: CustoDoQuadro;
  zerarCusto: () => void;
  /** Controle de medicao do render; nao altera o estado da sim. */
  ligarVento: (ligado: boolean) => void;
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
  /**
   * D-TELA-CAPTURA-DETERMINISTICA — HARNESS, como `pausar`/`avancar`: poe a camera num scroll exato,
   * para o roteiro nao depender de setas seguradas por tempo de parede. Nao usar em codigo de jogo,
   * `ui/` nem `input/`. A cena a liga na `create`; antes disso nao faz nada.
   */
  fixarCamera: (scroll: { readonly scrollX?: number; readonly scrollY?: number }) => void;
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
    revelacaoDasObras: {},
    medidoresDeObra: {},
    canteirosDeObra: {},
    spritesDePredio: {},
    prediosSemArte: [],
    pilhasDesenhadas: {},
    quadrosDeTrabalho: {},
    quadrosOciosos: {},
    quadrosDaEscola: {},
    sinaisDePausado: {},
    animaisDoCurral: {},
    camadasEmPx: {},
    caixasDesenhadas: {},
    selecaoMilitar: [],
    pedrasDaTorre: 0,
    ultimaPedra: null,
    projeteisNoAr: [],
    caixaDeSelecao: null,
    marcadorDeDestino: null,
    terrenoVisivel: {},
    variantesDaAguaVisivel: {},
    celulasDaAguaTrocadas: 0,
    aneisDaAgua: [], poolDosAneis: 0, trabalhoDosAneisNoQuadro: 0,
    poeiraDesenhada: [],
    rajadaNaVista: 0,
    poolDaPoeira: 0,
    fumacaPorPredio: {},
    poolDaFumaca: 0,
    recursosVisiveis: {},
    chaoDaCanaDesenhado: 0,
    recursosVarridosPeloChao: 0,
    mascarasDoLajedo: {},
    lajedoDesenhado: {},
    texturaDoTerreno: {},
    transicoesVisiveis: {},
    crescimentoDasArvores: {},
    estagiosDasCulturas: {},
    arteDasCamadas: { terreno: [], recurso: [], vegetacao: [] },
    vegetacaoRenderizada: 0,
    rochasRenderizadas: 0,
    vegetacaoBalancando: 0,
    ticksDaVegetacaoNaVista: {},
    arvoresDoVentoNaVista: {},
    custo: custoZerado(),
    zerarCusto: () => { estado.custo = custoZerado(); },
    ligarVento: () => undefined,
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
    renderizador: { tipo: -1, webgl: -1 },
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
    fixarCamera: () => undefined,
  };
  window.__cangaco = estado;
  return estado;
}
