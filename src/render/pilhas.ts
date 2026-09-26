/**
 * F-VIVO-a — a pilha: o que o predio guarda, desenhado como unidades empilhadas nas
 * ancoras do manifesto (docs/BRIEF-ARTE.md §4a, BUILD_PLAN.md F-VIVO).
 *
 * Aritmetica pura, so `import type`, como `manifesto-camadas.ts`: o dado chega por
 * parametro (`DadosDasPilhas`), montado pelo funil `predios.ts`. A cena so desenha a
 * lista; o teste afirma a lista em Node, sem tela.
 *
 * Quatro usos, uma regra de desenho (ate `TETO_DA_PILHA` unidades num ponto):
 * - predio com receita: as gavetas `entrada` e `saida`, na ordem de `entra`/`sai`;
 * - armazem: as `PONTOS_DO_ARMAZEM` mercadorias de maior quantidade;
 * - Bodega: as comidas, na ordem de `economia.grupos.comida`;
 * - obra: a tabua e a pedra entregues e ainda nao pregadas. Derivado, sem campo na
 *   sim: `entregues - ceil(hp / hpPorMaterialEntregue)`, a tabua consumida primeiro,
 *   como o `IncBuildingProgress` do kam_remake. A unidade sai da pilha quando a
 *   primeira martelada comeca nela, por isso o `ceil`.
 */
import type { AncorasDoPredio, PontoFracionario } from './manifesto';
import { PONTOS_DO_ARMAZEM } from './manifesto-camadas';
import type { ContextoDasCamadas } from './manifesto-camadas';
import type { Predio } from '../sim/state';

/** Quantas unidades uma pilha mostra, no maximo (operador, 2026-09-26). */
export const TETO_DA_PILHA = 5;

/** Quantas unidades vao na fileira de baixo; o resto (ate o teto) vai em cima. */
export const UNIDADES_NA_BASE = 3;

export type GavetaDaPilha = 'entrada' | 'saida' | 'obra';

export interface PilhaDesenhada {
  readonly gaveta: GavetaDaPilha;
  readonly mercadoria: string;
  /** Unidades desenhadas: `min(quantidade, TETO_DA_PILHA)`, sempre > 0. */
  readonly n: number;
  /** Onde a pilha pousa, em fracao do sprite `completo` (ou do lote, sem sprite). */
  readonly ponto: PontoFracionario;
}

export interface DadosDasPilhas {
  readonly contexto: ContextoDasCamadas;
  /** Custo em material por tipo de predio, na ordem do dado (tabua antes da pedra). */
  readonly custos: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly hpPorMaterialEntregue: number;
  /** As ancoras do manifesto por tipo. Tipo sem entrada usa as padrao. */
  readonly ancoras: Readonly<Record<string, AncorasDoPredio | undefined>>;
}

/**
 * Ancoras padrao, so para o placeholder (regra comum da F-VIVO): na linha da base,
 * a entrada a esquerda da porta e a saida a direita. Quando uma gaveta nao existe,
 * a outra ocupa a base inteira. A obra poe a tabua a esquerda e a pedra a direita.
 */
const Y_DA_BASE = 0.92;
const BASE_INTEIRA: readonly [number, number] = [0.04, 0.96];
const METADE_ESQUERDA: readonly [number, number] = [0.04, 0.48];
const METADE_DIREITA: readonly [number, number] = [0.52, 0.96];

function espalhar(k: number, [x0, x1]: readonly [number, number]): PontoFracionario[] {
  return Array.from({ length: k }, (_, i) => [x0 + ((x1 - x0) * (i + 0.5)) / k, Y_DA_BASE] as const);
}

export function pontosPadraoDoEstoque(entrada: number, saida: number): {
  readonly entrada: readonly PontoFracionario[]; readonly saida: readonly PontoFracionario[];
} {
  if (saida === 0) return { entrada: espalhar(entrada, BASE_INTEIRA), saida: [] };
  if (entrada === 0) return { entrada: [], saida: espalhar(saida, BASE_INTEIRA) };
  return { entrada: espalhar(entrada, METADE_ESQUERDA), saida: espalhar(saida, METADE_DIREITA) };
}

export function pontosPadraoDaObra(materiais: readonly string[]): Readonly<Record<string, PontoFracionario>> {
  const pontos = espalhar(materiais.length, BASE_INTEIRA);
  return Object.fromEntries(materiais.map((m, i) => [m, pontos[i] ?? [0.5, Y_DA_BASE]]));
}

const qtd = (gaveta: Readonly<Record<string, number>>, m: string): number => gaveta[m] ?? 0;

/**
 * As mercadorias que cada ponto de estoque mostra, com a quantidade, na ordem dos
 * pontos. Separado de `pilhasDoPredio` porque o teste do pisca conta a troca do
 * CONJUNTO do armazem, e nao a do desenho.
 */
