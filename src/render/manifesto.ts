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
  /**
   * Em px, do arquivo DERIVADO. A largura e sempre `footprint[0] * tilePx`; a
   * altura e o que a arte der — a fonte isometrica e 3:2, e forcar um quadrado
   * a esticaria 1,5x na vertical.
   */
  readonly tamanho: readonly [number, number];
  /** `[0.5, 1]`: meio na horizontal, borda de BAIXO do footprint. */
  readonly anchor: readonly [number, number];
  /** Estagio do render -> caminho do arquivo, relativo a `assets/`. */
  readonly estados: Readonly<Record<string, string>>;
  readonly licenca: string;
  readonly origem: OrigemDoAsset;
}

export interface Manifesto {
  readonly versao: number;
  readonly assets: readonly EntradaDeAsset[];
}

/** A entrada de um tipo de predio, ou `null` quando ele nao tem arte — e ai o
 *  render desenha o retangulo com o nome, que e comportamento normal (§9). */
export function assetDoPredio(manifesto: Manifesto, tipo: string): EntradaDeAsset | null {
  return manifesto.assets.find((e) => e.tipo === 'predio' && e.id === tipo) ?? null;
}

/** O arquivo de um estagio, ou `null` quando aquele estagio nao tem arte — um
 *  predio pode ter arte so em parte dos estagios, e o que falta vira retangulo. */
export function arquivoDoEstagio(entrada: EntradaDeAsset, estagio: string): string | null {
  return entrada.estados[estagio] ?? null;
}

/** A chave de textura no Phaser. Uma funcao so para quem carrega e para quem
 *  desenha: duas formas de montar a mesma chave e como elas divergem. */
export function chaveDaTextura(id: string, estagio: string): string {
  return `predio:${id}:${estagio}`;
}
