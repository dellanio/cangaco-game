import { createRng, type RngState } from './rng';
import { gameData } from './data';
import type { GameData } from './data/types';
import type { MotivoDeRecusa } from './placement';
import type { MotivoDeRecusaDeEstrada, TileDeGrid } from './estradas';

/**
 * Efeito colateral emitido por um sistema para o render consumir
 * (CLAUDE.md secao 5). A sim nunca chama o render.
 *
 * Ciclo de vida: `events` carrega SOMENTE os eventos do tick corrente.
 * `step()` comeca cada tick com a lista vazia. Isso mantem o GameState
 * limitado — 1000 ticks nao incham o JSON.
 *
 * Eventos sao funcao pura do estado e dos comandos: dois runs com a mesma
 * semente e os mesmos comandos produzem os mesmos eventos, na mesma ordem.
 * O teste de determinismo compara o estado inteiro, `events` incluso.
 */
export type GameEvent =
  | { readonly type: 'tick-advanced'; readonly tick: number }
  /**
   * Um comando foi recusado pela sim (ex.: `PlaceBlueprint` sobre outro predio).
   * O estado nao mudou. E o canal que a UI vai usar para dizer "por que nao"
   * (GDD §10); o texto ao lado do cursor nao esta na F07.
   */
  | {
      readonly type: 'command-rejected';
      readonly command: 'PlaceBlueprint';
      readonly buildingId: string;
      readonly gx: number;
      readonly gy: number;
      readonly motivo: MotivoDeRecusa;
    }
  | {
      /** `PlaceRoad` recusado. `tile` e o primeiro tile culpado (fora do mapa ou
       *  sobre um predio); `null` quando o motivo e do trecho todo (`sem-pedra`). */
      readonly type: 'command-rejected';
      readonly command: 'PlaceRoad';
      readonly motivo: MotivoDeRecusaDeEstrada;
      readonly tile: TileDeGrid | null;
    };

/**
 * Colecao indexada por id, com ordem de iteracao explicita.
 *
 * `porId` da acesso O(1) por id — o que JobBoard, haul e FSMs vao querer.
 * `ordem` existe porque a ordem de iteracao de `Object.keys` de um objeto JS
 * nao e uma garantia da linguagem para chaves nao numericas (na pratica os
 * motores atuais preservam insercao, mas nada obriga isso a continuar assim,
 * e determinismo nao pode depender de "na pratica"). Todo sistema varre
 * `ordem`, nunca `Object.keys(porId)`.
 */
export interface Colecao<T> {
  readonly porId: Readonly<Record<string, T>>;
  readonly ordem: readonly string[];
}

/**
 * `'completo'`: o predio existe e funciona. `'obra'`: a planta foi posicionada
 * (F07) e o predio ainda esta sendo entregue e martelado (F10/F11). O cenario
 * inicial so descreve predio `'completo'`.
 */
export type EstadoDePredio = 'completo' | 'obra';

/**
 * Estoque e capacidade tem a MESMA forma — duas gavetas, `entrada` e `saida`
 * — de proposito: a F09 vai comparar gaveta contra gaveta homonima para
 * decidir se ha vaga no destino, sem tradução no meio. Numa Bakery a vaga de
 * farinha e na entrada, a de pao e na saida; estoque plano obrigaria o
 * JobBoard a inventar essa separacao depois.
 */
export interface Estoque {
  readonly entrada: Readonly<Record<string, number>>;
  readonly saida: Readonly<Record<string, number>>;
}

/** `null` numa gaveta significa sem limite (caso do armazem). */
export interface Capacidade {
  readonly entrada: number | null;
  readonly saida: number | null;
}

interface PredioBase {
  readonly id: string;
  /** Id do predio em data/buildings.json ('storehouse', 'quarry', ...). */
  readonly tipo: string;
  readonly gx: number;
  readonly gy: number;
  /**
   * HP atual. Completo: o `hp` do dado. Em obra: o HP **ja martelado**, de 0 ate
   * `def.hp` — o total nao e guardado aqui (vem de `buildings.json`, que valida
   * `(timber + stone) * 50`), para nao haver duas fontes de verdade.
   */
  readonly hp: number;
}

export interface PredioCompleto extends PredioBase {
  readonly estado: 'completo';
  readonly capacidade: Capacidade;
  readonly estoque: Estoque;
}

/**
 * CONTRATO HERDADO (F09, F10, F11, F12, F16) — quem mudar isto muda as cinco.
 *
 * Obra nao tem `capacidade` nem `estoque`: ela nao guarda mercadoria. O que ja
 * foi entregue e `custo - faltam`; quando o serf entrega, o item SAI do estoque
 * do armazem e ENTRA em `faltam` (decrementa). E la que o custo e debitado — nao
 * no clique. O destino de uma entrega e `faltam`, nao a capacidade.
 */
