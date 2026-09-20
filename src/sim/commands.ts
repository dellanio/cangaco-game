/**
 * Comandos que o jogador pode emitir: uniao discriminada por `type`. Entram no
 * `step()` como lista, na ordem em que o jogador os emitiu.
 *
 * Nasceu vazia (`never`) na F02, para nao ter comando morto; a F07 acrescentou o
 * primeiro. O `switch` em `step()` (`tick.ts`) fecha com `default` atribuindo a
 * `never`: acrescentar um membro aqui sem tratar la reprova o `typecheck`.
 */
export type Command = {
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
};
