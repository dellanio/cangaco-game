/**
 * F-VIVO-b — o trabalho: o quadro de animacao de dentro do predio, por caso
 * (docs/BRIEF-ARTE.md §4a, BUILD_PLAN.md "Aceite da F-VIVO-b").
 *
 * Aritmetica pura, so `import type` e as tabelas de `manifesto-camadas.ts`, como
 * `pilhas.ts`: o dado chega por parametro (`DadosDoTrabalho`), montado pelo funil
 * `predios.ts`. A cena so desenha; o teste afirma o quadro em Node, sem tela.
 *
 * O quadro sai do `progresso` do ciclo, nunca do relogio: e isso que faz o predio
 * parado nao animar, e o numero de repeticoes vir de `ticksDoCiclo` — o render nao
 * inventa duracao. Um laco de F quadros cabe k vezes no trecho de T ticks, com
 * k = max(1, floor(T / (F * TICKS_POR_QUADRO))), e o quadro do tick p e
 * floor(p * k * F / T). Como k * F <= T, o indice sobe no maximo um por tick: o `n`
 * nunca pula.
 *
 * F-VIVO-e: o ocioso le o predicado "dentro" de `visibilidade.ts` (o do BUG-X), unica
 * dependencia que nao e so tipo ou tabela: a casa acende o ocioso exatamente quando a
 * tela esconde o homem.
 */
import type { AncorasDoPredio } from './manifesto';
import { LACOS_DO_CASO, LACOS_DA_FUMACA, ID_DA_FUMACA, LACOS_DO_OCIOSO, ID_DO_OCIOSO } from './manifesto-camadas';
import { dentroDaCasa } from './visibilidade';
import type { CasoDoPredioVivo } from './manifesto-camadas';
import type { Predio, Unidade } from '../sim/state';

/**
 * Um quadro por tick da sim (10 Hz): 8 quadros em 0,8 s. E o passo do kam_remake,
 * em que a animacao de trabalho avanca um quadro por tick de jogo. Numero de TELA,
 * nao de balanceamento: muda o ritmo do desenho, nunca o do ciclo.
 */
export const TICKS_POR_QUADRO = 1;

/**
 * Os rotulos da FSM do ocupante em que o relogio do ciclo anda (`sim/systems/
 * especialistas.ts`): `trabalhando` dentro do predio, `colhendo` no tile (F-T3).
 * `esperando_insumo`, `saida_cheia` e a caminhada nao animam. O teste confere os
 * dois contra uma pedreira real, para que um rotulo renomeado na sim reprove aqui.
 */
export const ROTULOS_QUE_ANIMAM: readonly string[] = ['trabalhando', 'colhendo'];

/**
 * BUG-X — os rotulos que animam com o ocupante DENTRO da casa. O caso 2 (`transforma`,
 * pedreira e vinhedo) so anima com eles: a casa desenha o trabalho de dentro, e enquanto
 * o cabra esta no lajedo (`colhendo`) nao ha ninguem la (decisao do operador, 2026-10-01).
 * O teste confere cada um contra `POSICAO_DO_ESTADO` da colisao, que e quem diz `dentro`.
 */
export const ROTULOS_DE_DENTRO: readonly string[] = ['trabalhando'];

/** A area padrao, so para o placeholder: no meio do predio, acima da linha das
 *  pilhas (`Y_DA_BASE` de `pilhas.ts`), para que as duas camadas nao se cubram. */
export const AREA_PADRAO: readonly [number, number, number, number] = [0.3, 0.35, 0.7, 0.75];

export interface QuadroDeTrabalho {
  readonly laco: string;
  /** De 1 ao total de quadros do laco. */
  readonly n: number;
}

export interface DadosDoTrabalho {
  readonly casos: Readonly<Record<string, CasoDoPredioVivo>>;
  /** `ticksDoCiclo` da receita de cada tipo, ja em ticks (o carregador converteu). */
  readonly ticksDoCiclo: Readonly<Record<string, number>>;
  /** As ancoras do manifesto por tipo. Tipo sem entrada usa as padrao. */
  readonly ancoras: Readonly<Record<string, AncorasDoPredio | undefined>>;
}

/**
 * O `progresso` do ciclo que esta sendo trabalhado agora, ou `null` se o predio
 * esta parado: sem ocupante, pausado, sem insumo, com a saida cheia, ou com o
 * ocupante andando.
 */
function progressoEmTrabalho(predio: Predio, unidade: Unidade | null, dados: DadosDoTrabalho): number | null {
  if (predio.estado !== 'completo' || predio.pausado || predio.producao === null) return null;
  if (unidade === null || predio.ocupante !== unidade.id) return null;
  if (!ROTULOS_QUE_ANIMAM.includes(unidade.fsm)) return null;
  const total = dados.ticksDoCiclo[predio.tipo];
  const { progresso } = predio.producao;
  if (total === undefined || total <= 0 || progresso < 0 || progresso >= total) return null;
  return progresso;
}

/** O quadro do tick `p` num trecho de `t` ticks em que um laco de `f` quadros se
 *  repete: devolve a volta (0..k-1) e o quadro (1..f). */