export interface Obra {
  /**
   * Materiais que ainda faltam ENTREGAR, por mercadoria. Nasce igual ao custo do
   * dado (`buildings.json`: `timber`, `stone`). O que foi entregue e derivavel:
   * `entregues = soma sobre m de (custo[m] - faltam[m])`, e o teto de HP martelavel
   * e `entregues * hpPorMaterialEntregue`. Reservas de vaga (F09) NAO moram aqui:
   * moram no JobBoard.
   *
   * Deliberadamente fora: o nivelamento do terreno. Sem consumidor hoje, sem campo
   * hoje — a F11 acrescenta o que precisar (BUILD_PLAN, notas da F11).
   */
  readonly faltam: Readonly<Record<string, number>>;
}

export interface PredioEmObra extends PredioBase {
  readonly estado: 'obra';
  readonly obra: Obra;
}

/** Uniao discriminada por `estado`: um predio em obra sem `obra`, ou completo sem
 *  `estoque`, nao e representavel. */
export type Predio = PredioCompleto | PredioEmObra;

export interface Unidade {
  readonly id: string;
  /** Id do civil em data/units.json civis.tipos ('serf', 'laborer', ...). */
  readonly tipo: string;
  readonly gx: number;
  readonly gy: number;
  /** Estado explicito da FSM (CLAUDE.md secao 5). Nesta feature toda unidade
   *  nasce ociosa — as FSMs reais (buscar/carregar/nivelar/martelar) entram
   *  na F10 e na F11. */
  readonly fsm: string;
  readonly fsmData: Readonly<Record<string, never>>;
}

/**
 * O GameState inteiro, serializavel em JSON.
 *
 * Proibido aqui: funcao, classe com metodo, Map, Set, Date, undefined,
 * referencia circular. `JSON.parse(JSON.stringify(state))` tem que devolver
 * um estado equivalente — e ha teste que verifica isso estruturalmente.
 */
export interface GameState {
  readonly tick: number;
  /** O RNG vive DENTRO do estado. Semente fora do estado quebra o load. */
  readonly rng: RngState;
  readonly events: readonly GameEvent[];
  readonly predios: Colecao<Predio>;
  readonly unidades: Colecao<Unidade>;
  /** Contador monotonico e deterministico para o proximo id de entidade
   *  (predio ou unidade). Sem `Math.random`, sem UUID — a F07 (posicionar
   *  planta) e a F13 (treinar na schoolhouse) criam entidade em runtime e
   *  precisam de um id novo sem colidir com os que ja existem. */
  readonly proximoId: number;
  /**
   * Ids dos TIPOS de predio que ja chegaram a `'completo'` alguma vez, na ordem
   * em que chegaram, sem repeticao. E o que o desbloqueio consulta
   * (`sim/desbloqueio.ts`), e nao a presenca atual: demolir o ultimo
   * Woodcutter's nao pode re-bloquear a Serraria — nem com uma Sawmill de pe —,
   * e demolir para reposicionar e um cenario banal.
   *
   * O estado inicial nasce com os tipos dos predios ja completos; depois, quem
   * alimenta e `registrarTipoConstruido`, chamado quando uma obra vira
   * `'completo'` (a F12 liga isso ao `step()`). O comportamento do jogo original
   * nao foi confirmado nas fontes: e decisao nossa, proposta (PROGRESS.md).
   */
  readonly tiposJaConstruidos: readonly string[];
  /**
   * CONTRATO HERDADO (F09, F10, F15) — as estradas que estao DE PE.
   *
   * Conjunto de tiles, chave `"gx,gy"` (inteiros), valor `true`. So tile PRONTO:
   * quando a F11 decidir que laborer constroi estrada, a "estrada planejada" e
   * OUTRO campo, e este continua sendo o que `isConnected` consulta.
   *
   * Nao guarda componentes conexos: dado derivado serializado poderia ficar
   * inconsistente com os tiles. A consulta "existe caminho de A ate B?" e O(1) por
   * um indice derivado e memoizado pela REFERENCIA deste objeto (`sim/estradas.ts`);
   * `step()` carrega a mesma referencia enquanto nenhum comando de estrada muda
   * algo. Conectividade em 4 direcoes. Nunca itere por `Object.keys` esperando uma
   * ordem: use `tilesOrdenados`.
   */
  readonly estradas: Readonly<Record<string, true>>;
}

function construirColecao<T extends { readonly id: string }>(itens: readonly T[]): Colecao<T> {
  const porId: Record<string, T> = {};
  const ordem: string[] = [];
  for (const item of itens) {
    porId[item.id] = item;
    ordem.push(item.id);
  }
  return { porId, ordem };
}

