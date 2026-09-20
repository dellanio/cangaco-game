/**
 * O JobBoard (CLAUDE.md §5): criacao, `reclamar` (claim), `liberar` (release) e a
 * reserva dupla — a unidade de recurso na origem e a vaga no destino. Pure: recebe
 * o estado, devolve o estado novo.
 */

/**
 * Por que uma tarefa reclamada foi liberada. Cada motivo devolve as DUAS reservas
 * (e a reserva e derivada da tarefa, entao nao ha como devolver so uma).
 *
 *  - reabrem a MESMA tarefa (falha so da unidade): `unidade-removida`,
 *    `pedido-da-unidade`;
 *  - CANCELAM a tarefa (origem, caminho ou destino ja nao valem; o gerador cria outra
 *    com a origem certa): `caminho-cortado`, `origem-sumiu`, `origem-sem-recurso`,
 *    `destino-sumiu`, `destino-completo`.
 */
export type MotivoDeLiberacao =
  | 'unidade-removida'
  | 'pedido-da-unidade'
  | 'caminho-cortado'
  | 'origem-sumiu'
  | 'origem-sem-recurso'
  | 'destino-sumiu'
  | 'destino-completo';
