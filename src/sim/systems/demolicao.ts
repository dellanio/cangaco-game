/**
 * `DemolishBuilding` (F16a): o jogador derruba um predio, em obra ou completo.
 *
 * Arquivo proprio, e nao `build.ts`: aquele e do `PlaceBlueprint`, e a demolicao
 * tem conta propria (devolucao) e uma regra de destino que o posicionamento nao
 * tem. O que ela NAO faz, de proposito: cancelar tarefa, apagar fila de treino ou
 * desocupar especialista. Isso e o saneamento do mesmo tick — `sanearTarefas`
 * (`systems/jobs.ts`), `sanearFilas` (`systems/escolas.ts`) e `passoProduzindo`
 * (`systems/especialistas.ts`) ja tratam "o predio sumiu", porque a F10, a F13 e a
 * F14 precisaram disso antes de existir comando. Reimplementar aqui seria criar
 * um segundo caminho para o mesmo estado.
 */
import type { Command } from '../commands';
import type { Colecao, GameEvent, GameState, Predio } from '../state';
import type { GameData } from '../data/types';
import { armazensCompletos, distanciaEntrePredios } from '../estradas';
import { devolverMercadorias } from '../deposito';
import { entreguesPorMercadoria } from '../obra';

export type DemolishBuilding = Extract<Command, { readonly type: 'DemolishBuilding' }>;

interface Resultado {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * O que volta ao armazem: a fracao do dado sobre o material JA ENTREGUE
 * (`construcao.devolucaoAoDemolir`, arredondada para baixo por mercadoria) MAIS o
 * estoque interno INTEIRO, as duas gavetas.
 *
 * O estoque vai inteiro por decisao do operador (2026-09-23): os niveis 6 e 7 da
 * escada de producao existem desde a F15b justamente para trazer essa mercadoria
 * de volta, entao destruir o que o jogador recuperaria esperando um tick puniria
 * quem demole rapido — e conservacao de bens e invariante do projeto. O material
 * de construcao e que perde a fracao: isso e o preco da demolicao.
 */
export function mercadoriasDevolvidas(
  predio: Predio, dados: GameData,
): Record<string, number> {
  const fracao = dados.construcao.devolucaoAoDemolir;
  const devolvido: Record<string, number> = {};
  for (const [mercadoria, posto] of Object.entries(entreguesPorMercadoria(predio, dados))) {
    const parte = Math.floor(posto * fracao);
    if (parte > 0) devolvido[mercadoria] = parte;
  }
  if (predio.estado === 'completo') {
    for (const gaveta of [predio.estoque.entrada, predio.estoque.saida]) {
      for (const [mercadoria, quantidade] of Object.entries(gaveta)) {
        if (quantidade > 0) devolvido[mercadoria] = (devolvido[mercadoria] ?? 0) + quantidade;
      }
    }
  }
  return devolvido;
}

/**
 * O armazem completo mais proximo ALCANCAVEL por estrada, medido de porta a porta
 * ANTES da remocao (depois o predio nao tem mais porta de onde medir). Empate: o
 * primeiro em `predios.ordem`, que e a mesma regra de desempate do serf em
 * `devolvendo`. `null` quando nenhum esta ligado a este predio pela rede — e a
 * perda declarada: predio desligado nao recebia entrega nem despachava nada.
 */
export function armazemDeDestino(
  state: GameState, predio: Predio, dados: GameData,
): string | null {
  let melhor: { id: string; distancia: number } | null = null;
  for (const armazem of armazensCompletos(state)) {
    if (armazem.id === predio.id) continue; // demolir o armazem nao o faz receber de si
    const distancia = distanciaEntrePredios(state, predio, armazem, dados);
    if (distancia !== null && (melhor === null || distancia < melhor.distancia)) {
      melhor = { id: armazem.id, distancia };
    }
  }
  return melhor === null ? null : melhor.id;
}

function semOPredio(predios: Colecao<Predio>, id: string): Colecao<Predio> {
  const porId = { ...predios.porId };
  delete porId[id];
  return { porId, ordem: predios.ordem.filter((outro) => outro !== id) };
}

export function aplicarDemolishBuilding(
  state: GameState, comando: DemolishBuilding, dados: GameData,
): Resultado {
  const predio = state.predios.porId[comando.predio];
  if (!predio) return { state, events: [] };

  const devolvido = mercadoriasDevolvidas(predio, dados);
  const destino = armazemDeDestino(state, predio, dados);
  const entregue = destino === null ? {} : devolvido;
  // Devolve ANTES de remover: o destino e um predio qualquer da colecao, e
  // remover primeiro so tornaria a conta mais dificil de ler. Como o destino
  // nunca e o proprio demolido, a ordem nao muda o resultado.
  const predios = semOPredio(devolverMercadorias(state.predios, devolvido, destino), comando.predio);

  return {
    state: { ...state, predios },
    events: [{
      type: 'building-demolished',
      predio: comando.predio,
      tipo: predio.tipo,
      devolvido: entregue,
      armazem: destino,
    }],
  };
}
