/**
 * O indice de arte do jogo (CLAUDE.md §9), lido por quem desenha.
 *
 * ZERO imports, como `estagio-obra.ts` e `medidor-obra.ts`: o manifesto chega
 * como parametro e o tipo de predio tambem. Este arquivo nao sabe que existe
 * Phaser, nem `sim/data`, nem tema.
 *
 * Nada aqui parseia nome de arquivo: quem mapeia estagio -> arquivo e o campo
 * `estados`. Renomear arte e editar uma linha do manifesto, e o teste da F17f
 * acusa se o arquivo declarado nao existir ou nao tiver a dimensao declarada.
 *
 * As chaves sao os ids NEUTROS da simulacao (`storehouse`), nunca o nome do
 * tema (`armazem`): indexar asset por nome tematico faria o render depender de
 * `theme-sertao.json` para achar arquivo, e o §9 e explicito — nenhuma regra
 * pode depender do tema.
 */

export interface OrigemDoAsset {
  /** Caminho da imagem base versionada, relativo a `assets/`. */
  readonly base: string;
  /** A semente que a ferramenta devolveu, quando houver (§9). */
  readonly semente: string | null;
  readonly nota?: string;
}

export interface EntradaDeAsset {
  readonly id: string;
  readonly tipo: 'predio';
  /** Em tiles, igual ao `tamanho` de `data/buildings.json`. */
  readonly footprint: readonly [number, number];
  /** Em px, do arquivo DERIVADO na regua canonica de 64 px por tile. O canvas
   * pode ser maior que o footprint: telhado, beiral e escada transbordam. */
  readonly tamanho: readonly [number, number];
  /** Ponto normalizado do PNG que assenta no centro da borda inferior do lote.
   * Nao e necessariamente `[0.5, 1]`: transbordo inferior exige `y < 1`. */
  readonly anchor: readonly [number, number];
  /** Estagio do render -> caminho do arquivo, relativo a `assets/`. */
  readonly estados: Readonly<Record<string, string>>;
  readonly licenca: string;
  readonly origem: OrigemDoAsset;
  /**
   * F-VIVO-0 — ONDE cada camada do predio vivo aparece (docs/BRIEF-ARTE.md §4a).
   * Opcional: predio sem `ancoras` usa as padrao do render. As regras (fracao,
   * contagem por receita, nao sobrepor) estao em `manifesto-camadas.ts`.
   */
  readonly ancoras?: AncorasDoPredio;
  /** F-ESC — a excecao ao `regraDeAltura.k` do manifesto, em multiplos da largura do
   *  lote. So existe onde a arte precisa (sobrado, torre); `escala-predio.ts`. */
  readonly alturaMaxPorLargura?: number;
  /** C10 — a excecao ao `regraDeLargura.k`, em multiplos da largura do lote. So onde a arte
   *  transborda o lote (armazem, Casa do Coronel); `escala-predio.ts`. */
  readonly larguraMaxPorLote?: number;
}

/** Um ponto em FRACAO do sprite `completo`: `[x, y]` de 0 a 1, origem no canto
 *  superior esquerdo. Fracao, e nao pixel, porque a largura do predio ainda muda. */
export type PontoFracionario = readonly [number, number];

/** F-VIVO-0 — as ancoras do predio vivo. Cada bloco e opcional. */
export interface AncorasDoPredio {
  /** Ponto de contato do pé do mastro com o teto, em fração do canvas do sprite. */
  readonly bandeira?: PontoFracionario;
  /** `area` e `[x0, y0, x1, y1]`, onde o quadro de trabalho e desenhado; `fumaca`
   *  e a chamine ou a boca da mina. */
  readonly trabalho?: {
    readonly area?: readonly [number, number, number, number];
    readonly fumaca?: PontoFracionario;
    readonly fogo?: PontoFracionario;
  };
  /** Um ponto por mercadoria da gaveta, na ordem de `entra`/`sai` da receita. */
  readonly estoque?: {
    readonly entrada?: readonly PontoFracionario[];
    readonly saida?: readonly PontoFracionario[];
  };
  /** Cinco pontos, so na criacao: onde fica cada animal. */
  readonly curral?: readonly PontoFracionario[];
  /** Um ponto por material da obra (`timber`, `stone`): a pilha do entregue e ainda
   *  nao pregado, como o `BuildSupply` do kam_remake. */
  readonly obra?: Readonly<Record<string, PontoFracionario>>;
}

