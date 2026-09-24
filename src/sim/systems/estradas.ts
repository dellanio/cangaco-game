import type { Command } from '../commands';
import type { Colecao, GameEvent, GameState, Predio } from '../state';
import { ID_DO_ARMAZEM } from '../state';
import type { GameData } from '../data/types';
import { canPlaceRoad, chaveDeTile, MERCADORIA_DA_ESTRADA } from '../estradas';
import { criarTarefaDeAssentamento } from '../jobs';
import { devolverMercadorias } from '../deposito';

export type PlaceRoad = Extract<Command, { readonly type: 'PlaceRoad' }>;
export type DemolishRoad = Extract<Command, { readonly type: 'DemolishRoad' }>;

interface Resultado {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
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
 * `PlaceRoad`: pergunta `canPlaceRoad` e, se aceitar, desenha os tiles NOVOS no
 * CANTEIRO (`estradasPlanejadas`) e abre uma tarefa de assentamento para cada um.
 * Recusa = mesmo estado e um evento `command-rejected`. Nada novo a fazer (trecho
 * vazio, ja construido ou ja desenhado) = mesmo estado, sem tarefa e sem evento.
 *
 * F18d-1b — FIM DO DESVIO da F08. O comando ja nao cria estrada nem debita pedra:
 * ele so PEDE a rua. Quem a levanta e o laborer, tile por tile, e e ele quem paga
 * (`comOTileAssentado`). A pedra fica RESERVADA desde aqui — a tarefa a reserva
 * desde `'aberta'` —, e por isso `canPlaceRoad` continua recusando por `'sem-pedra'`
 * o trecho que o canteiro pendente ja comprometeu.
 *
 * Um tile pode ficar desenhado SEM tarefa: se nenhum armazem pode pagar na hora do
 * clique, `criarTarefaDeAssentamento` devolve `null` e o `gerarTarefas` remenda
 * quando houver pedra. O canteiro e o pedido; a tarefa e a execucao.
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

  const estradasPlanejadas: Record<string, true> = { ...state.estradasPlanejadas };
  for (const tile of resposta.novos) estradasPlanejadas[chaveDeTile(tile)] = true;
  let atual: GameState = { ...state, estradasPlanejadas };
  for (const tile of resposta.novos) {
    // uma de cada vez, e de proposito: a tarefa recem-criada ja reserva a pedra
    // dela, entao a proxima enxerga o armazem ja mais pobre e pode nao nascer.
    const criada = criarTarefaDeAssentamento(atual, tile);
    if (criada === null) break;
    atual = criada.state;
  }
  return { state: atual, events: [] };
}

/** Os tiles de `chaves` que sobrevivem, na mesma ordem. */
function semAsChaves(conjunto: Readonly<Record<string, true>>, remover: ReadonlySet<string>): Record<string, true> {
  const resto: Record<string, true> = {};
  for (const chave of Object.keys(conjunto)) {
    if (!remover.has(chave)) resto[chave] = true;
  }
  return resto;
}

/**
 * `DemolishRoad`: a borracha, sobre os TRES conjuntos em que um tile pode estar.
 *
 *  - DE PE (`estradas`): sai, e devolve `floor(removidos * devolucaoAoDemolir)` de pedra
 *    ao primeiro armazem completo. Decisao do operador: sem devolucao a ferramenta seria
 *    punitiva — o jogador redesenha o traçado o tempo todo. O arredondamento e POR
 *    COMANDO: demolir um tile de cada vez devolve 0, arrastar sobre varios devolve
 *    (alternativa, se o playtest pedir: acumular a fracao num resto por armazem — ver
 *    PROGRESS.md). `0.5` e exato em ponto flutuante; outra fracao pode arredondar uma
 *    unidade abaixo.
 *  - DESENHADO (`estradasPlanejadas`, F18d-1b): sai, e devolve ZERO. Nada foi gasto
 *    ainda: a pedra do canteiro esta RESERVADA, nao debitada. A conta de devolucao conta
 *    so os de pe, senao apagar o proprio rascunho fabricaria pedra.
 *  - NEM UM NEM OUTRO: ignorado. Apagar chao vazio nao e erro.
 *
 * A tarefa de assentamento do tile desenhado nao e cancelada aqui: ela perde o destino,
 * e `sanearTarefas` — que roda logo depois dos comandos, no mesmo tick — a derruba com
 * `'destino-sumiu'` e devolve a reserva. Um caminho de volta so, para o tile apagado
 * pelo jogador e para o tile que sumiu por qualquer outro motivo.
 *
 * Nunca e recusado. Os predios que ficam sem ligacao NAO mudam (ver
 * `predioLigadoAoArmazem`).
 */
export function aplicarDemolishRoad(state: GameState, comando: DemolishRoad, dados: GameData): Resultado {
  const dePe = new Set<string>();
  const desenhados = new Set<string>();
  for (const tile of comando.tiles) {
    const chave = chaveDeTile(tile);
    if (state.estradas[chave] === true) dePe.add(chave);
    else if (state.estradasPlanejadas[chave] === true) desenhados.add(chave);
  }
  if (dePe.size === 0 && desenhados.size === 0) return { state, events: [] };

  const devolvida = Math.floor(dePe.size * dados.terreno.estrada.devolucaoAoDemolir);
  const predios = devolvida === 0 ? state.predios : devolverMercadorias(
    state.predios, { [MERCADORIA_DA_ESTRADA]: devolvida }, primeiroArmazem(state.predios),
  );
  return {
    state: {
      ...state,
      estradas: dePe.size === 0 ? state.estradas : semAsChaves(state.estradas, dePe),
      estradasPlanejadas: desenhados.size === 0
        ? state.estradasPlanejadas
        : semAsChaves(state.estradasPlanejadas, desenhados),
      predios,
    },
    events: [],
  };
}
