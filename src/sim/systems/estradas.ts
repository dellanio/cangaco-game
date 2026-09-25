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
 * ele so PEDE a rua. Quem a levanta e o laborer, tile por tile.
 *
 * F18g — e a pedra VIAJA: o comando nao reserva nada e nao exige pagador. Cada
 * tile novo ganha a sua `assentar-estrada` aqui mesmo; a tarefa de pedra
 * (`pedra-para-canteiro`, carga de serf) nasce em `gerarTarefas`, so ate onde
 * houver pedra livre num armazem. Tile sem pagador fica desenhado esperando — o
 * canteiro e o pedido e o feedback; a tarefa e a execucao.
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
  for (const tile of resposta.novos) atual = criarTarefaDeAssentamento(atual, tile).state;
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
 *  - DESENHADO SEM PEDRA (`estradasPlanejadas`, F18d-1b): sai, e devolve ZERO. Nada
 *    foi gasto ainda. A conta da fracao conta so os de pe, senao apagar o proprio
 *    rascunho fabricaria pedra.
 *  - DESENHADO COM PEDRA ENTREGUE (`pedraNoCanteiro`, F18g — o 4º caso): sai, e a
 *    pedra parada no tile volta INTEIRA ao mesmo armazem, sem fracao: ela nao virou
 *    rua, e pedra fisica que um serf largou ali, e conservacao de bens e invariante
 *    do projeto. Para qual armazem: o PRIMEIRO completo, o mesmo destino da devolucao
 *    da rua de pe — o tile nao tem porta de onde medir distancia. Sem armazem,
 *    perde-se, como o estoque do predio demolido sem armazem ligado (F16a).
 *  - NEM UM NEM OUTRO: ignorado. Apagar chao vazio nao e erro.
 *
 * As tarefas do tile desenhado (assentar, e a pedra a caminho) nao sao canceladas
 * aqui: elas perdem o destino, e `sanearTarefas` — que roda logo depois dos comandos,
 * no mesmo tick — as derruba com `'destino-sumiu'`; o serf que ja carregava devolve
 * ao armazem mais perto, como toda carga orfa. Um caminho de volta so, para o tile
 * apagado pelo jogador e para o tile que sumiu por qualquer outro motivo.
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

  let paradaNoCanteiro = 0;
  for (const chave of desenhados) paradaNoCanteiro += state.pedraNoCanteiro[chave] ?? 0;
  const devolvida = Math.floor(dePe.size * dados.terreno.estrada.devolucaoAoDemolir) + paradaNoCanteiro;
  const predios = devolvida === 0 ? state.predios : devolverMercadorias(
    state.predios, { [MERCADORIA_DA_ESTRADA]: devolvida }, primeiroArmazem(state.predios),
  );
  const pedraNoCanteiro: Record<string, number> = {};
  for (const [chave, quantidade] of Object.entries(state.pedraNoCanteiro)) {
    if (!desenhados.has(chave)) pedraNoCanteiro[chave] = quantidade;
  }
  return {
    state: {
      ...state,
      estradas: dePe.size === 0 ? state.estradas : semAsChaves(state.estradas, dePe),
      estradasPlanejadas: desenhados.size === 0
        ? state.estradasPlanejadas
        : semAsChaves(state.estradasPlanejadas, desenhados),
      pedraNoCanteiro: paradaNoCanteiro === 0 ? state.pedraNoCanteiro : pedraNoCanteiro,
      predios,
    },
    events: [],
  };
}
