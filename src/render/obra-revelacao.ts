/**
 * I-TELA-OBRA-PARTE-A-PARTE — a obra sobe por partes, nao como uma cortina. A fracao de cada camada
 * (a da F17g, `revelacaoDaObra`) vira um numero de blocos de uma grade: linha a linha de baixo para
 * cima e, dentro da linha, numa ordem fixa embaralhada pela semente (o id do predio e a camada).
 *
 * Pura e sem `phaser`: o teste a exercita por tabela. A grade vem de `data/obra-revelacao.json`.
 */
import type { Fracao } from './estagio-obra';

export interface GradeDaObra {
  readonly linhas: number;
  readonly colunas: number;
}

/** Um bloco da grade. `linha` 0 e a de BAIXO; `coluna` 0 a da esquerda. */
export interface BlocoDaObra {
  readonly linha: number;
  readonly coluna: number;
}

/** FNV-1a do texto: a semente do embaralhamento. */
function hashDoTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** A ordem em que os blocos aparecem: as linhas de baixo para cima, e as colunas de cada linha
 *  embaralhadas (Fisher-Yates com mulberry32 da semente). A mesma semente da a mesma ordem. */
export function ordemDosBlocos(grade: GradeDaObra, semente: string): BlocoDaObra[] {
  let estado = hashDoTexto(semente);
  const sorteio = (): number => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const ordem: BlocoDaObra[] = [];
  for (let linha = 0; linha < grade.linhas; linha++) {
    const colunas = Array.from({ length: grade.colunas }, (_, i) => i);
    for (let i = colunas.length - 1; i > 0; i--) {
      const j = Math.floor(sorteio() * (i + 1));
      [colunas[i], colunas[j]] = [colunas[j]!, colunas[i]!];
    }
    for (const coluna of colunas) ordem.push({ linha, coluna });
  }
  return ordem;
}

/** Quantos blocos a fracao mostra: o bloco aparece inteiro quando a fracao dele e alcancada. */
export function quantosBlocos(fracao: Fracao, grade: GradeDaObra): number {
  const [num, den] = fracao;
  const total = grade.linhas * grade.colunas;
  if (num <= 0 || den <= 0) return 0;
  if (num >= den) return total;
  return Math.floor((total * num) / den);
}

/** Os blocos visiveis nesta fracao, na ordem em que apareceram. */
export function blocosVisiveis(fracao: Fracao, grade: GradeDaObra, semente: string): BlocoDaObra[] {
  return ordemDosBlocos(grade, semente).slice(0, quantosBlocos(fracao, grade));
}

/** O retangulo do bloco no quadro da textura, em px inteiros (bordas arredondadas, sem fresta). */
export function recorteDoBloco(
  bloco: BlocoDaObra, grade: GradeDaObra, largura: number, altura: number,
): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
  const x0 = Math.round((bloco.coluna * largura) / grade.colunas);
  const x1 = Math.round(((bloco.coluna + 1) * largura) / grade.colunas);
  // a linha 0 e a de baixo: o y cresce para baixo na textura
  const y1 = Math.round(altura - (bloco.linha * altura) / grade.linhas);
  const y0 = Math.round(altura - ((bloco.linha + 1) * altura) / grade.linhas);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
