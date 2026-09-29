/**
 * F23b — salvar e carregar a partida pelo jogo. Mora no laco externo, ao lado da
 * `Sessao`: e quem tem o estado e quem pode troca-lo. TypeScript puro, sem DOM —
 * a gaveta (`localStorage` no navegador) entra por parametro, e o teste headless
 * passa uma de mentira (`tests/F23b-arquivo-da-partida.test.ts`).
 *
 * O formato e a garantia sao da F23 (`sim/save.ts`): aqui so se decide ONDE o
 * texto fica e o que o jogador ouve quando da errado. Toda recusa de `carregar`
 * deixa a partida em curso intocada.
 */
import type { Sessao } from './sessao';
import { carregar, salvar } from './sim/save';
import type { GameData } from './sim/data/types';
import { gameData } from './sim/data';

/** O pedaco do `Storage` que o arquivo usa. */
export interface Gaveta {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

/** Uma partida so, sempre na mesma chave: a F23b entrega o gesto, nao os slots. */
export const CHAVE_DO_SAVE = 'cangaco:partida';

export type ResultadoDoArquivo =
  | { readonly ok: true; readonly acao: 'salvou' | 'carregou' | 'escaramuca'; readonly tick: number }
  /** `sem-save`: nada na gaveta. `recusado`: `carregar` recusou, com o motivo dele.
   *  `gaveta`: o navegador nao guardou (cota cheia, armazenamento bloqueado). */
  | { readonly ok: false; readonly causa: 'sem-save' | 'recusado' | 'gaveta'; readonly detalhe: string };

export interface ArquivoDaPartida {
  salvar(): ResultadoDoArquivo;
  carregar(): ResultadoDoArquivo;
}

const PREFIXO_DA_RECUSA = 'carregar: ';

function mensagemDe(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro);
  return texto.startsWith(PREFIXO_DA_RECUSA) ? texto.slice(PREFIXO_DA_RECUSA.length) : texto;
}

export function criarArquivoDaPartida(sessao: Sessao, gaveta: Gaveta, dados: GameData = gameData): ArquivoDaPartida {
  return {
    salvar() {
      const estado = sessao.estado;
      try {
        gaveta.setItem(CHAVE_DO_SAVE, salvar(estado, dados));
      } catch (erro) {
        return { ok: false, causa: 'gaveta', detalhe: mensagemDe(erro) };
      }
      return { ok: true, acao: 'salvou', tick: estado.tick };
    },
    carregar() {
      let texto: string | null;
      try {
        texto = gaveta.getItem(CHAVE_DO_SAVE);
      } catch (erro) {
        return { ok: false, causa: 'gaveta', detalhe: mensagemDe(erro) };
      }
      if (texto === null) return { ok: false, causa: 'sem-save', detalhe: '' };
      let estado;
      try {
        estado = carregar(texto, dados);
      } catch (erro) {
        return { ok: false, causa: 'recusado', detalhe: mensagemDe(erro) };
      }
      sessao.substituir(estado);
      return { ok: true, acao: 'carregou', tick: estado.tick };
    },
  };
}
