/**
 * `SetBuildingMode` (F-REPL-b): o jogador escolhe se o lenhador so corta ou corta e
 * planta. Um campo (`Producao.modo`), um leitor (`plantaNoModo`, lido pelo rodizio e
 * pelo `tileTrabalhavel`), nenhum estado novo.
 *
 * O que ele NAO faz: nao cancela o plantio em curso. A viagem ja saiu e o tile ja
 * esta reservado; cortar o meio dela seria um release a mais sem ganho, e o modo
 * novo vale para a proxima escolha do rodizio.
 */
import type { Command } from '../commands';
import type { GameData } from '../data/types';
import type { GameState } from '../state';
import { motivoDaRecusaDeModo } from '../modo';
import { comPredio } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

export type SetBuildingMode = Extract<Command, { readonly type: 'SetBuildingMode' }>;

export function aplicarSetBuildingMode(
  state: GameState, comando: SetBuildingMode, dados: GameData,
): ResultadoDeSistema {
  const predio = state.predios.porId[comando.predio];
  const motivo = motivoDaRecusaDeModo(predio, comando.modo, dados);
  if (motivo !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'SetBuildingMode', predio: comando.predio, motivo }],
    };
  }
  // o `motivo === null` ja garantiu predio completo com producao; a guarda
  // explicita e para o TypeScript, como em `systems/pausa.ts`
  if (predio === undefined || predio.estado !== 'completo' || predio.producao === null) return { state, events: [] };
  // idempotente: o mesmo valor devolve o MESMO estado, sem evento
  if (predio.producao.modo === comando.modo) return { state, events: [] };
  return {
    state: comPredio(state, { ...predio, producao: { ...predio.producao, modo: comando.modo } }),
    events: [],
  };
}
