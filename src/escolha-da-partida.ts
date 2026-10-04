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
import { NIVEL_PADRAO } from './sim/ia';
import type { GameData } from './sim/data/types';
import { gameData } from './sim/data';
import { lerGaveta, lerUltimoSave } from './arquivo-da-partida';
import type { Gaveta, LeituraDoSave, NumeroDaGaveta } from './arquivo-da-partida';

export type EscolhaDaPartida =
  | { readonly modo: 'livre' }
  /** I-TELA-PARTIDA-GUIADA — o Aprender a jogar: o MESMO estado do jogo livre; a faixa de passos e
   *  so da tela, e a sim nao sabe dela. */
  | { readonly modo: 'guiada' }
  /** E-TELA-CONFIGURAR-PARTIDA — a paz escolhida, em minutos base do dado; ausente, o padrao. */
  | { readonly modo: 'escaramuca'; readonly pazMinBase?: number; readonly nivel?: string }
  /** O ultimo save (o Continuar do menu). */
  | { readonly modo: 'continuar' }
  /** E-SAVE-GAVETAS — uma gaveta escolhida no Carregar. */
  | { readonly modo: 'carregar'; readonly gaveta: NumeroDaGaveta };

/** `true` quando a pagina abre no menu. */
export function abreNoMenu(busca: string): boolean {
  const parametros = new URLSearchParams(busca);
  return parametros.has('menu') || [...parametros.keys()].length === 0;
}

/** A partida que a URL pede quando nao ha menu: a de sempre (`main.ts` antes do menu). */
export function escolhaDaUrl(busca: string): EscolhaDaPartida {
  const parametros = new URLSearchParams(busca);
  if (parametros.has('escaramuca')) return { modo: 'escaramuca' };
  // I-TELA-PARTIDA-GUIADA: `?guiada`, para o roteiro nascer com a faixa sem passar pelo menu
  return parametros.has('guiada') ? { modo: 'guiada' } : { modo: 'livre' };
}

export type EstadoDaEscolha =
  | { readonly ok: true; readonly estado: GameState }
  | { readonly ok: false; readonly leitura: Exclude<LeituraDoSave, { ok: true }> };

export type PartidaNova = Extract<EscolhaDaPartida, { readonly modo: 'livre' | 'guiada' | 'escaramuca' }>;

/** O tick 0 de uma partida nova. A semente e a do dado, como sempre foi. */
export function estadoNovo(escolha: PartidaNova, dados: GameData = gameData): GameState {
  const semente = dados.economia.estadoInicial.semente;
  if (escolha.modo === 'livre' || escolha.modo === 'guiada') return createInitialState(semente, dados);
  return criarEscaramuca(semente, dados, {
    ...(escolha.pazMinBase === undefined ? {} : { pazMinBase: escolha.pazMinBase }),
    // F-IA-DIFICULDADE: o nivel do adversario; ausente, o normal
    ...(escolha.nivel === undefined ? {} : { nivel: escolha.nivel }),
  });
}

/** E-TELA-CONFIGURAR-PARTIDA — as opcoes da paz como a tela as mostra: o valor do dado (o que volta
 *  na escolha), a duracao em SEGUNDOS DE JOGO (os ticks convertidos, nao os minutos base) e o padrao.
 *  O menu nao le `sim/data`: recebe esta lista. */
export interface OpcaoDePazNaTela {
  readonly valor: number;
  readonly segundos: number;
  readonly padrao: boolean;
}

export function opcoesDePazNaTela(dados: GameData = gameData): OpcaoDePazNaTela[] {
  return dados.escaramuca.opcoesDePaz.map((o) => ({
    valor: o.minBase,
    segundos: o.ticks / dados.tempo.tickHz,
    padrao: o.minBase === dados.escaramuca.peacetime_min_base,
  }));
}

/** F-IA-DIFICULDADE — os niveis do adversario como a tela os mostra: a chave do dado (o que volta
 *  na escolha), na ordem de `combat.json: ia.niveis`, e qual e o padrao. O menu nao le `sim/data`. */
export interface OpcaoDeNivelNaTela {
  readonly valor: string;
  readonly padrao: boolean;
}

export function opcoesDeNivelNaTela(dados: GameData = gameData): OpcaoDeNivelNaTela[] {
  return Object.keys(dados.combate.niveisDaIA).map((valor) => ({ valor, padrao: valor === NIVEL_PADRAO }));
}

/** O estado de cada escolha: a partida nova, o ultimo save ou uma gaveta (que podem ser recusados). */
export function estadoDaEscolha(escolha: EscolhaDaPartida, gaveta: Gaveta | null, dados: GameData = gameData): EstadoDaEscolha {
  if (escolha.modo === 'livre' || escolha.modo === 'guiada' || escolha.modo === 'escaramuca') return { ok: true, estado: estadoNovo(escolha, dados) };
  const leitura = escolha.modo === 'carregar' ? lerGaveta(gaveta, escolha.gaveta, dados) : lerUltimoSave(gaveta, dados);
  return leitura.ok ? { ok: true, estado: leitura.estado } : { ok: false, leitura };
}
