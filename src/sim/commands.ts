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
    };
