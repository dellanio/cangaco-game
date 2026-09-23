/**
 * F15a — as derivacoes puras do ciclo de producao. Modulo irmao de
 * `ocupacao.ts` e `obra.ts`: so le estado e dado, nao muta nada e NAO conhece o
 * JobBoard. E isso que permite `systems/especialistas.ts` importar os dois sem
 * fechar ciclo de import.
 *
 * O ciclo inteiro vem de `data/production.json`, ja convertido em
 * `ReceitaDePredio` no carregamento: `ticksDoCiclo` (inteiro) e as quantidades
 * de `entra`/`sai` por ciclo. Nenhuma quantidade e digitada aqui.
 */
import type { GameData, ReceitaDePredio } from './data/types';
import { gameData } from './data';
import type { Predio, PredioCompleto, Producao } from './state';

/** A receita do tipo, ou `null` — inclusive para tipo que nem existe no dado
 *  (save de outra versao). `null` e nunca `undefined`, como `trabalhadorDoTipo`. */
export function receitaDoTipo(tipo: string, dados: GameData = gameData): ReceitaDePredio | null {
  return dados.producao.receitas[tipo] ?? null;
}

/** Um predio COMPLETO cujo tipo tem receita. Estreita a uniao `Predio`, como
 *  `ehPredioOcupavel`. Obra nao produz: ela ainda nao tem gaveta. */
export function ehPredioProdutivo(
  predio: Predio | undefined,
  dados: GameData = gameData,
): predio is PredioCompleto {
  return predio !== undefined && predio.estado === 'completo'
    && receitaDoTipo(predio.tipo, dados) !== null;
}

/** Unidades de saida de UM ciclo (a soma de `sai`). A quarry rende 1, a sawmill
 *  2, a granja 1 porco + 1 couro = 2. */
export function unidadesPorCiclo(receita: ReceitaDePredio): number {
  return Object.values(receita.sai).reduce((soma, q) => soma + q, 0);
}

/** A gaveta `entrada` tem TUDO que o ciclo consome? Verdade de vacuo para
 *  receita sem entrada (quarry, woodcutters: tiram do veio ou do mato). */
export function temInsumo(predio: PredioCompleto, receita: ReceitaDePredio): boolean {
  return Object.entries(receita.entra)
    .every(([mercadoria, q]) => (predio.estoque.entrada[mercadoria] ?? 0) >= q);
}

/**
 * Debita de `entrada` o que UM ciclo consome. Pressupoe `temInsumo` — sem ele o
 * estoque fica negativo, e isso e bug de quem chamou, nao caso a tratar aqui.
 * Itera as chaves da RECEITA (fixas no carregamento), nunca as do estoque que
 * veio do save. A chave fica com `0` em vez de sumir: e o que `systems/serfs.ts`
 * ja faz ao coletar, e duas rotas para o mesmo estoque tem que dar o mesmo objeto.
 */
export function consumirInsumos(predio: PredioCompleto, receita: ReceitaDePredio): PredioCompleto {
  const entrada: Record<string, number> = { ...predio.estoque.entrada };
  for (const [mercadoria, q] of Object.entries(receita.entra)) {
    entrada[mercadoria] = (entrada[mercadoria] ?? 0) - q;
  }
  return { ...predio, estoque: { ...predio.estoque, entrada } };
}

/**
 * O que UM ciclo rende cabe na gaveta `saida`? O teto e da GAVETA INTEIRA
 * (`production.json: estoqueInternoPorPredio.saida`), somando mercadorias
 * diferentes — a granja enche a mesma gaveta com porco e couro. `null` e sem
 * limite (so o armazem, que nao produz).
 *
 * A soma varre `estoque.saida` vindo do save, o que normalmente seria proibido:
 * aqui vale porque soma de inteiros nao depende da ordem das chaves, entao o
 * resultado e o mesmo em qualquer maquina.
 */
export function cabeNaSaida(predio: PredioCompleto, receita: ReceitaDePredio): boolean {
  const teto = predio.capacidade.saida;
  if (teto === null) return true;
  const ocupado = Object.values(predio.estoque.saida).reduce((soma, q) => soma + q, 0);
  return ocupado + unidadesPorCiclo(receita) <= teto;
}

/**
 * O veio nao rende mais um ciclo INTEIRO. `false` quando `veio === null`
 * (receita renovavel: sawmill, bakery). O corte e no ciclo e nao na unidade
 * para que o predio nunca comece um ciclo que nao pode terminar — um veio com 1
 * pedra para uma receita de 2 ja esta esgotado.
 */
export function veioEsgotado(producao: Producao, receita: ReceitaDePredio): boolean {
  return producao.veio !== null && producao.veio < unidadesPorCiclo(receita);
}
