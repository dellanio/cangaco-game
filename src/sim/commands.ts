/**
 * Comandos que o jogador pode emitir. Sera uma uniao discriminada por `type`.
 *
 * A F02 define o contrato, nao os comandos: a uniao nasce vazia. `never`
 * em vez de um `noop` de mentira — comando morto sobrevive ao projeto
 * inteiro e nunca mais e removido.
 *
 * A F07 (posicionar planta) acrescenta o primeiro membro:
 *   export type Command =
 *     | { readonly type: 'place-building'; ... };
 */
export type Command = never;
