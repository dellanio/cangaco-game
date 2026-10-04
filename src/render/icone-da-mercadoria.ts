/**
 * D-ARTE-01 — o icone de cada mercadoria (`assets/manifest.json` > `icones.mercadorias`).
 *
 * So aponta arquivo que ja existe: o mesmo PNG do HUD (`timber`, `stone`, `gold`) ou do recurso
 * do mapa (`corn`, `fish`, `coal`, `iron_ore`, `gold_ore`). A chave e o id NEUTRO da mercadoria,
 * nunca o nome do tema (CLAUDE.md §9).
 *
 * Sem import de `phaser`, de `sim/data` nem do tema (so `manifesto.ts` e `manifesto-camadas.ts`, que tambem nao importam nada): o manifesto, a lista de mercadorias e a
 * leitura do cabecalho do PNG chegam por parametro, para o teste exercitar cada regra com um
 * manifesto escrito nele.
 */
import type { OrigemDoAsset } from './manifesto';
import { chaveDeTextura } from './manifesto';
import { ESTADO_DA_PILHA } from './manifesto-camadas';

export interface IconeDeMercadoria {
  /** Caminho relativo a `assets/`. */
  readonly arquivo: string;
  /** Em px, o que o arquivo tem. */
  readonly tamanho: readonly [number, number];
  readonly licenca: string;
  readonly origem: OrigemDoAsset;
}

/** O trecho `icones.mercadorias`, com o `_doc` que todo bloco do manifesto tem. */
export type IconesDeMercadoria = Readonly<Record<string, IconeDeMercadoria | string | undefined>>;

/** As entradas de verdade: tira as chaves `_` (comentario do dado). */
export function entradasDosIcones(icones: IconesDeMercadoria | undefined): [string, IconeDeMercadoria][] {
  if (icones === undefined) return [];
  return Object.entries(icones)
    .filter((par): par is [string, IconeDeMercadoria] => !par[0].startsWith('_') && typeof par[1] === 'object');
}

/**
 * As regras do bloco. `dimensao` devolve `[largura, altura]` do PNG em `assets/<arquivo>`, ou
 * `null` quando o arquivo nao existe. Lista vazia = valido.
 */
export function errosDosIconesDeMercadoria(
  icones: IconesDeMercadoria | undefined,
  mercadorias: readonly string[],
  dimensao: (arquivo: string) => readonly [number, number] | null,
): string[] {
  const erros: string[] = [];
  const conhecidas = new Set(mercadorias);
  for (const [id, icone] of entradasDosIcones(icones)) {
    if (!conhecidas.has(id)) erros.push(`icones.mercadorias.${id}: nao e mercadoria de economia.mercadorias`);
    const real = dimensao(icone.arquivo);
    if (real === null) {
      erros.push(`icones.mercadorias.${id}: o arquivo ${icone.arquivo} nao existe`);
    } else if (real[0] !== icone.tamanho[0] || real[1] !== icone.tamanho[1]) {
      erros.push(`icones.mercadorias.${id}: tamanho declarado ${JSON.stringify(icone.tamanho)}, o arquivo tem ${JSON.stringify(real)}`);
    }
  }
  return erros;
}

/** A placa escura sob o icone, na carga e na pilha: a cor do fundo do texto da carga e do contorno
 *  do quadrado da pilha, que ja existiam. O icone do HUD e traco creme feito para o painel escuro, e
 *  sem placa some na camisa branca do serf e na grama (medido na captura da D-TELA-03a/03b). */
export const COR_DA_PLACA_DO_ICONE = 0x2c1d12;

/** G-TELA-ESTOQUE-SEM-PLACA — o icone de pixel art no estoque do predio: sem placa (o sprite ja
 *  tem fundo transparente) e com o lado multiplicado pela escala do dado. */
export function iconeNaPilha(ladoDaUnidade: number, escala: number): { readonly placa: false; readonly lado: number } {
  return { placa: false, lado: (ladoDaUnidade - 3) * escala };
}

/** O estado unico do icone: a mercadoria inteira, sem pose. */
export const ESTADO_DO_ICONE = 'mercadoria';

/** A chave da textura do icone no Phaser: a mesma para quem carrega e para quem desenha. */
export function chaveDoIcone(mercadoria: string): string {
  return chaveDeTextura('icone', mercadoria, ESTADO_DO_ICONE);
}

/** O icone da mercadoria, se o manifesto o declara e o loader o trouxe; senao `null`. */
function iconeCarregado(
  mercadoria: string, icones: IconesDeMercadoria | undefined, carregada: (chave: string) => boolean,
): string | null {
  const icone = icones?.[mercadoria];
  if (mercadoria.startsWith('_') || typeof icone !== 'object') return null;
  const chave = chaveDoIcone(mercadoria);
  return carregada(chave) ? chave : null;
}

/**
 * D-TELA-03a — o que se desenha sobre a unidade que leva carga: o icone da mercadoria, quando
 * existe; senao o texto de hoje (BUG-O). Nenhuma carga some. O texto sem icone continua texto: o
 * quadrado no lugar dele e a pergunta 2 do §12 do plano, que espera o operador.
 */
export type MarcaDaCarga =
  | { readonly como: 'icone'; readonly chave: string }
  | { readonly como: 'texto'; readonly rotulo: string };

export function marcaDaCarga(
  mercadoria: string, icones: IconesDeMercadoria | undefined, carregada: (chave: string) => boolean,
  rotulo: (mercadoria: string) => string,
): MarcaDaCarga {
  const chave = iconeCarregado(mercadoria, icones, carregada);
  return chave === null ? { como: 'texto', rotulo: rotulo(mercadoria) } : { como: 'icone', chave };
}

/**
 * D-TELA-03b — a textura de uma unidade da pilha (F-VIVO-a), nessa ordem: o PNG `pilha` da
 * mercadoria; o icone dela; o quadrado com a cor do tema (o placeholder do §9).
 */
export type FonteDaPilha =
  | { readonly fonte: 'pilha'; readonly chave: string }
  | { readonly fonte: 'icone'; readonly chave: string }
  | { readonly fonte: 'quadrado' };

export function fonteDaPilha(
  mercadoria: string, icones: IconesDeMercadoria | undefined, carregada: (chave: string) => boolean,
): FonteDaPilha {
  const pilha = chaveDeTextura('pilha', mercadoria, ESTADO_DA_PILHA);
  if (carregada(pilha)) return { fonte: 'pilha', chave: pilha };
  const icone = iconeCarregado(mercadoria, icones, carregada);
  return icone === null ? { fonte: 'quadrado' } : { fonte: 'icone', chave: icone };
}
