/**
 * E-TELA-MENU-INICIAL — de onde a partida nasce. Laco externo, como a `Sessao` e o
 * `arquivo-da-partida`: TypeScript puro, sem DOM, testavel headless
 * (`tests/E-TELA-MENU-INICIAL.test.ts`).
 *
 * O menu (`ui/menu-inicial.ts`) so devolve a ESCOLHA; quem a transforma num `GameState` e
 * este arquivo, e o `main.ts` so recebe o estado pronto. Por isso a escaramuca do menu e a do
 * `?escaramuca` sao o mesmo estado: as duas passam por `estadoDaEscolha`.
 *
 * A regra da URL: sem parametro nenhum, o menu. Com qualquer parametro (`?pausado`,
 * `?escaramuca`, os dos roteiros), o jogo de antes, direto, sem uma linha de roteiro mudar.
 * `?menu` e a excecao: forca o menu mesmo com outros parametros, para o roteiro do menu poder
 * nascer pausado (`?menu&pausado`) e comparar o tick 0.
 */
import { createInitialState } from './sim/state';
import type { GameState } from './sim/state';
import { criarEscaramuca } from './sim/cenario';
import type { GameData } from './sim/data/types';
import { gameData } from './sim/data';
import { lerUltimoSave } from './arquivo-da-partida';
import type { Gaveta, LeituraDoSave } from './arquivo-da-partida';

export type EscolhaDaPartida =
  | { readonly modo: 'livre' }
  | { readonly modo: 'escaramuca' }
  /** O ultimo save (o Continuar do menu). */
  | { readonly modo: 'continuar' };

/** `true` quando a pagina abre no menu. */
export function abreNoMenu(busca: string): boolean {
  const parametros = new URLSearchParams(busca);
  return parametros.has('menu') || [...parametros.keys()].length === 0;
}

/** A partida que a URL pede quando nao ha menu: a de sempre (`main.ts` antes do menu). */
export function escolhaDaUrl(busca: string): EscolhaDaPartida {
  return new URLSearchParams(busca).has('escaramuca') ? { modo: 'escaramuca' } : { modo: 'livre' };
}

export type EstadoDaEscolha =
  | { readonly ok: true; readonly estado: GameState }
  | { readonly ok: false; readonly leitura: Exclude<LeituraDoSave, { ok: true }> };

/** O tick 0 de uma partida nova. A semente e a do dado, como sempre foi. */
export function estadoNovo(modo: 'livre' | 'escaramuca', dados: GameData = gameData): GameState {
  const semente = dados.economia.estadoInicial.semente;
  return modo === 'escaramuca' ? criarEscaramuca(semente, dados) : createInitialState(semente, dados);
}

/** O estado de cada escolha: a partida nova, ou o ultimo save (que pode ser recusado). */
export function estadoDaEscolha(escolha: EscolhaDaPartida, gaveta: Gaveta | null, dados: GameData = gameData): EstadoDaEscolha {
  if (escolha.modo !== 'continuar') return { ok: true, estado: estadoNovo(escolha.modo, dados) };
  const leitura = lerUltimoSave(gaveta, dados);
  return leitura.ok ? { ok: true, estado: leitura.estado } : { ok: false, leitura };
}
