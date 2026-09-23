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
       * Constroi estrada sobre `tiles` (um arrasto = um comando). Tudo ou nada: um
       * tile invalido recusa o comando inteiro. DEBITA pedra no comando, do
       * armazem (F08: a estrada nao tem canteiro nem viagem de material; ver a Nota
       * de desvio no item F08 do BUILD_PLAN). Tile que ja e estrada nao custa.
       */
      readonly type: 'PlaceRoad';
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
    };