/** O unico predio com estoque de verdade nesta feature. Referencia de id
 *  estrutural (qual predio e o armazem), nao numero de balanceamento — os
 *  numeros continuam vindo do dado. */
export const ID_DO_ARMAZEM = 'storehouse';

function capacidadeParaTipo(tipoId: string, dados: GameData): Capacidade {
  if (tipoId === ID_DO_ARMAZEM) {
    const { capacidade } = dados.economia.storehouse;
    return { entrada: capacidade, saida: capacidade };
  }
  if (tipoId in dados.producao.receitas) {
    const { entrada, saida } = dados.producao.estoqueInternoPorPredio;
    return { entrada, saida };
  }
  // Predio sem receita e sem ser o armazem (a schoolhouse, hoje): nao
  // gerencia estoque, entao nao ha limite a impor.
  return { entrada: null, saida: null };
}

function estoqueParaTipo(
  tipoId: string,
  estoqueInicial: Readonly<Record<string, number>>,
): Estoque {
  if (tipoId === ID_DO_ARMAZEM) {
    // O estoque inicial inteiro entra em `saida` — e de la que o serf
    // retira (decisao da F05a). `entrada` nasce vazia.
    return { entrada: {}, saida: { ...estoqueInicial } };
  }
  return { entrada: {}, saida: {} };
}

function criarPredios(
  dados: GameData,
  contadorInicial: number,
): { readonly predios: Colecao<Predio>; readonly proximoContador: number } {
  let contador = contadorInicial;
  const lista: PredioCompleto[] = [];
  for (const p of dados.economia.estadoInicial.predios) {
    const def = dados.predios.find((candidato) => candidato.id === p.id);
    if (!def) {
      throw new Error(`createInitialState: predio '${p.id}' de estadoInicial nao existe em data/buildings.json`);
    }
    if (p.estado !== 'completo') {
      throw new Error(
        `createInitialState: predio '${p.id}' de estadoInicial tem estado '${p.estado}'; o cenario inicial so descreve predio 'completo'`,
      );
    }
    const id = `p${contador}`;
    contador += 1;
    lista.push({
      id,
      tipo: p.id,
      gx: p.gx,
      gy: p.gy,
      estado: 'completo',
      hp: def.hp,
      capacidade: capacidadeParaTipo(p.id, dados),
      estoque: estoqueParaTipo(p.id, dados.economia.estadoInicial.estoque),
    });
  }
  return { predios: construirColecao(lista), proximoContador: contador };
}

function criarUnidades(
  dados: GameData,
  contadorInicial: number,
): { readonly unidades: Colecao<Unidade>; readonly proximoContador: number } {
  const { spawnDeUnidades, unidades } = dados.economia.estadoInicial;
  const contagemPorTipo = unidades as unknown as Readonly<Record<string, number>>;

  let contador = contadorInicial;
  let deslocamento = 0;
  const lista: Unidade[] = [];
  // Object.keys sobre um objeto vindo de JSON preserva a ordem de
  // declaracao do arquivo (chaves nao numericas) — aqui, 'serf' antes de
  // 'laborer', como data/economy.json declara.
  for (const tipo of Object.keys(contagemPorTipo)) {
    const quantidade = contagemPorTipo[tipo] ?? 0;
    for (let i = 0; i < quantidade; i++) {
      const id = `u${contador}`;
      contador += 1;
      lista.push({
        id,
        tipo,
        gx: spawnDeUnidades.gx + deslocamento,
        gy: spawnDeUnidades.gy,
        fsm: 'ocioso',
        fsmData: {},
      });
      deslocamento += 1;
    }
  }
  return { unidades: construirColecao(lista), proximoContador: contador };
}

/**
 * `dados` e explicito (com default no singleton `gameData` ja congelado) por
 * dois motivos: os chamadores existentes nao tem razao de conhecer o
 * carregador, e um teste precisa poder injetar uma variante para provar que
 * os valores vem do dado, nao de uma constante escondida em `.ts`.
 */
export function createInitialState(seed: number, dados: GameData = gameData): GameState {
  const { predios, proximoContador: apósPredios } = criarPredios(dados, 1);
  const { unidades, proximoContador: apósUnidades } = criarUnidades(dados, apósPredios);
  return {
    tick: 0,
    rng: createRng(seed),
    events: [],
    predios,
    unidades,
    proximoId: apósUnidades,
    tiposJaConstruidos: tiposCompletos(predios),
    estradas: {},
  };
}

/** Tipos distintos dos predios `'completo'`, na ordem de `predios.ordem`. */
function tiposCompletos(predios: Colecao<Predio>): readonly string[] {
  const tipos: string[] = [];
  for (const id of predios.ordem) {
    const predio = predios.porId[id];
    if (predio && predio.estado === 'completo' && !tipos.includes(predio.tipo)) tipos.push(predio.tipo);
  }
  return tipos;
}
