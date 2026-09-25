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
import type { GameState, Predio, PredioCompleto } from './state';
import { algumTileTrabalhavel, melhorTileDeColheita } from './recursos';
import { tileAlcancavelParaColheita } from './aproximacao';

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
 * F-T2a — nao ha mais recurso ao alcance para um ciclo INTEIRO. `false` para
 * receita sem colheita (sawmill, bakery: o insumo vem da gaveta). O corte e no
 * ciclo e nao na unidade para que o predio nunca comece um ciclo que nao pode
 * terminar — um lajedo com 1 pedra para uma receita de 2 ja esta esgotado.
 *
 * Substituiu `veioEsgotado(producao, receita)`, que perguntava ao PREDIO. A
 * pergunta agora e ao MAPA, e e por isso que ela precisa do estado. O nome do
 * alerta (`veio-esgotado`) e o do evento (`vein-exhausted`) ficaram: o que mudou
 * foi de onde vem a resposta, nao o que o jogador ve acontecer.
 *
 * F-T2c — a conta deixou de ser a SOMA do alcance e passou a ser POR TILE:
 * existe um tile ao alcance com o ciclo inteiro? Com a reserva exclusiva
 * (`TarefaColher`) um ciclo sai de UM tile, entao somar aqui e exigir um tile
 * ali seria o predicado de elegibilidade discordando de si mesmo nos dois lados:
 * dois tiles de 1 unidade para um ciclo de 2 nao esgotariam o predio e tambem
 * nunca gerariam tarefa, e o especialista esperaria o que nunca chega.
 *
 * A pergunta e ao MAPA e ignora reservas de proposito: quem responde "este veio
 * acabou" (o alerta da F22, o evento `vein-exhausted`) nao pode responder "a
 * pedreira vizinha esta usando o tile" — sao coisas diferentes, e a segunda se
 * resolve sozinha quando o ciclo da vizinha fecha.
 */
export function semRecursoAoAlcance(
  state: GameState, predio: PredioCompleto, receita: ReceitaDePredio, dados: GameData = gameData,
): boolean {
  const { colheita } = receita;
  if (colheita === null) return false;
  // F-T4d — o MESMO predicado de elegibilidade que a escolha do tile usa
  // (`especialistas.ts`: `tileAlcancavelParaColheita`). Medido em partida
  // (2026-09-25): a cabana do pescador na abertura tem 31 cardumes ao alcance e
  // so 19 com margem; secos os 19, o pescador parava em `esperando_insumo` e o
  // predio NAO dizia `veio-esgotado` nem emitia `vein-exhausted`, porque esta
  // pergunta contava os 12 tiles de interior de agua que ninguem alcanca. Era o
  // predicado de elegibilidade discordando de si mesmo nos dois lados — a mesma
  // classe do paragrafo da F-T2c acima, agora no eixo da APROXIMACAO em vez da
  // quantidade. Rocha e milho se pisam e nunca sentiram a diferenca; agua sente.
  return melhorTileDeColheita(
    state, predio, colheita, unidadesPorCiclo(receita), undefined, dados,
    (k) => tileAlcancavelParaColheita(state, k, dados),
  ) === null;
}

/**
 * F18 — este predio nao tem mais NADA que fazer no mapa: nem colher agora, nem
 * plantar para colher depois. E a irma larga de `semRecursoAoAlcance`, e a
 * diferenca entre as duas e so o pousio.
 *
 * Quem pergunta e o ALERTA, e e a pergunta certa para ele: o ciclo congela
 * enquanto nao ha o que colher (e ai o roceiro planta), mas o predio so esta
 * parado de verdade quando nao ha tile nenhum ao alcance. Para a pedreira as
 * duas dao a mesma resposta sempre — lajedo nao se replanta.
 */
export function semTrabalhoAoAlcance(
  state: GameState, predio: PredioCompleto, receita: ReceitaDePredio, dados: GameData = gameData,
): boolean {
  const { colheita } = receita;
  if (colheita === null) return false;
  // F-T4d — o mesmo `elegivel` de `semRecursoAoAlcance`, pelo mesmo motivo: e daqui
  // que sai o alerta `veio-esgotado` (F22), e sem o filtro a cabana com so interior
  // de agua ao alcance ficava muda enquanto o pescador esperava.
  return !algumTileTrabalhavel(
    state, predio, colheita, unidadesPorCiclo(receita), dados,
    (k) => tileAlcancavelParaColheita(state, k, dados),
  );
}
