import { createRng, type RngState } from './rng';
import { gameData } from './data';
// F20b — importacao de VALOR, e a unica que `state.ts` faz para um modulo derivado.
// `condicao.ts` importa de volta so TIPO (`import type`, que o compilador apaga),
// entao nao existe ciclo em tempo de execucao. O motivo de ela existir: a unidade
// nasce com condicao cheia, e o numero e do dado, nao deste arquivo.
import { condicaoCheiaDoTipo } from './condicao';
import type { GameData } from './data/types';
import type { MotivoDeRecusa } from './placement';
import type { MotivoDeRecusaDeEstrada, TileDeGrid } from './estradas';
// F18h: `import type` puro, como o de cima — nao ha aresta de runtime, e por isso
// o motivo mora ao lado da regra que o produz e nao aqui.
import type { MotivoDeRecusaDeCampo } from './campos';
import type { MotivoDeLiberacao } from './jobs';
import type { MotivoDeRecusaDeTreino } from './escola';
import type { MotivoDeRecusaDePausa } from './pausa';
import type { MotivoDeRecusaDeCota } from './cota';
import type { MotivoDeRecusaDeModo } from './modo';
import type { MotivoDeRecusaDeReparo } from './reparo';
import type { MotivoDeRecusaDeAceite } from './armazem';
import type { MotivoDeRecusaDeDistribuicao } from './distribuicao';
import type { MotivoDeRecusaDeSoldado } from './quartel';
import type { MotivoDeRecusaDeTroca } from './feira';
import type { MotivoDeRecusaDeMercenario } from './prefeitura';
// F-T2a: a camada de recurso nasce do MAPA, e quem sabe ler o mapa e
// `sim/recursos.ts`. Import de valor (nao de tipo) e o unico deste arquivo alem
// do RNG e do dado — `createInitialState` e o lugar certo para ele.
import { recursosIniciais } from './recursos';

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
/** F28a — por que um `AttackUnit` foi recusado. */
export type MotivoDeRecusaDeLuta =
  | 'sem-unidades'
  | 'alvo-inexistente'
  | 'alvo-sem-hp'
  | 'unidade-inexistente'
  | 'unidade-nao-militar'
  | 'unidade-a-distancia'
  | 'alvo-do-proprio-lado'
  /** C-IA-03b — a partida esta em peacetime (`sim/paz.ts`). */
  | 'em-paz';

/** F26a — por que um `MoveUnits` foi recusado. */
export type MotivoDeRecusaDeMarcha =
  | 'sem-unidades'
  | 'unidade-inexistente'
  | 'unidade-nao-militar'
  | 'lados-diferentes'
  | 'destino-inandavel'
  /** C-COMBATE-01a — `direcao` nao e inteiro de 0 a 7. */
  | 'direcao-invalida'
  /** C-COMBATE-01a — `colunas` nao e inteiro. */
  | 'colunas-invalidas';

/** C-COMBATE-01b — por que um `StormAttack` foi recusado: os da marcha que valem sem destino,
 *  a paz, e nenhuma unidade da lista carregar (`stormAttack.apenas`). */
export type MotivoDeRecusaDeCarga =
  | 'sem-unidades'
  | 'unidade-inexistente'
  | 'unidade-nao-militar'
  | 'lados-diferentes'
  | 'sem-infantaria-corpo-a-corpo'
  | 'em-paz';

/** C-COMIDA-01 — por que um `FeedUnits` foi recusado: os motivos da marcha que valem sem
 *  destino, e `sem-fome` quando ninguem do grupo esta abaixo do limiar do pedido. */
export type MotivoDeRecusaDeAlimentar =
  | 'sem-unidades'
  | 'unidade-inexistente'
  | 'unidade-nao-militar'
  | 'lados-diferentes'
  | 'sem-fome';

