/**
 * `SetBuildingPaused` (F16c): o jogador para a producao de UM predio.
 *
 * O sistema inteiro e o que se le abaixo, e e de proposito. Pausar congela o
 * RELOGIO do ciclo e nada mais (decisao do operador, 2026-09-23 —
 * `docs/planos/F16c-pausar.md` §3): um campo, um leitor (o `produzir` de
 * `systems/especialistas.ts`), nenhum estado novo.
 *
 * O que ele NAO faz, e por que:
 * - nao mexe na gaveta `saida`: o nivel 6 da escada continua escoando o que ja
 *   foi produzido; congelar criaria mercadoria que nenhuma regra libera;
 * - nao cancela nem impede tarefa de transporte: o destino de uma tarefa de
 *   insumo e validado pelo TIPO do predio (`motivoDoDestino`, `systems/jobs.ts`),
 *   que a pausa nao muda — nao ha tarefa orfa a sanear. E zerar o alvo de
 *   entrada faria o estoque virar excedente e voltar ao armazem pelo nivel 7:
 *   pausar e despausar mandaria a mesma mercadoria de ida e de volta;
 * - nao solta o ocupante: predio pausado e vago ANUNCIARIA vaga e puxaria um
 *   especialista para sentar parado, tirando-o de um predio que produziria.
 */
import type { Command } from '../commands';
import type { GameState } from '../state';
import { motivoDaRecusaDePausa } from '../pausa';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type SetBuildingPaused = Extract<Command, { readonly type: 'SetBuildingPaused' }>;

export function aplicarSetBuildingPaused(
  state: GameState, comando: SetBuildingPaused,
): ResultadoDeSistema {
  const predio = state.predios.porId[comando.predio];
  const motivo = motivoDaRecusaDePausa(predio);
  if (motivo !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'SetBuildingPaused', predio: comando.predio, motivo }],
    };
  }
  // o `motivo === null` ja garantiu predio completo; o TypeScript nao estreita
  // por uma funcao que devolve motivo, entao a guarda fica explicita aqui
  if (predio === undefined || predio.estado !== 'completo') return { state, events: [] };
  // idempotente: o mesmo valor devolve o MESMO estado, sem evento. Molde de
  // `sanearOcupacao` e de `comFsm` (`systems/especialistas.ts`).
  if (predio.pausado === comando.pausado) return { state, events: [] };
  return {
    state: comPredio(state, { ...predio, pausado: comando.pausado }),
    events: [],
  };
}