export function mercadoriasDoEstoque(
  predio: Predio, contexto: ContextoDasCamadas,
): { readonly entrada: readonly (readonly [string, number])[]; readonly saida: readonly (readonly [string, number])[] } {
  if (predio.estado !== 'completo') return { entrada: [], saida: [] };
  const { entrada, saida } = predio.estoque;
  if (predio.tipo === contexto.idDoArmazem) {
    // O armazem guarda nas duas gavetas (o estoque inicial nasce em `saida`); o
    // jogador ve o total. Desempate pela ordem de `economia.mercadorias`: `sort` e
    // estavel, e a lista de partida ja esta nessa ordem.
    const maiores = contexto.mercadorias
      .map((m) => [m, qtd(entrada, m) + qtd(saida, m)] as const)
      .filter(([, q]) => q > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, PONTOS_DO_ARMAZEM);
    return { entrada: maiores, saida: [] };
  }
  if (predio.tipo === contexto.idDaBodega) {
    return { entrada: contexto.comidas.map((m) => [m, qtd(entrada, m)] as const), saida: [] };
  }
  const r = contexto.receitas[predio.tipo];
  if (r === undefined) return { entrada: [], saida: [] };
  return {
    entrada: r.entra.map((m) => [m, qtd(entrada, m)] as const),
    saida: r.sai.map((m) => [m, qtd(saida, m)] as const),
  };
}

/** A tabua e a pedra entregues e ainda nao pregadas, na ordem do custo. */
export function materialNaObra(
  predio: Predio, custo: Readonly<Record<string, number>>, hpPorMaterialEntregue: number,
): readonly (readonly [string, number])[] {
  if (predio.estado !== 'obra') return [];
  let pregados = hpPorMaterialEntregue > 0 ? Math.ceil(predio.hp / hpPorMaterialEntregue) : 0;
  const pilha: (readonly [string, number])[] = [];
  for (const [m, total] of Object.entries(custo)) {
    if (total <= 0) continue;
    const entregues = total - (predio.obra.faltam[m] ?? 0);
    const consumidos = Math.min(pregados, entregues);
    pregados -= consumidos;
    pilha.push([m, entregues - consumidos]);
  }
  return pilha;
}

/** As pilhas de um predio, prontas para desenhar. Quantidade 0 nao desenha nada. */
export function pilhasDoPredio(predio: Predio, dados: DadosDasPilhas): PilhaDesenhada[] {
  const ancoras = dados.ancoras[predio.tipo];
  const pilhas: PilhaDesenhada[] = [];
  const empilhar = (gaveta: GavetaDaPilha, mercadoria: string, q: number, ponto: PontoFracionario | undefined): void => {
    if (q > 0 && ponto !== undefined) pilhas.push({ gaveta, mercadoria, n: Math.min(q, TETO_DA_PILHA), ponto });
  };

  if (predio.estado === 'obra') {
    const custo = dados.custos[predio.tipo] ?? {};
    const materiais = Object.keys(custo).filter((m) => (custo[m] ?? 0) > 0);
    const pontos = ancoras?.obra ?? pontosPadraoDaObra(materiais);
    for (const [m, q] of materialNaObra(predio, custo, dados.hpPorMaterialEntregue)) empilhar('obra', m, q, pontos[m]);
    return pilhas;
  }

  const { entrada, saida } = mercadoriasDoEstoque(predio, dados.contexto);
  // O armazem tem sempre os mesmos 4 pontos, mesmo com menos de 4 mercadorias:
  // o ponto e do PREDIO, nao do que ele guarda agora.
  const nEntrada = predio.tipo === dados.contexto.idDoArmazem ? PONTOS_DO_ARMAZEM : entrada.length;
  const padrao = pontosPadraoDoEstoque(nEntrada, saida.length);
  const pontosEntrada = ancoras?.estoque?.entrada ?? padrao.entrada;
  const pontosSaida = ancoras?.estoque?.saida ?? padrao.saida;
  entrada.forEach(([m, q], i) => empilhar('entrada', m, q, pontosEntrada[i]));
  saida.forEach(([m, q], i) => empilhar('saida', m, q, pontosSaida[i]));
  return pilhas;
}

/**
 * Onde cada unidade da pilha fica, em LADOS de unidade a partir do ponto (o ponto e
 * o pe da pilha, no meio da fileira de baixo): tres embaixo e dois em cima,
 * encaixados entre os de baixo. `[dx, dy]`, com dy negativo subindo.
 */
export function posicoesNaPilha(n: number): readonly (readonly [number, number])[] {
  const base = Math.min(n, UNIDADES_NA_BASE);
  const posicoes: (readonly [number, number])[] = [];
  for (let i = 0; i < base; i += 1) posicoes.push([i - (base - 1) / 2, 0]);
  const cima = Math.min(n, TETO_DA_PILHA) - base;
  for (let i = 0; i < cima; i += 1) posicoes.push([i - (cima - 1) / 2, -1]);
  return posicoes;
}