/** F-CERCO-a2 — por que um `AttackBuilding` foi recusado. */
export type MotivoDeRecusaDeAtaque =
  | 'predio-inexistente'
  | 'sem-unidades'
  | 'unidade-inexistente'
  | 'unidade-nao-militar'
  | 'predio-do-proprio-lado'
  /** C-IA-03b — a partida esta em peacetime (`sim/paz.ts`). */
  | 'em-paz';

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
      /** `PlaceRoad` recusado. `tile` e o primeiro tile culpado (fora do mapa,
       *  terreno, recurso ou sobre um predio). F18g: toda recusa e de UM tile —
       *  `'sem-pedra'`, o unico motivo do trecho todo, deixou de existir quando a
       *  pedra passou a viajar por tile e o canteiro a ser desenhado sem pagador. */
      readonly type: 'command-rejected';
      readonly command: 'PlaceRoad';
      readonly motivo: MotivoDeRecusaDeEstrada;
      readonly tile: TileDeGrid;
    }
  | {
      /** F18h — `PlowField` recusado. `tile` e o primeiro tile culpado; `null`
       *  quando o motivo e do comando todo (`cultura-desconhecida`). */
      readonly type: 'command-rejected';
      readonly command: 'PlowField';
      readonly motivo: MotivoDeRecusaDeCampo;
      readonly tile: TileDeGrid | null;
    }
  | {
      /**
       * F13 — `EnqueueTraining` recusado; o estado nao mudou. `CancelTraining` nunca
       * e recusado (item inexistente e no-op), no mesmo molde do `DemolishRoad`.
       */
      readonly type: 'command-rejected';
      readonly command: 'EnqueueTraining';
      readonly predio: string;
      readonly unidade: string;
      readonly motivo: MotivoDeRecusaDeTreino;
    }
  | {
      /**
       * F16c — `SetBuildingPaused` recusado; o estado nao mudou. Pausar com o
       * valor que o predio JA tem nao e recusa, e no-op: nao emite nada.
       */
      readonly type: 'command-rejected';
      readonly command: 'SetBuildingPaused';
      readonly predio: string;
      readonly motivo: MotivoDeRecusaDePausa;
    }
  | {
      /** F24a — `SetProductionQuota` recusado; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'SetProductionQuota';
      readonly predio: string;
      readonly motivo: MotivoDeRecusaDeCota;
    }
  | {
      /** F28a — `AttackUnit` recusado INTEIRO; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'AttackUnit';
      readonly alvo: string;
      readonly unidade: string | null;
      readonly motivo: MotivoDeRecusaDeLuta;
    }
  | {
      /** C-COMBATE-01b — `StormAttack` recusado INTEIRO; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'StormAttack';
      readonly unidade: string | null;
      readonly motivo: MotivoDeRecusaDeCarga;
    }
  | {
      /** F26a — `MoveUnits` recusado INTEIRO; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'MoveUnits';
      readonly unidade: string | null;
      readonly motivo: MotivoDeRecusaDeMarcha;
    }
  | {
      /** C-COMIDA-01 — `FeedUnits` recusado INTEIRO; o estado nao mudou. `sem-fome` e o
       *  "Ninguem com fome" da tela. */
      readonly type: 'command-rejected';
      readonly command: 'FeedUnits';
      readonly unidade: string | null;
      readonly motivo: MotivoDeRecusaDeAlimentar;
    }
  | {
      /** F35 — `SetTrade` recusado; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'SetTrade';
      readonly predio: string;
      readonly motivo: MotivoDeRecusaDeTroca;
    }
  | {
      /** F36 — `HireMercenary` recusado; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'HireMercenary';
      readonly predio: string;
      readonly tipo: string;
      readonly motivo: MotivoDeRecusaDeMercenario;
    }
  | {
      /** F25a — `TrainSoldier` recusado; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'TrainSoldier';
      readonly predio: string;
      readonly tipo: string;
      readonly motivo: MotivoDeRecusaDeSoldado;
    }
  | {
      /** F-CERCO-b — `SetBuildingRepair` recusado; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'SetBuildingRepair';
      readonly predio: string;
      readonly motivo: MotivoDeRecusaDeReparo;
    }
  | {
      /** D-TRANSPORTE-01a — `SetStorehouseAccept` recusado; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'SetStorehouseAccept';
      readonly predio: string;
      readonly mercadoria: string;
      readonly motivo: MotivoDeRecusaDeAceite;
    }
  | {
      /** D-TRANSPORTE-02a — `SetWareDistribution` recusado; o estado nao mudou. */
      readonly type: 'command-rejected';
      readonly command: 'SetWareDistribution';
      readonly mercadoria: string;
      readonly tipo: string;
      readonly motivo: MotivoDeRecusaDeDistribuicao;
    }
  | {
      /** F-CERCO-a2 — `AttackBuilding` recusado INTEIRO; o estado nao mudou. `unidade`
       *  e a primeira culpada, ou `null` quando o motivo e do predio ou da lista. */
      readonly type: 'command-rejected';
      readonly command: 'AttackBuilding';
      readonly predio: string;
      readonly unidade: string | null;
      readonly motivo: MotivoDeRecusaDeAtaque;
    }
  | {
      /**
       * F-CERCO-a2 — um golpe de tropa em predio: `dano` saiu do `hp`, que ficou em
       * `hp`. Um evento por golpe, e e por ele que o aceite conta os golpes
       * ("tiram exatamente 2 x golpes").
       */
      readonly type: 'building-attacked';
      readonly predio: string;
      readonly unidade: string;
      readonly dano: number;
      readonly hp: number;
    }
  | {
      /** F-REPL-b — `SetBuildingMode` recusado; o estado nao mudou. Pedir o modo
       *  que o predio JA tem nao e recusa, e no-op: nao emite nada. */
      readonly type: 'command-rejected';
      readonly command: 'SetBuildingMode';
      readonly predio: string;
      readonly motivo: MotivoDeRecusaDeModo;
    }
  | {
      /**
       * F13 — a escola terminou um treino: a unidade `unidade`, do tipo `tipo`,
       * nasceu na porta de `predio` e o item saiu da fila no mesmo tick.
       */
      readonly type: 'unit-trained';
      readonly predio: string;
      readonly unidade: string;
      readonly tipo: string;
    }
  | {
      /**
       * Uma tarefa saiu de `reclamada`: as DUAS reservas (recurso na origem, vaga no
       * destino) foram devolvidas. `reaberta`: a mesma tarefa voltou a `aberta`;
       * `cancelada`: foi removida (o gerador cria outra, com a origem certa).
       */
      readonly type: 'task-released';
      readonly tarefa: string;
      readonly motivo: MotivoDeLiberacao;
      readonly resultado: 'reaberta' | 'cancelada';
    }
  | {
      /** C-COMIDA-01b — o serf `serf` entregou `mercadoria` ao militar `unidade`, que ficou
       *  cheio (o `Feed(UNIT_MAX_CONDITION)` do KaM) e perdeu o pedido. A tarefa foi
       *  removida. A comida SAIU do mundo aqui: e o que a conservacao de bens desconta. */
      readonly type: 'unit-fed';
      readonly unidade: string;
      readonly serf: string;
      readonly mercadoria: string;
      readonly tarefa: string;
    }
  | {
      /** O serf entregou em `destino` e a tarefa foi removida. Obra: `faltam[mercadoria]`
       *  caiu 1. Escola (F13): `estoque.entrada[mercadoria]` subiu 1. O campo se chamava
       *  `obra` ate a F13 — deixou de ser verdade quando o destino pode ser escola.
       *  F18g: para a pedra do canteiro, `destino` e a CHAVE do tile (`"gx,gy"`,
       *  `chaveDeTile`), e `pedraNoCanteiro[chave]` subiu 1. */
      readonly type: 'task-completed';
      readonly tarefa: string;
      readonly destino: string;
      readonly mercadoria: string;
    }
  | {
      /** O serf depositou em `armazem` a carga que nao pode entregar (estado `devolvendo`). */
      readonly type: 'cargo-returned';
      readonly unidade: string;
      readonly armazem: string;
      readonly mercadoria: string;
    }
  | {
      /**
       * A obra virou predio COMPLETO (F11c: `hp === def.hp`). Quem emite NAO
       * desbloqueia nada: e o `step()` que, no fim do tick, dobra os eventos com
       * `registrarConclusoes` (`sim/desbloqueio.ts`) e move `tiposJaConstruidos`
       * (F12). Separado de proposito — quem conclui anuncia, quem desbloqueia escuta.
       */
      readonly type: 'building-completed';
      readonly predio: string;
      readonly tipo: string;
    }
  | {
      /**
       * F14 — um especialista chegou e ocupou um predio. `tipo` e o do CIVIL
       * (`stonemason`), nao o do predio — quem quiser o do predio o le do estado.
       */
      readonly type: 'building-occupied';
      readonly predio: string;
      readonly unidade: string;
      readonly tipo: string;
    }
  | {
      /**
       * F15a — um ciclo de producao terminou e a mercadoria caiu na gaveta
       * `saida` do predio. Um evento por mercadoria: uma receita pode render
       * duas (swine_farm: pig + skin).
       */
      readonly type: 'goods-produced';
      readonly predio: string;
      readonly mercadoria: string;
      readonly quantidade: number;
    }
  | {
      /**
       * D-PRODUCAO-03a — a oficina entregou o ultimo ciclo encomendado e a encomenda
       * de todas as saidas esta em zero. Uma vez por encomenda cumprida: o proximo so
       * vem depois de o jogador encomendar de novo (KaM, `TX_MSG_ORDER_COMPLETED`).
       */
      readonly type: 'production-order-completed';
      readonly predio: string;
    }
  | {
      /**
       * F16a — o predio saiu do estado por comando do jogador. `tipo` e o do
       * predio; `devolvido` e o que efetivamente entrou no armazem, por
       * mercadoria — vazio quando nao havia armazem alcancavel, e e assim que o
       * render (F16b) sabe se anuncia devolucao ou perda. Quem ouve nao precisa
       * do estado anterior para isso.
       */
      readonly type: 'building-demolished';
      readonly predio: string;
      readonly tipo: string;
      readonly devolvido: Readonly<Record<string, number>>;
      /** O armazem que recebeu, ou `null` quando a carga se perdeu. */
      readonly armazem: string | null;
    }
  | {
      /**
       * F15a — o veio deste predio deixou de render um ciclo inteiro. Sai UMA
       * vez, no tick do ultimo deposito. Dali em diante o ocupante fica em
       * `esperando_insumo` (a rocha e o insumo que nao vem mais).
       *
       * CORRIGIDO na F21 (2026-09-25): `producao.veio` NAO EXISTE mais — a F-T2a
       * levou o total para o TILE e apagou o campo. Quem responde "acabou" e
       * `semRecursoAoAlcance` (`sim/producao.ts`), que pergunta ao MAPA, e e dela
       * que saem tanto este evento quanto o alerta `veio-esgotado` da F22. Predio
       * cuja receita nao tem `colheita` (as minas de hoje, o lenhador) nunca
       * esgota, porque nao ha tile de onde tirar: a mina infinita esta medida na
       * F21 e o item que a conserta esta escrito na fila.
       */
      readonly type: 'vein-exhausted';
      readonly predio: string;
      readonly tipo: string;
    }
  | {
      /**
       * F20b — um civil chegou a `condicao === 0` e foi removido de `unidades` no
       * mesmo tick. O aceite escrito no item pede que a morte seja "registrada em
       * evento, nao em log solto": este e o registro, e o unico sinal que o render
       * (F20c) e o alerta (F22) tem para anunciar a perda — depois do tick, a
       * unidade nao existe mais no estado para ser lida.
       *
       * `carga` e o que ele levava na mao (`null` para quem nao levava nada) e
       * `armazem` o que recebeu de volta — `null` quando nao havia armazem
       * alcancavel e a carga se perdeu, no mesmo molde de `building-demolished`.
       */
      readonly type: 'unit-starved';
      readonly unidade: string;
      readonly tipo: string;
      readonly carga: string | null;
      readonly armazem: string | null;
    }
  | {
      /** F28a — um golpe de luta: `alvo` perdeu 1 HP (ficou em `hp`), ou o golpe errou
       *  (`acertou: false`). O aceite conta golpes e acertos por ele. */
      readonly type: 'unit-struck';
      readonly atacante: string;
      readonly alvo: string;
      readonly acertou: boolean;
      readonly hp: number;
    }
  | {
      /** C2 — `de` lancou um `projetil` em `alvo`; ele chega em `voo` ticks. */
      readonly type: 'projectile-fired';
      readonly projetil: string;
      readonly de: string;
      readonly alvo: TileDeGrid;
      readonly voo: number;
    }
  | {
      /** F28b — a torre `predio` atirou uma pedra no tile `alvo`, mirando `vitima` (quem
       *  estava ali no lancamento; pode ser do proprio lado). C2: a pedra voa, e a morte
       *  (`unit-killed`) sai na chegada. O render desenha o tiro por ele. */
      readonly type: 'stone-thrown';
      readonly predio: string;
      readonly alvo: TileDeGrid;
      readonly vitima: string;
    }
  | {
      /** F34 — a escaramuca acabou neste tick, com `fim`. Sai uma vez so. */
      readonly type: 'match-ended';
      readonly fim: 'vitoria' | 'derrota';
    }
  | {
      /** C-IA-03b — o peacetime acabou neste tick. Sai uma vez so. */
      readonly type: 'peace-ended';
    }
  | {
      /** F28a — a unidade morreu em luta e saiu do estado neste tick. */
      readonly type: 'unit-killed';
      readonly unidade: string;
      readonly tipo: string;
      readonly lado: number;
      readonly por: string;
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

/**
 * F-CERCO-a1 — o lado da vila do jogador. Lado e IDENTIDADE (quem e dono), nao
 * numero de balanceamento: por isso mora aqui e nao em `data/`. Sem lado nao existe
 * predio inimigo, e a F-CERCO-a2 (tropa ataca predio) recusa ordem contra o proprio.
 */
export const LADO_DO_JOGADOR = 0;
/** C-IA-03a — o lado da IA no cenario de escaramuca (`sim/cenario.ts`). Identificador, nao
 *  balanceamento: por isso mora aqui, ao lado do lado do jogador, e nao em `data/`. */
export const LADO_DA_IA = LADO_DO_JOGADOR + 1;

interface PredioBase {
  readonly id: string;
  /** F-CERCO-a1 — o dono. Quem cria poe o lado de quem mandou (`PlaceBuilding`: o
   *  jogador). Obrigatorio: predio sem dono nao e representavel. */
  readonly lado: number;
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
  /**
   * F14 — id do especialista que ocupa este predio, ou `null`. UM ocupante: a
   * cardinalidade esta no TIPO (um campo, nao uma lista com teto), entao "dois
   * no mesmo predio" nao e representavel. NAO e numero de balanceamento — nao
   * ha dado para mexer, diferente de `construcao.laborersMaximosPorObra`.
   *
   * `null` e nunca `undefined`, como `Tarefa.reclamadaPor`: e o que mantem o
   * estado comparavel byte a byte depois de um save/load.
   *
   * Predio cujo tipo nao pede trabalhador (`buildings.json: trabalhador: null`
   * — armazem, escola, quartel) fica `null` para sempre: o gerador nunca cria
   * tarefa de ocupacao para ele.
   */
  readonly ocupante: string | null;
  /**
   * F15a — o relogio do ciclo de producao e o veio. `null` quando o tipo nao tem
   * receita em `production.json` (armazem, escola, quartel): nao ha o que
   * representar, e `null` em vez de `{ progresso: 0 }` mantem "nao produz"
   * irrepresentavel como "produz, parado". Mesmo molde de `ocupante`.
   */
  readonly producao: Producao | null;
  /**
   * F16c — o jogador pausou este predio (`SetBuildingPaused`). Pausado, o
   * RELOGIO do ciclo congela e nada mais muda: a gaveta `saida` continua
   * escoando, as tarefas de transporte continuam valendo e o ocupante fica onde
   * esta, no rotulo `trabalhando` (decisao do operador, 2026-09-23;
   * `docs/planos/F16c-pausar.md` §3).
   *
   * SEMPRE presente e `false` no nascimento, nunca `undefined`: e o que mantem o
   * estado comparavel byte a byte depois de um save/load, como `ocupante`.
   *
   * O campo e do PREDIO, de qualquer tipo. Quem nao tem `producao` pode ser
   * pausado sem efeito — o unico leitor e o ciclo de producao
   * (`systems/especialistas.ts`), e "pausado" nao e estado de FSM: a tela o
   * compoe deste campo mais o ocupante, uma fonte de verdade so.
   */
  readonly pausado: boolean;
  /**
   * F-CERCO-b — o jogador ligou o REPARO deste predio (`SetBuildingRepair`). Ligado e
   * com `hp` abaixo do total do tipo, o predio pede laborer no JobBoard (`'reparar'`),
   * e cada martelada devolve `construcao.hpPorMartelada` (a MESMA da obra).
   *
   * Nasce DESLIGADO, como no KaM para o jogador humano (`KM_Houses.pas:532`,
   * `:1307-1308`), e ligado predio a predio. SEMPRE presente, como `pausado`.
   */
  readonly reparo: boolean;
  /**
   * F25a — quantos recrutas estao DENTRO deste quartel, esperando virar soldado
   * (`TrainSoldier`). So o quartel tem o campo; AUSENTE nos outros e lido como zero.
   * Recruta dentro nao e unidade: nao anda, nao come, nao aparece em `unidades`.
   */
  readonly recrutas?: number;
  /** F28b — ticks ate a torre atirar de novo. So a torre tem o campo; AUSENTE e pronta. */
  readonly recarga?: number;
  /** F35 — a ordem da feira: trocar A (`da`) por B (`para`) ate `quantidade` de B, e
   *  quantas ja sairam. So a feira tem o campo; AUSENTE e sem ordem. */
  readonly troca?: { readonly da: string; readonly para: string; readonly quantidade: number; readonly feitas: number };
  /** D-TRANSPORTE-01a — as mercadorias que este ARMAZEM nao recebe da sobra da vila
   *  (`SetStorehouseAccept`), ordenadas. So o armazem tem o campo; AUSENTE aceita tudo, e
   *  a lista vazia e apagada (`armazem.ts: comNaoAceita`). */
  readonly naoAceita?: readonly string[];
  /** D-PRODUCAO-01b — o tick da ultima entrega de insumo, por mercadoria. So os tipos de
   *  `delivery.divisaoDoEscasso` tem o campo, e so a entrega o escreve: e a vez com que
   *  o insumo escasso se divide (`jobs.ts: ordenarTarefasDoSerf`). AUSENTE nunca recebeu. */
  readonly ultimaEntrega?: Readonly<Record<string, number>>;
}

/**
 * F15a — o estado de producao de UM predio.
 *
 * Um relogio por PREDIO, nao um por mercadoria: a receita ja veio derivada em
 * ciclo do carregamento (`ReceitaDePredio`), entao um contador basta e o estado
 * nao ganha um campo por bem produzido.
 */
export interface Producao {
  /** Ticks ja trabalhados no ciclo em curso, de 0 ate `ticksDoCiclo`. Igual a
   *  `ticksDoCiclo` significa CICLO PRONTO esperando caber na gaveta `saida`. */
  readonly progresso: number;
  /** F18 — o tile que este predio esta REPONDO agora, ou `null`. O roçado nao
   *  colhe o que nao plantou: quando nao ha tile maduro ao alcance mas ha terra
   *  livre, o roceiro ara e semeia, e so depois volta a colher. */
  readonly plantio: Plantio | null;
  /** F24a — so no predio cuja receita `escolheSaida` (as tres oficinas de arma);
   *  AUSENTE nos outros, nunca `undefined` — a convencao de `DadosDaFsm`. Quem
   *  reconstroi `Producao` espalha a anterior para nao perder o rodizio. */
  readonly escolha?: EscolhaDeSaida;
  /** F-CAMPO-a — so no predio que REPOE o tile (roçado, canavial): o ultimo tile
   *  que o rodizio escolheu, chave `"gx,gy"`. AUSENTE nos outros e antes da
   *  primeira escolha. A proxima busca termina este tile se ainda ha o que colher
   *  nele, e senao comeca DEPOIS dele — nenhum tile ao alcance espera mais de uma
   *  volta. Quem reconstroi `Producao` espalha a anterior para nao perde-lo. */
  readonly cursor?: string;
  /** F-REPL-b — o modo que o jogador escolheu (`SetBuildingMode`), chave de
   *  `ReceitaDePredio.modos.porModo`. So no predio cuja receita declara `modos` (o
   *  lenhador), e nasce no `padrao`; AUSENTE nos outros, como `escolha`. Quem
   *  reconstroi `Producao` espalha a anterior para nao perde-lo. */
  readonly modo?: string;
}

/**
 * F24a — qual saida o proximo ciclo entrega (GDD §2.3, "quantas de cada arma
 * produzir").
 *
 * D-PRODUCAO-03a — a cota deixou de ser PESO e virou ENCOMENDA, como o `WareOrder`
 * do KaM (`KM_Houses.pas: PickOrder`, 731a8a4): nasce em zero, o ciclo so comeca
 * com alguma saida > 0, e o comeco do ciclo desconta 1 da escolhida. A escolha
 * procura a partir de `proxima`, na lista das saidas da receita em ordem de
 * `economia.mercadorias`. Deterministico e sem RNG.
 */
export interface EscolhaDeSaida {
  /** O que FALTA fazer de cada saida; inteiro >= 0. Tudo zero: a oficina para. */
  readonly cota: Readonly<Record<string, number>>;
  /** Indice, nas saidas da receita, de onde a proxima escolha comeca a procurar. */
  readonly proxima: number;
  /** A saida que o ciclo em andamento entrega, ja descontada da `cota`. AUSENTE
   *  sem ciclo em andamento; o deposito a apaga. */
  readonly emCurso?: string;
}

/**
 * F18 — a reposicao de UM tile em curso.
 *
 * F-CAMPO-a — deixou de ser "dentro do predio": semear e VIAGEM (`indo_semear`,
 * `semeando`, `voltando`), e esta reserva cobre a ida e a semeadura. O crescer
 * nao esta aqui: corre no tile (`RecursoNoTile.semeadoEm`), sem o roceiro. O
 * texto abaixo e o da F18 e continua valendo quanto ao pretendente unico.
 *
 * Por que aqui e nao como tarefa do quadro, ao contrario da colheita (F-T2c): a
 * tarefa de colheita existe porque DUAS pedreiras podem mirar o mesmo tile, e
 * ela carrega um caminho de `release` a errar. O unico pretendente de um plantio
 * e o proprio predio que o comecou, nao ha viagem, e demolir o predio some com a
 * reserva sem nenhum ramo de erro. O que a F-T2c conquistou continua valendo
 * porque `tilesReservadosParaColheita` devolve a UNIAO: tile de tarefa de
 * colheita mais tile em plantio. Duas fazendas vizinhas continuam sem poder
 * trabalhar o mesmo tile.
 */
export interface Plantio {
  /** O tile sendo reposto. Reservado desde o primeiro tick do plantio. */
  readonly tile: TileDeGrid;
  /** Ticks ja trabalhados NO TILE, de 0 ate `reposicao.ticksDeSemear`. */
  readonly progresso: number;
}

/**
 * F-T2a — o que sobrou de recurso natural em UM tile. Mora em
 * `state.recursos`, esparso, com a mesma chave de `state.estradas`; o mapa diz
 * ONDE ha recurso, `data/resources.json` diz quanto cada tile rende ao nascer, e
 * este objeto e o que resta. Leia por `sim/recursos.ts`.
 *
 * Nao guarda regime nem teto: os dois sao do TIPO e estao no dado. Dado derivado
 * dentro do estado seria mais uma coisa capaz de divergir do save.
 */
export interface RecursoNoTile {
  readonly tipo: string;
  readonly quantidade: number;
  /** F-CAMPO-a — o tick em que o roceiro terminou de semear este tile. So em
   *  tile semeado e ainda nao colhido ate o fim; AUSENTE em rocha, arvore, terra
   *  em pousio e todo tile de antes da F-CAMPO. Maduro e DERIVADO
   *  (`tick >= semeadoEm + ticksDeCrescer`, `tileMaduro` em sim/recursos.ts):
   *  nada avanca por tick, e o crescer corre em todos os tiles ao mesmo tempo.
   *  Opcional, e nao `number | null` obrigatorio: obrigatorio custava 41 erros
   *  de compilacao (5 na sim, 36 em teste), medido na noite 18. */
  readonly semeadoEm?: number;
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
   */
  readonly faltam: Readonly<Record<string, number>>;
  /**
   * Ticks de nivelamento do terreno ja acumulados pelo(s) laborer(s) desta obra
   * (F11c). MONOTONICO — nunca decresce, por isso `obraNivelada` (`sim/obra.ts`)
   * nunca fica retroativamente falsa. O alvo (`alvoDeNivelamento`) e derivado da
   * area do footprint; nao guardado aqui, para nao haver duas fontes de verdade.
   */
  readonly nivelamento: number;
}

export interface PredioEmObra extends PredioBase {
  readonly estado: 'obra';
  readonly obra: Obra;
}

/** Uniao discriminada por `estado`: um predio em obra sem `obra`, ou completo sem
 *  `estoque`, nao e representavel. */
export type Predio = PredioCompleto | PredioEmObra;

interface TarefaBase {
  /** `t<numero>`, do mesmo contador `proximoId` de predios e unidades. */
  readonly id: string;
  /** O desempate compara ESTE numero; comparar a string errararia ('t10' < 't2'). */
  readonly numero: number;
  /** Id da unidade que a reclamou; `null` (nunca `undefined`) se aberta. */
  readonly reclamadaPor: string | null;
}

/**
 * CONTRATO HERDADO (F10, F11b, F13, F15) — a tarefa original do JobBoard
 * (F09): uma unidade de recurso, de um armazem ATE uma obra. So o serf
 * (`TIPO_QUE_CARREGA`) e elegivel.
 *
 * UMA TAREFA = UMA UNIDADE DE RECURSO (o GDD §6.3 fala em "a unidade de recurso" e
 * nao ha dado de capacidade de carga; se houver, ganha `quantidade`).
 *
 * A RESERVA nao e um campo: e DERIVADA das tarefas (`sim/reservas.ts`). Uma tarefa
 * `aberta` nao reserva nada; a `reclamada` (serf indo buscar) reserva, ao mesmo tempo, a
 * unidade de recurso em `origem` e a vaga em `destino`; a `carregando` (F10: a coleta
 * consumiu a reserva da origem e a unidade leva o recurso) reserva so a vaga em
 * `destino`. Tirar a tarefa desses estados devolve o que ela reservava — nao ha contador
 * para dessincronizar, e a reserva sobrevive ao save/load porque a tarefa sobrevive.
 *
 * Ciclo (F10): `aberta` -> `reclamada` -> `carregando` -> (entrega: a tarefa some).
 */
interface TarefaDeCarga extends TarefaBase {
  readonly estado: 'aberta' | 'reclamada' | 'carregando';
  readonly mercadoria: string;
  /** Id do armazem de onde a unidade sai. */
  readonly origem: string;
  /** Id do predio que recebe. */
  readonly destino: string;
}

export interface TarefaMaterialParaObra extends TarefaDeCarga {
  readonly tipo: 'material-para-obra';
}

/**
 * F20a — nivel 1 da escada (`delivery.json: comida-para-inn`), a prioridade mais
 * ALTA de todas: uma unidade de comida do armazem ate a gaveta `entrada` de uma
 * Bodega COMPLETA. Mesmo serf, mesmo claim, mesma reserva dupla da tarefa de ouro.
 *
 * A diferenca da tarefa de ouro esta no que limita o destino. A escola e limitada
 * pela FILA de treino (demanda que some quando o jogador cancela); a Bodega, por um
 * TETO POR TIPO de comida, que vem de `condition.json:inn.estoquePorTipoDeComida` e
 * nao muda no meio da viagem. Por isso a `mercadoria` aqui e parametro — sao varias
 * comidas, cada uma com o seu teto —, e nao uma constante como `MERCADORIA_DE_OURO`.
 *
 * O teto NAO pode vir de `capacidade.entrada`: a Bodega nao tem receita, e por isso
 * nasce com capacidade `null` nas duas gavetas (ver `capacidadeParaTipo`). Quem
 * responde e `sim/bodega.ts`.
 */
export interface TarefaComidaParaInn extends TarefaDeCarga {
  readonly tipo: 'comida-para-inn';
}

/**
 * F13 — nivel 2 da escada (`delivery.json: ouro-para-escola`): uma unidade de ouro
 * do armazem ate uma escola COMPLETA. Mesmo serf, mesmo claim, mesma reserva dupla
 * da tarefa de material; o que muda e onde a carga entra na chegada (a gaveta
 * `entrada` da escola, em vez de `faltam` da obra) e o nivel na escada.
 *
 * A vaga no destino NAO e capacidade — a escola nao tem limite de gaveta. E a
 * DEMANDA DA FILA: `ouroNecessario` (`sim/escola.ts`), os itens que ainda nao
 * comecaram vezes o custo, menos o ouro que ja esta la. Demanda que encolhe
 * (item cancelado) e o que faz `sanearTarefas` cancelar a tarefa.
 */
export interface TarefaOuroParaEscola extends TarefaDeCarga {
  readonly tipo: 'ouro-para-escola';
}

/**
 * F25a — `delivery.json: arma-para-quartel`: uma unidade de equipamento (os `requisitos`
 * de `units.json: militares`) do armazem, ou direto da oficina (D-TRANSPORTE-03 T1), ate
 * a gaveta `entrada` de um quartel COMPLETO. Mesmo serf, mesmo claim, mesma reserva dupla da
 * tarefa de ouro. O que limita o destino nao e teto nem fila: o quartel quer TUDO o
 * que o armazem tem de cada requisito (`sim/quartel.ts`), como no KaM.
 */
export interface TarefaArmaParaQuartel extends TarefaDeCarga {
  readonly tipo: 'arma-para-quartel';
}

/**
 * F15b — niveis 4 e 5 da escada: uma unidade de insumo do armazem ate a gaveta
 * `entrada` de um produtor. Dois tipos e nao um com campo de urgencia porque o
 * NIVEL e a unica diferenca entre eles, e nivel mora no tipo (`nivelDoTipo`,
 * `delivery.json`). 4 e "precisa e tem zero"; 5 e "tem menos que o alvo".
 *
 * O tipo e FOTOGRAFADO na criacao e nunca muda depois: a urgencia pode virar
 * debaixo de um serf que ja esta com o tronco na mao, e trocar o tipo ali seria
 * trocar a tarefa por outra sem devolver a reserva. Tarefa ABERTA que perdeu a
 * urgencia e cancelada por `abertaVale` e recriada no mesmo tick — de graca,
 * porque aberta nao reserva nada.
 */
export interface TarefaInsumoProducaoParada extends TarefaDeCarga {
  readonly tipo: 'insumo-producao-parada';
}
export interface TarefaInsumoProducaoBaixa extends TarefaDeCarga {
  readonly tipo: 'insumo-producao-baixa';
}

/**
 * F15b — nivel 6: a gaveta `saida` de um produtor ate o armazem. Dispara com
 * estoque > 0, NAO com a gaveta cheia (BUILD_PLAN F15b-1, nota D3): esperar
 * encher faria de `saida_cheia` o regime permanente, e o GDD §6.2 a descreve
 * como sinal de gargalo. O nome do nivel no dado descreve o sintoma que ele
 * evita, nao a condicao de disparo.
 *
 * E o primeiro tipo em que a ORIGEM nao e armazem.
 */
export interface TarefaSaidaCheiaParaArmazem extends TarefaDeCarga {
  readonly tipo: 'saida-cheia-para-armazem';
}

/**
 * F15b — nivel 7: mercadoria parada na gaveta `entrada` de um predio que nao a
 * pede mais, de volta ao armazem. E o que fecha o ouro preso na escola depois de
 * a fila ser cancelada (BUILD_PLAN F15b-1, nota D4): o vazamento se conserta na
 * origem, e o HUD continua com uma regra so. Unico tipo cuja carga sai da gaveta
 * `entrada` — ver `gavetaDeOrigem`.
 */
export interface TarefaExcedenteParaArmazem extends TarefaDeCarga {
  readonly tipo: 'excedente-para-armazem';
}

/** As tarefas que um serf CARREGA: mesma forma, destinos diferentes. */
export type TarefaDeTransporte =
  | TarefaComidaParaInn
  | TarefaMaterialParaObra
  | TarefaOuroParaEscola
  | TarefaArmaParaQuartel
  | TarefaInsumoProducaoParada
  | TarefaInsumoProducaoBaixa
  | TarefaSaidaCheiaParaArmazem
  | TarefaExcedenteParaArmazem;

/** O tipo de uma tarefa que CARREGA, DERIVADO da uniao — nunca escrito a mao. */
export type TipoDeTransporte = TarefaDeTransporte['tipo'];

/** As duas gavetas de estoque de um predio completo. */
export type Gaveta = 'entrada' | 'saida';

/**
 * F15b — de que gaveta do predio de ORIGEM a carga sai. Exaustiva por
 * construcao: um tipo de transporte novo sem linha aqui nao compila, e quem o
 * acrescenta e obrigado a decidir, em vez de herdar `saida` por omissao.
 *
 * Mora em `state.ts`, e nao em `jobs.ts`, porque `reservas.ts` precisa dela e
 * deliberadamente nao importa `jobs.ts` (o ciclo que o cabecalho de `reservas.ts`
 * explica).
 */
export const GAVETA_DE_ORIGEM_POR_TIPO: Readonly<Record<TipoComOrigem, Gaveta>> = {
  // F20a: a comida sai da gaveta `saida` do armazem, a mesma de onde sai tudo o
  // que o serf carrega para fora dele.
  'comida-para-inn': 'saida',
  'material-para-obra': 'saida',
  'ouro-para-escola': 'saida',
  // F25a: a arma sai da `saida` do armazem, como o ouro. D-TRANSPORTE-03 T1: ou da
  // `saida` da oficina que a fez — a mesma gaveta
  'arma-para-quartel': 'saida',
  'insumo-producao-parada': 'saida',
  'insumo-producao-baixa': 'saida',
  'saida-cheia-para-armazem': 'saida',
  'excedente-para-armazem': 'entrada',
  // F18g: a pedra da estrada sai da `saida` do armazem, a mesma gaveta de onde
  // sai tudo o que o serf carrega para fora dele. Ate a F18g a linha aqui era a
  // de `'assentar-estrada'`, que reservava sem carregar; agora quem reserva e
  // quem carrega, e e a mesma tarefa.
  'pedra-para-canteiro': 'saida',
  // C-COMIDA-01b (fome militar com o Feed): a comida da tropa sai da `saida` do armazem
  'comida-para-tropa': 'saida',
};

export function gavetaDeOrigem(tipo: TipoComOrigem): Gaveta {
  return GAVETA_DE_ORIGEM_POR_TIPO[tipo];
}

/**
 * F15b — de que PREDIO a carga sai, pelo tipo. Ate o nivel 5 e sempre um
 * armazem (o serf abastece a cidade a partir do deposito); nos niveis 6 e 7 e o
 * proprio predio que tem a sobra, e o armazem e o destino. Exaustiva por
 * construcao, como `GAVETA_DE_ORIGEM_POR_TIPO`.
 *
 * F18g — indexada por `TipoComOrigem`, e nao mais por `TipoDeTransporte`: a
 * pedra do canteiro tambem sai de um armazem, e a pergunta "a origem tem a forma
 * do tipo?" e a mesma para ela.
 *
 * D-TRANSPORTE-03 T1 — `'qualquer'`: a arma sai do armazem OU direto da oficina que a
 * fez, sem passar pelo armazem (KM_HandLogistics.pas:1238-1258: a arma nao vai ao armazem
 * enquanto um quartel a aceita).
 */
export const ORIGEM_ESPERADA_POR_TIPO: Readonly<Record<TipoComOrigem, 'armazem' | 'outro-predio' | 'qualquer'>> = {
  'comida-para-inn': 'armazem',
  'material-para-obra': 'armazem',
  'ouro-para-escola': 'armazem',
  'arma-para-quartel': 'qualquer',
  // D-TRANSPORTE-03 T2 — o insumo sai do armazem OU da casa que o fez (a oferta casada com a
  // demanda, KM_HandLogistics.pas:1587-1590)
  'insumo-producao-parada': 'qualquer',
  'insumo-producao-baixa': 'qualquer',
  'saida-cheia-para-armazem': 'outro-predio',
  'excedente-para-armazem': 'outro-predio',
  'pedra-para-canteiro': 'armazem',
  // C-COMIDA-01b — so de armazem completo do mesmo lado (L3, decisao do operador)
  'comida-para-tropa': 'armazem',
};

/**
 * A origem de `tarefa` tem a FORMA que o tipo dela pressupoe? Predio completo,
 * e armazem ou nao-armazem conforme `ORIGEM_ESPERADA_POR_TIPO`.
 *
 * Mora aqui, e nao em `systems/jobs.ts`, para que o saneamento e o helper de
 * invariantes dos testes facam a MESMA pergunta — nao duas copias da regra que
 * um dia divergem.
 */
export function origemDaTarefaVale(state: GameState, tarefa: TarefaDoSerf): boolean {
  const origem = state.predios.porId[tarefa.origem];
  if (origem === undefined || origem.estado !== 'completo') return false;
  const esperada = ORIGEM_ESPERADA_POR_TIPO[tarefa.tipo];
  if (esperada === 'qualquer') return true;
  return esperada === 'armazem' ? origem.tipo === ID_DO_ARMAZEM : origem.tipo !== ID_DO_ARMAZEM;
}

/**
 * F11b — uma vaga de trabalho de construcao numa obra. So o laborer
 * (`TIPO_QUE_CONSTROI`) e elegivel. SEM `mercadoria`/`origem`: nao carrega
 * nada, e por isso SEM `'carregando'` no `estado` — o ciclo e so `aberta ->
 * reclamada -> (a obra completa: a F11c decide como a tarefa sai do quadro)`.
 * A vaga e o TETO `construcao.laborersMaximosPorObra` (dado), nao um campo
 * em `Obra` — a posse continua so no JobBoard (decisao do operador).
 */
export interface TarefaConstruir extends TarefaBase {
  readonly tipo: 'construir';
  readonly estado: 'aberta' | 'reclamada';
  /** Id da obra. */
  readonly destino: string;
}

/**
 * F-CERCO-b — uma vaga de REPARO num predio COMPLETO com `reparo` ligado e `hp` abaixo
 * do total. Molde da `TarefaConstruir`: so o laborer, sem carga, sem origem, sem
 * `'carregando'`. O reparo nao gasta material (no KaM tambem nao).
 */
export interface TarefaReparar extends TarefaBase {
  readonly tipo: 'reparar';
  readonly estado: 'aberta' | 'reclamada';
  /** Id do predio completo a reparar. */
  readonly destino: string;
}

/**
 * F25a — a vaga de um RECRUTA no quartel: ele anda ate a porta e ENTRA — a unidade
 * sai do estado e `recrutas` do quartel sobe 1. Molde da `TarefaOcupar`, sem carga e
 * fora da escada; so o recruta (`ID_DO_RECRUTA`) e elegivel. O quartel nao tem teto de
 * recrutas (no KaM tambem nao), entao ha UMA aberta por quartel completo, sempre, e
 * cada recruta que a reclama libera o gerador a abrir a proxima.
 */
export interface TarefaAlistar extends TarefaBase {
  readonly tipo: 'alistar';
  readonly estado: 'aberta' | 'reclamada';
  /** Id do quartel completo. */
  readonly destino: string;
}

/**
 * CONTRATO HERDADO (F10, F11b, F11c, F13, F15) — uma unidade de trabalho do
 * JobBoard. Uniao discriminada por `tipo`, no molde de `Predio` (F07): uma
 * tarefa de construir com `mercadoria`, ou uma de material sem `origem`, NAO
 * e representavel.
 *
 * A RESERVA nao e um campo: e DERIVADA das tarefas (`sim/reservas.ts`). Ver
 * `elegivelParaTarefa` (`sim/jobs.ts`) para quem pode reclamar cada tipo.
 */
/**
 * F14 — uma vaga de OCUPANTE num predio COMPLETO que pede trabalhador
 * (`buildings.json: trabalhador`). Molde da `TarefaConstruir`: SEM
 * `mercadoria`/`origem` e SEM `'carregando'` (o especialista nao carrega nada),
 * e FORA da escada de `delivery.json` — como a de construir, e pelo mesmo
 * motivo: quem a reclama nao disputa tarefa com serf nem com laborer.
 *
 * E o unico tipo cuja ELEGIBILIDADE depende do DESTINO e nao so do tipo da
 * tarefa: quem ocupa uma `quarry` e o civil que o dado declara para `quarry`.
 * Ver `podeReclamar` (`sim/jobs.ts`).
 *
 * A tarefa SOME quando o especialista chega (`removerTarefa`), no MESMO tick em
 * que `predio.ocupante` passa a apontar para ele. Nao existe instante com
 * ocupante e reserva ao mesmo tempo — e por isso a vaga nunca fica negativa.
 */
export interface TarefaOcupar extends TarefaBase {
  readonly tipo: 'ocupar';
  readonly estado: 'aberta' | 'reclamada';
  /** Id do predio completo a ocupar. */
  readonly destino: string;
}

/**
 * F18d-1b — assentar UM tile de estrada planejado (`estradasPlanejadas`). So o
 * laborer (`TIPO_QUE_CONSTROI`) e elegivel: o canteiro de estrada e obra, nao
 * carga. Molde da `TarefaConstruir`: SEM `'carregando'`, o laborer nao leva nada
 * na mao.
 *
 * F18g — a pedra deixou de morar aqui. Ate a F18g esta tarefa tinha `mercadoria`
 * e `origem` e RESERVAVA a pedra no armazem desde `'aberta'` (o unico caso
 * especial de `reservas.ts`), e o assentamento debitava do armazem. Agora a pedra
 * VIAJA: uma `TarefaPedraParaCanteiro` (carga de serf, abaixo) a leva do armazem
 * ate o tile, ela descansa em `pedraNoCanteiro`, e e de la que o assentamento a
 * consome. Esta tarefa ficou com a forma da `TarefaArar`: so o tile. Ela nasce
 * para TODO tile do canteiro, sem pagador — quem decide se o laborer vai e o
 * claim, que exige pedra no tile ou a caminho (`tileDeEstradaTrabalhavel`).
 *
 *  - O destino e um TILE, em `destinoTile`, e NAO ha `destino: string`. Tile nao
 *    e predio: nao tem gaveta, nao tem vaga, nao tem porta. Os lugares que fazem
 *    `predios.porId[tarefa.destino]` nao compilam contra este tipo, de proposito.
 */
export interface TarefaAssentarEstrada extends TarefaBase {
  readonly tipo: 'assentar-estrada';
  readonly estado: 'aberta' | 'reclamada';
  /** O tile planejado a assentar. */
  readonly destinoTile: TileDeGrid;
}

/**
 * F18g — UMA unidade de pedra, de um armazem ATE um tile do canteiro de estrada.
 * So o serf (`TIPO_QUE_CARREGA`) e elegivel: e carga como qualquer outra — mesma
 * FSM, mesmo claim, mesma reserva na origem ao reclamar, mesma coleta que tira
 * a unidade da gaveta `saida` e a poe na mao dele. O que muda e a PONTA: o
 * destino e um TILE (`destinoTile`), e a entrega nao cai em gaveta nenhuma — cai
 * em `pedraNoCanteiro[chave]`, de onde o laborer a consome ao assentar.
 *
 * Por que nao e `TarefaDeTransporte` com `destino: string`: `destino` de
 * transporte e id de PREDIO em dezenas de lugares (`predios.porId[t.destino]`), e
 * a chave de um tile la dentro seria um `undefined` silencioso em cada um. Com
 * `destinoTile` esses lugares nao compilam contra este tipo, de proposito — a
 * mesma regra da `TarefaAssentarEstrada`. Quem quer "a tarefa que o serf
 * carrega, qualquer que seja a ponta" pergunta `ehTarefaDoSerf`.
 *
 * A VAGA do tile e `custoStonePorTile − entregue − a caminho` (`vagaNoTile`,
 * reservas.ts): um tile pede exatamente o custo dele, e nem uma a mais.
 *
 * Ciclo (o do serf): `aberta` -> `reclamada` -> `carregando` -> (entrega: a
 * tarefa some). Tile que sai do canteiro no meio da viagem: `sanearTarefas` a
 * cancela (`destino-sumiu`) e o serf devolve a pedra ao armazem mais perto,
 * como toda carga orfa.
 */
export interface TarefaPedraParaCanteiro extends TarefaBase {
  readonly tipo: 'pedra-para-canteiro';
  readonly estado: 'aberta' | 'reclamada' | 'carregando';
  /** Sempre `MERCADORIA_DA_ESTRADA`; o campo existe para a reserva ser a mesma
   *  conta de `reservadoNaOrigem`, e nao uma segunda regra paralela. */
  readonly mercadoria: string;
  /** Id do armazem de onde a pedra sai. */
  readonly origem: string;
  /** O tile planejado que recebe a pedra. */
  readonly destinoTile: TileDeGrid;
}

/**
 * F18h — arar UM tile planejado (`camposPlanejados`) ate ele virar campo. So o
 * laborer, como o assentamento: o jogador manda, o obreiro faz. Molde da
 * `TarefaAssentarEstrada`, com um campo a menos e um a mais:
 *
 *  - SEM `mercadoria`/`origem`: o milho nao custa material nenhum (GDD 5.4), e
 *    reserva de material sem material a reservar seria caminho sem consumidor.
 *    Quando a cana entrar — com o Canavial ja colhendo, que e o que falta —, ela
 *    ganha os dois campos e a reserva-e-debito do armazem, exatamente como a
 *    pedra da estrada (decisao do operador, 2026-09-25).
 *  - COM `recurso`: qual cultura o tile vira ao fim. Fotografado na criacao,
 *    como `TarefaColher.recurso` — o canteiro guarda a mesma resposta, e as
 *    duas so divergiriam se alguem mudasse o canteiro com a tarefa viva.
 *
 * O destino e um TILE, em `destinoTile`, como o da estrada. E por isto que
 * `ehTarefaDeAssentamento` deixou de classificar por FORMA nesta feature: o
 * proprio doc da tarefa de estrada avisava que um segundo tipo com este campo
 * passaria a ser lido como tarefa de estrada em `sanearTarefas`, no claim e no
 * verificador. Quem ainda quer a pergunta de forma — "o destino e um tile?" —
 * chama `ehTarefaDeTile`.
 */
export interface TarefaArar extends TarefaBase {
  readonly tipo: 'arar';
  readonly estado: 'aberta' | 'reclamada';
  /** O tile planejado a arar. */
  readonly destinoTile: TileDeGrid;
  /** O recurso que o tile vira quando a aradura fecha. */
  readonly recurso: string;
}

/**
 * F-T2c — UM CICLO de colheita de UM tile de recurso natural, para o predio que
 * o colhe. Fecha a divida declarada na F-T2a: ate aqui a pedreira varria o
 * proprio alcance dentro do sistema de producao, sem passar pelo quadro, e duas
 * pedreiras vizinhas podiam mirar o mesmo tile no mesmo tick.
 *
 * A RESERVA e do TILE INTEIRO, e nao de unidades dentro dele: um tile e um
 * LUGAR, e quem cava nele o ocupa. Por isso ela nao passa por
 * `reservadoNaOrigem` (que conta mercadoria em gaveta) e sim por
 * `tilesReservadosParaColheita` (`sim/reservas.ts`), que devolve um conjunto.
 *
 * Vale desde `'aberta'`, como em `TarefaAssentarEstrada` e pelo mesmo motivo:
 * e a CRIACAO que compromete o tile. Sem isso duas tarefas nasceriam no mesmo
 * tile no mesmo `gerarTarefas`, e o claim teria de desempatar o que nem devia
 * ter sido criado.
 *
 * O tile e a ORIGEM (`origemTile`), nunca `destinoTile`: o recurso sai dele e
 * entra no predio, e `ehTarefaDeAssentamento` classifica por FORMA
 * (`'destinoTile' in tarefa`) — um segundo tipo com aquele nome passaria a ser
 * lido como tarefa de estrada em `sanearTarefas`, no claim e no verificador.
 *
 * Quem reclama e o OCUPANTE do predio, e so ele (`reclamar`). Nao ha caminho a
 * conferir: o especialista ja esta dentro.
 */
export interface TarefaColher extends TarefaBase {
  readonly tipo: 'colher';
  readonly estado: 'aberta' | 'reclamada';
  /** Id do predio COMPLETO que colhe. */
  readonly destino: string;
  /** O tile de onde o recurso sai, reservado inteiro enquanto a tarefa vive. */
  readonly origemTile: TileDeGrid;
  /** `colheita.recurso` da receita, fotografado na criacao. */
  readonly recurso: string;
  /** `unidadesPorCiclo(receita)`: o que UM ciclo tira do tile. */
  readonly quantidade: number;
}

/**
 * F20b — UMA refeicao numa Bodega COMPLETA: o assento de um civil com fome.
 *
 * Molde da `TarefaOcupar`: SEM `mercadoria`/`origem`, SEM `'carregando'`, e FORA da
 * escada de `delivery.json` — quem reclama nao disputa carga com serf nenhum, e por
 * isso nao ha nivel a comparar.
 *
 * A VAGA e `refeicoesGarantidas` (`sim/bodega.ts`; emenda da F20b, 2026-09-30), e nao um campo no predio:
 * ela e derivada das tarefas de comer daquele destino, como a vaga da obra e
 * derivada das de construir. Ela e reservada desde o `claim` e vale ATE a refeicao
 * acabar — o assento fica comprometido durante a caminhada, exactamente como a vaga
 * do `ocupar`.
 *
 * O que NAO e reservado e a COMIDA, e isso e decisao escrita (F20b, D5): uma
 * refeicao consome um CONJUNTO variavel de tipos (cada tipo no maximo uma vez, ate
 * encher), entao reservar uma unidade de um tipo seria uma reserva que mente sobre o
 * que vai ser consumido. O que cobre a corrida e o gerador — tarefa so nasce em
 * Bodega que TEM comida, o mesmo portao que na F20a impediu tarefa para `wine` — e o
 * consumo ATOMICO na chegada: quem chega e nao acha comida volta a `ocioso` no mesmo
 * tick, nunca espera.
 */
/**
 * C-COMIDA-01b (fome militar com o Feed) — um serf leva UMA comida do armazem `origem` ao
 * militar `destinoUnidade`, que pediu (`Unidade.pedidoDeComida`). O destino e uma UNIDADE,
 * e o campo se chama `destinoUnidade`, e nao `destino`, para que `predios.porId[t.destino]`
 * nao compile contra ela (o molde do `destinoTile` da F18g). A entrega anda livre (modo do
 * nivel `comida-para-tropa`) e segue o alvo que anda: ao chegar, se o militar estiver a mais
 * de 1 tile, recalcula e continua (KaM: `KM_UnitTaskDelivery.pas:492-497`).
 */
export interface TarefaComidaParaTropa extends TarefaBase {
  readonly tipo: 'comida-para-tropa';
  readonly estado: 'aberta' | 'reclamada' | 'carregando';
  readonly mercadoria: string;
  readonly origem: string;
  readonly destinoUnidade: string;
}

export interface TarefaComer extends TarefaBase {
  readonly tipo: 'comer';
  readonly estado: 'aberta' | 'reclamada';
  /** Id da Bodega COMPLETA onde a refeicao acontece. */
  readonly destino: string;
}

export type Tarefa =
  TarefaDeTransporte | TarefaConstruir | TarefaOcupar | TarefaAssentarEstrada | TarefaColher
  | TarefaComer | TarefaArar | TarefaPedraParaCanteiro | TarefaReparar | TarefaAlistar | TarefaComidaParaTropa;

/**
 * O tipo da tarefa, DERIVADO da uniao: acrescentar um produtor novo (F15, F20)
 * alarga `Tarefa` e esta linha acompanha sozinha. Os niveis continuam vindo de
 * `delivery.json` por id (`nivelDoTipo`), nunca digitados em `.ts`.
 */
export type TipoDeTarefa = Tarefa['tipo'];

/**
 * F18d-1b — os tipos que ESTAO na escada de `delivery.json`, e so eles.
 * `'construir'` e `'ocupar'` ficam de fora (nao disputam nivel com ninguem), e e
 * por isso que `modoDoTipo` nao aceita `TipoDeTarefa` inteiro: pedir o modo de um
 * tipo fora da escada e erro de chamada, e continua falhando alto.
 *
 * F18g — `'assentar-estrada'` saiu de `TipoComOrigem` (nao reserva mais nada) e
 * entra aqui pelo nome, ao lado de `'arar'`: as duas estao na escada so pelo
 * `modo`.
 */
export type TipoNaEscada = TipoComOrigem | TarefaAssentarEstrada['tipo'] | TarefaArar['tipo'];

/**
 * F18h — os tipos que reservam alguma coisa numa GAVETA de predio de origem, e
 * so eles. `'arar'` esta na escada (ela precisa de `modo`) e NAO esta aqui: ela
 * nao tem origem nem mercadoria, e uma linha em `GAVETA_DE_ORIGEM_POR_TIPO` para
 * ela seria dado morto respondendo a uma pergunta que ninguem faz.
 *
 * F18g — e exatamente o conjunto das tarefas que o SERF carrega (`TarefaDoSerf`):
 * quem tem origem e quem reserva, e quem reserva e quem carrega. O caso especial
 * da F18d-1b (assentar reservando sem carregar) deixou de existir.
 */
export type TipoComOrigem = TarefaDoSerf['tipo'];

/**
 * Uma tarefa que o serf CARREGA: tem `mercadoria` e entrega num PREDIO. Testa a
 * FORMA, e nao `tipo !== 'construir'` (como ate a F13): com a chegada de
 * `'ocupar'` (F14), o negativo classificaria a tarefa nova como transporte e ela
 * passaria por `vagaDoDestino`/`disponivelNaOrigem`, que leriam `undefined`.
 *
 * F18d-1b — `'mercadoria' in tarefa` sozinho deixou de bastar: a tarefa de
 * assentar tinha mercadoria e NAO tem `destino` de predio. F18g — a de pedra
 * para o canteiro tem mercadoria e `destinoTile`, e pela mesma razao NAO e
 * transporte: as duas perguntas juntas sao a forma inteira de uma carga que
 * entra em PREDIO. Quem quer "qualquer carga do serf" pergunta `ehTarefaDoSerf`.
 */
export function ehTarefaDeTransporte(tarefa: Tarefa): tarefa is TarefaDeTransporte {
  return 'mercadoria' in tarefa && 'destino' in tarefa;
}

/** F18g — pelo TIPO: a carga cujo destino e um tile do canteiro de estrada. */
export function ehTarefaDePedraParaCanteiro(tarefa: Tarefa): tarefa is TarefaPedraParaCanteiro {
  return tarefa.tipo === 'pedra-para-canteiro';
}

/**
 * F18g — tudo o que o SERF carrega: as cargas que entram em predio
 * (`TarefaDeTransporte`) e a pedra que entra em tile. E a uniao que a FSM do
 * serf, o claim e a reserva na origem percorrem; o que muda entre os dois
 * membros e so a ponta da entrega.
 */
export type TarefaDoSerf = TarefaDeTransporte | TarefaPedraParaCanteiro | TarefaComidaParaTropa;

/** C-COMIDA-01b — a comida levada a um militar em campo (destino que anda). */
export function ehTarefaDeComidaParaTropa(tarefa: Tarefa): tarefa is TarefaComidaParaTropa {
  return tarefa.tipo === 'comida-para-tropa';
}

export function ehTarefaDoSerf(tarefa: Tarefa): tarefa is TarefaDoSerf {
  return ehTarefaDeTransporte(tarefa) || ehTarefaDePedraParaCanteiro(tarefa) || ehTarefaDeComidaParaTropa(tarefa);
}

/**
 * F18d-1b, corrigido na F18h — pelo TIPO, e nao mais pela forma. Ate a F18h
 * `'destinoTile' in tarefa` bastava porque so uma tarefa tinha destino de tile;
 * com a aradura sao duas, e o proprio doc de `TarefaAssentarEstrada` avisava
 * que a segunda passaria a ser lida como estrada em `sanearTarefas`, no claim e
 * no verificador. Quem quer a pergunta de FORMA chama `ehTarefaDeTile`.
 */
export function ehTarefaDeAssentamento(tarefa: Tarefa): tarefa is TarefaAssentarEstrada {
  return tarefa.tipo === 'assentar-estrada';
}

/** F18h — a irma dela, pelo mesmo criterio. */
export function ehTarefaDeAradura(tarefa: Tarefa): tarefa is TarefaArar {
  return tarefa.tipo === 'arar';
}

/** F18h — as duas tarefas DE LABORER cujo destino e um TILE e nao um predio: quem
 *  pergunta isto quer a VIAGEM (o laborer anda ate o tile) ou o saneamento do
 *  destino, e a resposta e a mesma para as duas. Os lugares que fazem
 *  `predios.porId[tarefa.destino]` nao compilam contra este tipo, de proposito.
 *
 *  F18g — pelo TIPO, e nao mais por `'destinoTile' in tarefa`: a carga de pedra
 *  para o canteiro tambem tem `destinoTile`, e pela forma ela viraria tarefa de
 *  laborer (`ehTarefaDeLaborer`) e entraria na FSM errada. */
export function ehTarefaDeTile(tarefa: Tarefa): tarefa is TarefaAssentarEstrada | TarefaArar {
  return tarefa.tipo === 'assentar-estrada' || tarefa.tipo === 'arar';
}

/** F-T2c — pelo TIPO, e nao pela forma: `origemTile` existe justamente para esta
 *  tarefa nao cair na pergunta de forma acima. */
export function ehTarefaDeColheita(tarefa: Tarefa): tarefa is TarefaColher {
  return tarefa.tipo === 'colher';
}

/** As tarefas que SO o laborer reclama (`UNIDADE_ELEGIVEL_POR_TIPO`): construir e
 *  assentar. Nao e a negacao de `ehTarefaDeTransporte` — `'ocupar'` tambem nao e
 *  carga, e nao e do laborer. */
export type TarefaDeLaborer = TarefaConstruir | TarefaAssentarEstrada | TarefaArar | TarefaReparar;

export function ehTarefaDeLaborer(tarefa: Tarefa): tarefa is TarefaDeLaborer {
  return tarefa.tipo === 'construir' || tarefa.tipo === 'reparar' || ehTarefaDeTile(tarefa);
}

/** F-CERCO-b — pelo TIPO, como as irmas. */
export function ehTarefaDeReparo(tarefa: Tarefa): tarefa is TarefaReparar {
  return tarefa.tipo === 'reparar';
}

/** A central de tarefas. Serializavel: so `Colecao` de objetos planos. */
export interface JobBoard {
  readonly tarefas: Colecao<Tarefa>;
}

/**
 * F13 — um pedido na fila de uma escola. Uniao discriminada por `estado`, no molde
 * de `Predio` e `Tarefa`: um item que ainda nao comecou NAO tem `restam`, e um em
 * treino tem sempre `restam >= 1` (ao chegar a 0 a unidade nasce e o item sai da
 * fila no mesmo tick; `restam: 0` nunca fica gravado).
 *
 * O ouro e cobrado na TRANSICAO `aguardando -> treinando` (decisao do operador):
 * cancelar um `aguardando` nao devolve nada porque nada saiu; cancelar um
 * `treinando` perde o ouro ja gasto.
 */
export type ItemDeFila =
  | {
      /** `f<numero>`, do mesmo contador `proximoId` de predios, unidades e tarefas. */
      readonly id: string;
      /** Id do civil em data/units.json civis.tipos. */
      readonly unidade: string;
      readonly estado: 'aguardando';
    }
  | {
      readonly id: string;
      readonly unidade: string;
      readonly estado: 'treinando';
      /** Ticks de treino que faltam. Sempre >= 1 enquanto o item esta na fila. */
      readonly restam: number;
    };

/**
 * O que a FSM de uma unidade guarda entre ticks (CLAUDE.md §5: `fsmData` serializavel).
 * Campos ausentes sao OMITIDOS, nunca `undefined` (o JSON os perderia). `{}` e valido:
 * laborer e serf ocioso.
 *
 * Serf (F10): `tarefa` o id da tarefa em curso; `carga` a mercadoria que leva (uma
 * unidade); `caminho` os tiles a andar, SEM o tile onde esta; `progresso` os ticks ja
 * gastos no passo em curso; `armazem` o alvo do `devolvendo`.
 */
export interface DadosDaFsm {
  /** C5 — ticks que o militar ja esperou um tile ocupado por outro militar. D-MOVIMENTO-01 (colisao civil) — o mesmo
   *  para o civil com a colisao civil ligada (zera so num passo normal). */
  readonly bloqueado?: number;
  readonly tarefa?: string;
  readonly carga?: string;
  readonly caminho?: readonly TileDeGrid[];
  readonly progresso?: number;
  readonly armazem?: string;
  /** F-CERCO-a2 — o predio que a tropa recebeu ORDEM de atacar (`AttackBuilding`). */
  readonly alvo?: string;
  /** F-CERCO-a2 — ticks ate o proximo golpe no predio, na cadencia propria do dado. */
  readonly recarga?: number;
  /** F26a — o tile que a ordem de mover deu a ESTA unidade (`MoveUnits`). */
  readonly alvoTile?: TileDeGrid;
  /** C-COMBATE-01a — para onde a unidade vira ao chegar ao `alvoTile` (`MoveUnits`). */
  readonly direcaoFinal?: number;
  /** C-MOVIMENTO-02 — a ordem chegou no meio de um passo: ele termina o passo em curso e
   *  so entao planeja a rota nova (zerar o `progresso` desenhava o salto para tras). */
  readonly replanejar?: boolean;
  /** F28a — a unidade que esta sendo perseguida ou golpeada (`AttackUnit`, contato). */
  readonly alvoUnidade?: string;
  /** C-COMBATE-01b — tiles que faltam da carga (`StormAttack`), sorteados no inicio. */
  readonly cargaRestante?: number;
  /** C-COMBATE-01b — para onde a carga vai (0..7), a frente do lider. */
  readonly cargaDirecao?: number;
}

export interface Unidade {
  readonly id: string;
  /** F-CERCO-a1 — o dono. A unidade formada herda o lado do predio que a formou. */
  readonly lado: number;
  /** Id do civil em data/units.json civis.tipos ('serf', 'laborer', ...). */
  readonly tipo: string;
  readonly gx: number;
  readonly gy: number;
  /** Estado explicito da FSM (CLAUDE.md secao 5). Toda unidade nasce `ocioso`; a FSM do
   *  serf e da F10, a do laborer da F11. `gx`/`gy` e o tile onde a unidade ESTA; o
   *  movimento em curso vive em `fsmData` (`caminho` + `progresso`). */
  readonly fsm: string;
  readonly fsmData: DadosDaFsm;
  /** D-MOVIMENTO-01c (empilhamento de fora do passo) — ticks esperando a porta: quem nasceu ou saiu de "dentro" para um tile ocupado
   *  espera ele vagar, como no `GoInOut` do KaM. Enquanto isso nao ocupa nem anda. */
  readonly saindo?: number;
  /** C-COMIDA-01 (fome militar com o Feed) — o militar PEDIU comida (o `fRequestedFood` do
   *  KaM): um serf vai levar uma. Ausente = sem pedido. Some quando a comida chega ou ele
   *  morre; pedir de novo nao duplica. */
  readonly pedidoDeComida?: true;
  /**
   * F20b — a condicao (fome) em TICKS RESTANTES, inteiro. Cheia no nascimento
   * (`condicao.ticksCondicaoCheia` da classe), decrementada de 1 por tick pelo
   * `sistemaDaFome`, zero e morte.
   *
   * Ticks e nao fracao de propósito: a fracao de que o GDD fala (35 %, 50 %) e
   * DERIVADA na leitura (`fracaoDeCondicao`, `sim/condicao.ts`). Somar 1/12000 doze
   * mil vezes poria erro de ponto flutuante dentro do determinismo, que e a
   * invariante 2 do projeto.
   */
  readonly condicao: number;
  /**
   * F28c — os GOLPES que a unidade ainda aguenta (`units.json`: "hp aqui significa
   * golpes ate morrer"), ja multiplicados por `combate.multiplicadorHP`. So quem luta
   * tem: militar e mercenario. AUSENTE no civil, e AUSENTE num militar quer dizer
   * CHEIO (`hpDaUnidade`, `sim/vida.ts`) — assim a unidade que nasce nao precisa do
   * campo ate levar o primeiro golpe, e nenhum save anterior muda de sentido.
   */
  readonly hp?: number;
  /**
   * F28a — para onde a unidade esta virada: 0 = norte, e no sentido horario ate 7
   * (noroeste). E o que decide frente, flanco e costas no golpe, e o arco do arqueiro.
   * AUSENTE e 4 (sul, de frente para a camera), e so muda quando a unidade anda ou luta.
   */
  readonly direcao?: number;
  /**
   * C6 — o destino da marcha que o contato interrompeu. AUSENTE fora disso. O militar ocioso
   * que o tem, sem inimigo encostado, volta a marchar para la (`systems/combate.ts`); ordem
   * nova do jogador apaga. Fora do `fsmData` de proposito: a luta o reescreve varias vezes.
   */
  readonly retomarMarcha?: TileDeGrid;
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
   * a estrada PLANEJADA e outro campo (`estradasPlanejadas`, F18d-1b), e este
   * continua sendo o unico que `isConnected` consulta.
   *
   * Nao guarda componentes conexos: dado derivado serializado poderia ficar
   * inconsistente com os tiles. A consulta "existe caminho de A ate B?" e O(1) por
   * um indice derivado e memoizado pela REFERENCIA deste objeto (`sim/estradas.ts`);
   * `step()` carrega a mesma referencia enquanto nenhum comando de estrada muda
   * algo. Conectividade em 8 direcoes, com a quina de predio cortando a diagonal
   * (F18e). Nunca itere por `Object.keys` esperando uma
   * ordem: use `tilesOrdenados`.
   */
  readonly estradas: Readonly<Record<string, true>>;
  /**
   * F18d-1b — o CANTEIRO da estrada: os tiles que o jogador desenhou e que
   * nenhum laborer assentou ainda. Mesma forma de `estradas`, conjunto
   * separado, e os dois sao disjuntos por construcao (assentar move o tile de
   * um para o outro).
   *
   * NAO entra no indice da rede, de proposito: tile planejado nao liga nada —
   * e o proprio aceite da feature. Se um dia precisar de indice (para desenhar
   * o traçado, por exemplo), e indice SEPARADO, com a mesma regra de quina de
   * `passoPermitido`.
   */
  readonly estradasPlanejadas: Readonly<Record<string, true>>;
  /**
   * F18g — a PEDRA PARADA NO CANTEIRO: quantas unidades de `MERCADORIA_DA_ESTRADA`
   * um serf ja entregou em cada tile planejado e nenhum laborer assentou ainda.
   * Chave `"gx,gy"`, como `estradasPlanejadas`; so tiles com quantidade > 0
   * estao aqui (a entrada some no assentamento e na demolicao).
   *
   * Mapa PARALELO ao canteiro, e nao um valor mais rico em `estradasPlanejadas`:
   * trocar o `true` de la por objeto quebraria os 31 arquivos que o leem (7 com
   * `=== true`), e nenhum deles precisa saber da pedra. Quem precisa e o
   * assentamento (`comOTileAssentado` consome daqui), o claim do laborer
   * (`tileDeEstradaTrabalhavel`), a borracha (devolve o que esta aqui) e a
   * conservacao de bens (esta pedra e pedra).
   *
   * Nunca itere por `Object.keys` esperando uma ordem: use `tilesOrdenados`.
   */
  readonly pedraNoCanteiro: Readonly<Record<string, number>>;
  /**
   * F18h — o CANTEIRO do campo: os tiles que o jogador mandou arar e que nenhum
   * laborer arou ainda. Irmao de `estradasPlanejadas`, com uma diferenca: o
   * valor e o ID DO RECURSO que o tile vai virar, e nao `true`.
   *
   * O valor carrega a cultura porque a ferramenta e por cultura, e porque a
   * alternativa — um canteiro por tipo — faria o numero de campos do estado
   * crescer com o numero de culturas. Quando a aradura fecha, o tile sai daqui
   * e entra em `state.recursos`; os dois sao disjuntos por construcao, como o
   * canteiro da estrada e a rede.
   *
   * Nunca itere por `Object.keys` esperando uma ordem: use
   * `tilesPlanejadosParaArar` (`sim/campos.ts`).
   */
  readonly camposPlanejados: Readonly<Record<string, string>>;
  /**
   * F-T2a — o que sobrou de recurso natural, por tile. Esparso: tile sem recurso
   * NAO tem entrada, e tile de regime `nunca` que zerou PERDE a sua (o tile
   * volta a ser so terreno). Tile de regime `porAcao` que zerou FICA com
   * `quantidade: 0` — cortado nao e inexistente.
   *
   * Nasce do mapa (`GameData.mapa.recursos`) e e a unica parte da camada que
   * muda: onde ha recurso e dado imutavel, quanto ainda ha e estado. E isso que
   * faz demolir-e-reconstruir nao renovar nada.
   *
   * Nunca itere por `Object.keys` esperando ordem: use `sim/recursos.ts`.
   */
  readonly recursos: Readonly<Record<string, RecursoNoTile>>;
  /** O JobBoard (F09). Ver `Tarefa`. */
  readonly jobs: JobBoard;
  /**
   * CONTRATO HERDADO (F13b, F14) — a fila de treino de cada escola, por id de
   * PREDIO (nao de tipo: duas escolas tem duas filas).
   *
   * Escola sem pedido **nao tem entrada** (`{}`, nunca `{ p2: [] }`): dois estados
   * iguais precisam ter o mesmo JSON, ou o teste de determinismo e o save/load
   * passam a comparar ruido. Quem grava e so `comFila` (`sim/escola.ts`).
   *
   * A fila mora aqui, e nao em `PredioCompleto`, pelo mesmo motivo que `Predio` e
   * `Tarefa` sao unioes discriminadas: uma Pedreira com fila de treino nao pode
   * ser representavel.
   */
  readonly treino: Readonly<Record<string, readonly ItemDeFila[]>>;
  /**
   * F28-IA — o que a IA de cada LADO sabe (chave: o lado, em texto). AUSENTE quando
   * nenhum lado e da IA — o estado do jogo sem inimigo nao carrega o campo, e o save de
   * antes dele continua igual byte a byte. Quem cria as posicoes e o cenario.
   */
  readonly ia?: Readonly<Record<string, IADoLado>>;
  /**
   * F34 — o fim da escaramuca, gravado UMA vez no tick em que ela acaba (`sim/partida.ts`).
   * AUSENTE enquanto a partida corre. A sim continua andando depois: quem para o jogo e
   * a tela.
   */
  readonly partida?: { readonly fim: 'vitoria' | 'derrota'; readonly tick: number };
  /**
   * C-IA-03b — o tick em que o peacetime acaba (`sim/paz.ts`): em paz enquanto
   * `tick < pazAteTick`. AUSENTE no jogo livre; so a escaramuca o cria. O save nao muda de
   * versao (campo opcional ausente).
   */
  readonly pazAteTick?: number;
  /**
   * C2 — os projeteis no ar (`sim/projeteis.ts`), na ordem em que sairam. AUSENTE quando
   * nenhum voa: o estado sem combate nao carrega o campo, e o save nao muda de versao.
   */
  readonly projeteis?: readonly Projetil[];
  /**
   * D-TRANSPORTE-02a — o menu de distribuicao de cada LADO (chave: o lado, em texto):
   * mercadoria -> tipo de predio -> maximo na gaveta de entrada (`sim/distribuicao.ts`).
   * So o que difere de `delivery.json: distribuicao.padrao`; AUSENTE quando ninguem
   * mexeu, e o save nao muda de versao.
   */
  readonly distribuicao?: Readonly<Record<string, Readonly<Record<string, Readonly<Record<string, number>>>>>>;
}

/**
 * C2 — um projetil no ar. `de` e uma COPIA de quem atirou no instante do tiro: e o que
 * entra na chance de acerto, e vale mesmo se o atirador morrer antes da chegada. A flecha
 * cai em `alvoTile` e atinge quem estiver la (erra quem andou). A pedra da torre persegue
 * `alvoUnidade` (a decisao da F28b: "a pedra nunca erra") e cai no tile dele na chegada.
 */
export interface Projetil {
  readonly projetil: string;
  readonly de: {
    readonly id: string; readonly tipo: string; readonly lado: number;
    readonly gx: number; readonly gy: number; readonly direcao?: number;
  };
  readonly origem: TileDeGrid;
  readonly alvoTile: TileDeGrid;
  /** So a pedra da torre: quem ela persegue. */
  readonly alvoUnidade?: string;
  /** So a pedra da torre: a torre que a lancou (o `por` do `unit-killed`). */
  readonly predio?: string;
  /** Ticks de voo, no total e os que faltam; chega quando `restantes` zera. */
  readonly voo: number;
  readonly restantes: number;
}

/** F28-IA — o tipo de grupo, derivado do dado da tropa (`sim/ia.ts`). */
export type TipoDeGrupo = 'corpoACorpo' | 'antiCavalo' | 'distancia' | 'montado';

/** F28-IA — uma posicao de defesa da IA (ponto 1 do laco do KaM). */
export interface PosicaoDeDefesa {
  readonly id: string;
  readonly ponto: TileDeGrid;
  readonly tipoDeGrupo: TipoDeGrupo;
  /** Ate onde (euclidiano, em tiles, a partir do ponto) a posicao sai para o inimigo. */
  readonly raio: number;
  readonly linha: 'frente' | 'tras';
  /** Os ids dos membros, na ordem em que entraram (a ordem da o tile de cada um). */
  readonly membros: readonly string[];
}

export interface IADoLado {
  readonly posicoes: readonly PosicaoDeDefesa[];
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

/** F13 — o predio que treina civis (chave de `economy.json:schoolhouse`). Id
 *  estrutural, como `ID_DO_ARMAZEM`: os numeros (custo, slots, duracao)
 *  continuam vindo do dado. */
export const ID_DA_ESCOLA = 'schoolhouse';

/** F20a — a Bodega, onde os civis comem (chave de `condition.json:inn`). Id
 *  estrutural, como `ID_DA_ESCOLA`: o teto de comida e a lista de comidas
 *  continuam vindo do dado (`sim/bodega.ts`). */
export const ID_DA_BODEGA = 'inn';

/** F25a — o quartel, id estrutural como os de cima: e ele que forma soldado. */
export const ID_DO_QUARTEL = 'barracks';

/** F25a — o civil que vira soldado no quartel (`units.json: civis.tipos`). */
export const ID_DO_RECRUTA = 'recruit';

/** F13 — a mercadoria que a escola consome. Id estrutural, nao numero. */
export const MERCADORIA_DE_OURO = 'gold';

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

/**
 * F15a — o relogio de producao de um predio recem-nascido. `null` quando o tipo
 * nao tem receita: nao ha o que representar. `tipoId in dados.producao.receitas`
 * e o mesmo teste de "e produtor" que `capacidadeParaTipo` ja usa para dar
 * buffer de entrada e saida — os dois andam juntos de proposito.
 */
function producaoParaTipo(tipoId: string, dados: GameData): Producao | null {
  const receita = dados.producao.receitas[tipoId];
  // F-T2a: nao ha mais nada para semear alem do relogio. O que o predio tem para
  // colher nao nasce com ele — esta no mapa desde o tick 0 e continua la depois
  // que ele for demolido.
  if (receita === undefined) return null;
  // D-PRODUCAO-03a — a oficina que escolhe a saida nasce SEM encomenda: zero em
  // cada saida, e parada ate o jogador encomendar (o KaM, `fWareOrder[I] := 0`).
  // F-REPL-b — quem declara modos nasce no padrao do dado.
  const modo = receita.modos === null ? {} : { modo: receita.modos.padrao };
  if (!receita.escolheSaida) return { progresso: 0, plantio: null, ...modo };
  const cota: Record<string, number> = {};
  for (const m of dados.economia.mercadorias) if (m in receita.sai) cota[m] = 0;
  return { progresso: 0, plantio: null, escolha: { cota, proxima: 0 }, ...modo };
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

/**
 * A obra vira PREDIO COMPLETO (F11c: `hp === def.hp`, decidido por quem chama).
 * `id`/`tipo`/`gx`/`gy`/`hp` sao preservados; nasce com estoque e capacidade do
 * tipo — reusa `capacidadeParaTipo`/`estoqueParaTipo`, o mesmo caminho de
 * `criarPredios`, sem estoque inicial (uma obra nao guarda mercadoria: o custo
 * ja saiu do armazem na entrega, F10). NAO chama `registrarTipoConstruido` — quem
 * chama emite `building-completed`, e a F12 o consome no fim do `step()`
 * (`registrarConclusoes`).
 */
export function completarObra(predio: PredioEmObra, dados: GameData = gameData): PredioCompleto {
  return {
    id: predio.id,
    lado: predio.lado,
    tipo: predio.tipo,
    gx: predio.gx,
    gy: predio.gy,
    estado: 'completo',
    hp: predio.hp,
    capacidade: capacidadeParaTipo(predio.tipo, dados),
    estoque: estoqueParaTipo(predio.tipo, {}),
    ocupante: null,
    producao: producaoParaTipo(predio.tipo, dados),
    pausado: false,
    reparo: false,
  };
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
      lado: LADO_DO_JOGADOR,
      tipo: p.id,
      gx: p.gx,
      gy: p.gy,
      estado: 'completo',
      hp: def.hp,
      capacidade: capacidadeParaTipo(p.id, dados),
      estoque: estoqueParaTipo(p.id, dados.economia.estadoInicial.estoque),
      ocupante: null,
      producao: producaoParaTipo(p.id, dados),
      pausado: false,
      reparo: false,
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
        lado: LADO_DO_JOGADOR,
        tipo,
        gx: spawnDeUnidades.gx + deslocamento,
        gy: spawnDeUnidades.gy,
        fsm: 'ocioso',
        fsmData: {},
        condicao: condicaoCheiaDoTipo(tipo, dados),
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
    estradasPlanejadas: {},
    pedraNoCanteiro: {},
    camposPlanejados: {},
    recursos: recursosIniciais(dados),
    jobs: { tarefas: { porId: {}, ordem: [] } },
    treino: {},
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
