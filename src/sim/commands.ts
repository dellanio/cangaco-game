import type { TileDeGrid } from './estradas';

/**
 * Comandos que o jogador pode emitir: uniao discriminada por `type`. Entram no
 * `step()` como lista, na ordem em que o jogador os emitiu.
 *
 * Nasceu vazia (`never`) na F02; a F07 acrescentou o primeiro membro e a F08 os
 * dois de estrada. O `switch` em `step()` (`tick.ts`) fecha com `default`
 * atribuindo a `never`: acrescentar um membro aqui sem tratar la reprova o
 * `typecheck`.
 */
export type Command =
  | {
      /**
       * Posiciona a planta de um predio. Cria uma obra pendente (HP 0, materiais
       * faltando) se `canPlace` aceitar; senao o estado nao muda e o tick emite um
       * evento `command-rejected`. NAO debita estoque: o custo sai na entrega (F10).
       */
      readonly type: 'PlaceBlueprint';
      readonly buildingId: string;
      /** Canto superior esquerdo do footprint (mesma convencao de `canPlace`). */
      readonly gx: number;
      readonly gy: number;
    }
  | {
      /**
       * Pede estrada sobre `tiles` (um arrasto = um comando). Tudo ou nada quanto ao
       * CHAO: um tile invalido (fora do mapa, terreno, recurso, predio) recusa o
       * comando inteiro. Quanto a PEDRA, nada: desde a F18g o comando desenha o
       * canteiro (`estradasPlanejadas`) sem pagador, a pedra viaja ate cada tile na
       * mao de um serf (`pedra-para-canteiro`) e o laborer assenta quando ela chega.
       * (F08 debitava aqui; F18d-1b reservava aqui e recusava `sem-pedra`; os dois
       * desvios acabaram.) Tile que ja e estrada ou canteiro nao custa nem recusa.
       */
      readonly type: 'PlaceRoad';
      readonly tiles: readonly TileDeGrid[];
    }
  | {
      /**
       * F18h — manda ARAR `tiles` para a cultura `recurso` (um arrasto e um
       * comando). Tudo ou nada, como o `PlaceRoad`: um tile invalido recusa o
       * trecho inteiro com `command-rejected` e o motivo. Tile que ja esta no
       * canteiro nao custa e nao recusa.
       *
       * NAO cria o campo: escreve o pedido em `camposPlanejados` e abre uma tarefa
       * de aradura por tile. Quem ara e o laborer, tile por tile, e e na aradura
       * que o tile entra em `state.recursos` — em POUSIO, por semear. `recurso` e
       * o id NEUTRO da cultura (`corn`), e so vale tipo com bloco `aradura` em
       * `data/resources.json`.
       */
      readonly type: 'PlowField';
      readonly recurso: string;
      readonly tiles: readonly TileDeGrid[];
    }
  | {
      /**
       * F18i — a BORRACHA do campo: tira de `camposPlanejados` os tiles que o
       * jogador desenhou e nao quer mais. Nunca e recusado, nao devolve nada (nada
       * foi gasto: arar nao cobra material) e tile fora do canteiro e no-op. E o
       * ramo DESENHADO do `DemolishRoad`, e so ele.
       *
       * NAO apaga campo ja ARADO, de proposito: tile arado e recurso do tile, e
       * recurso nao se remove por comando — a mesma regra que vale para a rocha do
       * lajedo. O nome diz o alcance: `UnplanField`, e nao `DemolishField`.
       *
       * A tarefa de arar do tile apagado nao e cancelada aqui: ela perde o destino e
       * `sanearTarefas` a derruba com `'destino-sumiu'` no mesmo tick, devolvendo o
       * laborer a `ocioso`. Um caminho de volta so, para o tile que o jogador apagou
       * e para o que sumiu por qualquer outro motivo.
       */
      readonly type: 'UnplanField';
      readonly tiles: readonly TileDeGrid[];
    }
  | {
      /**
       * Demole os tiles de estrada de `tiles`; o que nao e estrada e ignorado.
       * Devolve `floor(removidos * terreno.estrada.devolucaoAoDemolir)` de pedra ao
       * armazem de onde sairia o debito. Nunca e recusado.
       */
      readonly type: 'DemolishRoad';
      readonly tiles: readonly TileDeGrid[];
    }
  | {
      /**
       * Demole o predio `predio`, em obra ou completo (F16a). Devolve
       * `floor(construcao.devolucaoAoDemolir * material ja entregue)` MAIS o
       * estoque interno inteiro, ao armazem completo mais proximo ALCANCAVEL por
       * estrada; sem armazem alcancavel a carga se perde. Nunca e recusado: id
       * inexistente e no-op, como no `DemolishRoad` e no `CancelTraining`.
       *
       * So tira o predio do estado. Quem cancela as tarefas ligadas a ele, apaga
       * a fila de treino e devolve o ocupante a `ocioso` e o saneamento do MESMO
       * tick (`sanearTarefas`, `sanearFilas`, `passoProduzindo`) — a demolicao
       * nao reimplementa nada disso.
       */
      readonly type: 'DemolishBuilding';
      readonly predio: string;
    }
  | {
      /**
       * Enfileira UM pedido de treino na escola `predio` (F13). NAO debita ouro: o
       * custo sai quando o treino COMECA (`systems/escolas.ts`) — e a fila em espera
       * que cria a demanda de ouro do JobBoard. Recusado (evento `command-rejected`)
       * se o predio nao e escola completa, se a fila esta no teto de
       * `economy.schoolhouse.slotsDeFila` ou se `unidade` nao e um civil conhecido.
       */
      readonly type: 'EnqueueTraining';
      readonly predio: string;
      /** Id do civil em data/units.json civis.tipos. */
      readonly unidade: string;
    }
  | {
      /**
       * Tira um item da fila de treino (F13). Nunca e recusado: item ou escola
       * inexistentes sao no-op, como no `DemolishRoad`. Nao devolve ouro — o item
       * que espera nunca pagou, e o que treina ja gastou.
       */
      readonly type: 'CancelTraining';
      readonly predio: string;
      /** Id do item (`f<numero>`), nao a posicao na fila. */
      readonly item: string;
    }
  | {
      /**
       * F16c — pausa ou despausa a PRODUCAO do predio `predio`. Pausado, o
       * relogio do ciclo congela e nada mais muda: a gaveta `saida` continua
       * escoando, as tarefas de transporte continuam valendo e o ocupante fica
       * (`docs/planos/F16c-pausar.md` §3). Recusado (`command-rejected`) se o
       * predio nao existe ou ainda esta em obra.
       *
       * `pausado` e o VALOR, nao um alternador: reenviar o comando, ou manda-lo
       * duas vezes no mesmo tick, nao pode inverter o estado — o botao da F16b
       * manda o que ele representa. Comando com o valor que o predio ja tem e
       * no-op: devolve o MESMO estado e nao emite nada.
       */
      readonly type: 'SetBuildingPaused';
      readonly predio: string;
      readonly pausado: boolean;
    }
  | {
      /**
       * F-REPL-b — o modo de trabalho do predio `predio` (o lenhador: `cortar` ou
       * `cortar_e_plantar`). O nome e chave de `modos` na receita, e o gatilho e o
       * DADO: qualquer predio que declare `modos` aceita, nenhum tipo esta digitado.
       * Recusado (`command-rejected`) se o predio nao existe, esta em obra, nao tem
       * modos ou o modo nao e dele.
       *
       * `modo` e o VALOR, nao um alternador, como `SetBuildingPaused`: o modo que o
       * predio ja tem e no-op e devolve o MESMO estado. A viagem de plantio em curso
       * termina; o modo novo vale para a proxima escolha do rodizio.
       */
      readonly type: 'SetBuildingMode';
      readonly predio: string;
      readonly modo: string;
    }
  | {
      /**
       * F24a — fixa a cota da oficina `predio` (GDD §2.3, "quantas de cada arma
       * produzir"). A cota e o PESO de cada saida no rodizio: `{ lance: 1 }` faz
       * so aguilhada; `{ hand_axe: 2, longbow: 1 }` faz dois facoes para cada
       * bodoque. Saida omitida vale zero. Recusado (`command-rejected`) se o
       * predio nao existe, esta em obra, nao escolhe a saida, se a cota nomeia o
       * que a receita nao faz, tem valor que nao e inteiro >= 0, ou e toda zero.
       */
      readonly type: 'SetProductionQuota';
      readonly predio: string;
      readonly cota: Readonly<Record<string, number>>;
    }
  | {
      /**
       * F-CERCO-a2 — manda `unidades` (militares) atacarem o predio `predio`. A tropa
       * anda ate encostar e golpeia na cadencia PROPRIA do golpe em predio
       * (`combate.ataqueAPredio`), nunca sozinha: sem esta ordem nenhum soldado toca em
       * predio (KaM, `gicArmyAttackHouse`). Recusado INTEIRO (`command-rejected`, o
       * estado nao muda) se o predio nao existe, a lista e vazia, ou alguma unidade nao
       * existe, nao e militar, atira a distancia ou e do mesmo lado do predio.
       */
      readonly type: 'AttackBuilding';
      readonly unidades: readonly string[];
      readonly predio: string;
    }
  | {
      /**
       * F-CERCO-b — liga ou desliga o REPARO do predio `predio` (GDD, "ligar/desligar
       * reparo"). Nasce desligado. Ligado e danificado, o predio pede laborer no
       * JobBoard; desligar no meio derruba a tarefa no saneamento do mesmo tick.
       * `ligado` e o VALOR, como em `SetBuildingPaused`: o mesmo valor e no-op.
       * Recusado (`command-rejected`) se o predio nao existe ou esta em obra.
       */
      readonly type: 'SetBuildingRepair';
      readonly predio: string;
      readonly ligado: boolean;
    }
  | {
      /**
       * D-TRANSPORTE-01a — o armazem `predio` passa a aceitar (`aceita: true`) ou a
       * bloquear a `mercadoria` que a vila manda para armazem (niveis 6 e 7). `aceita` e o
       * VALOR, como em `SetBuildingRepair`: o mesmo valor e no-op. Recusado
       * (`command-rejected`) se o predio nao existe, nao e armazem completo ou a
       * mercadoria nao esta em `economia.mercadorias`.
       */
      readonly type: 'SetStorehouseAccept';
      readonly predio: string;
      readonly mercadoria: string;
      readonly aceita: boolean;
    }
  | {
      /**
       * D-TRANSPORTE-02a — o menu de distribuicao: o maximo de `mercadoria` que um predio
       * do `tipo` quer na gaveta de entrada, no lado do jogador. `quantidade` e o VALOR:
       * o mesmo valor e no-op. Recusado (`command-rejected`) se o par nao esta em
       * `delivery.json: distribuicao.padrao` ou a quantidade nao e inteiro em `0..maximo`.
       */
      readonly type: 'SetWareDistribution';
      readonly mercadoria: string;
      readonly tipo: string;
      readonly quantidade: number;
    }
  | {
      /**
       * F25a — forma UM soldado do tipo `tipo` no quartel `predio`, na hora: consome 1
       * de cada requisito da gaveta `entrada` (`units.json: militares.tipos[].requisitos`)
       * e 1 recruta, e a unidade nasce na porta no mesmo tick, com o lado do quartel.
       * Recusado (`command-rejected`, o estado nao muda) se o predio nao e quartel
       * completo, o tipo nao e militar do dado, falta requisito, falta recruta ou a
       * porta esta bloqueada. Mercenario nao e daqui: e da Prefeitura (F36).
       */
      readonly type: 'TrainSoldier';
      readonly predio: string;
      readonly tipo: string;
    }
  | {
      /**
       * F26a — manda `unidades` (militares, do mesmo lado) marcharem ate `destino`. A ordem
       * nova substitui a anterior, inclusive o ataque. Recusado INTEIRO (`command-rejected`,
       * o estado nao muda) se a lista e vazia, alguma unidade nao existe ou nao e
       * militar, os lados diferem, o destino esta fora do mapa ou nao e andavel, ou
       * `direcao`/`colunas` nao sao inteiros validos (C-COMBATE-01a).
       *
       * C-COMBATE-01a (formação e virar) — os homens tomam fileiras de `colunas`, de frente
       * para `direcao`, com o centro da primeira fileira no destino e o primeiro da lista
       * (o lider) nela; ao chegar, viram para `direcao` (`systems/marcha.ts`). Com o destino
       * no tile do lider, e o "virar sem mover".
       */
      readonly type: 'MoveUnits';
      readonly unidades: readonly string[];
      readonly destino: TileDeGrid;
      /** 0..7 (`Unidade.direcao`). Ausente: a do lider ate o destino. */
      readonly direcao?: number;
      /** Homens por fileira; preso a `[formacao.colunasMin, n]`. Ausente: a raiz de n, para cima. */
      readonly colunas?: number;
    }
  | {
      /**
       * C-COMBATE-01b (storm attack) — `unidades` carregam em linha reta para a frente do
       * primeiro da lista, por uma distancia sorteada, mais rapido que a marcha e sem aceitar
       * ordem ate acabar (`systems/carga.ts`). So carrega quem `stormAttack.apenas` admite; os
       * outros da lista ficam como estao. Recusado INTEIRO se a lista e vazia, alguma unidade
       * nao existe ou nao e militar, os lados diferem, ou nenhuma pode carregar.
       */
      readonly type: 'StormAttack';
      readonly unidades: readonly string[];
    }
  | {
      /**
       * C-COMIDA-01 (fome militar com o Feed) — o Feed do grupo `unidades` (militares do
       * mesmo lado). Cada um PEDE comida se estiver abaixo de `ticksPedeComida` e ainda nao
       * tiver pedido: um serf levara uma. Recusado INTEIRO (`command-rejected`, o estado nao
       * muda) se a lista e vazia, alguma unidade nao existe ou nao e militar, os lados
       * diferem, ou ninguem esta com fome (`sem-fome`).
       */
      readonly type: 'FeedUnits';
      readonly unidades: readonly string[];
    }
  | {
      /**
       * F28a — manda `unidades` (militares corpo a corpo) perseguirem e golpearem a
       * unidade `alvo`, de outro lado e com HP (militar ou mercenario). A ordem nova
       * substitui a anterior. Recusado INTEIRO (`command-rejected`, o estado nao muda)
       * se a lista e vazia, o alvo nao existe, nao tem HP ou e do mesmo lado, ou alguma
       * unidade nao existe, nao e militar ou atira a distancia (o arqueiro e da F28d).
       */
      readonly type: 'AttackUnit';
      readonly unidades: readonly string[];
      readonly alvo: string;
    }
  | {
      /**
       * F35 — a ordem permanente da feira `predio`: trocar `da` (A) por `para` (B) ate
       * `quantidade` de B, a `economy.marketplace.taxa` unidades de A por uma de B.
       * Quantidade 0 cancela. Uma ordem por feira: a nova substitui a velha. Recusado
       * (`command-rejected`) se o predio nao e feira completa, A = B, a mercadoria nao
       * esta em `economia.mercadorias` ou a quantidade nao e inteira >= 0.
       */
      readonly type: 'SetTrade';
      readonly predio: string;
      readonly da: string;
      readonly para: string;
      readonly quantidade: number;
    }
  | {
      /**
       * F36 — contrata um mercenario `tipo` (`units.json: mercenarios`) na Prefeitura
       * `predio`: debita `custoOuro` da gaveta de entrada e a unidade nasce na porta no
       * mesmo tick. Recusado (`command-rejected`) se o predio nao e Prefeitura completa,
       * o tipo nao e mercenario, falta ouro ou a porta esta bloqueada.
       */
      readonly type: 'HireMercenary';
      readonly predio: string;
      readonly tipo: string;
    };
