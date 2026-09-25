import { gameData } from './data';
import type { GameData } from './data/types';
import type { GameState, Predio, PredioCompleto } from './state';
import { ID_DA_BODEGA } from './state';

/**
 * F20a — os derivados puros da Bodega: quem e Bodega, o que o jogo chama de
 * comida, quanto ela guarda de cada tipo e quanto ainda falta. Nenhum estado
 * muda aqui.
 *
 * CAMADA: este modulo NAO pode importar `estradas`, `pathfinding` nem `jobs`. E
 * o mesmo contrato que o cabecalho de `escola.ts` explica, e pelo mesmo motivo:
 * `reservas.ts` o importa (a demanda de uma tarefa de nivel 1 e a vaga do
 * destino) e `estradas.ts` importa `reservas.ts`.
 *
 * Irmao de `escola.ts`: a Bodega e o segundo predio sem receita que recebe
 * carga. A diferenca esta no que limita a gaveta — a escola e limitada pela
 * FILA de treino, a Bodega por um TETO POR TIPO de comida, que vem de
 * `data/condition.json:inn.estoquePorTipoDeComida`.
 */

/** Bodega de pe. Obra nao pede comida: ninguem come num canteiro. */
export function ehBodegaCompleta(predio: Predio | undefined): predio is PredioCompleto {
  return predio !== undefined && predio.estado === 'completo' && predio.tipo === ID_DA_BODEGA;
}

/**
 * O que o jogo chama de comida: as chaves de
 * `condition.json:restauracaoPorComida`, o unico lugar do dado que declara isso
 * (e o mesmo que a F20b vai ler para restaurar condicao). Ordem do dado, como
 * `insumosDoPredio` — a lista vem de um JSON versionado, nao de estado, entao a
 * ordem das chaves e estavel entre corridas e entre saves.
 *
 * Nenhum id de comida e digitado em `.ts`: nem `loaves`, nem `sausages`.
 */
export function comidasConhecidas(dados: GameData = gameData): readonly string[] {
  return Object.keys(dados.condicao.restauracaoPorComida);
}

/** Se `mercadoria` e comida. Falso para ouro, pedra e tronco. */
export function ehComida(mercadoria: string, dados: GameData = gameData): boolean {
  return comidasConhecidas(dados).includes(mercadoria);
}

/**
 * Quanto a Bodega guarda de CADA tipo de comida (`condition.json:inn`).
 *
 * Nao vem de `predio.capacidade.entrada`, e nao poderia: a Bodega nao tem
 * receita, entao `capacidadeParaTipo` lhe da `null` nas duas gavetas ("nao
 * gerencia estoque, nao ha limite a impor"). O limite dela e do dominio da
 * fome, e mora com a fome.
 */
export function tetoDeComidaNaBodega(dados: GameData = gameData): number {
  return dados.condicao.inn.estoquePorTipoDeComida;
}

/**
 * O que esta Bodega ainda precisa RECEBER desta mercadoria: o teto menos o que
 * ja esta na gaveta `entrada`. Nunca negativo.
 *
 * E o analogo exato de `ouroNecessario` (`sim/escola.ts`), e a mesma coisa: a
 * DEMANDA que o JobBoard converte em tarefa de entrega e a "vaga no destino" de
 * uma tarefa de nivel 1. Zero para quem nao e Bodega e para o que nao e comida —
 * e e isso que impede a Bodega de virar um segundo armazem.
 */
export function comidaNecessaria(
  state: GameState, predioId: string, mercadoria: string, dados: GameData = gameData,
): number {
  const bodega = state.predios.porId[predioId];
  if (!ehBodegaCompleta(bodega) || !ehComida(mercadoria, dados)) return 0;
  return Math.max(0, tetoDeComidaNaBodega(dados) - (bodega.estoque.entrada[mercadoria] ?? 0));
}

/**
 * F20b — as comidas que esta Bodega TEM na gaveta `entrada` agora, na ordem do
 * dado. E o portao do gerador de `'comer'` (ninguem caminha para achar
 * prateleira vazia) e a lista que a refeicao consome.
 *
 * Mede por QUANTIDADE, e nao pelas chaves de `entrada`: a gaveta guarda chave com
 * zero depois de uma refeicao, e contar chave diria "tem comida" para uma Bodega
 * vazia.
 */
export function comidasNaBodega(
  state: GameState, predioId: string, dados: GameData = gameData,
): readonly string[] {
  const bodega = state.predios.porId[predioId];
  if (!ehBodegaCompleta(bodega)) return [];
  return comidasConhecidas(dados).filter((c) => (bodega.estoque.entrada[c] ?? 0) > 0);
}

/** Se ha o que comer nesta Bodega. O predicado do gerador (F20b, D4). */
export function temComidaNaBodega(
  state: GameState, predioId: string, dados: GameData = gameData,
): boolean {
  return comidasNaBodega(state, predioId, dados).length > 0;
}
