/**
 * F13 — a escola: o comando de enfileirar, o de cancelar e o relogio da fila.
 *
 * O ouro e cobrado quando o treino COMECA (transicao `aguardando -> treinando`),
 * nao quando o pedido entra na fila: e a fila em `aguardando` que cria a DEMANDA
 * de ouro que faz o JobBoard pedir a entrega ao armazem (nivel 2 da escada).
 * Cobrar no enfileiramento tornaria a demanda impossivel — o ouro teria que ja
 * estar la para o pedido existir.
 */
import type { Command } from '../commands';
import type { GameData } from '../data/types';
import { gameData } from '../data';
import type { GameState, ItemDeFila, PredioCompleto } from '../state';
import { ID_DA_ESCOLA, MERCADORIA_DE_OURO } from '../state';
import { comFila, custoDeTreino, ehCivilConhecido, ehEscolaCompleta, filaDaEscola } from '../escola';
import type { MotivoDeRecusaDeTreino } from '../escola';
import { tilesDaPorta } from '../estradas';
import type { TileDeGrid } from '../estradas';
import { tileAndavel } from '../pathfinding';
import type { ResultadoDeSistema } from './jobs';

export type EnqueueTraining = Extract<Command, { readonly type: 'EnqueueTraining' }>;
export type CancelTraining = Extract<Command, { readonly type: 'CancelTraining' }>;

/**
 * Enfileira UM pedido. Recusa (sem mudar o estado) o que nao e escola completa, a
 * fila no teto de `slotsDeFila` e o tipo de civil que `units.json` nao conhece.
 * NAO olha ouro: quem olha e `sistemaDasEscolas`, na hora de comecar.
 */
export function aplicarEnqueueTraining(
  state: GameState, comando: EnqueueTraining, dados: GameData = gameData,
): ResultadoDeSistema {
  const recusar = (motivo: MotivoDeRecusaDeTreino): ResultadoDeSistema => ({
    state,
    events: [{
      type: 'command-rejected', command: 'EnqueueTraining',
      predio: comando.predio, unidade: comando.unidade, motivo,
    }],
  });

  const predio = state.predios.porId[comando.predio];
  if (predio === undefined) return recusar('predio-inexistente');
  if (predio.tipo !== ID_DA_ESCOLA) return recusar('nao-e-escola');
  if (!ehEscolaCompleta(predio)) return recusar('escola-em-obra');
  if (!ehCivilConhecido(comando.unidade, dados)) return recusar('unidade-desconhecida');

  const fila = filaDaEscola(state, comando.predio);
  if (fila.length >= dados.economia.schoolhouse.slotsDeFila) return recusar('fila-cheia');

  const numero = state.proximoId;
  const item: ItemDeFila = { id: `f${numero}`, unidade: comando.unidade, estado: 'aguardando' };
  return {
    state: comFila({ ...state, proximoId: numero + 1 }, comando.predio, [...fila, item]),
    events: [],
  };
}

/**
 * Tira o item da fila. Item ou escola inexistentes: no-op, nunca recusa (molde do
 * `DemolishRoad`). NAO devolve ouro — um item `aguardando` nunca pagou, e um
 * `treinando` ja gastou.
 */
export function aplicarCancelTraining(state: GameState, comando: CancelTraining): ResultadoDeSistema {
  const fila = filaDaEscola(state, comando.predio);
  const restante = fila.filter((item) => item.id !== comando.item);
  if (restante.length === fila.length) return { state, events: [] };
  return { state: comFila(state, comando.predio, restante), events: [] };
}

/**
 * Onde a unidade treinada nasce: o primeiro tile ANDAVEL da porta da escola (a
 * borda sul do footprint, `tilesDaPorta`). Nao e
 * `economy.json:estadoInicial.spawnDeUnidades` — aquele campo e o canto de onde o
 * cenario inicial nasce, e usa-lo faria duas escolas em pontas opostas do mapa
 * cuspirem unidades no mesmo tile.
 *
 * `null` se nenhum tile da porta e andavel: o item pronto segura. Na pratica nao
 * acontece — o ouro so chega a escola por uma porta que e estrada, e tile de
 * estrada e andavel, entao uma escola nessa situacao nunca chegou a cobrar.
 */