/** Os tipos de asset fora do predio (F-SPR). F-VIVO-0 acrescentou os tres do predio
 *  vivo: `trabalho` (os quadros de um predio), `pilha` (UMA unidade de mercadoria) e
 *  `animal` (a criacao, nas tres idades). As regras deles estao em `manifesto-camadas.ts`. */
export const TIPOS_DE_CAMADA = [
  'terreno', 'estrada', 'recurso', 'vegetacao', 'unidade', 'trabalho', 'pilha', 'animal',
] as const;
export type TipoDeCamada = (typeof TIPOS_DE_CAMADA)[number];

/**
 * F-SPR — os mesmos oito campos da §9, para tudo que nao e predio. O que muda e o
 * que cada campo quer dizer:
 * - `terreno`/`estrada`/`recurso`: textura de TILE. `id` e o tipo neutro
 *   (`grama`, `estrada`, `rock`); a imagem e redimensionada para o tile, entao
 *   `tamanho` e so o que o arquivo tem.
 * - `vegetacao`: SPRITE em pe sobre o tile de um recurso (`tree`). Desenhada no
 *   `tamanho` do arquivo, ancorada pelo `anchor` — pode transbordar o tile.
 * - `unidade`: SPRITE, um arquivo por pose e direcao (`chaveDaPose`). O oeste e
 *   espelho do leste quando nao declarado.
 * `footprint` fica `[1, 1]` nos quatro: nenhum deles ocupa mais de um tile na sim.
 */
export interface EntradaDeCamada {
  readonly id: string;
  readonly tipo: TipoDeCamada;
  readonly footprint: readonly [number, number];
  /** Em px, do arquivo DERIVADO. Nenhuma conta o deduz: e o que o arquivo tem. */
  readonly tamanho: readonly [number, number];
  readonly anchor: readonly [number, number];
  readonly estados: Readonly<Record<string, string>>;
  /** D-TELA-04a: atlas opcional; as poses PNG continuam aceitas. */
  readonly atlas?: string;
  readonly animacoes?: Readonly<Record<string, AnimacaoDeUnidade>>;
  readonly licenca: string;
  readonly origem: OrigemDoAsset;
}

export interface AnimacaoDeUnidade {
  readonly quadros: number;
  readonly fps?: number;
  readonly tilesPorCiclo?: number;
  readonly laco: boolean;
}

export type EntradaDoManifesto = EntradaDeAsset | EntradaDeCamada;

export interface Manifesto {
  readonly versao: number;
  /** F-ESC — o teto padrao da altura do predio (`escala-predio.ts`). */
  readonly regraDeAltura?: { readonly k: number };
  /** C10 — o teto padrao da largura do predio (`escala-predio.ts`). */
  readonly regraDeLargura?: { readonly k: number };
  readonly assets: readonly EntradaDoManifesto[];
}

export function ehEntradaDePredio(e: EntradaDoManifesto): e is EntradaDeAsset {
  return e.tipo === 'predio';
}

/** A entrada de um tipo de predio, ou `null` quando ele nao tem arte — e ai o
 *  render desenha o retangulo com o nome, que e comportamento normal (§9). */
export function assetDoPredio(manifesto: Manifesto, tipo: string): EntradaDeAsset | null {
  return manifesto.assets.find((e): e is EntradaDeAsset => ehEntradaDePredio(e) && e.id === tipo) ?? null;
}

/** F-SPR — a entrada de um id numa camada, ou `null`. O `tipo` discrimina: um predio,
 *  ou um recurso, com o mesmo id de um terreno nao responde por ele. */
export function assetDaCamada(manifesto: Manifesto, tipo: TipoDeCamada, id: string): EntradaDeCamada | null {
  return manifesto.assets.find(
    (e): e is EntradaDeCamada => e.tipo === tipo && e.id === id,
  ) ?? null;
}

/** O arquivo de um estagio, ou `null` quando aquele estagio nao tem arte — um
 *  predio pode ter arte so em parte dos estagios, e o que falta vira retangulo. */
export function arquivoDoEstagio(entrada: EntradaDeAsset, estagio: string): string | null {
  return entrada.estados[estagio] ?? null;
}