function noTrecho(p: number, t: number, f: number): { readonly volta: number; readonly n: number } {
  const k = Math.max(1, Math.floor(t / (f * TICKS_POR_QUADRO)));
  const indice = Math.min(k * f - 1, Math.floor((p * k * f) / t));
  return { volta: Math.floor(indice / f), n: (indice % f) + 1 };
}

const quadrosDe = (caso: CasoDoPredioVivo, laco: string): number => LACOS_DO_CASO[caso][laco] ?? 0;

/**
 * O quadro de trabalho do predio neste tick, ou `null`:
 * - caso 1 (`guarda`): sempre `null` — a vida dele e o trabalhador no campo e a fumaca;
 * - caso 2 (`transforma`): `inicio`, `meio` e `fim` pelos tercos do progresso, uma vez
 *   o primeiro e o ultimo, e o `meio` repetido ate encher o terco dele; so com o
 *   ocupante dentro (`ROTULOS_DE_DENTRO`, BUG-X): no tile, a casa fica parada;
 * - casos 3 e 5 (`dentro`, `criacao`): `laco1` e `laco2` alternando a cada volta;
 * - caso 4 (`luz`): `luz`, repetido.
 * O `tick` nao entra (o quadro e do `progresso`); fica na assinatura do aceite.
 */
export function quadroDeTrabalho(
  predio: Predio, unidade: Unidade | null, _tick: number, dados: DadosDoTrabalho,
): QuadroDeTrabalho | null {
  const caso = dados.casos[predio.tipo];
  if (caso === undefined || caso === 'guarda') return null;
  const p = progressoEmTrabalho(predio, unidade, dados);
  const total = dados.ticksDoCiclo[predio.tipo];
  if (p === null || total === undefined) return null;

  if (caso === 'transforma') {
    if (unidade === null || !ROTULOS_DE_DENTRO.includes(unidade.fsm)) return null;
    const t1 = Math.floor(total / 3);
    const t2 = Math.floor((2 * total) / 3);
    if (p < t1) return { laco: 'inicio', n: noTercoUnico(p, t1, quadrosDe(caso, 'inicio')) };
    if (p < t2) return { laco: 'meio', n: noTrecho(p - t1, t2 - t1, quadrosDe(caso, 'meio')).n };
    return { laco: 'fim', n: noTercoUnico(p - t2, total - t2, quadrosDe(caso, 'fim')) };
  }
  if (caso === 'luz') return { laco: 'luz', n: noTrecho(p, total, quadrosDe(caso, 'luz')).n };
  const { volta, n } = noTrecho(p, total, quadrosDe(caso, 'laco1'));
  return { laco: volta % 2 === 0 ? 'laco1' : 'laco2', n };
}

/** Um laco tocado UMA vez, esticado num trecho de `t` ticks. */
function noTercoUnico(p: number, t: number, f: number): number {
  if (t <= 0) return f;
  return Math.min(f, Math.floor((p * f) / t) + 1);
}

/**
 * O quadro da fumaca (1..8), ou `null`. So existe quando o predio DECLARA
 * `ancoras.trabalho.fumaca` e esta trabalhando pelo mesmo predicado do quadro — e a
 * unica coisa que o caso 1 anima. Aqui o `tick` entra: a fumaca nao tem ciclo, sobe
 * enquanto ha trabalho.
 */
export function quadroDaFumaca(
  predio: Predio, unidade: Unidade | null, tick: number, dados: DadosDoTrabalho,
): number | null {
  if (dados.ancoras[predio.tipo]?.trabalho?.fumaca === undefined) return null;
  if (progressoEmTrabalho(predio, unidade, dados) === null) return null;
  const f = LACOS_DA_FUMACA[ID_DA_FUMACA] ?? 1;
  return (Math.floor(Math.max(0, tick) / TICKS_POR_QUADRO) % f) + 1;
}

/**
 * F-VIVO-e — o quadro do ocioso (1..8), ou `null`: predio com receita, ocupante DENTRO
 * (`dentroDaCasa`, o mesmo predicado que o esconde) e nenhum quadro de trabalho. Cobre
 * `esperando_insumo`, `saida_cheia` e o descanso do caso 1. O ocioso nao tem ciclo: o
 * `tick` e o relogio, como na fumaca. Pausado nao acende, porque `dentroDaCasa` o poe
 * fora (BUG-X); a decisao do operador de 2026-10-01 que o quer aceso espera no BUILD_PLAN.
 */
export function quadroOcioso(
  predio: Predio, unidade: Unidade | null, tick: number, dados: DadosDoTrabalho,
): number | null {
  if (dados.casos[predio.tipo] === undefined || predio.estado !== 'completo' || predio.producao === null) return null;
  if (unidade === null || !dentroDaCasa(predio, unidade)) return null;
  if (quadroDeTrabalho(predio, unidade, tick, dados) !== null) return null;
  const f = LACOS_DO_OCIOSO[ID_DO_OCIOSO] ?? 1;
  return (Math.floor(Math.max(0, tick) / TICKS_POR_QUADRO) % f) + 1;
}

/** Onde o quadro e desenhado, em fracao do sprite `completo` (ou do lote). */
export function areaDoTrabalho(ancoras: AncorasDoPredio | undefined): readonly [number, number, number, number] {
  return ancoras?.trabalho?.area ?? AREA_PADRAO;
}
