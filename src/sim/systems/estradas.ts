import type { Command } from '../commands';
import type { Colecao, GameEvent, GameState, Predio } from '../state';
import { ID_DO_ARMAZEM } from '../state';
import type { GameData } from '../data/types';
import { canPlaceRoad, chaveDeTile, MERCADORIA_DA_ESTRADA } from '../estradas';
import { devolverMercadorias } from '../deposito';
import { disponivelNaOrigem } from '../reservas';

export type PlaceRoad = Extract<Command, { readonly type: 'PlaceRoad' }>;
export type DemolishRoad = Extract<Command, { readonly type: 'DemolishRoad' }>;

interface Resultado {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

/**
 * Tira `quantidade` de pedra dos armazens completos: um armazem depois do outro em
 * `predios.ordem`, e em cada um a gaveta `saida` (so o que nao esta reservado por uma
 * tarefa) antes da `entrada`. O chamador ja garantiu (`canPlaceRoad`, que usa a mesma
 * conta em `pedraDisponivel`) que ha o bastante.
 */
function debitarPedra(state: GameState, quantidade: number): Colecao<Predio> {
  const { predios } = state;
  let restante = quantidade;
  const porId = { ...predios.porId };
  for (const id of predios.ordem) {
    if (restante <= 0) break;
    const predio = predios.porId[id];
    if (!predio || predio.estado !== 'completo' || predio.tipo !== ID_DO_ARMAZEM) continue;
    const daSaida = Math.min(Math.max(disponivelNaOrigem(state, id, MERCADORIA_DA_ESTRADA), 0), restante);
    restante -= daSaida;
    const daEntrada = Math.min(predio.estoque.entrada[MERCADORIA_DA_ESTRADA] ?? 0, restante);
    restante -= daEntrada;
    if (daSaida === 0 && daEntrada === 0) continue;
    porId[id] = {
      ...predio,
      estoque: {
        saida: { ...predio.estoque.saida, [MERCADORIA_DA_ESTRADA]: (predio.estoque.saida[MERCADORIA_DA_ESTRADA] ?? 0) - daSaida },
        entrada: { ...predio.estoque.entrada, [MERCADORIA_DA_ESTRADA]: (predio.estoque.entrada[MERCADORIA_DA_ESTRADA] ?? 0) - daEntrada },
      },
    };
  }
  return { porId, ordem: predios.ordem };
}

/** O PRIMEIRO armazem completo de `predios.ordem` — o mesmo de onde o debito
 *  comecaria. E o destino da devolucao da estrada, que nao tem porta de onde medir
 *  distancia; o predio demolido (F16a) tem, e por isso mede (`armazemDeDestino`). */
function primeiroArmazem(predios: Colecao<Predio>): string | null {
  for (const id of predios.ordem) {
    const predio = predios.porId[id];
    if (predio && predio.estado === 'completo' && predio.tipo === ID_DO_ARMAZEM) return id;
  }
  return null;
}

/**
 * `PlaceRoad`: pergunta `canPlaceRoad` e, se aceitar, acrescenta os tiles NOVOS a
 * `estradas` e DEBITA a pedra deles — no comando, dos armazens. Recusa = mesmo estado
 * e um evento `command-rejected`. Nada novo a fazer (trecho vazio ou ja construido) =
 * mesmo estado, sem custo e sem evento.
 *
 * DESVIO PROVISORIO da regra "o custo sai na entrega" (F07): a estrada nao tem
 * canteiro nem viagem de material — o aceite exige que o tile exista e conecte no
 * proprio comando, e serf (F10) e laborer (F11) ainda nao existem. Ver a Nota de
 * desvio no item F08 do BUILD_PLAN; a F11 decide se isso muda.
 */
export function aplicarPlaceRoad(state: GameState, comando: PlaceRoad, dados: GameData): Resultado {
  const resposta = canPlaceRoad(state, comando.tiles, dados);
  if (!resposta.ok) {
    return {
      state,
      events: [{ type: 'command-rejected', command: comando.type, motivo: resposta.motivo, tile: resposta.tile }],
    };
  }
  if (resposta.novos.length === 0) return { state, events: [] };

  const estradas: Record<string, true> = { ...state.estradas };
  for (const tile of resposta.novos) estradas[chaveDeTile(tile)] = true;
  return {
    state: { ...state, estradas, predios: debitarPedra(state, resposta.custoEmPedra) },
    events: [],
  };
}

/**
 * `DemolishRoad`: remove os tiles que SAO estrada (o resto e ignorado) e devolve
 * `floor(removidos * terreno.estrada.devolucaoAoDemolir)` de pedra ao primeiro armazem
 * completo. Decisao do operador: sem devolucao a ferramenta seria punitiva — o jogador
 * redesenha o traçado o tempo todo. O arredondamento e POR COMANDO: demolir um tile de
 * cada vez devolve 0, arrastar sobre varios devolve (alternativa, se o playtest pedir:
 * acumular a fracao num resto por armazem — ver PROGRESS.md). `0.5` e exato em ponto
 * flutuante; outra fracao pode arredondar uma unidade abaixo.
 *
 * Nunca e recusado. Os predios que ficam sem ligacao NAO mudam (ver
 * `predioLigadoAoArmazem`).
 */
export function aplicarDemolishRoad(state: GameState, comando: DemolishRoad, dados: GameData): Resultado {
  const remover = new Set<string>();
  for (const tile of comando.tiles) {
    const chave = chaveDeTile(tile);
    if (state.estradas[chave] === true) remover.add(chave);
  }
  if (remover.size === 0) return { state, events: [] };

  const estradas: Record<string, true> = {};
  for (const chave of Object.keys(state.estradas)) {
    if (!remover.has(chave)) estradas[chave] = true;
  }
  const devolvida = Math.floor(remover.size * dados.terreno.estrada.devolucaoAoDemolir);
  const predios = devolverMercadorias(
    state.predios, { [MERCADORIA_DA_ESTRADA]: devolvida }, primeiroArmazem(state.predios),
  );
  return { state: { ...state, estradas, predios }, events: [] };
}
