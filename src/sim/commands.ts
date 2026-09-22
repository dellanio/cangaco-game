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
    };
