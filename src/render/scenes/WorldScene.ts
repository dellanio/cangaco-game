import dadosDaBandeira from '../../../data/bandeira.json';
import { recursoSubmerso } from '../recurso-submerso';
import { transformacaoDoClima } from '../cobertura-clima';
import { candidatosAEnfeite, MemoriaDosEnfeites } from '../enfeites';
import { sementeDoMapa, centroDaVilaInicial } from '../mapa';
import { corComTom, panoDaBandeira, tonsDoPano } from '../bandeira';
import { configDaSerra, MemoriaDaSerra, texturaDaSerra } from '../serra';
import { rendimentoDaRocha } from '../mapa';
import { rendimentosDasFontes } from '../mapa';
import { configDasFontes, MemoriaDasFontes, texturaDaFonte } from '../fontes-naturais';
// A cena so le o estado (aqui, so gameData/tema e o GameState via ponte) e
// desenha. Nada de logica de jogo (CLAUDE.md §10): nenhuma decisao de regra
// mora aqui, so apresentacao.
import Phaser from 'phaser';
import { extrudarTira, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA } from '../extrusao-de-tira';
import temaSertao from '../../../data/theme-sertao.json';
import dadosDoVento from '../../../data/vento.json';
import dadosDosAneis from '../../../data/agua-peixe.json';
import { aneisDaAgua, pescadoresNaAgua } from '../agua-peixe';
import agua from '../../../data/agua.json';
import dadosDaPoeira from '../../../data/poeira.json';
import dadosDaFumaca from '../../../data/fumaca.json';
import dadosDoPensamento from '../../../data/pensamento.json';
import { CHAVE_DO_MARTELO } from '../pensamento';
import { faseNoTick, ticksParaAmadurecer } from '../../sim/clima';
import { degrauDaCaatinga, texturaDaCaatinga } from '../caatinga';
import dadosDoClimaVisualCru from '../../../data/clima-visual.json';
import { gotasDaChuva, particulasDoCalor, veuDaEstacao } from '../clima-visual';
import type { ConfigDoClimaVisual } from '../clima-visual';
import dadosDoPadreVisualCru from '../../../data/padre-visual.json';
import { desenhoDoPadre } from '../padre-visual';
import type { ConfigDoPadreVisual } from '../padre-visual';
const dadosDoPadreVisual = dadosDoPadreVisualCru as ConfigDoPadreVisual;
const dadosDoClimaVisual = dadosDoClimaVisualCru as ConfigDoClimaVisual;
import dadosDaObraRevelada from '../../../data/obra-revelacao.json';
import { ladoDaMercadoriaNoEstoque, ladoPadraoDoEstoque, pilhasVisiveisDoPredio, posicoesDaMercadoriaNoEstoque, posicoesGiradas, pontosDosPeixesPendurados, rotacaoDaMercadoriaNoEstoque } from '../estoque-visual';
import { blocosVisiveis, recorteDoBloco, revelacaoVisualDaObra } from '../obra-revelacao';
import type { GradeDaObra } from '../obra-revelacao';
import { chaminesRemovidas, particulasDaFumaca, type ParticulaDaFumaca } from '../fumaca';
import { particulasDaFagulha } from '../fagulha';
import { celulasDaAguaParaTrocar } from '../agua-viva';
import { particulasDaPoeira, rajadaNaVista } from '../poeira';
import { codigoDoRecurso, configDoMapa, recursosDeRender, terrenoDeRender } from '../mapa';
import { geometriaDaCultura, texturaDoEstagioDaCultura } from '../culturas-visual';
import { CHAOS_DA_ROCA, chaoDaRoca, indiceDoChao, quadroDoChaoDaCanaMudou } from '../chao-da-roca';
import {
  gridToScreen, screenToGrid, deslocamentoDaUnidade, depthDeY, tileDentroDoMapa, ESCALA_DO_MUNDO, PROFUNDIDADE_DA_SELECAO,
} from '../grid';
import { proximoNivel, mundoSobPonto, scrollAncorado } from '../zoom';
import type { Navegacao } from '../../input/navegacao';
import type { Tile } from '../grid';
import { publicarEstadoDebug } from '../debug';
import { terrenoRecebeDetalhe } from '../detalhes-do-terreno';
import { somarCusto } from '../custo-do-quadro';
import { nevoaNaTela, PROFUNDIDADE_DA_NEVOA, prediosInimigosForaDaVista, resumoDaNevoa, texturaDaNevoa } from '../nevoa';
import { criarCamadaDeRelevo } from '../camada-de-relevo';
import { arvoreNaVista, balancaVegetacao, especieDoTile, quadroDoVentoMudou, transformacaoDoVento } from '../vento';
import type { LuzDoRelevo } from '../camada-de-relevo';
import { marcadorVisivel } from '../marcador-de-destino';
import type { MarcadorDeDestino } from '../marcador-de-destino';
import type {
  AnimalNoDebug, CaixaDesenhada, ComensalNoDebug, CamadasEmPx, CrescimentoNoDebug, EstadoDebug, OciosoNoDebug, PilhaNoDebug, PredioNoDebug, QuadroNoDebug, RelogioVisivel, SinalDePausadoNoDebug,
} from '../debug';
import { aparenciaDoPredio, capacidadeDoAcude, corDaPilha, dadosDasPilhas, dadosDosAnimais, dadosDoTrabalho, ordemDasMercadorias, raioDaBencao } from '../predios';
import dadosDoAcudeVisualCru from '../../../data/acude-visual.json';
import { estadoDoAcude } from '../acude-visual';
import type { ConfigDoAcudeVisual, EstadoDoAcude } from '../acude-visual';
const dadosDoAcudeVisual = dadosDoAcudeVisualCru as ConfigDoAcudeVisual;
import { animaisDoCurral, curralDesenhado, quadroDoAnimal } from '../animais';
import { MAX_PASSOS_POR_QUADRO } from '../../laco';
import type { AnimalDoCurral } from '../animais';
import { comensaisDaBodega, ESCALA_DO_COMENSAL, quadroDoComensal } from '../comensais';
import { lerModoAdmin } from '../modo-admin';
import { ligarGradacaoDeCor, ligarSombrasDeContato } from '../visual-premium';
import { visualPremium } from '../visual-premium-regra';
import type { SombrasDeContato } from '../visual-premium';
import type { ComensalNaMesa } from '../comensais';
import type { PilhaDesenhada } from '../pilhas';
import { areaDoTrabalho, quadroDaEscola, quadroDaFumaca, quadroDeTrabalho, quadroOcioso } from '../trabalho';
import type { QuadroDeTrabalho } from '../trabalho';
import { caixaDoSinalDePausado, temSinalDePausado, TEXTO_DO_SINAL_DE_PAUSADO } from '../sinal-de-pausado';
import { CASO_DO_PREDIO, ID_DA_FUMACA, ID_DO_COMENSAL, ID_DO_OCIOSO, LACO_DA_ESCOLA, LACO_DO_COMENSAL } from '../manifesto-camadas';
import { medidorDaObra } from '../medidor-obra';
import type { LinhaDoMedidor } from '../medidor-obra';
import { canteiroDaObra, chaveDoCanteiro, ordemDeNivelamento } from '../nivelamento-obra';
import { cordasDoLote } from '../corda-do-canteiro';
import { arvoreNaTela } from '../corte-da-arvore';
import { blocoDoMacico, ID_DO_MACICO, VEIOS_NA_MONTANHA } from '../macico';
import dadosDosRecursos from '../../../data/resources.json';
import { ordemDeConstrucao, PASSOS as PASSOS_DA_OBRA } from '../ordem-de-construcao';
import type { CamadaDaObra } from '../ordem-de-construcao';
import type { CanteiroDaObra } from '../nivelamento-obra';
import {
  chaveDaRevelacao, contagemDeEstagios, estagioDoPredio, estaEmObra, ORDEM_DOS_ESTAGIOS,
} from '../estagio-obra';
import type { EstagioDaObra, Fracao, RevelacaoDaObra } from '../estagio-obra';
import { centroDaVila } from '../../sim/selectors';
import { corDoBando } from '../cor-do-bando';
import { tileDeChave } from '../../sim/estradas';
import type { EstadoDePredio, GameState, Predio, PredioCompleto, RecursoNoTile, Tarefa, Unidade } from '../../sim/state';
import { ID_DO_ACUDE } from '../../sim/state';
import type { PonteDeEstado } from '../ponte';
import type { Ferramenta } from '../../input/ferramenta';
import type { EntradaDoMapa } from '../../input/colocar';
import { criarPlantaFantasma } from '../planta-fantasma';
import { criarCamadaDeEstradas, criarPreviaDeEstrada } from '../estradas';
import { criarCamadaDeCampos, criarPreviaDeCampo } from '../campos';
import { criarCamadaDeUnidades } from '../unidades';
import { depuracaoRegistrada } from '../registro-de-depuracao';
import { depuracaoDeUnidade, spriteDoAtlas } from '../animacao-de-unidade';
import { DIRECOES } from '../manifesto';
import { peDoSprite } from '../pe-do-sprite';
import { memoriaDeTexturas } from '../memoria-de-texturas';
import { criarCamadaDeMortes } from '../mortes-de-unidades';
import { tempoDeAnimacao } from '../animacao-de-unidade';
import { criarCargaDeUnidades, pedidosDeUnidade, tiposPresentes } from '../carregamento-de-unidades';
import { urlsDeSprites } from '../sprites-urls';
import { posicaoDoProjetil } from '../projeteis';
import {
  assetDaCamada, assetDoPredio, arquivoDoEstagio, chaveDaTextura, chaveDeTextura, desenhoDoRecurso,
  texturaDaCamada, ESTADO_DO_TERRENO,
} from '../manifesto';
import type { ChaveDaRevelacao, DesenhoDoRecurso, EntradaDeAsset, TexturaCarregada } from '../manifesto';
import {
  ALFA_DO_ESTAGIO, escalaDoPlaceholder, especiesDaVegetacao, estadoDeCrescimento, estagioDaCultura,
  temArteJuvenilDaEspecie, especieDoVentoDaVegetacao,
  type EstadoDeCrescimento, type EstagioDaCultura,
} from '../crescimento';
import { iconesDoJogo, manifestoDoJogo, prediosSemArteDaBusca, texturasDosIcones, texturasParaCarregar, atlasesParaCarregar } from '../sprites';
import { COR_DA_PLACA_DO_ICONE, fonteDaPilha, iconeNaPilha } from '../icone-da-mercadoria';
import dadosDaCargaNasMaos from '../../../data/carga-nas-maos.json';
import type { FonteDaPilha } from '../icone-da-mercadoria';
import { escalaDoSprite, regraDeLarguraDoManifesto, regraDoManifesto } from '../escala-predio';
import { unidadesNaCaixa, unidadesNoPonto } from '../acerto';
import { geometriaDoAnel, larguraDoTracoDeSelecao } from '../selecao-visual';
import type { UnidadeDesenhada } from '../acerto';
import type { SelecaoMilitar } from '../../input/selecao-militar';
import { mascaraCardinal, VIZINHOS_CARDINAIS } from '../mascara-cardinal';

/** F-TELA-NEVOA — a chave da textura da nevoa no TextureManager. */
const CHAVE_DA_NEVOA = 'nevoa-do-jogador';

const CHAVE_TEXTURA_TERRENO = 'tiles-terreno';
const ESTADOS_DO_TERRENO = [ESTADO_DO_TERRENO, 'v1', 'v2', 'v3'] as const;
const VARIANTES_DE_TERRENO = ESTADOS_DO_TERRENO.length;
const CHAVE_TEXTURA_BORDA_AGUA = 'tiles-borda-agua';
const ESTADOS_DA_BORDA_AGUA = Array.from({ length: 16 }, (_v, mascara) => `borda-m${mascara}`);
const CHAVE_TEXTURA_AREIA_GRAMA = 'tiles-areia-grama';
const ESTADOS_DA_BORDA_AREIA_GRAMA = Array.from(
  { length: 16 }, (_v, mascara) => `borda-grama-m${mascara}`,
);
const CHAVE_TEXTURA_ROCHA_GRAMA = 'tiles-rocha-grama';
const ESTADOS_DA_BORDA_ROCHA_GRAMA = Array.from(
  { length: 16 }, (_v, mascara) => `borda-grama-m${mascara}`,
);
const CHAVE_TEXTURA_DETALHES = 'tiles-detalhes-terreno';
const VARIANTES_DE_DETALHE = 3;
const CHAVE_TEXTURA_RECURSO = 'tiles-recurso';
const CHAVE_TEXTURA_CHAO_DA_CANA = 'tiles-chao-da-cana';
// Acima do chao (0) e abaixo da estrada (1, `render/estradas.ts`): a rua que o
// jogador assentou cobre o marcador, como cobre o chao. O recurso continua no
// estado; quem o le e a simulacao, nao o pixel.
const DEPTH_DOS_RECURSOS = 0.5;
/** F-VIVO-a — o dado das pilhas, com as ancoras do manifesto. Montado uma vez. */
const DADOS_DAS_PILHAS = dadosDasPilhas(manifestoDoJogo);
const DADOS_DOS_ANIMAIS = dadosDosAnimais(manifestoDoJogo);
/** I-ARTE-MARCACAO-DO-CANTEIRO — as pecas do lote em obra (uma entrada `interface` `canteiro-<peca>` cada), a escala em que a arte
 *  foi desenhada (um tile de 64 px) e a espessura do cordel nessa escala. */
const ID_DO_CANTEIRO = 'canteiro';
const PECAS_DO_CANTEIRO = ['estaca', 'cordel-h', 'cordel-v', 'terra'] as const;
const TILE_DA_ARTE_DO_CANTEIRO = 64;
const ESPESSURA_DO_CORDEL = 8;
/** I-TELA-CORDA-ENTRE-AS-ESTACAS — a corda amarrada a 34 px do pe da estaca (de 40, na arte), cedendo 3% do vao, ate 6 px;
 *  sisal com uma linha escura por baixo. Desenho, nao balanceamento. */
const FORMA_DA_CORDA = { alturaDoNo: 34, cedePorPx: 0.03, barrigaMaxima: 6 } as const;
const COR_DA_CORDA = 0xd8b77a;
const COR_DA_SOMBRA_DA_CORDA = 0x4a321c;
/** F-VIVO-b — o dado do quadro de trabalho, com as ancoras do manifesto. Montado uma vez. */
const DADOS_DO_TRABALHO = dadosDoTrabalho(manifestoDoJogo);
/** F-ESC — o teto da altura do predio, do manifesto. Montado uma vez. */
const REGRA_DE_ALTURA = regraDoManifesto(manifestoDoJogo);
/** C10 — o teto de largura do predio, do manifesto. */
const REGRA_DE_LARGURA = regraDeLarguraDoManifesto(manifestoDoJogo);
/** F-VIVO-a — o lado de UMA unidade da pilha, em tiles. O brief dizia 1/4; com
 *  1/4 as quatro pilhas do armazem (3 tiles de base) se sobrepoem, com 1/5 cabem.
 *  Desenho, nao balanceamento: fica aqui, como o resto do placeholder. */
const LADO_DA_UNIDADE_EM_TILES = 1 / 5;
/** C-IA-03c — hex do tema para o numero que o Phaser pinta. */
const cor = (hex: string): number => Phaser.Display.Color.HexStringToColor(hex).color;
/** I-ARTE-BANDEIRA-COM-VOLUME — o mastro e a ponta de latao, em px de mundo. */
const LARGURA_DO_MASTRO = 3;
const COR_DO_LATAO = 0xc9a24a;
const COR_DA_SELECAO = 0xf2d16b;
/** F28b — a pedra da torre na tela: cor e quanto tempo o traco fica. Numeros de TELA. */
const COR_DA_PEDRA = 0xe8e2d0;
/** C2b — o projetil no ar: contorno escuro e miolo claro; a flecha tem esta fracao de tile. */
const COR_DA_FLECHA = 0x2a1a0a;
const COR_DO_MIOLO_DA_FLECHA = 0xf2e2b8;
const TAMANHO_DA_FLECHA = 0.8;

/** F-VIVO-c — o lado do losango do animal sem PNG: a unidade da pilha no filhote, o
 *  dobro no adulto. Uma funcao so para o desenho e o `debug.camadasEmPx`. */
