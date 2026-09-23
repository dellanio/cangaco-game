/**
 * F15b — quanto um predio QUER na gaveta `entrada`, e o que sobra dela.
 *
 * Uma funcao so para os dois lados da escada: a demanda de insumo (niveis 4 e 5)
 * e `alvo - estoque`, e o excedente (nivel 7) e `estoque - alvo`. Escrever as
 * duas contas separadas seria a garantia de que um dia elas discordam e uma
 * mercadoria fica indo e voltando entre o armazem e o predio.
 *
 * Nenhum numero mora aqui: a capacidade vem do proprio predio
 * (`capacidade.entrada`, carregado de `production.json`) e a proporcao, da
 * receita ja derivada. Modulo irmao de `producao.ts` e `obra.ts`: so le estado e
 * dado, nao muta nada e NAO conhece o JobBoard — e isso que deixa `reservas.ts`
 * e `systems/jobs.ts` importarem os dois sem fechar ciclo.
 */
import type { GameState } from './state';
import { MERCADORIA_DE_OURO } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';
import { custoDeTreino, ehEscolaCompleta, filaDaEscola } from './escola';
import { receitaDoTipo } from './producao';

/**
 * A capacidade da gaveta `entrada` repartida na proporcao da receita. Com uma
 * entrada so, e a gaveta inteira. Com duas, e proporcional a `entra` — e a sobra
 * da divisao inteira vai para a mercadoria de maior `entra`, desempate por nome,
 * para nao depender da ordem das chaves (determinismo).
 */
function alvoDoProdutor(
  entra: Readonly<Record<string, number>>,
  capacidade: number,
  mercadoria: string,
): number {
  const chaves = Object.keys(entra);
  const total = chaves.reduce((soma, m) => soma + (entra[m] ?? 0), 0);
  if (total === 0 || !(mercadoria in entra)) return 0;
  const parte = (m: string): number => Math.floor(((entra[m] ?? 0) * capacidade) / total);
  const sobra = capacidade - chaves.reduce((soma, m) => soma + parte(m), 0);
  const principal = [...chaves]
    .sort((a, b) => (entra[b] ?? 0) - (entra[a] ?? 0) || a.localeCompare(b))[0];
  return parte(mercadoria) + (mercadoria === principal ? sobra : 0);
}

/**
 * Quanto `predioId` quer de `mercadoria` na gaveta `entrada`.
 *
 * Produtor: a gaveta repartida pela receita. Escola: a demanda da FILA (os itens
 * que ainda nao comecaram, vezes o custo), que nao e capacidade — a escola nao
 * tem teto de gaveta. Qualquer outro predio: zero, e por isso o armazem nunca
 * gera tarefa de insumo nem de excedente para si mesmo.
 */
export function alvoDeEntrada(
  state: GameState,
  predioId: string,
  mercadoria: string,
  dados: GameData = gameData,
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  const receita = receitaDoTipo(predio.tipo, dados);
  if (receita !== null) {
    // `null` e "gaveta sem limite", e so o armazem tem isso — e armazem nao tem
    // receita, entao este ramo e inalcancavel hoje. Zero (nao infinito) e a
    // resposta conservadora se um dia for alcancado: deixa de gerar tarefa, em
    // vez de gerar um numero infinito delas.
    if (predio.capacidade.entrada === null) return 0;
    return alvoDoProdutor(receita.entra, predio.capacidade.entrada, mercadoria);
  }
  if (mercadoria === MERCADORIA_DE_OURO && ehEscolaCompleta(predio)) {
    // O ALVO e o que a fila quer TER, e nao `ouroNecessario`, que e o que ela
    // ainda precisa RECEBER (ja descontado o que esta na gaveta). Usar o
    // segundo faria o ouro recem-entregue virar excedente no mesmo tick e
    // voltar ao armazem pelo nivel 7 — o vaivem que esta funcao existe para
    // impedir. A relacao entre os dois continua exata:
    // `ouroNecessario === alvoDeEntrada - emCaixa`.
    const aguardando = filaDaEscola(state, predioId).filter((i) => i.estado === 'aguardando').length;
    return aguardando * custoDeTreino(dados);
  }
  return 0;
}

/** Niveis 4 e 5: o que ainda falta chegar na gaveta `entrada`. Nunca negativo. */
export function demandaDeInsumo(
  state: GameState,
  predioId: string,
  mercadoria: string,
  dados: GameData = gameData,
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  const alvo = alvoDeEntrada(state, predioId, mercadoria, dados);
  return Math.max(0, alvo - (predio.estoque.entrada[mercadoria] ?? 0));
}

/** Nivel 7: o que esta na gaveta `entrada` ALEM do alvo. Nunca negativo. E a
 *  mesma conta de `demandaDeInsumo` com o sinal trocado — por isso as duas nunca
 *  sao positivas ao mesmo tempo, e nada fica indo e voltando. */
export function excedenteNaEntrada(
  state: GameState,
  predioId: string,
  mercadoria: string,
  dados: GameData = gameData,
): number {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return 0;
  const alvo = alvoDeEntrada(state, predioId, mercadoria, dados);
  return Math.max(0, (predio.estoque.entrada[mercadoria] ?? 0) - alvo);
}

/**
 * Nivel 4 (parada) contra nivel 5 (baixa): o predio precisa de `mercadoria` e
 * nao tem NENHUMA. E o unico criterio — "parada" e falta, nao lentidao. Falso
 * para quem nao pede a mercadoria: a escola nao "para" por falta de ouro no
 * sentido da producao, e o nivel dela e o 2.
 */
export function produtorParado(
  state: GameState,
  predioId: string,
  mercadoria: string,
  dados: GameData = gameData,
): boolean {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return false;
  const receita = receitaDoTipo(predio.tipo, dados);
  if (receita === null || !(mercadoria in receita.entra)) return false;
  return (predio.estoque.entrada[mercadoria] ?? 0) === 0;
}

/** As mercadorias que a receita de `predioId` consome, na ordem do dado. Vazia
 *  para quem nao produz ou nao tem entrada (quarry, woodcutters). */
export function insumosDoPredio(
  state: GameState,
  predioId: string,
  dados: GameData = gameData,
): readonly string[] {
  const predio = state.predios.porId[predioId];
  if (!predio || predio.estado !== 'completo') return [];
  const receita = receitaDoTipo(predio.tipo, dados);
  return receita === null ? [] : Object.keys(receita.entra);
}
