/**
 * F-VIVO-c — os animais do curral (docs/BRIEF-ARTE.md §4a, BUILD_PLAN.md "Aceite da
 * F-VIVO-c"): cinco posicoes na Malhada e na Cocheira, com a idade DERIVADA do
 * progresso da receita. A sim nao muda e nao sabe que existe animal.
 *
 * Aritmetica pura, como `trabalho.ts`: o dado chega por parametro (`DadosDosAnimais`),
 * montado pelo funil `predios.ts`. A cena so desenha; o teste afirma em Node.
 *
 * A idade da posicao i e `1 + floor(3 * frac(p/T + i/5))`, com p o `progresso` e T o
 * `ticksDoCiclo`. A defasagem i/5 existe para os cinco nao crescerem juntos. A conta
 * e feita em inteiros, `floor(3 * ((5p + iT) mod 5T) / 5T)`, para a fronteira nao
 * depender de ponto flutuante.
 */
import type { AncorasDoPredio, PontoFracionario } from './manifesto';
import { ANIMAIS_NO_CURRAL, LACOS_DO_ANIMAL } from './manifesto-camadas';
import { ROTULOS_QUE_ANIMAM, TICKS_POR_QUADRO } from './trabalho';
import type { Predio, Unidade } from '../sim/state';

/** As tres idades do brief: filhote, jovem, adulto. */
export const IDADES_DO_ANIMAL = 3;

export type IdadeDoAnimal = 1 | 2 | 3;

export interface AnimalDoCurral {
  /** A posicao no curral, de 0 a `ANIMAIS_NO_CURRAL - 1`. */
  readonly i: number;
  readonly animal: string;
  readonly idade: IdadeDoAnimal;
  readonly ponto: PontoFracionario;
}

export interface DadosDosAnimais {
  /** Tipo de predio -> o animal que ele cria (`ANIMAL_DA_CRIACAO`). */
  readonly animais: Readonly<Record<string, string>>;
  /** `ticksDoCiclo` da receita de cada tipo, ja em ticks (o carregador converteu). */
  readonly ticksDoCiclo: Readonly<Record<string, number>>;
  readonly ancoras: Readonly<Record<string, AncorasDoPredio | undefined>>;
}

/**
 * Os pontos padrao, so para o placeholder (regra comum da F-VIVO): em fila sobre a
 * metade de tras do predio, acima da area padrao do trabalho (`trabalho.ts`, que
 * comeca em y 0,35) e longe da linha das pilhas (y 0,92).
 */
const Y_DO_CURRAL = 0.25;
const X_DO_CURRAL: readonly [number, number] = [0.08, 0.92];

export function pontosPadraoDoCurral(): readonly PontoFracionario[] {
  const [x0, x1] = X_DO_CURRAL;
  return Array.from(
    { length: ANIMAIS_NO_CURRAL },
    (_, i) => [x0 + ((x1 - x0) * (i + 0.5)) / ANIMAIS_NO_CURRAL, Y_DO_CURRAL] as const,
  );
}

/** A idade da posicao `i` no progresso `p` de um ciclo de `t` ticks. */
export function idadeNaPosicao(p: number, t: number, i: number): IdadeDoAnimal {
  const volta = ANIMAIS_NO_CURRAL * t;
  const fase = (((ANIMAIS_NO_CURRAL * p + i * t) % volta) + volta) % volta;
  return (1 + Math.floor((IDADES_DO_ANIMAL * fase) / volta)) as IdadeDoAnimal;
}

/**
 * Os animais do curral, ou `[]` (curral vazio): predio que nao e criacao, obra, sem
 * ocupante, ou SEM INSUMO — gaveta de entrada vazia e ciclo parado no zero, o
 * criador esperando milho. Pausado e com a saida cheia os animais continuam la,
 * parados na idade em que estavam: o bicho nao some porque o dono parou.
 */
export function animaisDoCurral(predio: Predio, dados: DadosDosAnimais): AnimalDoCurral[] {
  const animal = dados.animais[predio.tipo];
  if (animal === undefined || predio.estado !== 'completo') return [];
  if (predio.ocupante === null || predio.producao === null) return [];
  const t = dados.ticksDoCiclo[predio.tipo];
  if (t === undefined || t <= 0) return [];
  const { progresso } = predio.producao;
  const naEntrada = Object.values(predio.estoque.entrada).reduce((s, q) => s + (q ?? 0), 0);
  if (naEntrada === 0 && progresso === 0) return [];
  const p = Math.min(Math.max(progresso, 0), t);
  const pontos = dados.ancoras[predio.tipo]?.curral ?? pontosPadraoDoCurral();
  return Array.from({ length: ANIMAIS_NO_CURRAL }, (_, i) => ({
    i, animal, idade: idadeNaPosicao(p, t, i), ponto: pontos[i] ?? pontosPadraoDoCurral()[i] ?? [0.5, Y_DO_CURRAL],
  }));
}

/**
 * O quadro do laco parado do animal (1..4). Anda com o tick quando o criador esta
 * trabalhando (o mesmo predicado de `trabalho.ts`); parado, e o quadro 1. Um
 * quadro por tick, o passo de tela da F-VIVO-b.
 */
export function quadroDoAnimal(predio: Predio, unidade: Unidade | null, tick: number): number {
  const f = LACOS_DO_ANIMAL['idade1'] ?? 1;
  if (predio.estado !== 'completo' || predio.pausado || unidade === null) return 1;
  if (predio.ocupante !== unidade.id || !ROTULOS_QUE_ANIMAM.includes(unidade.fsm)) return 1;
  return (Math.floor(Math.max(0, tick) / TICKS_POR_QUADRO) % f) + 1;
}