export function tileDeSaida(
  state: GameState, escola: PredioCompleto, dados: GameData = gameData,
): TileDeGrid | null {
  return tilesDaPorta(escola, dados).find((tile) => tileAndavel(state, tile, 'livre', dados)) ?? null;
}

/** O ouro na gaveta `entrada` da escola — de onde a cobranca sai. */
function ouroNaEscola(escola: PredioCompleto): number {
  return escola.estoque.entrada[MERCADORIA_DE_OURO] ?? 0;
}

function comOuro(state: GameState, escola: PredioCompleto, novo: number): GameState {
  const atualizado: PredioCompleto = {
    ...escola,
    estoque: {
      ...escola.estoque,
      entrada: { ...escola.estoque.entrada, [MERCADORIA_DE_OURO]: novo },
    },
  };
  return {
    ...state,
    predios: { ...state.predios, porId: { ...state.predios.porId, [escola.id]: atualizado } },
  };
}

/**
 * Apaga fila de predio que nao e escola completa (demolicao, F16). Devolve o MESMO
 * objeto quando nada muda — um tick normal nao aloca estado novo por causa disto.
 */
export function sanearFilas(state: GameState): GameState {
  let atual = state;
  for (const predioId of Object.keys(state.treino)) {
    if (ehEscolaCompleta(state.predios.porId[predioId])) continue;
    atual = comFila(atual, predioId, []);
  }
  return atual;
}

export function sistemaDasEscolas(state: GameState, dados: GameData = gameData): ResultadoDeSistema {
  let atual = sanearFilas(state);
  const events: ResultadoDeSistema['events'][number][] = [];

  for (const predioId of atual.predios.ordem) {
    const escola = atual.predios.porId[predioId];
    if (!ehEscolaCompleta(escola)) continue;
    const fila = filaDaEscola(atual, predioId);
    const primeiro = fila[0];
    if (primeiro === undefined) continue;

    if (primeiro.estado === 'aguardando') {
      // A escola treina UM de cada vez: so o primeiro item anda.
      const custo = custoDeTreino(dados);
      const emCaixa = ouroNaEscola(escola);
      if (emCaixa < custo) continue; // espera o serf; a demanda ja esta no quadro
      const comecou: ItemDeFila = {
        id: primeiro.id, unidade: primeiro.unidade, estado: 'treinando',
        restam: dados.economia.schoolhouse.ticksPorTreino,
      };
      // O tick que COBRA nao conta como tick de treino: `restam` nasce cheio e a
      // contagem comeca no tick seguinte.
      atual = comFila(comOuro(atual, escola, emCaixa - custo), predioId, [comecou, ...fila.slice(1)]);
      continue;
    }

    const restam = primeiro.restam - 1;
    if (restam > 0) {
      const andou: ItemDeFila = { ...primeiro, restam };
      atual = comFila(atual, predioId, [andou, ...fila.slice(1)]);
      continue;
    }

    // Terminou: a unidade nasce na porta e o item sai da fila no mesmo tick.
    const tile = tileDeSaida(atual, escola, dados);
    if (tile === null) continue; // sem porta andavel o item segura; `restam` fica em 1
    const id = `u${atual.proximoId}`;
    atual = comFila(
      {
        ...atual,
        proximoId: atual.proximoId + 1,
        unidades: {
          porId: {
            ...atual.unidades.porId,
            [id]: { id, tipo: primeiro.unidade, gx: tile.gx, gy: tile.gy, fsm: 'ocioso', fsmData: {} },
          },
          ordem: [...atual.unidades.ordem, id],
        },
      },
      predioId,
      fila.slice(1),
    );
    events.push({ type: 'unit-trained', predio: predioId, unidade: id, tipo: primeiro.unidade });
  }

  return { state: atual, events };
}