/**
 * F17g — as duas imagens da obra revelada (docs/BRIEF-ARTE.md §4): a `madeira` e
 * o `completo`, que e a de pedra. Um predio com as DUAS no manifesto e desenhado
 * pela revelacao; sem o par, continua pelos seis estagios de antes (decisao do
 * operador, 2026-09-26: "predio sem o par continua como esta hoje").
 */
export const CHAVES_DA_REVELACAO = ['madeira', 'completo'] as const;
export type ChaveDaRevelacao = (typeof CHAVES_DA_REVELACAO)[number];

export function temParDeRevelacao(entrada: EntradaDeAsset): boolean {
  return CHAVES_DA_REVELACAO.every((k) => arquivoDoEstagio(entrada, k) !== null);
}

/** A chave de textura no Phaser. Uma funcao so para quem carrega e para quem
 *  desenha: duas formas de montar a mesma chave e como elas divergem. */
export function chaveDaTextura(id: string, estagio: string): string {
  return chaveDeTextura('predio', id, estagio);
}

/** F-SPR — a mesma chave para todo tipo. Para predio da exatamente a de antes. */
export function chaveDeTextura(tipo: string, id: string, estado: string): string {
  return `${tipo}:${id}:${estado}`;
}

/** O estado lido na textura de terreno. Transicao e variacao sao da F-TR. */
export const ESTADO_DO_TERRENO = 'padrao';
/** O estado lido no recurso e na vegetacao com quantidade > 0. O esgotado continua
 *  sendo o marcador unico da camada de tile (F-T2a) ate a F-TR separar por tipo. */
export const ESTADO_PRESENTE = 'presente';

/** Pergunta da cena ao loader: a textura desta chave chegou? Parametro para o
 *  resolvedor continuar puro e testavel sem Phaser. */
export type TexturaCarregada = (chave: string) => boolean;

/** A chave de textura de um id de camada, ou `null` quando nao ha entrada, estado ou
 *  arquivo carregado — `null` e o placeholder de hoje, nao falha (§9). */
export function texturaDaCamada(
  manifesto: Manifesto, tipo: 'terreno' | 'recurso' | 'vegetacao', id: string,
  estado: string, carregada: TexturaCarregada,
): string | null {
  const entrada = assetDaCamada(manifesto, tipo, id);
  if (!entrada || entrada.estados[estado] === undefined) return null;
  const chave = chaveDeTextura(tipo, id, estado);
  return carregada(chave) ? chave : null;
}

/**
 * F-SPR — como a cena desenha um tipo de recurso PRESENTE:
 * - `vegetacao`: sprite em pe por tile, e a celula da tira fica vazia;
 * - `textura`: a celula da tira recebe a imagem;
 * - `marcador`: o losango da F-T2a, que e o placeholder.
 * Quem decide se e vegetacao e o manifesto (`tipo: "vegetacao"`), nao uma lista aqui.
 */
export type DesenhoDoRecurso =
  | { readonly como: 'vegetacao'; readonly chave: string; readonly entrada: EntradaDeCamada }
  | { readonly como: 'textura'; readonly chave: string }
  | { readonly como: 'marcador' };

export function desenhoDoRecurso(
  manifesto: Manifesto, id: string, carregada: TexturaCarregada,
): DesenhoDoRecurso {
  const vegetacao = texturaDaCamada(manifesto, 'vegetacao', id, ESTADO_PRESENTE, carregada);
  const entrada = assetDaCamada(manifesto, 'vegetacao', id);
  if (vegetacao !== null && entrada !== null) return { como: 'vegetacao', chave: vegetacao, entrada };
  const textura = texturaDaCamada(manifesto, 'recurso', id, ESTADO_PRESENTE, carregada);
  if (textura !== null) return { como: 'textura', chave: textura };
  return { como: 'marcador' };
}