function ladoDoAnimalSemArte(idade: number, tilePx: number): number {
  return (tilePx * LADO_DA_UNIDADE_EM_TILES * (idade + 1)) / 2;
}

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
  /** `?semArte=` (F17e/F17f): predios que o loader nao traz, lidos uma vez. */
  private readonly prediosSemArte = prediosSemArteDaBusca(window.location.search);
  private readonly recursosDesenhados = new Map<string, number>();
  private readonly memoriaDosEnfeites = new MemoriaDosEnfeites(candidatosAEnfeite(terrenoDeRender, sementeDoMapa, centroDaVilaInicial));
  private readonly enfeitesDesenhados = new Map<string, Phaser.GameObjects.Image>();
  private ultimoMapaDeEnfeites: object | null = null;
  private readonly chaoDaCanaNoMapa = new Map<string, number>();
  private ultimoQuadroDoChaoDaCana: { readonly tick: number; readonly vista: string; readonly partida: object | null } | null = null;
  private chaoDaCanaNaVista = 0;

  /** F-SPR — como cada CODIGO de recurso se desenha, resolvido uma vez no `create`
   *  (a arte ja chegou no `preload`). Indice e o codigo, como na tira. */
  private desenhoPorCodigo: readonly DesenhoDoRecurso[] = [];
  private culturasEmPe = new Map<string, Phaser.GameObjects.Image>();

  /** F-SPR — o sprite de vegetacao de pe por tile, para o diff. Memoria de render,
   *  como `recursosDesenhados`: a verdade continua em `state.recursos`. */
  private readonly vegetacaoDesenhada = new Map<string, Phaser.GameObjects.Image>();
  /** I-TELA-LENHADOR-CORTA-E-DERRUBA: a arvore derrubada desenhada por cima do tile (no lugar da em pe), por tile */
  private readonly arvoresCortadas = new Map<string, { readonly chave: string; readonly imagem: Phaser.GameObjects.Image | null }>();
  private quedasDeArvore = 0;
  /** I-ARTE-MONTANHA-COM-VEIOS: o bloco de cada tile de montanha (criados uma vez) e o estado da arte de cada um */
  private macico: Map<string, { readonly imagem: Phaser.GameObjects.Image; estado: string }> | null = null;
  private degrauSazonal = -1;
  private recalculosDaCaatinga = 0;
  private repinturasDaCaatinga = 0;
  private readonly memoriaDaSerra = new MemoriaDaSerra();
  private repinturasDaSerra = 0;
  private readonly memoriaDasFontes = new MemoriaDasFontes();
  private readonly fontesDesenhadas = new Map<string, Phaser.GameObjects.Image>();
  private repinturasDasFontes = 0;
  private ventoLigado = true;
  private readonly panosDasBandeiras = new Map<string, {
    pano: Phaser.GameObjects.Graphics; mastro: Phaser.GameObjects.Graphics; cor: number; gx: number; gy: number;
    quadro: { tick: number; alfa: number; vista: string } | null;
  }>();
  private ultimoQuadroDoVento: { tick: number; alfa: number; vista: string } | null = null;
  private vegetacaoNova = true;
  private readonly ultimoTickDaVegetacao = new Map<string, number>();
  private arvoresNaVista: Array<readonly [string, Phaser.GameObjects.Image]> = [];
  /** I-TELA-PREMIUM-PROTOTIPO — as sombras de contato e a gradacao, so com `?premium`. */
  private sombrasDeContato: SombrasDeContato | null = null;
  private gradacaoDeCor = false;
  /** D-TELA-LUZ-RELEVO — a luz do relevo, ou `null` com ele desligado (o padrao): todo gancho e `luz?.`. */
  private luz: LuzDoRelevo | null = null;
  /** BUG-N3 — os tiles cujo sprite de vegetacao NASCEU de rocha. Guardado na hora de
   *  pintar, e nao perguntado a `recursos` depois: a rocha esgotada sai de `recursos`, e
   *  um sprite que sobrasse dela sumiria da conferencia por construcao. */
  private readonly rochaDesenhada = new Set<string>();

  /** F-REPL-e — o estado de crescimento que cada sprite de vegetacao desenhou. O
   *  crescimento anda sem o codigo do tile mudar; e esta memoria que o diff compara. */
  private readonly crescimentoDesenhado = new Map<string, CrescimentoNoDebug>();
  /** BUG-W — o estagio que cada tile de cultura desenhou. Como o crescimento da arvore,
   *  anda sem o codigo do tile mudar; e esta memoria que o diff compara. */
  private readonly estagioDesenhado = new Map<string, EstagioDaCultura>();

  /** F-VIVO-g — o ultimo curral desenhado de cada criacao ocupada. Memoria de tela, nao
   *  entra no save: esvazia quando o tick volta ou salta mais do que um quadro roda
   *  (`MAX_PASSOS_POR_QUADRO`), que e a partida carregada. */
  private readonly curralGuardado = new Map<string, readonly AnimalDoCurral[]>();
  /** I-TELA-MODO-ADMIN — quantos rotulos de predio (nome e estagio) a cena ja escreveu; fora do admin, 0. */
  private rotulosDePredio = 0;
  /** I-TELA-CORDA-ENTRE-AS-ESTACAS: quantas cordas de canteiro a cena ja desenhou (so cresce), para o roteiro */
  private cordasDoCanteiroDesenhadas = 0;
  private tickDoCurral: number | null = null;
  /** Memoria e pool exclusivos de render, alocados uma vez por chamine. */
  private readonly chamines = new Map<string, {
    trabalhandoDesde: number | null;
    parouEm: number | null;
    pool: Phaser.GameObjects.Graphics[];
    poolFagulha: Phaser.GameObjects.Graphics[];
  }>();
  private ultimoQuadroDaFumaca = '';
  private tickDaFumaca: number | null = null;

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
    /** F26b — o grupo militar na mao do jogador. A cena so o DESENHA. */
    private readonly selecaoMilitar: SelecaoMilitar,
    /** E-ENTREGA-BUILD — o progresso do loader, de 0 a 1, para a tela de carregamento (`ui/`). A
     *  cena so avisa; quem desenha a barra e quem a passou. */
    private readonly aoCarregar: (fracao: number) => void = () => undefined,
  ) {
    super('world');
  }

  /** F26b — o que a camada de unidades desenhou no ultimo quadro: a lista contra a qual
   *  o clique e a caixa fazem o teste de acerto (`render/acerto.ts`). */
  private unidadesDesenhadas: readonly UnidadeDesenhada[] = [];

  /** F26b — as unidades desenhadas sob o ponto, da mais perto do centro para a mais longe. */
  unidadesNoPonto(ponto: { readonly x: number; readonly y: number }): string[] {
    return unidadesNoPonto(this.unidadesDesenhadas, ponto, configDoMapa.tilePx);
  }

  /** D-TELA-02 — o retangulo de mundo que a camera mostra, para o minimapa; `null` antes
   *  de a cena criar a camera. */
  vistaDaCamera(): { x: number; y: number; width: number; height: number } | null {
    const camera = this.cameras?.main;
    if (camera === undefined) return null;
    const v = camera.worldView;
    return { x: v.x, y: v.y, width: v.width, height: v.height };
  }

  /** D-TELA-02 — leva a camera ao centro do tile (o clique no minimapa). O `setBounds` da
   *  F04 prende na borda. */
  centrarCameraEm(tile: Tile): void {
    const camera = this.cameras?.main;
    if (camera === undefined) return;
    const { tilePx } = configDoMapa;
    camera.centerOn((tile.gx + 0.5) * tilePx, (tile.gy + 0.5) * tilePx);
  }

  /** C-TELA-02 — a marca no tile do destino da ultima ordem de mover. Estado de tela. */
  private marcador: MarcadorDeDestino | null = null;

  /** C-TELA-02 — marca o destino agora; a marca desbota e some sozinha. */
  marcarDestino(tile: Tile): void {
    this.marcador = { tile, desdeMs: this.time.now };
  }

  /** C-TELA-02 — tira a marca antes da hora (a ordem foi recusada). */
  apagarDestino(): void {
    this.marcador = null;
  }

  /** F26b — as unidades desenhadas dentro da caixa. */
  unidadesNaCaixa(a: { readonly x: number; readonly y: number }, b: { readonly x: number; readonly y: number }): string[] {
    return unidadesNaCaixa(this.unidadesDesenhadas, a, b, configDoMapa.tilePx);
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
    this.load.on(Phaser.Loader.Events.PROGRESS, this.aoCarregar);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.PROGRESS, this.aoCarregar);
      this.aoCarregar(1);
    });
    const depuracao = depuracaoRegistrada();
    const tipos = tiposPresentes(this.ponte.atual);
    const daDepuracao = new Set<string>();
    if (depuracao && depuracaoDeUnidade(window.location.search)) {
      for (const a of depuracao.atlases ?? [depuracao.atlas]) {
        if([...tipos].some((id)=>a.chave===`unidade:${id}:atlas`)) { this.load.atlas(a.chave, a.url, a.dados); daDepuracao.add(a.chave); }
      }
    }
    for (const a of atlasesParaCarregar(undefined, undefined, undefined, daDepuracao)) if([...tipos].some((id)=>a.chave===`unidade:${id}:atlas`)) this.load.atlas(a.chave, a.url, a.dados);
    for (const textura of texturasParaCarregar(manifestoDoJogo, undefined, this.prediosSemArte, tipos)) {
      this.load.image(textura.chave, textura.url);
    }
    // D-TELA-03a/03b: os icones de mercadoria, para a carga do serf e a pilha sem PNG
    for (const textura of texturasDosIcones(undefined, undefined, this.prediosSemArte)) this.load.image(textura.chave, textura.url);
    // I-TELA-BALAO-COM-MARTELO: o martelo do balao de obra
    const urlDoMartelo = urlsDeSprites[(dadosDoPensamento as { iconeDeObra: string }).iconeDeObra];
    if (urlDoMartelo !== undefined) this.load.image(CHAVE_DO_MARTELO, urlDoMartelo);
  }

  create(): void {
    const { tilePx, largura, altura, larguraPx, alturaPx } = configDoMapa;
    const estado = publicarEstadoDebug(this.relogio);
    Object.defineProperty(estado, 'memoriaDeTexturas', {
      enumerable: true, get: () => memoriaDeTexturas(Object.values(this.textures.list)),
    });
    const depuracao = depuracaoRegistrada();
    if (depuracao && depuracaoDeUnidade(window.location.search)) {
      const manifestoDeDepuracao = depuracao.manifesto;
      const atlasDeDepuracao = depuracao.atlas;
      const entrada = manifestoDeDepuracao.assets.find((a) => a.tipo === 'unidade' && a.id === 'serf');
      const imagem = this.add.image(0, 0, atlasDeDepuracao.chave).setOrigin(0.5, 1).setVisible(false);
      const pes: { frame: string; direcao: string; espelhado: boolean; peY: number }[] = [];
      if (entrada && 'animacoes' in entrada) for (const [animacao, dado] of Object.entries(entrada.animacoes ?? {})) {
        for (const direcao of DIRECOES) for (let quadro = 0; quadro < dado.quadros; quadro++) {
          const sprite = spriteDoAtlas(manifestoDeDepuracao, 'serf', animacao, direcao, quadro,
            (chave, frame) => this.textures.exists(chave) && this.textures.get(chave).has(frame));
          if (!sprite) continue;
          imagem.setFrame(sprite.frame).setFlipX(sprite.espelhar);
          pes.push({ frame: imagem.frame.name, direcao, espelhado: imagem.flipX, peY: peDoSprite(imagem) });
        }
      }
      estado.pesDosQuadrosDoSerf = pes;
    }
    estado.renderizador = { tipo: this.game.renderer.type, webgl: Phaser.WEBGL };
    estado.prediosSemArte = [...this.prediosSemArte];

    // F-SPR — o loader so conhece o que o manifesto declarou e o bundler achou;
    // `exists` e a unica pergunta que os resolvedores de `manifesto.ts` fazem ao Phaser.
    const carregada: TexturaCarregada = (chave) => this.textures.exists(chave);
    const texturaDoTerreno = this.criarTexturaDeTerreno(tilePx, carregada, estado);
    const camadaChao = this.criarTilemap(tilePx, largura, altura, texturaDoTerreno);
    // F-TELA-NEVOA: um pixel por tile, esticado com filtro linear (a borda da vista vira degrade
    // de um tile), acima do mundo e abaixo dos nomes e da selecao. Repinta so quando o estado muda.
    if (this.textures.exists(CHAVE_DA_NEVOA)) this.textures.remove(CHAVE_DA_NEVOA);
    const texturaDaNevoaNaCena = this.textures.createCanvas(CHAVE_DA_NEVOA, largura, altura);
    if (texturaDaNevoaNaCena === null) throw new Error('nevoa: o Phaser nao criou a textura');
    texturaDaNevoaNaCena.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.add.image(0, 0, CHAVE_DA_NEVOA).setOrigin(0, 0)
      .setDisplaySize(largura * tilePx * ESCALA_DO_MUNDO, altura * tilePx * ESCALA_DO_MUNDO).setDepth(PROFUNDIDADE_DA_NEVOA)
      .setVisible(nevoaNaTela(window.location.search));
    const pixelsDaNevoa = new Uint8ClampedArray(largura * altura * 4);
    let estadoDaNevoa: GameState | null | undefined;
    const aguaAnimada = !new URLSearchParams(window.location.search).has('aguaDesligada');
    let ultimoTickDaAgua: number | null = null;
    let ultimaVistaDaAgua = '';
    // I-TELA-CLIMA-VISUAL: o veu da estacao, a chuva e o calor, em coordenadas da tela (acima do mundo,
    // abaixo da nevoa)
    const climaNaTela = this.add.graphics().setScrollFactor(0).setDepth(PROFUNDIDADE_DA_NEVOA - 1);
    let ultimoQuadroDoClima = '';
    // I-ARTE-PADRE: a aura da bencao e o facho da conversao, no mundo, abaixo das unidades; o clarao do
    // convertido por cima delas
    const padreNoChao = this.add.graphics().setDepth(0.8);
    const padreNoAr = this.add.graphics().setDepth(PROFUNDIDADE_DA_NEVOA - 2);
    const claroes = new Map<string, number>();
    let estadoDoPadre: unknown = null;
    let tempoDoPadre = -1;
    const poolDaPoeira = Array.from({ length: dadosDaPoeira.maximoNaVista }, () =>
      this.add.graphics().setDepth(0.75).setVisible(false));
    estado.poolDaPoeira = poolDaPoeira.length;
    let ultimoQuadroDaPoeira = '';
    const poolDosAneis = Array.from({ length: dadosDosAneis.maximoNaVista }, () =>
      this.add.graphics().setDepth(0.3).setVisible(false));
    estado.poolDosAneis = poolDosAneis.length;
    let ultimoQuadroDosAneis = '';
    let estadoDosAneis: GameState | null = null;
    const texturaDosDetalhes = this.criarTexturaDeDetalhesDoTerreno(tilePx);
    this.criarCamadaDeDetalhesDoTerreno(tilePx, largura, altura, texturaDosDetalhes, estado);
    const texturaDaBordaDaAgua = this.criarTexturaDaBordaDaAgua(tilePx, carregada);
    const texturaDaBordaAreiaGrama = this.criarTexturaDaBordaAreiaGrama(tilePx, carregada);
    const texturaDaBordaRochaGrama = this.criarTexturaDaBordaRochaGrama(tilePx, carregada);
    const camadasDeTransicao = {
      agua: this.criarCamadaDaBordaDaAgua(tilePx, largura, altura, texturaDaBordaDaAgua),
      'areia-grama': this.criarCamadaDaBordaAreiaGrama(tilePx, largura, altura, texturaDaBordaAreiaGrama),
      'rocha-grama': this.criarCamadaDaBordaRochaGrama(tilePx, largura, altura, texturaDaBordaRochaGrama),
    };
    const gradeDaFerramenta = this.criarGradeDaFerramenta(tilePx, largura, altura);
    const aplicarForcaDaGrade = (modo: string): void => {
      // Com textura real a linha embutida no placeholder deixa de existir. A
      // malha continua sendo a linguagem do jogo: sutil em repouso, inteira
      // quando uma ferramenta pede leitura tile a tile.
      gradeDaFerramenta.setAlpha(modo === 'nenhum' ? 0.35 : 1);
    };
    aplicarForcaDaGrade(this.ferramenta.modo);
    const desligarGrade = this.ferramenta.aoMudar((_predio, modo) => aplicarForcaDaGrade(modo));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, desligarGrade);
    const camadaDoChaoDaCana = this.criarCamadaDoChaoDaCana(tilePx, largura, altura, carregada);
    const texturaDoRecurso = this.criarTexturaDeRecurso(tilePx, carregada, estado);
    const camadaDeRecursos = this.criarCamadaDeRecursos(tilePx, largura, altura, texturaDoRecurso);
    // D-TELA-LUZ-RELEVO: antes do primeiro `atualizarPredios`, que ja tinge o predio ao nascer.
    this.luz = criarCamadaDeRelevo(this, configDoMapa, window.location.search, estado);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, larguraPx, alturaPx);
    // I-TELA-PREMIUM-PROTOTIPO: so com `?premium`; sem ele, nada nasce
    if (visualPremium(window.location.search)) {
      this.sombrasDeContato = ligarSombrasDeContato(this);
      this.gradacaoDeCor = ligarGradacaoDeCor(camera);
    }
    // D-TELA-CAPTURA-DETERMINISTICA: o roteiro poe a camera exata pela ponte (harness)
    estado.fixarCamera = ({ scrollX, scrollY }) => {
      if (scrollX !== undefined) camera.scrollX = scrollX;
      if (scrollY !== undefined) camera.scrollY = scrollY;
    };
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
    const camadaDeUnidades = criarCamadaDeUnidades(this, tilePx, this.luz, ()=>this.ponte.identidadePartida ?? 0, () => this.ponte.acoes);
    const camadaDeMortes = criarCamadaDeMortes(this, tilePx, this.luz);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => camadaDeMortes.limpar());
    const carga=criarCargaDeUnidades((chave)=>this.textures.exists(chave),(p)=>{
      if(p.dados) this.load.atlas(p.chave,p.url,p.dados); else this.load.image(p.chave,p.url);
    });
    const concluiu=(chave:string)=>{if(this.textures.exists(chave)) {carga.concluir(chave);camadaDeUnidades.invalidar();}};
    const falhou=(arquivo:{key:string})=>carga.falhar(arquivo.key);
    this.load.on('filecomplete',concluiu);this.load.on('loaderror',falhou);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>{this.load.off('filecomplete',concluiu);this.load.off('loaderror',falhou);});
    const dep=depuracaoRegistrada();
    // D-ARTE-PIXEL-ART-MILITARES: o atlas de depuracao vence o real do mesmo tipo tambem na carga tardia
    const atlasesDisponiveis=[...(dep?.atlases ?? []),...atlasesParaCarregar(undefined,undefined,undefined,new Set((dep?.atlases ?? []).map((a)=>a.chave)))];
    let estadoDaCarga: GameState | null | undefined;
    let partidaDaCarga = -1;
    // F26b: o anel dos selecionados e a caixa ficam ACIMA de tudo do mundo
    const marcasDeSelecao = this.add.graphics().setDepth(PROFUNDIDADE_DA_SELECAO);
    const caixaDeSelecao = this.add.graphics().setDepth(PROFUNDIDADE_DA_SELECAO);
    const projeteisNoAr = this.add.graphics().setDepth(PROFUNDIDADE_DA_SELECAO);
    const marcaDoDestino = this.add.graphics().setDepth(PROFUNDIDADE_DA_SELECAO);
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
          this.entrada.aoArrastar(tile, { x: mundo.x, y: mundo.y });
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
      if (!pointer.rightButtonDown()) return;
      // F26b: o tile do botao direito e a ordem militar de mao vazia
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx, ESCALA_DO_MUNDO);
      // C-TELA-04: com o ponto de mundo, para a ordem acertar a unidade inimiga pelo desenho
      this.entrada.aoClicarDireito(tileDentroDoMapa(tile, largura, altura) ? tile : undefined, { x: mundo.x, y: mundo.y });
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonDown()) return;
      // F-D2, aceite 3: com o `Espaco` segurado o clique e o comeco de um
      // arrasto de camera, e nao a planta descendo no tile.
      if (this.navegacao.espacoApertado) return;
      // F18a: ESCALA_DO_MUNDO — `getWorldPoint` ja desfez o zoom (ver pointermove).
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx, ESCALA_DO_MUNDO);
      // F26b: o ponto de mundo (o soldado se acerta pelo pixel, nao pelo tile) e o shift
      const somar = (pointer.event as MouseEvent | undefined)?.shiftKey === true;
      if (tileDentroDoMapa(tile, largura, altura)) this.entrada.aoClicar(tile, { x: mundo.x, y: mundo.y }, somar);
    });

    // Soltar o botao esquerdo: fecha o arrasto no tile do ponteiro. Solto fora do mapa
    // (canvas maior que o mapa) cancela, como sair do canvas.
    // C-COMBATE-01c: soltar o botao direito e o fim da ordem de mao vazia; o ponto de mundo
    // da soltura da a direcao do arrasto. A cena so encaminha, como no pointerdown.
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.rightButtonReleased()) return;
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      this.entrada.aoSoltarDireito({ x: mundo.x, y: mundo.y });
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.leftButtonReleased()) return;
      if (this.navegacao.espacoApertado) return;
      // F18a: ESCALA_DO_MUNDO — `getWorldPoint` ja desfez o zoom (ver pointermove).
      const mundo = camera.getWorldPoint(pointer.x, pointer.y);
      const tile: Tile = screenToGrid({ x: mundo.x, y: mundo.y }, tilePx, ESCALA_DO_MUNDO);
      if (tileDentroDoMapa(tile, largura, altura)) this.entrada.aoSoltar(tile, { x: mundo.x, y: mundo.y });
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
      const enfeites = this.memoriaDosEnfeites.atualizar(this.ponte.atual, this.ponte.identidadePartida ?? 0);
      if (enfeites !== this.ultimoMapaDeEnfeites) {
        this.ultimoMapaDeEnfeites = enfeites;
        const vivos = new Set(enfeites.map(e => `${e.gx},${e.gy}`));
        for (const [k, sprite] of this.enfeitesDesenhados) if (!vivos.has(k)) { sprite.destroy(); this.enfeitesDesenhados.delete(k); }
        for (const e of enfeites) {
          const k = `${e.gx},${e.gy}`;
          if (this.enfeitesDesenhados.has(k)) continue;
          const entrada = manifestoDoJogo.assets.find(a => a.tipo === 'enfeite' && a.id === e.id);
          const chave = `enfeite:${e.id}:normal`;
          if (!entrada || !this.textures.exists(chave)) continue;
          const canto = gridToScreen(e, tilePx, ESCALA_DO_MUNDO);
          const x = canto.x + tilePx * ESCALA_DO_MUNDO / 2;
          const y = canto.y + tilePx * ESCALA_DO_MUNDO;
          const imagem = this.add.image(x,y,chave).setOrigin(entrada.anchor[0],entrada.anchor[1])
            .setDisplaySize(entrada.tamanho[0]*ESCALA_DO_MUNDO,entrada.tamanho[1]*ESCALA_DO_MUNDO).setDepth(depthDeY(y));
          this.enfeitesDesenhados.set(k, imagem);
        }
      }
      const vistaEnfeites = camera.worldView;
      estado.enfeitesNaVista = [...this.enfeitesDesenhados.values()].filter(i => i.x >= vistaEnfeites.x && i.x < vistaEnfeites.right && i.y >= vistaEnfeites.y && i.y < vistaEnfeites.bottom).length;
      estado.recalculosDosEnfeites = this.memoriaDosEnfeites.recalculos;
      // F-D2: o roteiro afirma o teto sobre este numero, em vez de cronometrar
      // pixel entre dois quadros e brigar com o relogio do navegador.
      estado.navegacao = {
        espacoApertado: this.navegacao.espacoApertado,
        velocidade: this.navegacao.velocidade,
      };
      estado.tilesRenderizados = camadaChao.tilesDrawn;
      const tickDaAgua = this.ponte.atual?.tick ?? 0;
      const vistaDaAgua = camera.worldView;
      const chaveDaVistaDaAgua = `${vistaDaAgua.x},${vistaDaAgua.y},${vistaDaAgua.width},${vistaDaAgua.height}`;
      // D-TELA-AGUA-VIVA: a variante so muda com o tick, e a vista so com a camera. Fora disso
      // o quadro nao varre a agua nem republica a ponte (aceite 3, "so quando a variante muda").
      const agora = () => performance.now();
      const inicioDaAgua = agora();
      let celulasDaAguaTrabalhadas = 0;
      if (ultimoTickDaAgua !== tickDaAgua || ultimaVistaDaAgua !== chaveDaVistaDaAgua) {
        estado.celulasDaAguaTrocadas = 0;
        ultimoTickDaAgua = tickDaAgua;
        ultimaVistaDaAgua = chaveDaVistaDaAgua;
        const tilesDaVista = camadaChao.getTilesWithinWorldXY(
          vistaDaAgua.x, vistaDaAgua.y, vistaDaAgua.width, vistaDaAgua.height,
        );
        celulasDaAguaTrabalhadas = tilesDaVista.filter((tile) =>
          terrenoDeRender.tipos[Math.floor(tile.index / VARIANTES_DE_TERRENO)] === 'agua').length;
        if (aguaAnimada) {
          const trocas = celulasDaAguaParaTrocar(agua, tickDaAgua, tilesDaVista.map((tile) => ({
            gx: tile.x,
            gy: tile.y,
            tipo: terrenoDeRender.tipos[Math.floor(tile.index / VARIANTES_DE_TERRENO)] ?? '',
            varianteAtual: ESTADOS_DO_TERRENO[tile.index % VARIANTES_DE_TERRENO] ?? '',
          })));
          const codigoDaAgua = terrenoDeRender.tipos.indexOf('agua');
          for (const troca of trocas) {
            const variante = ESTADOS_DO_TERRENO.indexOf(troca.variante as typeof ESTADOS_DO_TERRENO[number]);
            camadaChao.putTileAt(codigoDaAgua * VARIANTES_DE_TERRENO + variante, troca.gx, troca.gy);
          }
          estado.celulasDaAguaTrocadas = trocas.length;
        }
        estado.variantesDaAguaVisivel = Object.fromEntries(tilesDaVista.filter((tile) =>
          terrenoDeRender.tipos[Math.floor(tile.index / VARIANTES_DE_TERRENO)] === 'agua',
        ).map((tile) => [`${tile.x},${tile.y}`, ESTADOS_DO_TERRENO[tile.index % VARIANTES_DE_TERRENO] ?? '']));
      }
      // D-TELA-AGUA-PEIXE: pool separado; nao troca nenhum tile da agua viva.
      const alfaDosAneis = this.relogio.alfa();
      const chaveDosAneis = `${tickDaAgua},${alfaDosAneis},${chaveDaVistaDaAgua}`;
      const partidaDosAneis = this.ponte.atual;
      estado.trabalhoDosAneisNoQuadro = 0;
      if (chaveDosAneis !== ultimoQuadroDosAneis || partidaDosAneis !== estadoDosAneis) {
        ultimoQuadroDosAneis = chaveDosAneis;
        estadoDosAneis = partidaDosAneis;
        estado.trabalhoDosAneisNoQuadro = 1;
        const aneis = aneisDaAgua(dadosDosAneis, tickDaAgua, alfaDosAneis, {
          x: vistaDaAgua.x / tilePx, y: vistaDaAgua.y / tilePx,
          largura: vistaDaAgua.width / tilePx, altura: vistaDaAgua.height / tilePx,
          larguraMapa: largura, alturaMapa: altura,
        }, (gx, gy) => terrenoDeRender.tipos[terrenoDeRender.codigos[gy * largura + gx] ?? -1] === 'agua',
        partidaDosAneis ? pescadoresNaAgua(partidaDosAneis) : []);
        estado.aneisDaAgua = aneis;
        poolDosAneis.forEach((grafico, indice) => {
          const anel = aneis[indice];
          if (!anel) { grafico.setVisible(false); return; }
          grafico.clear().setPosition((anel.gx + 0.5) * tilePx, (anel.gy + 0.5) * tilePx).setVisible(true);
          grafico.lineStyle(dadosDosAneis.espessuraPx, Number.parseInt(dadosDosAneis.cor.slice(1), 16), anel.opacidade);
          grafico.strokeCircle(0, 0, anel.raio * tilePx);
        });
      }
      const alfaDaPoeira = this.relogio.alfa();
    // I-TELA-CLIMA-VISUAL: a estacao do tick, e o que ela desenha na vista
    const tempoDoClima = tickDaAgua + alfaDaPoeira;
      const chaveDoClima = `${tempoDoClima.toFixed(2)},${camera.width},${camera.height},${camera.zoom},${camera.originX},${camera.originY}`;
    if (chaveDoClima !== ultimoQuadroDoClima) {
      ultimoQuadroDoClima = chaveDoClima;
      const fase = faseNoTick(tickDaAgua);
        const w = camera.width;
        const h = camera.height;
        const ajuste = transformacaoDoClima(w,h,camera.zoom,camera.originX,camera.originY);
        climaNaTela.setScale(ajuste.escala).setPosition(ajuste.x,ajuste.y);
      climaNaTela.clear();
      const veu = veuDaEstacao(fase, dadosDoClimaVisual);
      if (veu !== null && veu.alfa > 0) {
        climaNaTela.fillStyle(Number.parseInt(veu.cor.slice(1), 16), veu.alfa);
        climaNaTela.fillRect(0, 0, w, h);
      }
      const gotas = gotasDaChuva(fase, tempoDoClima, w, h, dadosDoClimaVisual);
      climaNaTela.lineStyle(1, Number.parseInt(dadosDoClimaVisual.chuva.cor.slice(1), 16), dadosDoClimaVisual.chuva.alfa);
      for (const g of gotas) climaNaTela.lineBetween(g.x, g.y, g.x + g.dx, g.y + g.dy);
      const calor = particulasDoCalor(fase, tempoDoClima, w, h, dadosDoClimaVisual);
      climaNaTela.fillStyle(Number.parseInt(dadosDoClimaVisual.calor.cor.slice(1), 16), dadosDoClimaVisual.calor.alfa);
      for (const p of calor) climaNaTela.fillCircle(p.x, p.y, dadosDoClimaVisual.calor.raioPx);
        const canto = camera.getWorldPoint(camera.x,camera.y);
        estado.clima = { estacao: fase?.id ?? null, veu, gotas: gotas.length, calor: calor.length,
          limites: { x: camera.x + (climaNaTela.x + camera.scrollX - canto.x)*camera.zoom,
            y: camera.y + (climaNaTela.y + camera.scrollY - canto.y)*camera.zoom,
            largura: w*climaNaTela.scaleX*camera.zoom, altura: h*climaNaTela.scaleY*camera.zoom },
          vista: {x:camera.x,y:camera.y,largura:w,altura:h} };
    }
    // I-ARTE-PADRE: a cada quadro em que o tempo ou a partida mudam (a partida carregada pausada tambem)
    const jogo = this.ponte.atual;
    if (jogo !== estadoDoPadre || tempoDoClima !== tempoDoPadre) {
      estadoDoPadre = jogo;
      tempoDoPadre = tempoDoClima;
      padreNoChao.clear();
      padreNoAr.clear();
      if (jogo !== null) {
        for (const e of jogo.events) if (e.type === 'unit-converted') claroes.set(e.unidade, jogo.tick + dadosDoPadreVisual.clarao.duracaoTicks);
        const d = desenhoDoPadre(jogo, raioDaBencao, tempoDoClima, dadosDoPadreVisual);
        const corDaAura = Number.parseInt(dadosDoPadreVisual.aura.cor.slice(1), 16);
        for (const a of d.aneis) {
          padreNoChao.lineStyle(dadosDoPadreVisual.aura.espessuraPx, corDaAura, a.alfa);
          padreNoChao.strokeCircle((a.gx + 0.5) * tilePx, (a.gy + 0.5) * tilePx, a.raio * tilePx);
        }
        const corDoBrilho = Number.parseInt(dadosDoPadreVisual.brilho.cor.slice(1), 16);
        // nos pes de quem esta abencoado, com o mesmo desvio de desenho da unidade (F18f)
        for (const b of d.abencoados) {
          const desvio = deslocamentoDaUnidade(b.unidade, tilePx, ESCALA_DO_MUNDO);
          padreNoChao.fillStyle(corDoBrilho, b.alfa);
          padreNoChao.fillEllipse((b.gx + 0.5) * tilePx + desvio.x, (b.gy + 0.5) * tilePx + desvio.y, dadosDoPadreVisual.brilho.raioPx * 2, dadosDoPadreVisual.brilho.raioPx);
        }
        const corDoFacho = Number.parseInt(dadosDoPadreVisual.facho.cor.slice(1), 16);
        for (const f of d.fachos) {
          padreNoAr.lineStyle(dadosDoPadreVisual.facho.espessuraPx, corDoFacho, f.alfa);
          const de = deslocamentoDaUnidade(f.padre, tilePx, ESCALA_DO_MUNDO);
          const para = deslocamentoDaUnidade(f.alvo, tilePx, ESCALA_DO_MUNDO);
          padreNoAr.lineBetween((f.de.gx + 0.5) * tilePx + de.x, (f.de.gy - 0.2) * tilePx + de.y, (f.para.gx + 0.5) * tilePx + para.x, (f.para.gy - 0.2) * tilePx + para.y);
        }
        const corDoClarao = Number.parseInt(dadosDoPadreVisual.clarao.cor.slice(1), 16);
        for (const [id, ate] of claroes) {
          const u = jogo.unidades.porId[id];
          if (u === undefined || jogo.tick > ate) { claroes.delete(id); continue; }
          const resto = (ate - jogo.tick) / dadosDoPadreVisual.clarao.duracaoTicks;
          padreNoAr.fillStyle(corDoClarao, dadosDoPadreVisual.clarao.alfa * resto);
          const desvio = deslocamentoDaUnidade(id, tilePx, ESCALA_DO_MUNDO);
          padreNoAr.fillCircle((u.gx + 0.5) * tilePx + desvio.x, (u.gy + 0.1) * tilePx + desvio.y, dadosDoPadreVisual.clarao.raioPx * (1.5 - resto * 0.5));
        }
        estado.padre = { aneis: d.aneis.length, abencoados: d.abencoados.length, fachos: d.fachos.length, claroes: claroes.size };
      }
    }
    const chaveDaPoeira = `${tickDaAgua},${alfaDaPoeira},${chaveDaVistaDaAgua}`;
    if (chaveDaPoeira !== ultimoQuadroDaPoeira) {
      ultimoQuadroDaPoeira = chaveDaPoeira;
      const vistaDaPoeira = {
          x: vistaDaAgua.x / tilePx, y: vistaDaAgua.y / tilePx,
          largura: vistaDaAgua.width / tilePx, altura: vistaDaAgua.height / tilePx,
          larguraMapa: largura, alturaMapa: altura,
        };
      const particulas = particulasDaPoeira(
        dadosDaPoeira, dadosDoVento, tickDaAgua, alfaDaPoeira,
        vistaDaPoeira,
        (gx, gy) => terrenoDeRender.tipos[terrenoDeRender.codigos[gy * largura + gx] ?? -1] === 'agua',
      );
      estado.rajadaNaVista = rajadaNaVista(dadosDoVento, tickDaAgua, alfaDaPoeira, vistaDaPoeira);
      estado.poeiraDesenhada = particulas.map(({ id, tipo, evento, gx, gy }) => ({ id, tipo, evento, gx, gy }));
      poolDaPoeira.forEach((grafico, indice) => {
        const particula = particulas[indice];
        if (!particula) { grafico.setVisible(false); return; }
        grafico.clear().setPosition(particula.x * tilePx, particula.y * tilePx).setVisible(true);
        const cor = particula.tipo === 'palha' ? dadosDaPoeira.corPalha : dadosDaPoeira.corPoeira;
        grafico.fillStyle(Number.parseInt(cor.slice(1), 16), 0.7);
        if (particula.tipo === 'palha') grafico.fillRect(-2, 0, 5, 1);
        else grafico.fillCircle(0, 0, 1.5);
      });
    }
      estado.custo = somarCusto(estado.custo, 'agua', inicioDaAgua, celulasDaAguaTrabalhadas, agora);
      // F-TELA-NEVOA: so o estado ATUAL da ponte (a visao e cacheada por ele), e so quando ele muda
      const inicioDaNevoa = agora();
      let tilesDaNevoa = 0;
      if (this.ponte.atual !== estadoDaNevoa) {
        estadoDaNevoa = this.ponte.atual;
        if (estadoDaNevoa !== null) {
          texturaDaNevoa(estadoDaNevoa, configDoMapa.nevoa, configDoMapa, pixelsDaNevoa);
          texturaDaNevoaNaCena.context.putImageData(new ImageData(pixelsDaNevoa, largura, altura), 0, 0);
          texturaDaNevoaNaCena.refresh();
          tilesDaNevoa = largura * altura;
          estado.nevoa = resumoDaNevoa(pixelsDaNevoa, configDoMapa.nevoa);
        }
      }
      estado.custo = somarCusto(estado.custo, 'nevoa', inicioDaNevoa, tilesDaNevoa, agora);
      estado.terrenoVisivel = this.contarTerrenoVisivel(camadaChao);
      // F-T2a: a camada de recurso se repinta do ESTADO a cada frame (por diff),
      // e nao uma vez no create como a de terreno. E a diferenca que o item pede:
      // onde ha rocha e imutavel, quanto sobrou nao e, e o jogador tem de ver o
      // tile esgotar.
      estado.recursosVisiveis = this.atualizarRecursos(camadaDeRecursos);
      // I-TELA-LENHADOR-CORTA-E-DERRUBA: a arvore que o lenhador derrubou cai e fica deitada
      estado.arvoresNaTela = this.atualizarArvoresCortadas();
      // I-ARTE-MONTANHA-COM-VEIOS: o macico de granito e os veios
      estado.macico = this.atualizarMacico();
      estado.quedasDeArvore = this.quedasDeArvore;
      const inicioDoChao = agora();
      estado.chaoDaCanaDesenhado = this.atualizarChaoDaCana(camadaDoChaoDaCana);
      estado.custo = somarCusto(estado.custo, 'chaoDaCana', inicioDoChao, estado.chaoDaCanaDesenhado, agora);
      estado.mascarasDoLajedo = this.mascarasDoLajedo();
      estado.lajedoDesenhado = this.lajedoDesenhado();
      estado.serra = {
        recalculos: this.memoriaDaSerra.recalculos, repinturas: this.repinturasDaSerra,
        trechos: Object.fromEntries([...this.memoriaDaSerra.trechos].map(([chave, trecho]) => [chave, {
          ...trecho, textura: this.vegetacaoDesenhada.get(chave)?.texture.key ?? '(sem sprite)',
        }])),
      };
      estado.fontesNaturais = {
        recalculos: this.memoriaDasFontes.recalculos, repinturas: this.repinturasDasFontes,
        tiles: Object.fromEntries([...this.memoriaDasFontes.fontes].map(([chave, fonte]) => [chave, {
          ...fonte, textura: this.fontesDesenhadas.get(chave)?.texture.key ?? null,
        }])),
      };
      estado.transicoesVisiveis = this.lerTransicoesVisiveis(camadasDeTransicao);
    estado.vegetacaoRenderizada = this.vegetacaoDesenhada.size;
    const vistaDaMata = this.cameras.main.worldView;
    let normal = 0, seca = 0;
    for (const [chave, imagem] of this.vegetacaoDesenhada) {
      if (this.ponte.atual?.recursos[chave]?.tipo !== 'tree' || !vistaDaMata.contains(imagem.x, imagem.y)) continue;
      if (imagem.texture.key.split(':')[2] === 'seca') seca++; else normal++;
    }
    estado.caatinga = { normal, seca, degrau: this.degrauSazonal, recalculos: this.recalculosDaCaatinga, repinturas: this.repinturasDaCaatinga };
      estado.ligarVento = (ligado) => { this.ventoLigado = ligado; this.vegetacaoNova = true; };
      estado.rochasRenderizadas = this.rochaDesenhada.size;
      const inicioDoVento = agora();
      estado.vegetacaoBalancando = this.atualizarVento();
      estado.custo = somarCusto(estado.custo, 'vento', inicioDoVento, estado.vegetacaoBalancando, agora);
      estado.crescimentoDasArvores = Object.fromEntries(this.crescimentoDesenhado);
      estado.estagiosDasCulturas = Object.fromEntries(this.estagioDesenhado);
      estado.arteDasCulturas = Object.fromEntries([...this.estagioDesenhado.keys()].map(chave => {
        const imagem = this.culturasEmPe.get(chave);
        return [chave, { fonte: imagem ? 'png' : 'fallback', textura: imagem?.texture.key ?? null,
          largura: imagem?.displayWidth ?? 0, altura: imagem?.displayHeight ?? 0 }];
      }));
      estado.pronto = true;
      if (this.ponte.atual) this.atualizarPredios(this.ponte.atual, tilePx, estado);
      estado.bandeirasRedesenhadas = this.atualizarBandeiras(tilePx);
      this.atualizarFumaca(estado, tilePx);

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
      estado.estagiosDaRuaEmObra = estradas.estagios;
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
      if (estadoDaCarga !== this.ponte.atual || partidaDaCarga !== this.ponte.identidadePartida) {
        estadoDaCarga = this.ponte.atual;
        partidaDaCarga = this.ponte.identidadePartida ?? 0;
        const novos = carga.solicitar(pedidosDeUnidade(manifestoDoJogo, tiposPresentes(estadoDaCarga), urlsDeSprites, atlasesDisponiveis));
        if (novos > 0 && !this.load.isLoading()) this.load.start();
      }
      estado.cargasDeUnidade=carga.estados;
      estado.unidadesRenderizadas = camadaDeUnidades.atualizar(this.ponte.atual, this.relogio.alfa());
      estado.mortesRenderizadas = camadaDeMortes.atualizar(this.ponte.consumirMortes?.() ?? [], tempoDeAnimacao(estado.tick, this.relogio.alfa()), this.ponte.identidadePartida ?? 0);
      estado.corposNaMemoria = camadaDeMortes.quantidade;
      estado.animacoesDeUnidadeTrabalhadas = camadaDeUnidades.animacoesTrabalhadas;
      // F26b: o acerto do proximo clique mira ESTE desenho
      this.unidadesDesenhadas = estado.unidadesRenderizadas;
      // F28b: a pedra da torre, lida do evento do tick (uma vez por tick)
      this.desenharPedras(estado);
      // C2b: cada projetil no ar, interpolado com o mesmo alfa das unidades
      estado.projeteisNoAr = this.desenharProjeteis(projeteisNoAr, tilePx, this.relogio.alfa());
      estado.selecaoMilitar = this.desenharSelecao(marcasDeSelecao, estado.unidadesRenderizadas, tilePx, estado);
      estado.caixaDeSelecao = this.desenharCaixa(caixaDeSelecao);
      estado.marcadorDeDestino = this.desenharMarcador(marcaDoDestino, tilePx);
    });
  }

  /** F26b — um anel sob cada unidade selecionada, na posicao DESENHADA (a mesma do
   *  acerto). Devolve os ids que de fato ganharam anel, para o roteiro afirmar o que a
   *  tela mostra e nao o que a selecao guarda. */
  private desenharSelecao(
    marcas: Phaser.GameObjects.Graphics, desenhadas: readonly UnidadeDesenhada[], tilePx: number, debug: EstadoDebug,
  ): string[] {
    marcas.clear();
    const ids = new Set(this.selecaoMilitar.ids);
    const marcadas: string[] = [];
    const aneis: ReturnType<typeof geometriaDoAnel>[] = [];
    marcas.lineStyle(larguraDoTracoDeSelecao, COR_DA_SELECAO, 1);
    for (const u of desenhadas) {
      if (!ids.has(u.id)) continue;
      const g = geometriaDoAnel(u, tilePx);
      marcas.strokeEllipse(g.x, g.y, g.largura, g.altura);
      aneis.push(g);
      marcadas.push(u.id);
    }
    debug.aneisDeSelecao = aneis;
    return marcadas;
  }

  /**
   * C-TELA-02 — o destino da ordem de mover: um anel e quatro cantos no tile, na cor da
   * selecao, desbotando ate sumir em `segundosDoMarcador` (theme-sertao, bloco `ordem`).
   */
  private desenharMarcador(g: Phaser.GameObjects.Graphics, tilePx: number): { gx: number; gy: number } | null {
    g.clear();
    const visivel = marcadorVisivel(this.marcador, this.time.now, temaSertao.ordem.segundosDoMarcador * 1000);
    if (visivel === null) {
      this.marcador = null;
      return null;
    }
    const canto = gridToScreen(visivel.tile, tilePx, ESCALA_DO_MUNDO);
    const lado = tilePx * ESCALA_DO_MUNDO;
    const alfa = 1 - visivel.fracao;
    const [cx, cy] = [canto.x + lado / 2, canto.y + lado / 2];
    g.lineStyle(3, COR_DA_SELECAO, alfa);
    // o anel encolhe um pouco enquanto desbota: o olho acha o tile pelo movimento
    g.strokeCircle(cx, cy, (lado / 2) * (1 - visivel.fracao / 3));
    const perna = lado / 4;
    for (const [x, y, dx, dy] of [
      [canto.x, canto.y, 1, 1], [canto.x + lado, canto.y, -1, 1],
      [canto.x, canto.y + lado, 1, -1], [canto.x + lado, canto.y + lado, -1, -1],
    ] as const) {
      g.lineBetween(x, y, x + dx * perna, y);
      g.lineBetween(x, y, x, y + dy * perna);
    }
    return { gx: visivel.tile.gx, gy: visivel.tile.gy };
  }

  /** F28b — o ultimo tick cujos eventos de pedra ja foram desenhados. */
  private tickDasPedras = -1;

  /**
   * F28b — a pedra da torre na tela: um traco do alto da torre ate o tile e um circulo
   * no ponto, por meio segundo. Le `stone-thrown` do estado que a ponte trouxe, UMA vez
   * por tick. Tick que o laco rodou sem quadro no meio (velocidade alta) perde o traco:
   * e so desenho, a pedra e a morte ja aconteceram na sim.
   */
  private desenharPedras(debug: EstadoDebug): void {
    const atual = this.ponte.atual;
    if (atual === null || atual.tick === this.tickDasPedras) return;
    this.tickDasPedras = atual.tick;
    for (const e of atual.events) {
      if (e.type !== 'stone-thrown') continue;
      // C2b: o traco instantaneo saiu — a pedra VOA e e desenhada por `desenharProjeteis`.
      // Aqui ficam so os contadores que o roteiro F28b le.
      debug.pedrasDaTorre += 1;
      debug.ultimaPedra = { predio: e.predio, alvo: { gx: e.alvo.gx, gy: e.alvo.gy }, vitima: e.vitima };
    }
  }

  /**
   * C2b — o projetil no ar, lido de `state.projeteis` a cada quadro: a flecha e o virote
   * sao um traco curto na direcao do voo; a funda e a pedra, um circulo. Sobem num arco
   * (`render/projeteis.ts`). A pedra sai do meio do lote da torre.
   */
  private desenharProjeteis(
    g: Phaser.GameObjects.Graphics, tilePx: number, alfa: number,
  ): EstadoDebug['projeteisNoAr'] {
    g.clear();
    const atual = this.ponte.atual;
    const desenhados: EstadoDebug['projeteisNoAr'][number][] = [];
    for (const p of atual?.projeteis ?? []) {
      const torre = p.predio === undefined ? undefined : atual?.predios.porId[p.predio];
      const centro = torre === undefined ? undefined : (() => {
        const { largura, altura } = aparenciaDoPredio(torre.tipo);
        return { gx: torre.gx + largura / 2, gy: torre.gy + altura / 2 };
      })();
      const pos = posicaoDoProjetil(p, alfa, centro);
      // a mesma conversao grid -> tela de tudo (`gridToScreen`), com tile fracionario
      const tela = gridToScreen({ gx: pos.gx, gy: pos.gy - pos.altura }, tilePx, ESCALA_DO_MUNDO);
      if (p.projetil === 'flecha' || p.projetil === 'virote') {
        const dx = p.alvoTile.gx - p.origem.gx;
        const dy = p.alvoTile.gy - p.origem.gy;
        const n = Math.hypot(dx, dy) || 1;
        const meio = gridToScreen({ gx: TAMANHO_DA_FLECHA / 2, gy: 0 }, tilePx, ESCALA_DO_MUNDO).x;
        // contorno escuro e miolo claro: a flecha tem de se ler sobre grama, areia e pedra
        const [x0, y0, x1, y1] = [tela.x - (dx / n) * meio, tela.y - (dy / n) * meio, tela.x + (dx / n) * meio, tela.y + (dy / n) * meio];
        g.lineStyle(5, COR_DA_FLECHA, 1);
        g.lineBetween(x0, y0, x1, y1);
        g.lineStyle(2, COR_DO_MIOLO_DA_FLECHA, 1);
        g.lineBetween(x0, y0, x1, y1);
      } else {
        const raio = gridToScreen({ gx: 1 / 8, gy: 0 }, tilePx, ESCALA_DO_MUNDO).x;
        g.fillStyle(COR_DA_FLECHA, 1);
        g.fillCircle(tela.x, tela.y, raio + 2);
        g.fillStyle(COR_DA_PEDRA, 1);
        g.fillCircle(tela.x, tela.y, raio);
      }
      desenhados.push({ projetil: p.projetil, fracao: pos.fracao, gx: pos.gx, gy: pos.gy, altura: pos.altura });
    }
    return desenhados;
  }

  /** F26b — o retangulo da caixa em curso, ou nada. */
  private desenharCaixa(caixa: Phaser.GameObjects.Graphics): { a: { x: number; y: number }; b: { x: number; y: number } } | null {
    caixa.clear();
    const atual = this.entrada.caixa();
    if (atual === null) return null;
    caixa.lineStyle(1, COR_DA_SELECAO, 1);
    caixa.strokeRect(
      Math.min(atual.a.x, atual.b.x), Math.min(atual.a.y, atual.b.y),
      Math.abs(atual.b.x - atual.a.x), Math.abs(atual.b.y - atual.a.y),
    );
    return { a: { ...atual.a }, b: { ...atual.b } };
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
      for (let variante = 0; variante < VARIANTES_DE_TERRENO; variante += 1) {
        const x = (codigo * VARIANTES_DE_TERRENO + variante) * tilePx;
        g.fillStyle(Phaser.Display.Color.HexStringToColor(hex).color, 1);
        g.fillRect(x, 0, tilePx, tilePx);
        // O grid continua sendo a linguagem do jogo, mas em repouso nao compete
        // com predios e terreno. A ferramenta ativa recebe uma segunda camada,
        // mais clara e forte, em `criarGradeDaFerramenta`.
        g.lineStyle(1, 0x000000, 0.035);
        g.strokeRect(x, 0, tilePx, tilePx);
      }
    });
    g.generateTexture(
      CHAVE_TEXTURA_TERRENO,
      tilePx * terrenoDeRender.cores.length * VARIANTES_DE_TERRENO,
      tilePx,
    );
    g.destroy();
    const arte = terrenoDeRender.tipos.flatMap((id) => {
      const padrao = texturaDaCamada(
        manifestoDoJogo, 'terreno', id, ESTADO_DO_TERRENO, carregada,
      );
      return ESTADOS_DO_TERRENO.map(
        (estado) => texturaDaCamada(manifestoDoJogo, 'terreno', id, estado, carregada) ?? padrao,
      );
    });
    debug.arteDasCamadas = {
      ...debug.arteDasCamadas,
      terreno: terrenoDeRender.tipos.filter((_id, codigo) => arte
        .slice(codigo * VARIANTES_DE_TERRENO, (codigo + 1) * VARIANTES_DE_TERRENO)
        .some((chave) => chave !== null)),
    };
    // F-TR — o ARQUIVO do manifesto, e nao a chave: a chave traz o id do tipo no nome
    // e seria distinta por construcao; dois tipos apontando o mesmo PNG nao seriam.
    debug.texturaDoTerreno = Object.fromEntries(terrenoDeRender.tipos.map((id, codigo) => {
      const entrada = assetDaCamada(manifestoDoJogo, 'terreno', id);
      return [id, ESTADOS_DO_TERRENO.map((estado, variante) => {
        const chave = arte[codigo * VARIANTES_DE_TERRENO + variante] ?? null;
        if (chave === null) return `cor:${terrenoDeRender.cores[codigo] ?? ''}`;
        const usado = chave === chaveDeTextura('terreno', id, estado) ? estado : ESTADO_DO_TERRENO;
        return entrada?.estados[usado] ?? chave;
      })];
    }));
    return this.sobreporArteNaTira(CHAVE_TEXTURA_TERRENO, tilePx, arte, []);
  }

  /** As 16 mascaras N/L/S/O sao PNGs; o render apenas escolhe a combinacao. */
  private criarTexturaDaBordaDaAgua(tilePx: number, carregada: TexturaCarregada): string {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, tilePx * ESTADOS_DA_BORDA_AGUA.length, tilePx);
    g.generateTexture(CHAVE_TEXTURA_BORDA_AGUA, tilePx * ESTADOS_DA_BORDA_AGUA.length, tilePx);
    g.destroy();
    const arte = ESTADOS_DA_BORDA_AGUA.map((estado) => texturaDaCamada(
      manifestoDoJogo, 'terreno', 'agua', estado, carregada,
    ));
    return this.sobreporArteNaTira(CHAVE_TEXTURA_BORDA_AGUA, tilePx, arte, []);
  }

  /**
   * A borda mora sobre o tile de agua e nunca altera o codigo do terreno. Um
   * vizinho cardinal que nao e agua liga o bit correspondente: N=1, L=2,
   * S=4, O=8. O miolo continua com as quatro variantes do chao.
   */
  private criarCamadaDaBordaDaAgua(
    tilePx: number, largura: number, altura: number, textura: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('borda-agua', textura, tilePx, tilePx, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset da borda da agua.');
    const camada = mapa.createBlankLayer('borda-agua', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada da borda da agua.');

    const { codigos, largura: larguraDoTerreno, altura: alturaDoTerreno } = terrenoDeRender;
    const codigoDaAgua = terrenoDeRender.tipos.indexOf('agua');
    const ehAgua = (gx: number, gy: number): boolean => (
      gx >= 0 && gy >= 0 && gx < larguraDoTerreno && gy < alturaDoTerreno
      && codigos[gy * larguraDoTerreno + gx] === codigoDaAgua
    );
    for (let gy = 0; gy < Math.min(altura, alturaDoTerreno); gy += 1) {
      for (let gx = 0; gx < Math.min(largura, larguraDoTerreno); gx += 1) {
        if (!ehAgua(gx, gy)) continue;
        const mascara = mascaraCardinal((dx, dy) => !ehAgua(gx + dx, gy + dy));
        if (mascara !== 0) camada.putTileAt(mascara, gx, gy);
      }
    }
    return camada.setDepth(0.2);
  }

  /** A familia areia–grama usa a mesma mascara, mas arte e camada proprias. */
  private criarTexturaDaBordaAreiaGrama(tilePx: number, carregada: TexturaCarregada): string {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, tilePx * ESTADOS_DA_BORDA_AREIA_GRAMA.length, tilePx);
    g.generateTexture(CHAVE_TEXTURA_AREIA_GRAMA, tilePx * ESTADOS_DA_BORDA_AREIA_GRAMA.length, tilePx);
    g.destroy();
    const arte = ESTADOS_DA_BORDA_AREIA_GRAMA.map((estado) => texturaDaCamada(
      manifestoDoJogo, 'terreno', 'areia', estado, carregada,
    ));
    return this.sobreporArteNaTira(CHAVE_TEXTURA_AREIA_GRAMA, tilePx, arte, []);
  }

  /** Grama invade somente o lado do tile de areia que realmente toca grama. */
  private criarCamadaDaBordaAreiaGrama(
    tilePx: number, largura: number, altura: number, textura: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('areia-grama', textura, tilePx, tilePx, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset areia-grama.');
    const camada = mapa.createBlankLayer('areia-grama', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada areia-grama.');

    const { codigos, largura: larguraDoTerreno, altura: alturaDoTerreno } = terrenoDeRender;
    const codigoDaAreia = terrenoDeRender.tipos.indexOf('areia');
    const codigoDaGrama = terrenoDeRender.tipos.indexOf('grama');
    const codigoEm = (gx: number, gy: number): number => (
      gx >= 0 && gy >= 0 && gx < larguraDoTerreno && gy < alturaDoTerreno
        ? codigos[gy * larguraDoTerreno + gx] as number
        : -1
    );
    for (let gy = 0; gy < Math.min(altura, alturaDoTerreno); gy += 1) {
      for (let gx = 0; gx < Math.min(largura, larguraDoTerreno); gx += 1) {
        if (codigoEm(gx, gy) !== codigoDaAreia) continue;
        const mascara = mascaraCardinal((dx, dy) => codigoEm(gx + dx, gy + dy) === codigoDaGrama);
        if (mascara !== 0) camada.putTileAt(mascara, gx, gy);
      }
    }
    return camada.setDepth(0.1);
  }

  /** A base do lajedo recebe grama nas faces externas; o recurso fica por cima. */
  private criarTexturaDaBordaRochaGrama(tilePx: number, carregada: TexturaCarregada): string {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, tilePx * ESTADOS_DA_BORDA_ROCHA_GRAMA.length, tilePx);
    g.generateTexture(CHAVE_TEXTURA_ROCHA_GRAMA, tilePx * ESTADOS_DA_BORDA_ROCHA_GRAMA.length, tilePx);
    g.destroy();
    const arte = ESTADOS_DA_BORDA_ROCHA_GRAMA.map((estado) => texturaDaCamada(
      manifestoDoJogo, 'terreno', 'rocha', estado, carregada,
    ));
    return this.sobreporArteNaTira(CHAVE_TEXTURA_ROCHA_GRAMA, tilePx, arte, []);
  }

  private criarCamadaDaBordaRochaGrama(
    tilePx: number, largura: number, altura: number, textura: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('rocha-grama', textura, tilePx, tilePx, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset rocha-grama.');
    const camada = mapa.createBlankLayer('rocha-grama', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada rocha-grama.');

    const { codigos, largura: larguraDoTerreno, altura: alturaDoTerreno } = terrenoDeRender;
    const codigoDaRocha = terrenoDeRender.tipos.indexOf('rocha');
    const codigoDaGrama = terrenoDeRender.tipos.indexOf('grama');
    const codigoEm = (gx: number, gy: number): number => (
      gx >= 0 && gy >= 0 && gx < larguraDoTerreno && gy < alturaDoTerreno
        ? codigos[gy * larguraDoTerreno + gx] as number
        : -1
    );
    for (let gy = 0; gy < Math.min(altura, alturaDoTerreno); gy += 1) {
      for (let gx = 0; gx < Math.min(largura, larguraDoTerreno); gx += 1) {
        if (codigoEm(gx, gy) !== codigoDaRocha) continue;
        const mascara = mascaraCardinal((dx, dy) => codigoEm(gx + dx, gy + dy) === codigoDaGrama);
        if (mascara !== 0) camada.putTileAt(mascara, gx, gy);
      }
    }
    return camada.setDepth(0.1);
  }

  /**
   * O grid operacional. Fica oculto em repouso e aparece com qualquer
   * ferramenta ativa, sem tocar no tilemap nem no GameState. Uma unica malha
   * para o mapa inteiro custa 258 linhas no mapa 128x128; estrada, recurso e
   * predio continuam por cima pelos respectivos depths.
   */
  private criarGradeDaFerramenta(
    tilePx: number, largura: number, altura: number,
  ): Phaser.GameObjects.Graphics {
    const grade = this.add.graphics();
    grade.lineStyle(1, 0xede3d0, 0.16);
    const larguraPx = largura * tilePx;
    const alturaPx = altura * tilePx;
    for (let gx = 0; gx <= largura; gx += 1) {
      const x = gx * tilePx;
      grade.lineBetween(x, 0, x, alturaPx);
    }
    for (let gy = 0; gy <= altura; gy += 1) {
      const y = gy * tilePx;
      grade.lineBetween(0, y, larguraPx, y);
    }
    return grade.setDepth(0.25);
  }

  /**
   * Tira transparente de decalques do terreno. Nao e asset novo: sao marcas
   * geometricas nas cores do tema, fallback ate existir arte propria no
   * manifesto. Tres variantes por tipo quebram a repeticao sem `Math.random`.
   */
  private criarTexturaDeDetalhesDoTerreno(tilePx: number): string {
    type Detalhe = {
      readonly claro: string;
      readonly escuro: string;
      readonly densidade: number;
      readonly padrao: 'capim' | 'sulco' | 'grao' | 'onda' | 'cascalho' | 'serra';
    };
    const detalhes = temaSertao.detalhesTerreno as unknown as Readonly<Record<string, Detalhe | string | undefined>>;
    const g = this.make.graphics({ x: 0, y: 0 }, false);

    terrenoDeRender.tipos.forEach((tipo, codigo) => {
      const detalhe = detalhes[tipo];
      if (typeof detalhe !== 'object' || detalhe === null) {
        throw new Error(`WorldScene: falta detalhe visual para o terreno '${tipo}'.`);
      }
      const claro = Phaser.Display.Color.HexStringToColor(detalhe.claro).color;
      const escuro = Phaser.Display.Color.HexStringToColor(detalhe.escuro).color;
      for (let variante = 0; variante < VARIANTES_DE_DETALHE; variante += 1) {
        const x = (codigo * VARIANTES_DE_DETALHE + variante) * tilePx;
        const deslocamento = variante * 5;
        g.fillStyle(variante === 1 ? claro : escuro, 0.045);
        g.fillRect(x, 0, tilePx, tilePx);

        if (detalhe.padrao === 'capim') {
          g.lineStyle(1, escuro, 0.34);
          for (let i = 0; i < 3; i += 1) {
            const px = x + 12 + ((i * 17 + deslocamento) % 38);
            const py = 22 + ((i * 13 + deslocamento) % 28);
            g.lineBetween(px, py + 4, px - 2, py);
            g.lineBetween(px, py + 4, px + 2, py + 1);
          }
        } else if (detalhe.padrao === 'sulco') {
          g.lineStyle(1, escuro, 0.25);
          for (let i = 0; i < 4; i += 1) {
            const py = 13 + i * 12 + variante;
            g.lineBetween(x + 8 + deslocamento, py, x + 46 + deslocamento, py);
          }
        } else if (detalhe.padrao === 'grao') {
          g.fillStyle(escuro, 0.28);
          for (let i = 0; i < 5; i += 1) {
            g.fillCircle(x + 10 + ((i * 19 + deslocamento) % 45), 10 + ((i * 23 + deslocamento) % 45), 1);
          }
        } else if (detalhe.padrao === 'onda') {
          g.lineStyle(1, claro, 0.34);
          for (let i = 0; i < 3; i += 1) {
            const py = 16 + i * 15 + variante;
            g.lineBetween(x + 8 + deslocamento, py, x + 24 + deslocamento, py);
            g.lineBetween(x + 30 + deslocamento, py + 3, x + 48 + deslocamento, py + 3);
          }
        } else if (detalhe.padrao === 'cascalho') {
          g.lineStyle(1, escuro, 0.32);
          for (let i = 0; i < 3; i += 1) {
            const px = x + 11 + ((i * 21 + deslocamento) % 42);
            const py = 14 + ((i * 17 + deslocamento) % 35);
            g.strokeTriangle(px - 3, py + 3, px, py - 3, px + 4, py + 3);
          }
        } else {
          g.lineStyle(1, claro, 0.27);
          for (let i = 0; i < 3; i += 1) {
            const px = x + 6 + ((i * 18 + deslocamento) % 38);
            const py = 18 + i * 12;
            g.lineBetween(px, py + 7, px + 7, py);
            g.lineBetween(px + 7, py, px + 13, py + 6);
          }
        }
      }
    });

    g.generateTexture(
      CHAVE_TEXTURA_DETALHES,
      tilePx * terrenoDeRender.tipos.length * VARIANTES_DE_DETALHE,
      tilePx,
    );
    g.destroy();
    return this.extrudarTexturaDaTira(CHAVE_TEXTURA_DETALHES, tilePx);
  }

  /** Camada separada para preservar indices, contagens e culling do chao. */
  private criarCamadaDeDetalhesDoTerreno(
    tilePx: number, largura: number, altura: number, textura: string,
    debug: EstadoDebug,
  ): Phaser.Tilemaps.TilemapLayer {
    type Detalhe = { readonly densidade: number };
    const detalhes = temaSertao.detalhesTerreno as unknown as Readonly<Record<string, Detalhe | string | undefined>>;
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('detalhes-terreno', textura, tilePx, tilePx, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset de detalhes do terreno.');
    const camada = mapa.createBlankLayer('detalhes-terreno', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada de detalhes do terreno.');

    const { codigos, largura: larguraDoTerreno, altura: alturaDoTerreno } = terrenoDeRender;
    const contagens: Record<string, number> = Object.fromEntries(terrenoDeRender.tipos.map((tipo) => [tipo, 0]));
    for (let gy = 0; gy < Math.min(altura, alturaDoTerreno); gy += 1) {
      for (let gx = 0; gx < Math.min(largura, larguraDoTerreno); gx += 1) {
        const codigo = codigos[gy * larguraDoTerreno + gx] as number;
        const tipo = terrenoDeRender.tipos[codigo];
        if (tipo === undefined || !terrenoRecebeDetalhe(tipo, debug.arteDasCamadas.terreno)) continue;
        const detalhe = tipo === undefined ? undefined : detalhes[tipo];
        if (typeof detalhe !== 'object' || detalhe === null) continue;
        const hash = this.hashVisual(gx, gy, codigo);
        if ((hash % 10_000) / 10_000 >= detalhe.densidade) continue;
        const variante = Math.floor(hash / 10_000) % VARIANTES_DE_DETALHE;
        const tile = camada.putTileAt(codigo * VARIANTES_DE_DETALHE + variante, gx, gy);
        tile.flipX = (hash & 1) !== 0;
        tile.flipY = (hash & 2) !== 0;
        contagens[tipo] = (contagens[tipo] ?? 0) + 1;
      }
    }
    debug.detalhesDoTerrenoPorTipo = contagens;
    return camada.setDepth(0.1);
  }

  /** Hash so de apresentacao: mesma coordenada, mesmo decalque, em toda carga. */
  private hashVisual(gx: number, gy: number, codigo: number): number {
    let hash = Math.imul(gx + 1, 73_856_093) ^ Math.imul(gy + 1, 19_349_663);
    hash ^= Math.imul(codigo + 1, 83_492_791);
    hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
    return (hash ^ (hash >>> 16)) >>> 0;
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
    if (arte.every((c) => c === null) && vazias.length === 0) return this.extrudarTexturaDaTira(chaveDaTira, tilePx);
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
    return this.extrudarTexturaDaTira(chave, tilePx);
  }

  /** Extruda so na montagem: a camada continua usando os mesmos indices e tilePx. */
  private extrudarTexturaDaTira(chaveDaTira: string, tilePx: number): string {
    const base = this.textures.get(chaveDaTira).getSourceImage() as HTMLCanvasElement;
    const ctx = base.getContext('2d');
    if (!ctx) throw new Error(`WorldScene: falta contexto da tira '${chaveDaTira}'.`);
    const tira = extrudarTira(ctx.getImageData(0, 0, base.width, base.height).data, tilePx, base.width / tilePx);
    const chave = `${chaveDaTira}:extrusao`;
    const textura = this.textures.createCanvas(chave, tira.largura, tira.altura);
    if (!textura) throw new Error(`WorldScene: falha ao extrudar a tira '${chaveDaTira}'.`);
    const destino = textura.getContext();
    const imagem = destino.createImageData(tira.largura, tira.altura);
    imagem.data.set(tira.pixels);
    destino.putImageData(imagem, 0, 0);
    textura.refresh();
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
      // I-TELA-CHAO-DA-ROCA-DO-MILHO: a roca em pousio nao tem losango; o chao da roca e o desenho dela
      if (codigo === recursosDeRender.codigoEmPousio) return;
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
    // I-TELA-CHAO-DA-ROCA-DO-MILHO: o alfa no meio da celula do pousio e do esgotado (o controle, que
    // continua losango), lido da textura gerada
    const alfaNoMeio = (codigo: number): number => this.textures.getPixelAlpha(codigo * tilePx + meio, meio, CHAVE_TEXTURA_RECURSO) ?? -1;
    debug.losangoNaTira = { pousio: alfaNoMeio(recursosDeRender.codigoEmPousio), esgotado: alfaNoMeio(recursosDeRender.codigoEsgotado) };
    // Codigo 0 e o esgotado ficam fora: vazio e marcador unico, sem entrada propria.
    this.desenhoPorCodigo = recursosDeRender.cores.map((_cor, codigo): DesenhoDoRecurso => {
      const id = recursosDeRender.tipos[codigo - 1];
      if (codigo === 0 || codigo === recursosDeRender.codigoEsgotado || codigo === recursosDeRender.codigoEmPousio
        || id === undefined) return { como: 'marcador' };
      return desenhoDoRecurso(manifestoDoJogo, id, carregada);
    });
    const arte = this.desenhoPorCodigo.map((d) => (d.como === 'textura' ? d.chave : null));
    const vazias = this.desenhoPorCodigo.flatMap((d, codigo) => (d.como === 'vegetacao' ? [codigo] : []));
    for (let codigo = 0; codigo < arte.length; codigo++) {
      // I-ARTE-MONTANHA-COM-VEIOS: o veio de ferro e de ouro aparece no bloco da montanha, e nao como morrinho
      if (recursoSubmerso(recursosDeRender.tipos[codigo - 1] ?? '') || VEIOS_NA_MONTANHA.includes(recursosDeRender.tipos[codigo - 1] ?? '') ||
          (configDasFontes.tipos.includes(recursosDeRender.tipos[codigo - 1] ?? '') && arte[codigo] !== null)) {
        arte[codigo] = null; vazias.push(codigo);
      }
    }
    const idsCom = (como: DesenhoDoRecurso['como']): string[] => this.desenhoPorCodigo.flatMap(
      (d, codigo) => (d.como === como ? [recursosDeRender.tipos[codigo - 1] as string] : []),
    );
    debug.arteDasCamadas = { ...debug.arteDasCamadas, recurso: idsCom('textura'), vegetacao: idsCom('vegetacao') };
    return this.sobreporArteNaTira(CHAVE_TEXTURA_RECURSO, tilePx, arte, vazias);
  }

  /** Camada opcional: sem PNG carregado, a textura do terreno continua intacta. */
  private criarCamadaDoChaoDaCana(
    tilePx: number, largura: number, altura: number, carregada: TexturaCarregada,
  ): Phaser.Tilemaps.TilemapLayer | null {
    // I-TELA-CHAO-DA-ROCA-DO-MILHO: um bloco de 4 variantes por chao (a cana e o milho); chao sem PNG fica
    // com o bloco vazio (o terreno aparece)
    const padroes = CHAOS_DA_ROCA.map((chao) => texturaDaCamada(manifestoDoJogo, 'terreno', chao, ESTADO_DO_TERRENO, carregada));
    if (padroes.every((p) => p === null)) return null;
    const tira = this.textures.createCanvas(CHAVE_TEXTURA_CHAO_DA_CANA, tilePx * (1 + 4 * CHAOS_DA_ROCA.length), tilePx);
    if (!tira) throw new Error('WorldScene: falha ao criar a tira do chao da cana.');
    const ctx = tira.getContext();
    CHAOS_DA_ROCA.forEach((chao, bloco) => {
      const padrao = padroes[bloco];
      if (padrao === null || padrao === undefined) return;
      ESTADOS_DO_TERRENO.forEach((estado, variante) => {
        const chave = texturaDaCamada(manifestoDoJogo, 'terreno', chao, estado, carregada) ?? padrao;
        ctx.drawImage(this.textures.get(chave).getSourceImage() as HTMLImageElement, (1 + bloco * 4 + variante) * tilePx, 0, tilePx, tilePx);
      });
    });
    tira.refresh();
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const textura = this.extrudarTexturaDaTira(CHAVE_TEXTURA_CHAO_DA_CANA, tilePx);
    const tileset = mapa.addTilesetImage('chao-da-cana', textura, tilePx, tilePx, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset do chao da cana.');
    const camada = mapa.createBlankLayer('chao-da-cana', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada do chao da cana.');
    // Acima das bordas do chao (0,1 e 0,2) e abaixo da grade da ferramenta (0,25): com a
    // ferramenta ativa, a grade continua visivel sobre o partido da cana.
    return camada.setDepth(0.22);
  }

  /** Repinta pelo estado, sem alterar o terreno do mapa nem a simulacao. */
  private atualizarChaoDaCana(camada: Phaser.Tilemaps.TilemapLayer | null): number {
    const debug = window.__cangaco;
    if (debug) debug.recursosVarridosPeloChao = 0;
    if (camada === null) return 0;
    const vista = this.cameras.main.worldView;
    const quadro = {
      tick: this.ponte.atual?.tick ?? 0,
      partida: this.ponte.atual,
      vista: `${vista.x},${vista.y},${vista.width},${vista.height}`,
    };
    const trabalho = quadroDoChaoDaCanaMudou(this.ultimoQuadroDoChaoDaCana, quadro);
    if (trabalho.varrerRecursos) {
      const recursos = this.ponte.atual?.recursos ?? {};
      const atuais = new Set<string>();
      for (const [chave, recurso] of Object.entries(recursos)) {
        if (debug) debug.recursosVarridosPeloChao += 1;
        const chao = chaoDaRoca(recurso);
        if (chao === null) continue;
        atuais.add(chave);
        const { gx, gy } = tileDeChave(chave);
        const variante = indiceDoChao(chao, gx, gy);
        if (this.chaoDaCanaNoMapa.get(chave) !== variante) camada.putTileAt(variante, gx, gy);
        this.chaoDaCanaNoMapa.set(chave, variante);
      }
      for (const chave of this.chaoDaCanaNoMapa.keys()) {
        if (atuais.has(chave)) continue;
        const { gx, gy } = tileDeChave(chave);
        camada.removeTileAt(gx, gy);
        this.chaoDaCanaNoMapa.delete(chave);
      }
    }
    if (trabalho.contarVista) {
      this.chaoDaCanaNaVista = camada.getTilesWithinWorldXY(vista.x, vista.y, vista.width, vista.height,
        { isNotEmpty: true }).length;
    }
    this.ultimoQuadroDoChaoDaCana = quadro;
    return this.chaoDaCanaNaVista;
  }

  private criarCamadaDeRecursos(
    tilePx: number, largura: number, altura: number, textura: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('recurso', textura, tilePx, tilePx, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA);
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
    const repintar = new Set<string>();
    for (const chave of this.memoriaDasFontes.atualizar(recursos, this.ponte.atual?.tick ?? 0, rendimentosDasFontes)) this.pintarFonteNatural(chave);
    for (const chave of this.memoriaDaSerra.atualizar(recursos, this.ponte.atual?.tick ?? 0, rendimentoDaRocha)) repintar.add(chave);
    const degrau = degrauDaCaatinga(faseNoTick(this.ponte.atual?.tick ?? 0));
    if (degrau !== this.degrauSazonal) {
      this.degrauSazonal = degrau;
      this.recalculosDaCaatinga++;
      for (const [chave, recurso] of Object.entries(recursos)) if (recurso.tipo === 'tree') repintar.add(chave);
    }
    const marcarComVizinhos = (chave: string): void => {
      repintar.add(chave);
      const { gx, gy } = tileDeChave(chave);
      for (const { dx, dy } of VIZINHOS_CARDINAIS) repintar.add(`${gx + dx},${gy + dy}`);
    };
    for (const [chave, recurso] of Object.entries(recursos)) {
      const codigo = codigoDoRecurso(recurso);
      if (this.recursosDesenhados.get(chave) === codigo) {
        if (this.desenhoPorCodigo[codigo]?.como === 'vegetacao'
          && this.crescimentoDoTile(chave) !== (this.crescimentoDesenhado.get(chave)?.estado ?? null)) {
          repintar.add(chave);
        }
        this.pintarEstagio(camada, chave, recurso, codigo, false);
        continue;
      }
      const { gx, gy } = tileDeChave(chave);
      camada.putTileAt(codigo, gx, gy);
      this.recursosDesenhados.set(chave, codigo);
      marcarComVizinhos(chave);
      // o tile trocado nasce com opacidade cheia: o estagio se repoe sempre
      this.pintarEstagio(camada, chave, recurso, codigo, true);
    }
    for (const chave of [...this.recursosDesenhados.keys()]) {
      if (recursos[chave] !== undefined) continue;
      const { gx, gy } = tileDeChave(chave);
      camada.putTileAt(0, gx, gy);
      this.recursosDesenhados.delete(chave);
      this.estagioDesenhado.delete(chave);
      this.culturasEmPe.get(chave)?.destroy();
      this.culturasEmPe.delete(chave);
      marcarComVizinhos(chave);
    }
    for (const chave of repintar) {
      const recurso = recursos[chave];
      this.pintarVegetacao(chave, recurso === undefined ? 0 : codigoDoRecurso(recurso));
    }
    return this.contarRecursosVisiveis(camada);
  }

  /** F-SPR — poe, troca ou tira o sprite de vegetacao de um tile, pelo codigo que a
   *  camada acabou de receber. O `anchor` do manifesto cai no meio da borda de BAIXO
   *  do tile, como o do predio no footprint; a imagem sai no tamanho do arquivo e pode
   *  transbordar o tile — por isso e sprite, e nao celula da tira. Depth pelo pe: a
   *  unidade no tile de cima passa atras, a do tile de baixo passa na frente. */
  private pintarFonteNatural(chave: string): void {
    const atual = this.fontesDesenhadas.get(chave);
    const textura = texturaDaFonte(this.memoriaDasFontes.fontes.get(chave), chave => this.textures.exists(chave));
    if (textura === null) {
      if (atual) { atual.destroy(); this.fontesDesenhadas.delete(chave); this.repinturasDasFontes++; }
      return;
    }
    if (atual?.texture.key === textura) return;
    atual?.destroy();
    const { tilePx } = configDoMapa;
    const canto = gridToScreen(tileDeChave(chave), tilePx, ESCALA_DO_MUNDO);
    const tipo = this.memoriaDasFontes.fontes.get(chave)!.tipo;
    const entrada = manifestoDoJogo.assets.find(a => a.tipo === 'recurso' && a.id === tipo)!;
    const imagem = this.add.image(canto.x + tilePx / 2, canto.y + tilePx, textura)
      .setOrigin(entrada.anchor[0], entrada.anchor[1]).setScale(configDasFontes.escala).setDepth(depthDeY(canto.y + tilePx));
    this.luz?.tingir(imagem, imagem.x, imagem.y, `fonte:${chave}`);
    this.fontesDesenhadas.set(chave, imagem); this.repinturasDasFontes++;
  }

  /**
   * I-TELA-LENHADOR-CORTA-E-DERRUBA — a arvore que o lenhador derrubou: tomba quando o primeiro tronco sai dela (o lenhador
   * volta para casa com ele), fica deitada e encolhe a cada tronco levado, e no ultimo some (o toco do estado). So tela:
   * o estado so desconta o tronco no deposito. A arte deitada e `trabalho:arvore-caida:caida_<N>`; sem ela, a propria
   * arvore em pe, deitada no chao. Devolve o estado de cada arvore cortada, para o roteiro.
   */
  private atualizarArvoresCortadas(): Record<string, string> {
    const estado: GameState | null = this.ponte.atual;
    if (estado === null || estado === undefined) return {};
    const rendimento = (dadosDosRecursos.tipos as Record<string, { readonly rendimentoPorTile?: number }>)['tree']?.rendimentoPorTile ?? 1;
    const aCaminho = new Map<string, number>();
    for (const id of estado.unidades.ordem) {
      const u: Unidade | undefined = estado.unidades.porId[id];
      if (u?.fsm !== 'voltando' || u.fsmData.tarefa === undefined) continue;
      const tarefa: Tarefa | undefined = estado.jobs.tarefas.porId[u.fsmData.tarefa as string];
      if (tarefa?.tipo !== 'colher') continue;
      const chave = `${tarefa.origemTile.gx},${tarefa.origemTile.gy}`;
      if (estado.recursos[chave]?.tipo === 'tree') aCaminho.set(chave, (aCaminho.get(chave) ?? 0) + 1);
    }
    const candidatos = new Set([...this.arvoresCortadas.keys(), ...aCaminho.keys()]);
    for (const [chave, r] of Object.entries(estado.recursos)) if (r.tipo === 'tree' && r.quantidade > 0 && r.quantidade < rendimento) candidatos.add(chave);
    const { tilePx } = configDoMapa;
    const saida: Record<string, string> = {};
    for (const chave of candidatos) {
      const r = estado.recursos[chave];
      const atual = this.arvoresCortadas.get(chave);
      const emPe = this.vegetacaoDesenhada.get(chave);
      const naTela = r?.tipo === 'tree' && r.quantidade > 0 ? arvoreNaTela(r.quantidade, rendimento, aCaminho.get(chave) ?? 0) : null;
      if (naTela === null || naTela.tipo === 'em-pe') {
        atual?.imagem?.destroy();
        this.arvoresCortadas.delete(chave);
        emPe?.setVisible(true);
        continue;
      }
      emPe?.setVisible(false);
      const troncos = naTela.tipo === 'caida' ? naTela.troncos : 0;
      const nova = naTela.tipo === 'toco' ? 'toco' : `caida-${troncos}`;
      saida[chave] = nova;
      if (atual?.chave === nova) continue;
      atual?.imagem?.destroy();
      if (nova === 'toco') { this.arvoresCortadas.set(chave, { chave: nova, imagem: null }); continue; }
      const canto = gridToScreen(tileDeChave(chave), tilePx, ESCALA_DO_MUNDO);
      const pe = { x: canto.x + tilePx / 2, y: canto.y + tilePx };
      const arte = chaveDeTextura('trabalho', 'arvore-caida', `caida_${troncos}`);
      const deitada = this.textures.exists(arte)
        ? this.add.image(pe.x, pe.y - tilePx / 2, arte).setOrigin(0.5, 0.5)
        : emPe === undefined ? null
        // sem a arte: a arvore em pe, deitada no chao (girada a partir do pe), cortada do alto conforme o que sobra
        : this.add.image(pe.x, pe.y, emPe.texture.key).setOrigin(emPe.originX, emPe.originY).setScale(emPe.scaleX * 0.8).setAngle(82)
          .setCrop(0, emPe.height * (1 - (troncos / rendimento)), emPe.width, emPe.height * (troncos / rendimento));
      if (deitada !== null) {
        deitada.setDepth(depthDeY(pe.y - 1));
        this.luz?.tingir(deitada, pe.x, pe.y, `arvore-caida:${chave}`);
        // a queda: so na passagem da arvore em pe para a deitada, a em pe gira do pe ate o chao
        if (atual === undefined && emPe !== undefined) {
          this.quedasDeArvore++;
          deitada.setVisible(false);
          const caindo = this.add.image(pe.x, pe.y, emPe.texture.key).setOrigin(emPe.originX, emPe.originY).setScale(emPe.scaleX).setDepth(depthDeY(pe.y));
          this.tweens.add({ targets: caindo, angle: 84, duration: 700, ease: 'Quad.easeIn', onComplete: () => { caindo.destroy(); deitada.setVisible(true); } });
        }
      }
      this.arvoresCortadas.set(chave, { chave: nova, imagem: deitada });
    }
    return saida;
  }

  /**
   * I-ARTE-MONTANHA-COM-VEIOS — um bloco de granito em pe em cada tile de montanha (o terreno nao muda: os blocos sao
   * criados uma vez), o pe no meio da borda de baixo do tile; os vizinhos se sobrepoem (o de baixo na frente) e formam o
   * macico. O tile com veio de ferro ou de ouro mostra o bloco com o veio, e volta ao granito quando ele acaba. Sem a
   * arte carregada, nada: o chao de montanha de hoje. Devolve a contagem para o roteiro.
   */
  private atualizarMacico(): { readonly blocos: number; readonly ferro: number; readonly ouro: number } {
    const recursos = this.ponte.atual?.recursos ?? {};
    const arte = (estado: string): string => chaveDeTextura('trabalho', ID_DO_MACICO, estado);
    if (this.macico === null) {
      this.macico = new Map();
      if (!this.textures.exists(arte('granito_1'))) return { blocos: 0, ferro: 0, ouro: 0 };
      const { tilePx } = configDoMapa;
      const { codigos, largura, altura, tipos } = terrenoDeRender;
      for (let gy = 0; gy < altura; gy++) for (let gx = 0; gx < largura; gx++) {
        const chave = `${gx},${gy}`;
        const estado = blocoDoMacico(tipos[codigos[gy * largura + gx] as number] ?? '', gx, gy, recursos[chave]);
        if (estado === null || !this.textures.exists(arte(estado))) continue;
        const canto = gridToScreen({ gx, gy }, tilePx, ESCALA_DO_MUNDO);
        const pe = { x: canto.x + tilePx / 2, y: canto.y + tilePx };
        const imagem = this.add.image(pe.x, pe.y, arte(estado)).setOrigin(0.5, 1).setDepth(depthDeY(pe.y));
        this.luz?.tingir(imagem, pe.x, pe.y, `macico:${chave}`);
        this.macico.set(chave, { imagem, estado });
      }
    }
    let ferro = 0, ouro = 0;
    const { codigos, largura, tipos } = terrenoDeRender;
    for (const [chave, bloco] of this.macico) {
      // so o tile com veio muda (o veio acaba); o granito puro fica como nasceu
      if (!bloco.estado.startsWith('granito') && bloco.estado !== 'sem-veio') {
        const { gx, gy } = tileDeChave(chave);
        const estado = blocoDoMacico(tipos[codigos[gy * largura + gx] as number] ?? '', gx, gy, recursos[chave]);
        if (estado === null) {
          // o veio da rocha acabou: o bloco sai e volta o lajedo
          bloco.imagem.setVisible(false);
          bloco.estado = 'sem-veio';
        } else if (estado !== bloco.estado && this.textures.exists(arte(estado))) {
          bloco.imagem.setTexture(arte(estado));
          bloco.estado = estado;
        }
      }
      if (bloco.estado.startsWith('ferro')) ferro++;
      else if (bloco.estado.startsWith('ouro')) ouro++;
    }
    return { blocos: [...this.macico.values()].filter((b) => b.estado !== 'sem-veio').length, ferro, ouro };
  }

  private pintarVegetacao(chave: string, codigo: number): void {
    const desenho = this.desenhoPorCodigo[codigo];
    const atual = this.vegetacaoDesenhada.get(chave);
    if (desenho?.como !== 'vegetacao') {
      atual?.destroy();
      this.vegetacaoDesenhada.delete(chave);
      this.ultimoTickDaVegetacao.delete(chave);
      // D-TELA-VENTO-NA-VISTA: a arvore cortada sai da lista da vista ja no proximo quadro; sem
      // isto, o vento seguiria girando o sprite destruido ate a camera mexer.
      if (atual !== undefined) this.vegetacaoNova = true;
      this.rochaDesenhada.delete(chave);
      this.crescimentoDesenhado.delete(chave);
      return;
    }
    if (this.ponte.atual?.recursos[chave]?.tipo === 'rock') this.rochaDesenhada.add(chave);
    else this.rochaDesenhada.delete(chave);
    // F-REPL-e — PNG do estado, se houver; senao a adulta do tile encolhida pelo
    // estado (placeholder). Sem arte de vegetacao nenhuma, nem se chega aqui: o
    // marcador da camada de tile e o fallback de hoje.
    const crescimento = this.crescimentoDoTile(chave);
    const chaveDoEstado = crescimento === null
      ? null : chaveDeTextura('vegetacao', desenho.entrada.id, crescimento);
    const texturaBase = this.texturaDaVegetacao(desenho, chave);
    const estadoBase = texturaBase.split(':').slice(2).join(':');
    const especie = estadoBase === 'seca' ? 'presente' : estadoBase.replace(/^seca:/, '');
    const comPng = chaveDoEstado !== null && this.textures.exists(chaveDoEstado)
      && temArteJuvenilDaEspecie(desenho.entrada.id, estadoBase);
    const textura = comPng && chaveDoEstado !== null ? chaveDoEstado : texturaBase;
    const escala = textura.startsWith('vegetacao:rock:v') ? configDaSerra.escala
      : crescimento === null || comPng ? 1 : escalaDoPlaceholder(crescimento);
    if (crescimento === null) this.crescimentoDesenhado.delete(chave);
    else this.crescimentoDesenhado.set(chave, { estado: crescimento, fonte: comPng ? 'png' : 'placeholder', escala, especie });
    if (atual?.texture.key === textura && atual.scaleX === escala) return;
    if (desenho.entrada.id === 'tree' && atual !== undefined && atual.texture.key !== textura) this.repinturasDaCaatinga++;
    if (desenho.entrada.id === 'rock') this.repinturasDaSerra++;
    atual?.destroy();
    this.vegetacaoNova = true;
    this.ultimoTickDaVegetacao.delete(chave);
    const { tilePx } = configDoMapa;
    const canto = gridToScreen(tileDeChave(chave), tilePx, ESCALA_DO_MUNDO);
    const pe = { x: canto.x + tilePx / 2, y: canto.y + tilePx };
    const imagem = this.add.image(pe.x, pe.y, textura)
      .setOrigin(desenho.entrada.anchor[0], desenho.entrada.anchor[1])
      .setScale(escala)
      .setDepth(depthDeY(pe.y));
    this.luz?.tingir(imagem, pe.x, pe.y, `vegetacao:${chave}`);
    if (this.arvoresCortadas.has(chave)) imagem.setVisible(false);
    this.vegetacaoDesenhada.set(chave, imagem);
  }

  /** A cena so aplica a transformacao pura. O pe e o mesmo usado para tingir a luz. */
  private atualizarVento(): number {
    const recursos = this.ponte.atual?.recursos;
    if (!recursos) return 0;
    if (!this.ventoLigado) {
      for (const imagem of this.vegetacaoDesenhada.values()) {
        if (imagem.rotation !== 0) imagem.setRotation(0);
      }
      return 0;
    }
    const camera = this.cameras.main.worldView;
    const quadro = {
      tick: this.ponte.atual?.tick ?? 0,
      alfa: this.relogio.alfa(),
      vista: `${camera.x},${camera.y},${camera.width},${camera.height}`,
    };
    if (!quadroDoVentoMudou(this.ultimoQuadroDoVento, quadro, this.vegetacaoNova)) return 0;
    if (this.vegetacaoNova || this.ultimoQuadroDoVento?.vista !== quadro.vista) {
      this.arvoresNaVista = [];
      for (const [chave, imagem] of this.vegetacaoDesenhada) {
        const tipo = recursos[chave]?.tipo;
        if (!tipo || !balancaVegetacao(tipo, dadosDoVento)) continue;
        const entrada = assetDaCamada(manifestoDoJogo, 'vegetacao', tipo);
        if (entrada && arvoreNaVista(imagem, entrada.anchor, entrada.tamanho, imagem.scaleX, camera)) {
          this.arvoresNaVista.push([chave, imagem]);
        }
      }
    }
    this.ultimoQuadroDoVento = quadro;
    this.vegetacaoNova = false;
    let quantos = 0;
    const ticksNaVista: Record<string, number> = {};
    const arvores: Record<string, { especie: string; anguloGraus: number }> = {};
    for (const [chave, imagem] of this.arvoresNaVista) {
      const { gx, gy } = tileDeChave(chave);
      const especie = especieDoVentoDaVegetacao(imagem.texture.key.split(':')[1] ?? '',
        imagem.texture.key.split(':').slice(2).join(':') || 'presente');
      const transformacao = transformacaoDoVento(
        dadosDoVento, quadro.tick, quadro.alfa, gx, gy, imagem.x, imagem.y, especie,
      );
      arvores[chave] = { especie, anguloGraus: transformacao.deslocamentoGraus };
      // Gira em volta da origem que o sprite ja tem (o anchor do manifesto, posto ao nascer), e
      // nao de uma origem fixa: com outro anchor, o pe sairia do lugar.
      imagem.setRotation(transformacao.rotacao);
      this.ultimoTickDaVegetacao.set(chave, quadro.tick);
      ticksNaVista[chave] = quadro.tick;
      quantos += 1;
    }
    if (window.__cangaco) {
      window.__cangaco.ticksDaVegetacaoNaVista = ticksNaVista;
      window.__cangaco.arvoresDoVentoNaVista = arvores;
    }
    return quantos;
  }

  /** F-REPL-e — o estado de crescimento do tile, pela mesma funcao que o teste confere
   *  contra o `tileMaduro` da sim. */
  /** BUG-W — a opacidade da celula pelo estagio da cultura (`estagioDaCultura`). So o que
   *  nao e vegetacao: a arvore cresce como sprite em pe. Sem relogio (tile do mapa,
   *  esgotado), a celula fica cheia. `repor`: o tile acabou de ser trocado e a opacidade
   *  voltou a 1, entao reaplica mesmo sem mudanca de estagio. */
  private pintarEstagio(
    camada: Phaser.Tilemaps.TilemapLayer, chave: string, recurso: RecursoNoTile, codigo: number, repor: boolean,
  ): void {
    const tick = this.ponte.atual?.tick ?? 0;
    const estagio = this.desenhoPorCodigo[codigo]?.como === 'vegetacao'
      ? null
      // I-CLIMA-CRESCIMENTO: o tempo de crescer e o da estacao da semeadura, a mesma conta da sim
      : estagioDaCultura(recurso, tick, recurso.semeadoEm === undefined
        ? recursosDeRender.ticksDeCrescer[recurso.tipo] ?? 0
        : ticksParaAmadurecer(recurso.tipo, recursosDeRender.ticksDeCrescer[recurso.tipo] ?? 0, recurso.semeadoEm, undefined, recurso.irrigado === true));
    const desenho = this.desenhoPorCodigo[codigo];
    const geometria = geometriaDaCultura(recurso.tipo, estagio, configDoMapa.tilePx);
    const arte = desenho?.como === 'textura'
      ? texturaDoEstagioDaCultura(recurso.tipo, estagio, desenho.chave, chave => this.textures.exists(chave)) : null;
    const emPe = (geometria.emPe || arte?.juvenil === true) && desenho?.como === 'textura';
    const atual = this.culturasEmPe.get(chave);
    if (emPe) {
      const textura = arte?.chave ?? desenho.chave;
      if (!atual || atual.texture.key !== textura) {
        atual?.destroy();
        const canto = gridToScreen(tileDeChave(chave), configDoMapa.tilePx, ESCALA_DO_MUNDO);
        const imagem = this.add.image(canto.x + geometria.peX, canto.y + geometria.peY, textura)
          .setOrigin(0.5, 1).setDisplaySize(geometria.largura, geometria.altura)
          .setDepth(depthDeY(canto.y + geometria.peY));
        this.luz?.tingir(imagem, imagem.x, imagem.y, `cultura:${chave}`);
        this.culturasEmPe.set(chave, imagem);
      }
    } else if (atual) {
      atual.destroy();
      this.culturasEmPe.delete(chave);
    }
    if (!repor && estagio === (this.estagioDesenhado.get(chave) ?? null)) return;
    const { gx, gy } = tileDeChave(chave);
    camada.getTileAt(gx, gy)?.setAlpha(emPe ? 0 : estagio === null ? 1 : ALFA_DO_ESTAGIO[estagio]);
    if (estagio === null) this.estagioDesenhado.delete(chave);
    else this.estagioDesenhado.set(chave, estagio);
  }

  private crescimentoDoTile(chave: string): EstadoDeCrescimento | null {
    const estadoDoJogo = this.ponte.atual;
    if (!estadoDoJogo) return null;
    const recurso = estadoDoJogo.recursos[chave];
    if (recurso === undefined) return null;
    return estadoDeCrescimento(recurso, estadoDoJogo.tick, recursosDeRender.ticksDeCrescer[recurso.tipo] ?? 0);
  }

  /**
   * Variacao puramente visual e estavel: o mesmo tile sempre recebe a mesma
   * especie, sem RNG e sem acrescentar ids a simulacao. `presente` continua
   * sendo o fallback quando algum derivado nao foi carregado.
   */
  private especiesCarregadasDaVegetacao(entrada: Pick<EntradaDeAsset, 'id' | 'estados'>): string[] {
    return especiesDaVegetacao(Object.keys(entrada.estados)).filter((estado) => (
      this.textures.exists(chaveDeTextura('vegetacao', entrada.id, estado))
    )).map((estado) => chaveDeTextura('vegetacao', entrada.id, estado));
  }

  private texturaDaVegetacao(
    desenho: Extract<DesenhoDoRecurso, { readonly como: 'vegetacao' }>,
    chave: string,
  ): string {
    if (desenho.entrada.id === 'rock') {
      const { gx, gy } = tileDeChave(chave);
      const recursos = this.ponte.atual?.recursos ?? {};
      const mascara = mascaraCardinal((dx, dy) => {
        const vizinho = recursos[`${gx + dx},${gy + dy}`];
        return vizinho?.tipo === 'rock' && vizinho.quantidade > 0;
      });
      const chaveDaMascara = chaveDeTextura('vegetacao', 'rock', `m${mascara}`);
      const anterior = this.textures.exists(chaveDaMascara) ? chaveDaMascara : desenho.chave;
      return texturaDaSerra(this.memoriaDaSerra.trechos.get(chave) ?? null, (textura) => this.textures.exists(textura), anterior) ?? anterior;
    }
    const estados = this.especiesCarregadasDaVegetacao(desenho.entrada);
    if (estados.length === 0) return desenho.chave;
    const { gx, gy } = tileDeChave(chave);
    const normal = especieDoTile(estados, gx, gy);
    return desenho.entrada.id === 'tree'
      ? texturaDaCaatinga(normal, gx, gy, this.degrauSazonal, (textura) => this.textures.exists(textura))
      : normal;
  }

  /** Mascaras publicadas para o roteiro provar a troca dos quatro vizinhos. */
  private mascarasDoLajedo(): Record<string, number> {
    const recursos = this.ponte.atual?.recursos ?? {};
    const mascaras: Record<string, number> = {};
    for (const [chave, recurso] of Object.entries(recursos)) {
      if (recurso.tipo !== 'rock' || recurso.quantidade <= 0) continue;
      const { gx, gy } = tileDeChave(chave);
      mascaras[chave] = mascaraCardinal((dx, dy) => {
        const vizinho = recursos[`${gx + dx},${gy + dy}`];
        return vizinho?.tipo === 'rock' && vizinho.quantidade > 0;
      });
    }
    return mascaras;
  }

  /** F-TR-b — o estado da textura de cada sprite de rocha de pe, lido da imagem. */
  private lajedoDesenhado(): Record<string, string> {
    // BUG-N3: le o que FOI pintado como rocha, nao o `recursos` de agora — assim o
    // sprite que sobrasse de uma rocha esgotada aparece aqui e o roteiro o reprova
    const desenhado: Record<string, string> = {};
    for (const chave of this.rochaDesenhada) {
      const imagem = this.vegetacaoDesenhada.get(chave);
      desenhado[chave] = imagem === undefined ? '(sem sprite)' : imagem.texture.key.split(':').pop() ?? '';
    }
    return desenhado;
  }

  /** F-TR — o indice de cada tile de borda E a mascara (`putTileAt(mascara)`), entao
   *  ler a camada de volta devolve a transicao que a tela desenhou. */
  private lerTransicoesVisiveis(
    camadas: Readonly<Record<string, Phaser.Tilemaps.TilemapLayer>>,
  ): Record<string, Record<string, number>> {
    const vista = this.cameras.main.worldView;
    const transicoes: Record<string, Record<string, number>> = {};
    for (const [familia, camada] of Object.entries(camadas)) {
      const mascaras: Record<string, number> = {};
      const tiles = camada.getTilesWithinWorldXY(
        vista.x, vista.y, vista.width, vista.height, { isNotEmpty: true },
      );
      for (const tile of tiles) mascaras[`${tile.x},${tile.y}`] = tile.index;
      transicoes[familia] = mascaras;
    }
    return transicoes;
  }

  /** Lido de volta da camada desenhada, como `contarTerrenoVisivel`: o roteiro
   *  afirma sobre o que a cena TEM na tela, nao sobre o dado que a alimentou. */
  private contarRecursosVisiveis(camada: Phaser.Tilemaps.TilemapLayer): Record<string, number> {
    const vista = this.cameras.main.worldView;
    const contagem: Record<string, number> = {};
    for (const tipo of recursosDeRender.tipos) contagem[tipo] = 0;
    contagem.esgotado = 0;
    contagem.emPousio = 0;
    for (const tile of camada.getTilesWithinWorldXY(vista.x, vista.y, vista.width, vista.height)) {
      if (tile.index <= 0) continue;
      const chave = tile.index === recursosDeRender.codigoEsgotado ? 'esgotado'
        : tile.index === recursosDeRender.codigoEmPousio ? 'emPousio' : recursosDeRender.tipos[tile.index - 1];
      if (chave !== undefined) contagem[chave] = (contagem[chave] as number) + 1;
    }
    return contagem;
  }

  private criarTilemap(
    tilePx: number, largura: number, altura: number, textura: string,
  ): Phaser.Tilemaps.TilemapLayer {
    const mapa = this.make.tilemap({ tileWidth: tilePx, tileHeight: tilePx, width: largura, height: altura });
    const tileset = mapa.addTilesetImage('terreno', textura, tilePx, tilePx, MARGEM_DA_TIRA, ESPACAMENTO_DA_TIRA);
    if (!tileset) throw new Error('WorldScene: falha ao criar o tileset de terreno.');
    const camada = mapa.createBlankLayer('chao', tileset);
    if (!camada) throw new Error('WorldScene: falha ao criar a camada de chao.');
    // Preenche com o codigo 0 e so visita o que difere: no mapa base a grande
    // maioria dos tiles e grama, e `fill` custa uma passada contra as duas de
    // um `putTileAt` por tile.
    const { codigos, largura: larguraDoTerreno, altura: alturaDoTerreno } = terrenoDeRender;
    for (let gy = 0; gy < altura; gy += 1) {
      for (let gx = 0; gx < largura; gx += 1) {
        const dentroDoDado = gx < larguraDoTerreno && gy < alturaDoTerreno;
        const codigo = dentroDoDado ? codigos[gy * larguraDoTerreno + gx] as number : 0;
        const variante = this.hashVisual(gx, gy, codigo) % VARIANTES_DE_TERRENO;
        camada.putTileAt(codigo * VARIANTES_DE_TERRENO + variante, gx, gy);
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
      const codigo = Math.floor(tile.index / VARIANTES_DE_TERRENO);
      const tipo = terrenoDeRender.tipos[codigo];
      if (tipo !== undefined) contagem[tipo] = (contagem[tipo] as number) + 1;
    }
    return contagem;
  }

  /** Chamine sem quadros: memoria de trabalho e pool independente, redesenho por tick/alfa/vista. */
  private atualizarFumaca(debug: EstadoDebug, tilePx: number): void {
    debug.particulasCalculadasNesteQuadro = 0;
    const jogo = this.ponte.atual;
    if (jogo === null) return;
    const alfa = this.relogio.alfa();
    const vista = this.cameras.main.worldView;
    const chave = `${jogo.tick},${alfa},${vista.x},${vista.y},${vista.width},${vista.height}`;
    if (chave === this.ultimoQuadroDaFumaca) return;
    this.ultimoQuadroDaFumaca = chave;
    if (this.tickDaFumaca !== null && jogo.tick < this.tickDaFumaca) {
      for (const memoria of this.chamines.values()) {
        memoria.trabalhandoDesde = null;
        memoria.parouEm = null;
      }
    }
    this.tickDaFumaca = jogo.tick;
    const desenhada: Record<string, readonly ParticulaDaFumaca[]> = {};
    const fagulhas: Record<string, readonly ParticulaDaFumaca[]> = {};
    for (const memoria of this.chamines.values()) {
      for (const grafico of memoria.pool) grafico.setVisible(false);
      for (const grafico of memoria.poolFagulha) grafico.setVisible(false);
    }
    const foraDaVista = prediosInimigosForaDaVista(jogo);
    for (const id of jogo.predios.ordem) {
      const predio = jogo.predios.porId[id];
      // F-TELA-NEVOA: a chamine do inimigo fora da vista nao fuma na tela
      if (predio === undefined || foraDaVista.has(id)) continue;
      const ancora = DADOS_DO_TRABALHO.ancoras[predio.tipo]?.trabalho?.fumaca;
      if (ancora === undefined) continue;
      const fogo = DADOS_DO_TRABALHO.ancoras[predio.tipo]?.trabalho?.fogo;
      // Um manifesto futuro com quadros continua no laco da F-VIVO-b.
      if (this.textures.exists(chaveDeTextura('trabalho', ID_DA_FUMACA, `${ID_DA_FUMACA}_1`))) continue;
      let memoria = this.chamines.get(id);
      if (memoria === undefined) {
        memoria = { trabalhandoDesde: null, parouEm: null,
          pool: Array.from({ length: dadosDaFumaca.maximoPorChamine }, () => this.add.graphics().setVisible(false)),
          poolFagulha: fogo === undefined ? [] : Array.from({ length: dadosDaFumaca.fagulha.maximoPorFogo }, () => this.add.graphics().setVisible(false)) };
        this.chamines.set(id, memoria);
      }
      const ocupante = predio.estado === 'completo' && predio.ocupante !== null
        ? jogo.unidades.porId[predio.ocupante] ?? null : null;
      const trabalhando = quadroDaFumaca(predio, ocupante, jogo.tick, DADOS_DO_TRABALHO) !== null;
      if (trabalhando && (memoria.trabalhandoDesde === null || memoria.parouEm !== null)) {
        memoria.trabalhandoDesde = jogo.tick;
        memoria.parouEm = null;
      } else if (!trabalhando && memoria.trabalhandoDesde !== null && memoria.parouEm === null) {
        memoria.parouEm = jogo.tick;
      }
      const aparencia = aparenciaDoPredio(predio.tipo);
      const caixa = this.caixaDoPredio(predio.tipo, aparencia.largura * tilePx, aparencia.altura * tilePx);
      const canto = gridToScreen({ gx: predio.gx, gy: predio.gy }, tilePx, ESCALA_DO_MUNDO);
      // Mantem a memoria do trabalho fora da vista, mas nao calcula particulas ali.
      const margem = dadosDaFumaca.vidaTicks * (dadosDaFumaca.subidaTilesPorTick
        + dadosDaFumaca.velocidadeTilesPorTick + dadosDaFumaca.crescimentoTilesPorTick) * tilePx;
      if (canto.x + caixa.x + caixa.w + margem < vista.x || canto.x + caixa.x - margem > vista.right
        || canto.y + caixa.y + caixa.h + margem < vista.y || canto.y + caixa.y - margem > vista.bottom) continue;
      const ponto = { x: (canto.x + caixa.x + caixa.w * ancora[0]) / tilePx,
        y: (canto.y + caixa.y + caixa.h * ancora[1]) / tilePx };
      const particulas = particulasDaFumaca(dadosDaFumaca, dadosDoVento, jogo.tick, alfa,
        ponto, memoria.trabalhandoDesde, memoria.parouEm);
      debug.particulasCalculadasNesteQuadro += particulas.length;
      desenhada[id] = particulas.filter((p) => p.x * tilePx + p.raio * tilePx >= vista.x
        && p.x * tilePx - p.raio * tilePx < vista.right && p.y * tilePx + p.raio * tilePx >= vista.y
        && p.y * tilePx - p.raio * tilePx < vista.bottom);
      desenhada[id]?.forEach((particula, indice) => {
        const grafico = memoria.pool[indice];
        if (grafico === undefined) return;
        grafico.clear().setPosition(particula.x * tilePx, particula.y * tilePx)
          .setDepth(depthDeY(canto.y + aparencia.altura * tilePx) + 0.1).setVisible(true);
        grafico.fillStyle(Number.parseInt(dadosDaFumaca.cor.slice(1), 16), particula.opacidade);
        grafico.fillCircle(0, 0, particula.raio * tilePx);
      });
      if (fogo !== undefined) {
        const pontoDoFogo = { x: (canto.x + caixa.x + caixa.w * fogo[0]) / tilePx,
          y: (canto.y + caixa.y + caixa.h * fogo[1]) / tilePx };
        const pontos = particulasDaFagulha(dadosDaFumaca.fagulha, jogo.tick, alfa,
          pontoDoFogo, memoria.trabalhandoDesde, memoria.parouEm);
        debug.particulasCalculadasNesteQuadro += pontos.length;
        fagulhas[id] = pontos.filter((p) => p.x * tilePx + p.raio * tilePx >= vista.x
          && p.x * tilePx - p.raio * tilePx < vista.right && p.y * tilePx + p.raio * tilePx >= vista.y
          && p.y * tilePx - p.raio * tilePx < vista.bottom);
        fagulhas[id]?.forEach((particula, indice) => {
          const grafico = memoria.poolFagulha[indice];
          if (grafico === undefined) return;
          grafico.clear().setPosition(particula.x * tilePx, particula.y * tilePx)
            .setDepth(depthDeY(canto.y + aparencia.altura * tilePx) + 0.2).setVisible(true);
          grafico.fillStyle(Number.parseInt(dadosDaFumaca.fagulha.cor.slice(1), 16), particula.opacidade);
          grafico.fillCircle(0, 0, particula.raio * tilePx);
        });
      }
    }
    for (const id of chaminesRemovidas([...this.chamines.keys()], new Set(jogo.predios.ordem))) {
      for (const grafico of this.chamines.get(id)!.pool) grafico.destroy();
      for (const grafico of this.chamines.get(id)!.poolFagulha) grafico.destroy();
      this.chamines.delete(id);
    }
    debug.fumacaPorPredio = desenhada;
    debug.poolDaFumaca = [...this.chamines.values()].reduce((total, m) => total + m.pool.length, 0);
    debug.fagulhaPorPredio = fagulhas;
    debug.poolDaFagulha = [...this.chamines.values()].reduce((total, m) => total + m.poolFagulha.length, 0);
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
    const tick = estadoDoJogo.tick;
    if (this.tickDoCurral !== null && (tick < this.tickDoCurral || tick > this.tickDoCurral + MAX_PASSOS_POR_QUADRO)) {
      this.curralGuardado.clear();
    }
    this.tickDoCurral = tick;
    for (const id of this.curralGuardado.keys()) if (!vivos.has(id)) this.curralGuardado.delete(id);
    for (const [id, item] of this.desenhados) {
      if (!vivos.has(id)) {
        item.objeto.destroy();
        this.desenhados.delete(id);
        this.panosDasBandeiras.delete(id);
      }
    }
    const porEstagio = contagemDeEstagios();
    // F-TELA-NEVOA: o predio inimigo fora da vista nao se desenha (GDD 6.5, nivel de regra)
    const foraDaVista = prediosInimigosForaDaVista(estadoDoJogo);
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
    const acudesNoDebug: Record<string, { readonly agua: number; readonly estado: string; readonly sprite: string | null }> = {};
    // F-VIVO-a: o que cada pilha desenhou, da MESMA lista que vai para `criarPredio`.
    const pilhasNoDebug: Record<string, readonly PilhaNoDebug[]> = {};
    // F-VIVO-b: o quadro de trabalho de cada predio animando, da MESMA chamada do desenho.
    const quadrosNoDebug: Record<string, QuadroNoDebug> = {};
    // F-VIVO-e: o ocioso de cada casa com gente dentro e sem trabalho, idem.
    const ociososNoDebug: Record<string, OciosoNoDebug> = {};
    // F-VIVO-h: a escola treinando, idem.
    const escolasNoDebug: Record<string, OciosoNoDebug> = {};
    const animaisNoDebug: Record<string, readonly AnimalNoDebug[]> = {};
    const comensaisNoDebug: Record<string, readonly ComensalNoDebug[]> = {};
    const camadasNoDebug: Record<string, CamadasEmPx> = {};
    // D-TELA-07: a placa de pausado, em px de mundo, da MESMA caixa que `criarPredio` desenha.
    const sinaisNoDebug: Record<string, SinalDePausadoNoDebug> = {};
    // F17g: as obras desenhadas pela revelacao, da MESMA conta que vai para `criarPredio`.
    const revelacoes: Record<string, RevelacaoDaObra> = {};
    for (const id of estadoDoJogo.predios.ordem) {
      const predio = estadoDoJogo.predios.porId[id];
      if (!predio) continue;
      doEstado[id] = {
        tipo: predio.tipo,
        lado: predio.lado,
        corDoBando: corDoBando(predio.lado),
        estado: predio.estado,
        gx: predio.gx,
        gy: predio.gy,
        hp: predio.hp,
        pausado: predio.estado === 'completo' ? predio.pausado : false,
        ocupante: predio.estado === 'completo' ? predio.ocupante : null,
        naVista: !foraDaVista.has(id),
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
      // BUG-N2: o completo danificado em combate continua `completo` (nao vira obra)
      const estagio = estagioDoPredio(
        predio.estado, predio.hp, aparencia.hpTotal, canteiro === null || canteiro.nivelada,
      );
      // F17g: obra de predio com o PAR carregado e revelada pelo `hp`; sem o par,
      // os seis estagios de antes. Predio de pe continua o `completo` inteiro.
      const par = predio.estado === 'obra' ? this.parDeRevelacao(predio.tipo) : null;
      const revelacao = par === null
        ? null
        : revelacaoVisualDaObra(
          predio.hp, aparencia.hpTotal, aparencia.custo['timber'] ?? 0, aparencia.custo['stone'] ?? 0, !par.unica,
        );
      if (par === null || revelacao === null) {
        porEstagio[estagio] += 1;
        sprites[id] = this.spriteDesenhado(predio, estagio)?.chave ?? null;
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
      const pilhas = pilhasVisiveisDoPredio(predio, DADOS_DAS_PILHAS);
      if (pilhas.length > 0) {
        pilhasNoDebug[id] = pilhas.map((x) => ({
          gaveta: x.gaveta, mercadoria: x.mercadoria, n: x.n,
          ladoPx: ladoDaMercadoriaNoEstoque(predio.tipo, x.mercadoria, ladoPadraoDoEstoque(tilePx)),
          ...this.fonteNoDebug(x.mercadoria, predio.tipo),
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
      const quadroDeFumaca = quadroDaFumaca(predio, ocupante, estadoDoJogo.tick, DADOS_DO_TRABALHO);
      const fumaca = quadroDeFumaca !== null
        && this.textures.exists(chaveDeTextura('trabalho', ID_DA_FUMACA, `${ID_DA_FUMACA}_${quadroDeFumaca}`))
        ? quadroDeFumaca : null;
      if (quadro !== null) {
        quadrosNoDebug[id] = { ...quadro, sprite: this.texturaDoQuadro(predio.tipo, quadro) !== null };
      }
      // F-VIVO-e: casa com gente dentro e sem trabalho desenha o ocioso no mesmo lugar do
      // quadro. Os dois nunca coincidem (`quadroOcioso` exige quadro nulo).
      const ocioso = quadroOcioso(predio, ocupante, estadoDoJogo.tick, DADOS_DO_TRABALHO);
      // F-VIVO-h: a escola nao tem receita nem ocupante; anima enquanto a fila treina.
      const treino = quadroDaEscola(predio, estadoDoJogo.treino[id], estadoDoJogo.tick);
      const quadroDesenhado: QuadroDeTrabalho | null = quadro
        ?? (ocioso !== null ? { laco: ID_DO_OCIOSO, n: ocioso } : treino !== null ? { laco: LACO_DA_ESCOLA, n: treino } : null);
      if (ocioso !== null && quadroDesenhado !== null) {
        ociososNoDebug[id] = { n: ocioso, sprite: this.texturaDoQuadro(predio.tipo, quadroDesenhado) !== null };
      }
      if (treino !== null && quadroDesenhado !== null) {
        escolasNoDebug[id] = { n: treino, sprite: this.texturaDoQuadro(predio.tipo, quadroDesenhado) !== null };
      }
      const chaveDoTrabalho = `${quadroDesenhado === null ? '-' : `${quadroDesenhado.laco}_${quadroDesenhado.n}`}/${fumaca ?? '-'}`;
      // F-VIVO-c: a idade anda com o progresso e o quadro com o tick, sem mexer em
      // estado nem em estagio — mesma razao da pilha e do trabalho.
      // F-VIVO-g: entre duas entregas o curral da sim esvazia; ocupado, a tela guarda o ultimo.
      const animais = curralDesenhado(
        this.curralGuardado.get(id) ?? [], animaisDoCurral(predio, DADOS_DOS_ANIMAIS),
        predio.estado === 'completo' && predio.ocupante !== null,
      );
      if (animais.length > 0) this.curralGuardado.set(id, animais);
      else this.curralGuardado.delete(id);
      const quadroAnimal = quadroDoAnimal(predio, ocupante, estadoDoJogo.tick);
      if (animais.length > 0) {
        animaisNoDebug[id] = animais.map((a) => ({
          i: a.i, animal: a.animal, idade: a.idade, quadro: quadroAnimal,
          sprite: this.texturaDoAnimal(a, quadroAnimal) !== null,
        }));
      }
      const caso = CASO_DO_PREDIO[predio.tipo];
      if (predio.estado === 'completo' && caso !== undefined) {
        camadasNoDebug[id] = this.camadasEmPx(predio.tipo, caso, quadro, pilhas.length > 0, animais, tilePx);
      }
      const chaveDosAnimais = animais.length === 0 ? '-' : `${animais.map((a) => a.idade).join('')}/${quadroAnimal}`;
      // I-TELA-COMENSAIS-NA-BODEGA: quem come aparece a mesa; o quadro anda com o tick, e entra na chave como o animal
      const comensais = this.comensaisDoPredio(estadoDoJogo, predio);
      if (comensais.length > 0) {
        comensaisNoDebug[id] = comensais.map((c) => ({
          i: c.i, unidade: c.unidade, olha: c.lugar.olha, quadro: quadroDoComensal(estadoDoJogo.tick, c.i),
          sprite: this.texturaDoComensal(quadroDoComensal(estadoDoJogo.tick, c.i)) !== null,
        }));
      }
      const chaveDosComensais = comensais.length === 0 ? '-' : `${comensais.length}/${quadroDoComensal(estadoDoJogo.tick, 0)}`;
      // D-TELA-07: pausar e retomar mudam so `pausado`; entra na chave pelo mesmo motivo da pilha.
      const sinal = temSinalDePausado(predio);
      if (sinal) {
        const canto = gridToScreen({ gx: predio.gx, gy: predio.gy }, tilePx, ESCALA_DO_MUNDO);
        const corpo = this.caixaDoPredio(predio.tipo, aparencia.largura * tilePx, aparencia.altura * tilePx);
        const placa = caixaDoSinalDePausado(corpo, tilePx);
        sinaisNoDebug[id] = {
          texto: TEXTO_DO_SINAL_DE_PAUSADO,
          placa: { x: canto.x + placa.x, y: canto.y + placa.y, w: placa.w, h: placa.h },
          corpo: { x: canto.x + corpo.x, y: canto.y + corpo.y, w: corpo.w, h: corpo.h },
        };
      }
      // F17g: cada martelada muda a revelacao sem mudar o estagio de fallback.
      const chaveDoCorpo = revelacao === null ? '-' : chaveDaRevelacao(revelacao);
      // I-TELA-ACUDE-NA-TELA: o nivel muda sem mexer em estado nem em estagio; entra na chave pelo mesmo motivo da pilha
      const nivel = this.nivelDoAcude(predio);
      if (nivel !== null) acudesNoDebug[id] = { agua: (predio as PredioCompleto).agua ?? 0, estado: nivel, sprite: sprites[id] ?? null };
      const assinatura = `${linhas.map((l) => l.entregue).join(',')}|${chaveDoCanteiro(canteiro)}|${chaveDasPilhas}|${chaveDoTrabalho}|${chaveDosAnimais}|${chaveDoCorpo}|${sinal ? 'P' : '-'}|${nivel ?? '-'}|${chaveDosComensais}`;
      const existente = this.desenhados.get(id);
      if (existente && existente.estado === predio.estado && existente.estagio === estagio
        && existente.assinatura === assinatura) continue;
      const bandeiraExistente = this.panosDasBandeiras.get(id);
      if (bandeiraExistente && existente) {
        existente.objeto.remove([bandeiraExistente.mastro, bandeiraExistente.pano]);
      }
      existente?.objeto.destroy();
      this.desenhados.set(id, {
        estado: predio.estado, estagio, assinatura,
        objeto: this.criarPredio(
          predio, estagio, revelacao, linhas, canteiro, pilhas, quadroDesenhado, fumaca, animais, quadroAnimal, tilePx,
          comensais, estadoDoJogo.tick,
        ),
      });
    }
    for (const [id, item] of this.desenhados) item.objeto.setVisible(!foraDaVista.has(id));
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
    debug.acudes = acudesNoDebug;
    debug.pilhasDesenhadas = pilhasNoDebug;
    debug.quadrosDeTrabalho = quadrosNoDebug;
    debug.quadrosOciosos = ociososNoDebug;
    debug.quadrosDaEscola = escolasNoDebug;
    debug.animaisDoCurral = animaisNoDebug;
    debug.comensaisDaBodega = comensaisNoDebug;
    debug.modoAdmin = lerModoAdmin();
    debug.premium = { ligado: this.sombrasDeContato !== null, sombras: this.sombrasDeContato?.quantas() ?? 0, gradacao: this.gradacaoDeCor };
    debug.rotulosDePredio = this.rotulosDePredio;
    debug.cordasDoCanteiro = this.cordasDoCanteiroDesenhadas;
    debug.passosDasObrasEmOrdem = { ...this.passosDasObrasEmOrdem };
    debug.canteiroComArte = PECAS_DO_CANTEIRO.every((e) => this.textures.exists(chaveDeTextura('interface', `${ID_DO_CANTEIRO}-${e}`, 'normal')));
    debug.camadasEmPx = camadasNoDebug;
    debug.sinaisDePausado = sinaisNoDebug;
    debug.caixasDesenhadas = this.caixasDesenhadas(estadoDoJogo, sprites, tilePx);
  }

  /** F-ESC (c) — a caixa do sprite do predio completo, lida da IMAGEM que o container
   *  tem, e nao recalculada: e o que a tela mostra. Predio em obra ou sem arte fica de
   *  fora (placeholder do §9 nao tem regra de altura). */
  private caixasDesenhadas(
    estadoDoJogo: GameState, sprites: Readonly<Record<string, string | null>>, tilePx: number,
  ): Record<string, CaixaDesenhada> {
    const caixas: Record<string, CaixaDesenhada> = {};
    for (const [id, desenhado] of this.desenhados) {
      const predio = estadoDoJogo.predios.porId[id];
      const textura = sprites[id];
      if (predio?.estado !== 'completo' || textura === null || textura === undefined) continue;
      const imagem = desenhado.objeto.list.find((o): o is Phaser.GameObjects.Image => (
        o instanceof Phaser.GameObjects.Image && o.texture.key === textura
      ));
      if (imagem === undefined) continue;
      caixas[id] = {
        tipo: predio.tipo, textura,
        w: imagem.displayWidth, h: imagem.displayHeight,
        lote: aparenciaDoPredio(predio.tipo).largura * tilePx,
      };
    }
    return caixas;
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
    tipo: string, estagio: EstagioDaObra | ChaveDaRevelacao | EstadoDoAcude,
  ): { readonly chave: string; readonly entrada: EntradaDeAsset } | null {
    const entrada = assetDoPredio(manifestoDoJogo, tipo);
    if (!entrada) return null;
    if (!arquivoDoEstagio(entrada, estagio)) return null;
    const chave = chaveDaTextura(entrada.id, estagio);
    return this.textures.exists(chave) ? { chave, entrada } : null;
  }

  /** I-TELA-ACUDE-NA-TELA — o nivel do Acude completo escolhe o estado do sprite (`vazio`...`cheio`), quando o
   *  manifesto o tem; senao fica o `estagio` de sempre. `null` em quem nao e Acude completo. */
  private nivelDoAcude(predio: Predio): EstadoDoAcude | null {
    return predio.estado === 'completo' && predio.tipo === ID_DO_ACUDE
      ? estadoDoAcude(predio.agua ?? 0, capacidadeDoAcude, dadosDoAcudeVisual) : null;
  }

  private spriteDesenhado(predio: Predio, estagio: EstagioDaObra): { readonly chave: string; readonly entrada: EntradaDeAsset } | null {
    const nivel = this.nivelDoAcude(predio);
    return (nivel === null ? null : this.spriteDoPredio(predio.tipo, nivel)) ?? this.spriteDoPredio(predio.tipo, estagio);
  }

  /** Ajuste 10: par proprio quando existe, completo por partes quando nao.
   * Sem completo carregado, conserva os estagios de placeholder.
   * A mesma escolha publica o debug e desenha a obra. */
  private parDeRevelacao(tipo: string): {
    readonly unica: boolean;
    readonly madeira: { readonly chave: string; readonly entrada: EntradaDeAsset };
    readonly pedra: { readonly chave: string; readonly entrada: EntradaDeAsset };
  } | null {
    const pedra = this.spriteDoPredio(tipo, 'completo');
    if (!pedra) return null;
    const madeira = this.spriteDoPredio(tipo, 'madeira');
    return madeira ? { madeira, pedra, unica:false } : {madeira:pedra,pedra,unica:true};
  }

  /** Placeholder do §9: retangulo do tamanho do footprint com o nome
   *  tematico escrito por cima. Sem PNG em assets/base/, isto e o desenho
   *  definitivo desta sessao, nao uma falha. Uma OBRA (F07) e a marcacao no
   *  chao; a F11c divide essa fase em tres estagios derivados do `hp`
   *  (`estagio-obra.ts`): marcacao (nada martelado), madeira (em obra) e
   *  completo (o predio de pe, sem rotulo extra). */
  /** C-IA-03c — a bandeira do bando no canto do lote: um mastro e um pano na cor do lado
   *  (`corDoBando`, do tema). Sem ela o predio inimigo e identico ao do jogador. */
  private desenharBandeira(
    predio: Predio, tilePx: number, contato: { readonly x: number; readonly y: number } = { x: 4, y: 4 },
  ): Phaser.GameObjects.GameObject[] {
    const altura = tilePx * 0.6;
    const corDoPano = cor(corDoBando(predio.lado));
    const existente = this.panosDasBandeiras.get(predio.id);
    if (existente) {
      existente.mastro.setPosition(contato.x, contato.y - altura);
      existente.pano.setPosition(contato.x + LARGURA_DO_MASTRO, contato.y - altura);
      existente.gx = predio.gx;
      existente.gy = predio.gy;
      existente.quadro = null;
      if (existente.cor !== corDoPano) {
        existente.cor = corDoPano;
        this.pintarPano(existente.pano, corDoPano, this.pontosDoPano(predio.gx, predio.gy, tilePx));
      }
      return [existente.mastro, existente.pano];
    }
    const mastro = this.add.graphics().setPosition(contato.x, contato.y - altura);
    this.pintarMastro(mastro, altura);
    const pano = this.add.graphics().setPosition(contato.x + LARGURA_DO_MASTRO, contato.y - altura);
    this.pintarPano(pano, corDoPano, this.pontosDoPano(predio.gx, predio.gy, tilePx));
    this.panosDasBandeiras.set(predio.id, { pano, mastro, cor: corDoPano, gx: predio.gx, gy: predio.gy, quadro: null });
    return [mastro, pano];
  }

  private pontosDoPano(gx: number, gy: number, tilePx: number, tick = this.ponte.atual?.tick ?? 0, alfa = this.relogio.alfa()): { x: number; y: number }[] {
    return panoDaBandeira(dadosDoVento, {
      ...dadosDaBandeira, larguraPx: tilePx * 0.35, alturaPx: tilePx * 0.22,
    }, tick, alfa, gx, gy);
  }

  /** I-ARTE-BANDEIRA-COM-VOLUME — o mastro como cilindro de madeira (bordas escuras, meio claro: a luz e de cima, sem
   *  leste-oeste) e uma ponta de latao no topo. */
  private pintarMastro(g: Phaser.GameObjects.Graphics, altura: number): void {
    const madeira = cor(temaSertao.paleta.madeira);
    const w = LARGURA_DO_MASTRO;
    g.clear();
    g.fillStyle(corComTom(madeira, 0.7), 1).fillRect(0, 0, w, altura);
    g.fillStyle(corComTom(madeira, 1.25), 1).fillRect(w * 0.3, 0, w * 0.4, altura);
    g.fillStyle(0x000000, 0.25).fillEllipse(w / 2, altura, w * 3, w * 1.2);
    const r = w * 0.85;
    g.fillStyle(COR_DO_LATAO, 1).fillCircle(w / 2, -r * 0.6, r);
    g.fillStyle(corComTom(COR_DO_LATAO, 0.65), 1).fillCircle(w / 2, -r * 0.35, r * 0.7);
    g.fillStyle(COR_DO_LATAO, 1).fillCircle(w / 2, -r * 0.75, r * 0.7);
    g.fillStyle(0xfff4c8, 0.9).fillCircle(w / 2 - r * 0.25, -r * 0.95, r * 0.3);
  }

  /** I-ARTE-BANDEIRA-COM-VOLUME — o pano em faixas, cada uma no tom da inclinacao da onda (`tonsDoPano`), com a bainha
   *  de cima clara, a de baixo escura e o contorno. */
  private pintarPano(g: Phaser.GameObjects.Graphics, corDoPano: number, pontos: readonly { x: number; y: number }[]): void {
    const segmentos = dadosDaBandeira.segmentos;
    const tons = tonsDoPano(pontos, segmentos);
    const topo = (i: number) => pontos[i]!;
    const base = (i: number) => pontos[pontos.length - 1 - i]!;
    g.clear();
    tons.forEach((tom, i) => {
      g.fillStyle(corComTom(corDoPano, tom), 1);
      g.fillPoints([topo(i), topo(i + 1), base(i + 1), base(i)], true);
    });
    g.lineStyle(1, corComTom(corDoPano, 1.35), 0.9);
    g.strokePoints(Array.from({ length: segmentos + 1 }, (_, i) => ({ x: topo(i).x, y: topo(i).y + 1 })), false);
    g.lineStyle(1, corComTom(corDoPano, 0.5), 0.9);
    g.strokePoints(Array.from({ length: segmentos + 1 }, (_, i) => ({ x: base(i).x, y: base(i).y - 1 })), false);
    g.lineStyle(1, corComTom(cor(temaSertao.paleta.madeira), 0.8), 1);
    g.strokePoints([...pontos], true);
  }

  private atualizarBandeiras(tilePx: number): number {
    const vista = this.cameras.main.worldView;
    const quadro = { tick: this.ponte.atual?.tick ?? 0, alfa: this.relogio.alfa(),
      vista: `${vista.x},${vista.y},${vista.width},${vista.height}` };
    let redesenhadas = 0;
    for (const memoria of this.panosDasBandeiras.values()) {
      if (!quadroDoVentoMudou(memoria.quadro, quadro, false)) continue;
      const pai = memoria.pano.parentContainer;
      if (!pai) continue;
      const x = pai.x + memoria.pano.x;
      const y = pai.y + memoria.pano.y;
      const margem = dadosDaBandeira.amplitudeMaximaPx;
      if (x > vista.right || x + tilePx * 0.35 < vista.x ||
        y - margem > vista.bottom || y + tilePx * 0.22 + margem < vista.y) continue;
      // Mantem o objeto Phaser; redesenha o pano com a geometria e os tons da onda deste quadro.
      this.pintarPano(memoria.pano, memoria.cor, this.pontosDoPano(memoria.gx, memoria.gy, tilePx, quadro.tick, quadro.alfa));
      memoria.quadro = quadro;
      redesenhadas += 1;
    }
    return redesenhadas;
  }

  /** D-TELA-07 — a placa de pausado no alto do corpo: duas barras e a palavra do tema, na
   *  caixa de `caixaDoSinalDePausado`. Placeholder geometrico do §9 ate haver arte. */
  private desenharSinalDePausado(
    predio: Predio, corpo: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
    tilePx: number,
  ): Phaser.GameObjects.GameObject[] {
    if (!temSinalDePausado(predio)) return [];
    const c = caixaDoSinalDePausado(corpo, tilePx);
    const fundo = this.add.rectangle(c.x, c.y, c.w, c.h, 0x2c1d12, 0.85).setOrigin(0, 0);
    fundo.setStrokeStyle(1, 0xf2d6a2);
    const barraH = c.h * 0.6;
    const barraW = Math.max(2, c.h * 0.14);
    const y = c.y + (c.h - barraH) / 2;
    const x = c.x + c.h * 0.3;
    const barras = [x, x + barraW * 2].map((bx) => this.add.rectangle(bx, y, barraW, barraH, 0xf2d6a2, 1).setOrigin(0, 0));
    const rotulo = this.add.text(x + barraW * 3 + c.h * 0.25, c.y + c.h / 2, TEXTO_DO_SINAL_DE_PAUSADO, {
      fontFamily: 'monospace', fontSize: '11px', color: '#f2d6a2',
    });
    rotulo.setOrigin(0, 0.5);
    return [fundo, ...barras, rotulo];
  }

  private criarPredio(
    predio: Predio, estagio: EstagioDaObra, revelacao: RevelacaoDaObra | null,
    linhas: readonly LinhaDoMedidor[],
    canteiro: CanteiroDaObra | null, pilhas: readonly PilhaDesenhada[],
    quadro: QuadroDeTrabalho | null, fumaca: number | null,
    animais: readonly AnimalDoCurral[], quadroAnimal: number, tilePx: number,
    comensais: readonly ComensalNaMesa[] = [], tick = 0,
  ): Phaser.GameObjects.Container {
    const { largura, altura, nome } = aparenciaDoPredio(predio.tipo);
    const canto = gridToScreen({ gx: predio.gx, gy: predio.gy }, tilePx, ESCALA_DO_MUNDO);
    const larguraPx = largura * tilePx;
    const alturaPx = altura * tilePx;

    const sprite = this.spriteDesenhado(predio, estagio);
    // F17g: com revelacao, madeira embaixo e pedra (o `completo`) por cima.
    const par = revelacao === null ? null : this.parDeRevelacao(predio.tipo);
    // BUG-M: o lote vai por baixo do corpo revelado. Sem ele, a obra de poucas
    // marteladas e so o medidor no gramado, sem dizer quanto chao vai ocupar.
    const corpo = revelacao !== null && par !== null
      ? [
        ...this.desenharLote(estagio, larguraPx, alturaPx, canteiro, largura),
        ...this.desenharCamadaDaObra(predio.tipo, 'madeira', par.madeira, revelacao.madeira, larguraPx, alturaPx, `${predio.id}:madeira`),
        ...this.desenharCamadaDaObra(predio.tipo, 'pedra', par.pedra, revelacao.pedra, larguraPx, alturaPx, `${predio.id}:pedra`),
      ]
      : sprite === null
        ? this.desenharPlaceholder(estagio, nome, larguraPx, alturaPx, canteiro, largura)
        : [this.desenharSprite(sprite.chave, sprite.entrada, larguraPx, alturaPx)];
    const caixa = this.caixaDoPredio(predio.tipo, larguraPx, alturaPx);

    // O canteiro vai PRIMEIRO no container: ele e o chao, e o corpo da obra fica
    // por cima. O medidor da F17b continua por ultimo.
    const bandeiraNaArte = sprite?.entrada.ancoras?.bandeira;
    const escalaDaArte = sprite === null ? 1 : escalaDoSprite(sprite.entrada, REGRA_DE_ALTURA, tilePx, larguraPx, REGRA_DE_LARGURA);
    const contatoDaBandeira = bandeiraNaArte === undefined || sprite === null ? undefined : {
      x: larguraPx / 2 + (bandeiraNaArte[0] - sprite.entrada.anchor[0]) * sprite.entrada.tamanho[0] * escalaDaArte,
      y: alturaPx + (bandeiraNaArte[1] - sprite.entrada.anchor[1]) * sprite.entrada.tamanho[1] * escalaDaArte,
    };
    const container = this.add.container(canto.x, canto.y, [
      ...this.desenharCanteiro(canteiro, largura, tilePx),
      ...corpo,
      ...this.desenharTrabalho(predio.tipo, quadro, fumaca, caixa),
      ...this.desenharAnimais(animais, quadroAnimal, caixa, tilePx),
      ...this.desenharComensais(comensais, tick, caixa),
      ...this.desenharPilhas(predio.tipo, pilhas, caixa, tilePx),
      ...this.desenharMedidor(linhas, larguraPx, alturaPx, canteiro === null || canteiro.nivelada),
      ...this.desenharBandeira(predio, tilePx, contatoDaBandeira),
      ...this.desenharSinalDePausado(predio, caixa, tilePx),
    ]);
    container.setDepth(depthDeY(canto.y + alturaPx));
    this.luz?.tingirContainer(container, canto.x + larguraPx / 2, canto.y + alturaPx, `predio:${predio.id}`);
    return container;
  }

  /** O `anchor` e o ponto DO PNG que assenta no centro da borda inferior do
   *  footprint. Ele pode ficar acima da borda inferior da imagem quando uma
   *  escada ou outro volume transborda o lote para baixo.
   *
   *  A escala usa a regua canonica de 64 px por tile, nao a largura do canvas.
   *  Assim o canvas pode transbordar sem encolher o predio de volta ao lote.
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
    imagem.setScale(escalaDoSprite(entrada, REGRA_DE_ALTURA, configDoMapa.tilePx, larguraPx, REGRA_DE_LARGURA));
    return imagem;
  }

  /** F17g — uma camada do par revelada pela fracao: a obra sobe do chao.
   *  I-TELA-OBRA-PARTE-A-PARTE: por BLOCOS de uma grade (`data/obra-revelacao.json`), linha a linha
   *  de baixo para cima e, na linha, na ordem embaralhada pela `semente` (o predio e a camada). Uma
   *  imagem por bloco visivel, recortada no quadro da textura (px do arquivo); escala e ancoragem
   *  continuam as de `desenharSprite`. Fracao zero nao desenha nada. */
/** I-TELA-OBRA-EM-ORDEM-DE-CONSTRUCAO — a camada da obra: em ordem de construcao para os tipos da lista
   *  (`obra-revelacao.json: ordemDeConstrucao`), na grade de blocos para os outros. */
  private desenharCamadaDaObra(
    tipo: string, camada: CamadaDaObra, sprite: { readonly chave: string; readonly entrada: EntradaDeAsset }, fracao: Fracao,
    larguraPx: number, alturaPx: number, semente: string,
  ): Phaser.GameObjects.Image[] {
    const lista = (dadosDaObraRevelada as { readonly ordemDeConstrucao?: readonly string[] }).ordemDeConstrucao ?? [];
    if (!lista.includes(tipo)) return this.desenharRevelado(sprite, fracao, larguraPx, alturaPx, semente);
    const [num, den] = fracao;
    const passos = num <= 0 || den <= 0 ? 0 : num >= den ? PASSOS_DA_OBRA : Math.floor((PASSOS_DA_OBRA * num) / den);
    this.passosDasObrasEmOrdem[semente] = passos;
    if (passos <= 0) return [];
    if (passos >= PASSOS_DA_OBRA) return [this.desenharSprite(sprite.chave, sprite.entrada, larguraPx, alturaPx)];
    const chave = this.texturaDaObraNoPasso(sprite.chave, camada, passos);
    return chave === null ? this.desenharRevelado(sprite, fracao, larguraPx, alturaPx, semente)
      : [this.desenharSprite(chave, sprite.entrada, larguraPx, alturaPx)];
  }

  /** I-TELA-OBRA-EM-ORDEM-DE-CONSTRUCAO — os pixels e a ordem de cada arte (lidos uma vez), e a textura de cada passo
   *  (feita uma vez): so os pixels cuja ordem e menor que `passos`. `null` sem a arte carregada. */
  /** I-TELA-OBRA-EM-ORDEM-DE-CONSTRUCAO: o passo desenhado de cada camada (`<id>:madeira`, `<id>:pedra`), para o roteiro */
  private readonly passosDasObrasEmOrdem: Record<string, number> = {};
  private readonly ordensDaObra = new Map<string, { readonly pixels: Uint8ClampedArray; readonly ordem: Uint8Array; readonly w: number; readonly h: number }>();
  private texturaDaObraNoPasso(chave: string, camada: CamadaDaObra, passos: number): string | null {
    const alvo = `obra-em-ordem:${chave}:${passos}`;
    if (this.textures.exists(alvo)) return alvo;
    if (!this.textures.exists(chave)) return null;
    let lida = this.ordensDaObra.get(`${chave}|${camada}`);
    if (lida === undefined) {
      const fonte = this.textures.get(chave).getSourceImage() as CanvasImageSource & { readonly width: number; readonly height: number };
      const tela = document.createElement('canvas');
      tela.width = fonte.width; tela.height = fonte.height;
      const ctx = tela.getContext('2d');
      if (ctx === null) return null;
      ctx.drawImage(fonte, 0, 0);
      const dados = ctx.getImageData(0, 0, tela.width, tela.height);
      lida = { pixels: dados.data, ordem: ordemDeConstrucao({ width: tela.width, height: tela.height, data: dados.data }, camada), w: tela.width, h: tela.height };
      this.ordensDaObra.set(`${chave}|${camada}`, lida);
    }
    const textura = this.textures.createCanvas(alvo, lida.w, lida.h);
    if (textura === null) return null;
    const ctx = textura.getContext();
    const saida = ctx.createImageData(lida.w, lida.h);
    for (let i = 0; i < lida.ordem.length; i++) {
      if (lida.ordem[i]! < passos) saida.data.set(lida.pixels.subarray(i * 4, i * 4 + 4), i * 4);
    }
    ctx.putImageData(saida, 0, 0);
    textura.refresh();
    return alvo;
  }

  private desenharRevelado(
    sprite: { readonly chave: string; readonly entrada: EntradaDeAsset }, fracao: Fracao,
    larguraPx: number, alturaPx: number, semente: string,
  ): Phaser.GameObjects.Image[] {
    const grade = dadosDaObraRevelada as GradeDaObra;
    return blocosVisiveis(fracao, grade, semente).map((bloco) => {
      const imagem = this.desenharSprite(sprite.chave, sprite.entrada, larguraPx, alturaPx);
      const r = recorteDoBloco(bloco, grade, imagem.width, imagem.height);
      imagem.setCrop(r.x, r.y, r.w, r.h);
      return imagem;
    });
  }

  /** F-VIVO-a — o retangulo que o sprite ocupa dentro do container, pela mesma
   *  ancoragem e escala de `desenharSprite`. */
  /** F-VIVO-a: a fracao da ancora e do sprite `completo` (brief §4a). Sem ele, do lote. */
  private caixaDoPredio(
    tipo: string, larguraPx: number, alturaPx: number,
  ): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    const completo = this.spriteDoPredio(tipo, 'completo');
    return completo === null
      ? { x: 0, y: 0, w: larguraPx, h: alturaPx }
      : this.caixaDoSprite(completo.entrada, larguraPx, alturaPx);
  }

  /** F-VIVO-d — o tamanho de cada camada, da mesma geometria de `criarPredio`. */
  private camadasEmPx(
    tipo: string, caso: string, quadro: QuadroDeTrabalho | null, comPilha: boolean,
    animais: readonly AnimalDoCurral[], tilePx: number,
  ): CamadasEmPx {
    const { largura, altura } = aparenciaDoPredio(tipo);
    const caixa = this.caixaDoPredio(tipo, largura * tilePx, altura * tilePx);
    const [x0, y0, x1, y1] = areaDoTrabalho(DADOS_DO_TRABALHO.ancoras[tipo]);
    return {
      tipo, caso,
      corpo: [caixa.w, caixa.h],
      trabalho: quadro === null ? null : [caixa.w * (x1 - x0), caixa.h * (y1 - y0)],
      pilha: comPilha ? tilePx * LADO_DA_UNIDADE_EM_TILES : null,
      animais: animais.length === 0 ? null : animais.map((a) => ladoDoAnimalSemArte(a.idade, tilePx)),
    };
  }

  private caixaDoSprite(
    entrada: EntradaDeAsset, larguraPx: number, alturaPx: number,
  ): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    const escala = escalaDoSprite(entrada, REGRA_DE_ALTURA, configDoMapa.tilePx, larguraPx, REGRA_DE_LARGURA);
    const w = entrada.tamanho[0] * escala;
    const h = entrada.tamanho[1] * escala;
    return { x: larguraPx / 2 - w * entrada.anchor[0], y: alturaPx - h * entrada.anchor[1], w, h };
  }

  /** F-VIVO-a — a textura da unidade de uma mercadoria. D-TELA-03b: o PNG `pilha`, senao o icone
   *  da mercadoria, senao o quadrado do §9 (`icone-da-mercadoria.ts`). */
  private fonteDaPilha(mercadoria: string, tipo?: string): FonteDaPilha {
    const pendurados = pontosDosPeixesPendurados(tipo ?? '', mercadoria, 1);
    const peixe = pontosDosPeixesPendurados('inn', mercadoria, 1) !== null;
    return fonteDaPilha(mercadoria, iconesDoJogo, (chave) =>
      !(peixe && pendurados === null && chave.startsWith('pilha:')) && this.textures.exists(chave));
  }

  /** D-TELA-03b — a fonte da pilha para a ponte: `sprite` continua dizendo "PNG de pilha" (F-VIVO-a). */
  private fonteNoDebug(mercadoria: string, tipo?: string): { readonly sprite: boolean; readonly fonte: 'pilha' | 'icone' | 'quadrado' } {
    const { fonte } = this.fonteDaPilha(mercadoria, tipo);
    return { sprite: fonte === 'pilha', fonte };
  }

  /** I-TELA-COMENSAIS-NA-BODEGA — os comensais desta Bodega, nos lugares do manifesto. Outro predio: nenhum. */
  private comensaisDoPredio(estado: GameState, predio: Predio): readonly ComensalNaMesa[] {
    const lugares = DADOS_DAS_PILHAS.ancoras[predio.tipo]?.comensais;
    if (lugares === undefined) return [];
    const { largura, altura } = aparenciaDoPredio(predio.tipo);
    return comensaisDaBodega(estado, predio, [largura, altura], lugares);
  }

  /** I-TELA-COMENSAIS-NA-BODEGA — a textura do comensal no quadro, ou `null` (sem arte, nada: placeholder e so de predio). */
  private texturaDoComensal(quadro: number): string | null {
    const chave = chaveDeTextura('trabalho', ID_DO_COMENSAL, `${LACO_DO_COMENSAL}_${quadro}`);
    return this.textures.exists(chave) ? chave : null;
  }

  /** I-TELA-COMENSAIS-NA-BODEGA — cada comensal com o pe no lugar, espelhado quando olha para oeste. */
  private desenharComensais(
    comensais: readonly ComensalNaMesa[], tick: number,
    caixa: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  ): Phaser.GameObjects.GameObject[] {
    const objetos: Phaser.GameObjects.GameObject[] = [];
    for (const c of comensais) {
      const textura = this.texturaDoComensal(quadroDoComensal(tick, c.i));
      if (textura === null) continue;
      const imagem = this.add.image(caixa.x + caixa.w * c.lugar.ponto[0], caixa.y + caixa.h * c.lugar.ponto[1], textura);
      imagem.setOrigin(0.5, 1).setFlipX(c.lugar.olha === 'oeste').setScale(ESCALA_DO_COMENSAL);
      objetos.push(imagem);
    }
    return objetos;
  }

  /** F-VIVO-c — a textura do animal na idade e no quadro, ou `null` (losango do §9). */
  private texturaDoAnimal(animal: AnimalDoCurral, quadro: number): string | null {
    const chave = chaveDeTextura('animal', animal.animal, `idade${animal.idade}_${quadro}`);
    return this.textures.exists(chave) ? chave : null;
  }

  /** F-VIVO-c — os animais do curral, com o pe no ponto. PNG quando o manifesto tem
   *  o `animal` na idade; senao um losango cujo lado cresce com a idade (a unidade da
   *  pilha no filhote, o dobro no adulto), para o filhote se distinguir sem arte. */
  private desenharAnimais(
    animais: readonly AnimalDoCurral[], quadro: number,
    caixa: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
    tilePx: number,
  ): Phaser.GameObjects.GameObject[] {
    const objetos: Phaser.GameObjects.GameObject[] = [];
    for (const a of animais) {
      const x = caixa.x + caixa.w * a.ponto[0];
      const y = caixa.y + caixa.h * a.ponto[1];
      const textura = this.texturaDoAnimal(a, quadro);
      if (textura !== null) {
        const imagem = this.add.image(x, y, textura);
        imagem.setOrigin(0.5, 1);
        objetos.push(imagem);
        continue;
      }
      const lado = ladoDoAnimalSemArte(a.idade, tilePx);
      const losango = this.add.polygon(x, y - lado / 2, [lado / 2, 0, lado, lado / 2, lado / 2, lado, 0, lado / 2], 0xe8d2b0, 1);
      losango.setStrokeStyle(1, 0x2c1d12);
      objetos.push(losango);
    }
    return objetos;
  }

  /** F-VIVO-b — a textura de um quadro de trabalho, ou `null` (retangulo do §9). O
   *  ocioso (F-VIVO-e) e uma entrada so, com o id dele, para todos os predios. */
  private texturaDoQuadro(tipo: string, quadro: QuadroDeTrabalho): string | null {
    const id = quadro.laco === ID_DO_OCIOSO ? ID_DO_OCIOSO : tipo;
    const chave = chaveDeTextura('trabalho', id, `${quadro.laco}_${quadro.n}`);
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
      } else if (lerModoAdmin()) {
        // I-TELA-MODO-ADMIN: o quadro sem arte (o retangulo com `<laco>_<n>`) e depuracao, so no modo admin
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
      }
    }
    return objetos;
  }

  /** F-VIVO-a — as pilhas: `n` unidades por ponto, tres embaixo e dois em cima
   *  (`posicoesNaPilha`), com o pe da pilha no ponto. PNG quando o manifesto tem a
   *  `pilha` da mercadoria; senao um quadrado com a cor do tema. */
  private desenharPilhas(
    tipo: string,
    pilhas: readonly PilhaDesenhada[],
    caixa: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
    tilePx: number,
  ): Phaser.GameObjects.GameObject[] {
    const objetos: Phaser.GameObjects.GameObject[] = [];
    for (const pilha of pilhas) {
      const lado = ladoDaMercadoriaNoEstoque(tipo, pilha.mercadoria, ladoPadraoDoEstoque(tilePx));
      const px = caixa.x + caixa.w * pilha.ponto[0];
      const py = caixa.y + caixa.h * pilha.ponto[1];
      const fonte = this.fonteDaPilha(pilha.mercadoria, tipo);
      const pendurados = pontosDosPeixesPendurados(tipo, pilha.mercadoria, pilha.n);
      if (pendurados !== null) {
        for (const ponto of pendurados) {
          const x = caixa.x + caixa.w * ponto[0];
          const y = caixa.y + caixa.h * ponto[1];
          if (fonte.fonte !== 'quadrado') {
            const imagem = this.add.image(x, y, fonte.chave).setOrigin(0.5, 1);
            imagem.setDisplaySize(lado, lado * imagem.height / imagem.width);
            objetos.push(imagem);
          } else objetos.push(this.add.rectangle(x, y - lado / 2, lado, lado, 0xc2aa7b));
        }
        continue;
      }
      const cor = Phaser.Display.Color.HexStringToColor(corDaPilha(pilha.mercadoria)).color;
      // I-TELA-LENHA-NO-DEQUE-DO-LENHADOR: a pilha gira inteira (a fileira e cada peca)
      const graus = rotacaoDaMercadoriaNoEstoque(tipo, pilha.mercadoria);
      const inicio = objetos.length;
      for (const [dx, dy] of posicoesGiradas(posicoesDaMercadoriaNoEstoque(tipo, pilha.mercadoria, pilha.n), graus)) {
        const x = px + dx * lado;
        const y = py + dy * lado - lado / 2;
        if (fonte.fonte === 'icone') {
          // G-TELA-ESTOQUE-SEM-PLACA: o icone de pixel art ja tem fundo transparente; sem placa, maior
          const desenho = iconeNaPilha(lado, dadosDaCargaNasMaos.escalaDoIconeNaPilha);
          const icone = this.add.image(x, y, fonte.chave);
          icone.setDisplaySize(desenho.lado, desenho.lado);
          objetos.push(icone);
        } else if (fonte.fonte === 'pilha') {
          const imagem = this.add.image(x, y + lado / 2, fonte.chave);
          imagem.setOrigin(0.5, 1);
          imagem.setDisplaySize(lado, lado * (imagem.height / imagem.width));
          objetos.push(imagem);
        } else {
          const unidade = this.add.rectangle(x, y, lado - 1, lado - 1, cor, 1);
          unidade.setStrokeStyle(1, COR_DA_PLACA_DO_ICONE);
          objetos.push(unidade);
        }
      }
      if (graus !== 0) {
        for (const o of objetos.slice(inicio)) (o as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle).setAngle(graus);
      }
    }
    return objetos;
  }

  /** O placeholder do §9: o lote e o volume que sobe nele. A F11c desenhava o
   *  mesmo retangulo com tres opacidades; a F17e da a cada um dos seis estagios
   *  uma silhueta propria — contorno vazado sempre, volume em tres patamares de
   *  altura e uma cor por camada. Continua sendo o desenho de 27 dos 28 predios,
   *  e continua NAO sendo falha. */
  /** O contorno do footprint, vazado: do placeholder e, desde o BUG-M, tambem por
   *  baixo da obra revelada. */
  /** O lote no chao. Em obra, I-ARTE-MARCACAO-DO-CANTEIRO: a terra raspada, o cordel nas quatro bordas e uma estaca
   *  em cada canto (as pecas do Codex, `interface:canteiro:*`). Sem as pecas, ou fora da obra, o retangulo de antes. */
  private desenharLote(
    estagio: EstagioDaObra, larguraPx: number, alturaPx: number,
    canteiro: CanteiroDaObra | null = null, larguraEmTiles = 1,
  ): Phaser.GameObjects.GameObject[] {
    const peca = (estado: string): string => chaveDeTextura('interface', `${ID_DO_CANTEIRO}-${estado}`, 'normal');
    const comArte = PECAS_DO_CANTEIRO.every((e) => this.textures.exists(peca(e)));
    if (!estaEmObra(estagio) || !comArte) {
      const lote = this.add.rectangle(larguraPx / 2, alturaPx / 2, larguraPx, alturaPx, CARA_DO_ESTAGIO[estagio].cor, 0);
      lote.setStrokeStyle(2, estaEmObra(estagio) ? 0xede3d0 : 0x2c1d12);
      return [lote];
    }
    const escala = configDoMapa.tilePx / TILE_DA_ARTE_DO_CANTEIRO;
    const fio = ESPESSURA_DO_CORDEL * escala;
    // I-TELA-OBREIRO-NIVELA-O-LOTE: a terra raspada so nos tiles ja aplainados, na ordem em zigue-zague do obreiro; o tile
    // em curso aparece aos poucos (pelos oitavos da chave do canteiro). Sem leitura do canteiro, ou nivelado, o lote todo.
    const terra: Phaser.GameObjects.GameObject[] = [];
    if (canteiro === null || canteiro.nivelada || canteiro.tilesTotais <= 0) {
      terra.push(this.add.tileSprite(larguraPx / 2, alturaPx / 2, larguraPx, alturaPx, peca('terra')).setTileScale(escala, escala));
    } else {
      const lado = configDoMapa.tilePx;
      const ordem = ordemDeNivelamento(Math.max(1, larguraEmTiles), Math.ceil(canteiro.tilesTotais / Math.max(1, larguraEmTiles)));
      const tile = (n: number, alfa: number): void => {
        const t = ordem[n];
        if (t === undefined || alfa <= 0) return;
        // o recorte da textura acompanha o tile no mundo, e o chao raspado nao se repete igual em cada tile
        terra.push(this.add.tileSprite(t.gx * lado + lado / 2, t.gy * lado + lado / 2, lado, lado, peca('terra'))
          .setTileScale(escala, escala).setTilePosition((t.gx * lado) / escala, (t.gy * lado) / escala).setAlpha(alfa));
      };
      for (let n = 0; n < canteiro.tilesProntos; n++) tile(n, 1);
      tile(canteiro.tilesProntos, canteiro.oitavosDoTileEmCurso / 8);
    }
    const cordel = (x: number, y: number, w: number, h: number, estado: string): Phaser.GameObjects.TileSprite =>
      this.add.tileSprite(x, y, w, h, peca(estado)).setTileScale(escala, escala);
    const bordas = [
      cordel(larguraPx / 2, fio / 2, larguraPx, fio, 'cordel-h'),
      cordel(larguraPx / 2, alturaPx - fio / 2, larguraPx, fio, 'cordel-h'),
      cordel(fio / 2, alturaPx / 2, fio, alturaPx, 'cordel-v'),
      cordel(larguraPx - fio / 2, alturaPx / 2, fio, alturaPx, 'cordel-v'),
    ];
    // a estaca com o pe no canto (a origem e o centro da borda de baixo, como a arte foi pedida)
    const estacas = ([[0, 0], [larguraPx, 0], [0, alturaPx], [larguraPx, alturaPx]] as const).map(([x, y]) =>
      this.add.image(x, y + fio / 2, peca('estaca')).setOrigin(0.5, 1).setScale(escala));
    // I-TELA-CORDA-ENTRE-AS-ESTACAS: a corda de no a no, nos quatro lados; a de cima e as dos lados atras das estacas da
    // frente, a de baixo na frente delas
    const cordas = cordasDoLote(larguraPx, alturaPx, {
      alturaDoNo: FORMA_DA_CORDA.alturaDoNo * escala - fio / 2, cedePorPx: FORMA_DA_CORDA.cedePorPx, barrigaMaxima: FORMA_DA_CORDA.barrigaMaxima * escala,
    });
    const desenho = (lados: readonly string[]): Phaser.GameObjects.Graphics => {
      const g = this.add.graphics();
      for (const c of cordas.filter((k) => lados.includes(k.lado))) {
        const curva = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(c.de.x, c.de.y), new Phaser.Math.Vector2(c.meio.x, c.meio.y), new Phaser.Math.Vector2(c.ate.x, c.ate.y));
        g.lineStyle(Math.max(1, 3 * escala), COR_DA_SOMBRA_DA_CORDA, 0.9);
        curva.draw(g, 24);
        g.lineStyle(Math.max(1, 1.5 * escala), COR_DA_CORDA, 1);
        curva.draw(g, 24);
      }
      this.cordasDoCanteiroDesenhadas += cordas.filter((k) => lados.includes(k.lado)).length;
      return g;
    };
    return [...terra, ...bordas, desenho(['cima', 'esquerda', 'direita']), ...estacas, desenho(['baixo'])];
  }

  private desenharPlaceholder(
    estagio: EstagioDaObra, nome: string, larguraPx: number, alturaPx: number,
    canteiro: CanteiroDaObra | null = null, larguraEmTiles = 1,
  ): Phaser.GameObjects.GameObject[] {
    const emObra = estaEmObra(estagio);
    const cara = CARA_DO_ESTAGIO[estagio];
    const objetos: Phaser.GameObjects.GameObject[] = [];

    // O lote, sempre: e o que diz ao jogador quanto chao a obra vai ocupar,
    // inclusive quando ainda nao ha volume nenhum em cima dele.
    objetos.push(...this.desenharLote(estagio, larguraPx, alturaPx, canteiro, larguraEmTiles));

    // O volume, ancorado no PE do footprint: a obra sobe do chao para cima, e nao
    // cresce a partir do meio.
    if (cara.altura > 0) {
      const altura = alturaPx * cara.altura;
      objetos.push(this.add.rectangle(
        larguraPx / 2, alturaPx - altura / 2, larguraPx, altura, cara.cor, cara.opacidade,
      ));
    }

    // I-TELA-MODO-ADMIN: o nome e o estagio escritos sao texto de depuracao, so no modo admin
    if (!lerModoAdmin()) return objetos;
    const texto = emObra ? `${nome}\n(${temaSertao.obra[estagio]})` : nome;
    const rotulo = this.add.text(larguraPx / 2, alturaPx / 2, texto, {
      fontSize: '14px',
      color: '#ede3d0',
      align: 'center',
      wordWrap: { width: larguraPx - 8 },
    });
    rotulo.setOrigin(0.5, 0.5);
    objetos.push(rotulo);
    this.rotulosDePredio += 1;
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
    // I-TELA-OBREIRO-NIVELA-O-LOTE: com as pecas do canteiro, o aplainado e a terra raspada do lote (`desenharLote`)
    if (PECAS_DO_CANTEIRO.every((e) => this.textures.exists(chaveDeTextura('interface', `${ID_DO_CANTEIRO}-${e}`, 'normal')))) return [];
    const COR = 0x8a6a4a;
    const OPACIDADE = 0.55;
    const OITAVOS = 8;
    const objetos: Phaser.GameObjects.GameObject[] = [];
    const porLinha = Math.max(1, larguraEmTiles);
    // I-TELA-OBREIRO-NIVELA-O-LOTE: a mesma ordem em zigue-zague do obreiro e da terra raspada
    const ordem = ordemDeNivelamento(porLinha, Math.ceil(canteiro.tilesTotais / porLinha));
    const bloco = (n: number, largura: number): void => {
      if (largura <= 0 || ordem[n] === undefined) return;
      const coluna = ordem[n].gx;
      const fileira = ordem[n].gy;
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