/** As oito direcoes, em sentido horario a partir do norte (y cresce para o sul). */
export const DIRECOES = ['n', 'ne', 'l', 'se', 's', 'so', 'o', 'no'] as const;
export type Direcao = (typeof DIRECOES)[number];
/** Com 4 direcoes, so os eixos. */
export const DIRECOES_DE_QUATRO: readonly Direcao[] = ['n', 'l', 's', 'o'];
/** O lado oeste e espelho (BRIEF-ARTE §6): falta `o`, desenha `l` virado. */
export const ESPELHO_DO_OESTE: Readonly<Partial<Record<Direcao, Direcao>>> = { o: 'l', no: 'ne', so: 'se' };
/**
 * Diagonal sem quadro (nem o proprio, nem o espelho) cai na HORIZONTAL: e o que o tipo de
 * 4 direcoes ja mostrava no passo diagonal (`direcaoDoPasso`, empate na horizontal). Assim
 * o civil que passou a declarar 8 (decisao do operador, 2026-09-30) desenha igual ate a
 * arte diagonal existir, em vez de virar placeholder no meio da caminhada.
 */
export const HORIZONTAL_DA_DIAGONAL: Readonly<Partial<Record<Direcao, Direcao>>> = { ne: 'l', se: 'l', no: 'o', so: 'o' };
/** A unica pose que o render pede hoje. Animacao acrescenta poses, nao muda a chave. */
export const POSE_PARADO = 'parado';

/** A chave de `estados` de uma unidade: `"<pose>:<direcao>"`. */
export function chaveDaPose(pose: string, direcao: Direcao): string {
  return `${pose}:${direcao}`;
}

/**
 * A direcao de um passo `(dx, dy)` em tiles, ou `null` parado. Com 4 direcoes o eixo
 * dominante manda e o empate cai na horizontal (a diagonal do grid vira leste/oeste);
 * com 8, o eixo menor que metade do maior conta como zero e o resto e o sinal.
 */
export function direcaoDoPasso(dx: number, dy: number, direcoes: 4 | 8): Direcao | null {
  if (dx === 0 && dy === 0) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (direcoes === 4) {
    if (ax >= ay) return dx > 0 ? 'l' : 'o';
    return dy > 0 ? 's' : 'n';
  }
  const sx = ax * 2 < ay ? 0 : Math.sign(dx);
  const sy = ay * 2 < ax ? 0 : Math.sign(dy);
  if (sy === 0) return sx > 0 ? 'l' : 'o';
  const vertical = sy < 0 ? 'n' : 's';
  if (sx === 0) return vertical;
  return `${vertical}${sx > 0 ? 'e' : 'o'}` as Direcao;
}

/** O que a cena desenha para uma unidade: a chave da textura e se vira o arquivo. */
export interface SpriteDaUnidade {
  readonly chave: string;
  readonly espelhar: boolean;
  readonly entrada: EntradaDeCamada;
}

/**
 * F-SPR — o sprite de uma unidade numa pose e direcao, ou `null` (placeholder). A
 * direcao declarada vence; sem ela, o oeste cai no espelho do leste, e a diagonal sem
 * quadro cai na horizontal (`HORIZONTAL_DA_DIAGONAL`). Direcao fora do
 * conjunto do tipo (`ne` num civil de 4) nao existe e resolve `null`, e tipo sem
 * `direcoesDeSprite` no dado (os mercenarios, decisao do operador) tambem.
 */
export function spriteDaUnidade(
  manifesto: Manifesto, tipo: string, pose: string, direcao: Direcao,
  direcoesDoTipo: 4 | 8 | null, carregada: TexturaCarregada,
): SpriteDaUnidade | null {
  if (direcoesDoTipo === null) return null;
  if (direcoesDoTipo === 4 && !DIRECOES_DE_QUATRO.includes(direcao)) return null;
  const entrada = assetDaCamada(manifesto, 'unidade', tipo);
  if (!entrada) return null;
  const tentar = (d: Direcao, espelhar: boolean): SpriteDaUnidade | null => {
    const estado = chaveDaPose(pose, d);
    if (entrada.estados[estado] === undefined) return null;
    const chave = chaveDeTextura('unidade', tipo, estado);
    return carregada(chave) ? { chave, espelhar, entrada } : null;
  };
  const naDirecao = (d: Direcao): SpriteDaUnidade | null => {
    const espelho = ESPELHO_DO_OESTE[d];
    return tentar(d, false) ?? (espelho ? tentar(espelho, true) : null);
  };
  const horizontal = HORIZONTAL_DA_DIAGONAL[direcao];
  return naDirecao(direcao) ?? (horizontal ? naDirecao(horizontal) : null);
}
