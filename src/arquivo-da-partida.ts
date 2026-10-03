/**
 * F23b — salvar e carregar a partida pelo jogo. Mora no laco externo, ao lado da
 * `Sessao`: e quem tem o estado e quem pode troca-lo. TypeScript puro, sem DOM —
 * a gaveta (`localStorage` no navegador) entra por parametro, e o teste headless
 * passa uma de mentira (`tests/F23b-arquivo-da-partida.test.ts`).
 *
 * O formato e a garantia sao da F23 (`sim/save.ts`): aqui so se decide ONDE o
 * texto fica e o que o jogador ouve quando da errado. Toda recusa de `carregar`
 * deixa a partida em curso intocada.
 *
 * E-SAVE-GAVETAS — tres gavetas. A gaveta 1 e a chave da F23b (`cangaco:partida`), sem mudar
 * nada: o save de quem ja tinha um E a gaveta 1, sem migracao. A 2 e a 3 sao `cangaco:partida:2`
 * e `:3`, com o mesmo texto da F23. O que nao cabe no save (o tipo da partida, a data e qual
 * gaveta foi salva por ultimo) mora num indice a parte, `cangaco:gavetas`. A DATA vem do relogio
 * que quem cria o arquivo injeta (o laco externo, `main.ts`), nunca da `sim/`.
 */
import type { Sessao } from './sessao';
import type { GameState } from './sim/state';
import { carregar, salvar } from './sim/save';
import type { GameData } from './sim/data/types';
import { gameData } from './sim/data';

/** O pedaco do `Storage` que o arquivo usa. */
export interface Gaveta {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
}

/** A gaveta 1: a chave da F23b, que continua sendo a dela. */
export const CHAVE_DO_SAVE = 'cangaco:partida';
/** E-SAVE-GAVETAS — o indice: tipo e data de cada gaveta, e a ultima salva. */
export const CHAVE_DO_INDICE = 'cangaco:gavetas';
/** Quantas gavetas a tela oferece. Numero de interface, nao de jogo. */
export const GAVETAS = [1, 2, 3] as const;
export type NumeroDaGaveta = (typeof GAVETAS)[number];

export function chaveDaGaveta(n: NumeroDaGaveta): string {
  return n === 1 ? CHAVE_DO_SAVE : `${CHAVE_DO_SAVE}:${n}`;
}

/** O tipo da partida guardada: o "nome" da gaveta, que a tela traduz pelo tema. */
export type TipoDaPartida = 'escaramuca' | 'livre';

export function tipoDaPartida(estado: GameState): TipoDaPartida {
  return estado.pazAteTick === undefined ? 'livre' : 'escaramuca';
}

interface EntradaDoIndice {
  readonly tipo: TipoDaPartida;
  /** ISO 8601, do relogio do laco externo. */
  readonly data: string;
}

interface Indice {
  readonly ultima: NumeroDaGaveta | null;
  readonly gavetas: Partial<Record<string, EntradaDoIndice>>;
}

const INDICE_VAZIO: Indice = { ultima: null, gavetas: {} };

function ehNumeroDaGaveta(v: unknown): v is NumeroDaGaveta {
  return (GAVETAS as readonly unknown[]).includes(v);
}

/** O indice, ou o vazio se ele falta ou nao se le: indice ruim nunca derruba o menu. */
function lerIndice(gaveta: Gaveta): Indice {
  try {
    const texto = gaveta.getItem(CHAVE_DO_INDICE);
    if (texto === null) return INDICE_VAZIO;
    const cru = JSON.parse(texto) as { ultima?: unknown; gavetas?: unknown };
    const gavetas = typeof cru.gavetas === 'object' && cru.gavetas !== null ? cru.gavetas as Indice['gavetas'] : {};
    return { ultima: ehNumeroDaGaveta(cru.ultima) ? cru.ultima : null, gavetas };
  } catch {
    return INDICE_VAZIO;
  }
}

export type ResultadoDoArquivo =
  | { readonly ok: true; readonly acao: 'salvou' | 'carregou' | 'escaramuca'; readonly tick: number }
  /** `sem-save`: nada na gaveta. `recusado`: `carregar` recusou, com o motivo dele.
   *  `gaveta`: o navegador nao guardou (cota cheia, armazenamento bloqueado). */
  | { readonly ok: false; readonly causa: 'sem-save' | 'recusado' | 'gaveta'; readonly detalhe: string };

export interface ArquivoDaPartida {
  /** Guarda na gaveta `n` (1 se omitida, como na F23b) e a marca como a ultima. */
  salvar(n?: NumeroDaGaveta): ResultadoDoArquivo;
  /** Retoma a gaveta `n` (1 se omitida). */
  carregar(n?: NumeroDaGaveta): ResultadoDoArquivo;
  /** O que cada gaveta tem agora, para a tela. */
  gavetas(): SituacaoDaGaveta[];
}

const PREFIXO_DA_RECUSA = 'carregar: ';

function mensagemDe(erro: unknown): string {
  const texto = erro instanceof Error ? erro.message : String(erro);
  return texto.startsWith(PREFIXO_DA_RECUSA) ? texto.slice(PREFIXO_DA_RECUSA.length) : texto;
}

/**
 * E-TELA-MENU-INICIAL — le um save sem tocar em sessao nenhuma: e o que o menu usa para saber
 * se o Continuar abre (e por que nao), antes de o jogo existir. `gaveta` nula e o navegador sem
 * armazenamento. O `carregar` do jogo passa por aqui tambem.
 */
export type LeituraDoSave =
  | { readonly ok: true; readonly estado: GameState }
  | { readonly ok: false; readonly causa: 'sem-save' | 'recusado' | 'gaveta'; readonly detalhe: string };

export function lerGaveta(gaveta: Gaveta | null, n: NumeroDaGaveta, dados: GameData = gameData): LeituraDoSave {
  if (gaveta === null) return { ok: false, causa: 'gaveta', detalhe: '' };
  let texto: string | null;
  try {
    texto = gaveta.getItem(chaveDaGaveta(n));
  } catch (erro) {
    return { ok: false, causa: 'gaveta', detalhe: mensagemDe(erro) };
  }
  if (texto === null) return { ok: false, causa: 'sem-save', detalhe: '' };
  try {
    return { ok: true, estado: carregar(texto, dados) };
  } catch (erro) {
    return { ok: false, causa: 'recusado', detalhe: mensagemDe(erro) };
  }
}

/** E-SAVE-GAVETAS — a gaveta salva por ultimo (a do Continuar). Sem indice, o save da F23b,
 *  que e a gaveta 1, conta como a ultima: e a partida de quem ja tinha save. */
export function ultimaGaveta(gaveta: Gaveta | null): NumeroDaGaveta | null {
  if (gaveta === null) return null;
  const { ultima } = lerIndice(gaveta);
  if (ultima !== null) return ultima;
  try {
    return gaveta.getItem(CHAVE_DO_SAVE) === null ? null : 1;
  } catch {
    return null;
  }
}

/** O Continuar: a ultima gaveta salva. */
export function lerUltimoSave(gaveta: Gaveta | null, dados: GameData = gameData): LeituraDoSave {
  if (gaveta === null) return { ok: false, causa: 'gaveta', detalhe: '' };
  const n = ultimaGaveta(gaveta);
  return n === null ? { ok: false, causa: 'sem-save', detalhe: '' } : lerGaveta(gaveta, n, dados);
}

/** E-SAVE-GAVETAS — o que a tela mostra de uma gaveta. `data` nula: o save veio da F23b, antes do
 *  indice. A recusada traz o motivo, e a tela a mostra sem abrir. */
export type SituacaoDaGaveta =
  | { readonly n: NumeroDaGaveta; readonly situacao: 'vazia' }
  | { readonly n: NumeroDaGaveta; readonly situacao: 'pronta'; readonly tipo: TipoDaPartida; readonly tick: number; readonly data: string | null }
  | { readonly n: NumeroDaGaveta; readonly situacao: 'recusada'; readonly causa: 'recusado' | 'gaveta'; readonly detalhe: string; readonly data: string | null };

export function lerGavetas(gaveta: Gaveta | null, dados: GameData = gameData): SituacaoDaGaveta[] {
  const indice = gaveta === null ? INDICE_VAZIO : lerIndice(gaveta);
  return GAVETAS.map((n): SituacaoDaGaveta => {
    const leitura = lerGaveta(gaveta, n, dados);
    const data = indice.gavetas[String(n)]?.data ?? null;
    if (leitura.ok) return { n, situacao: 'pronta', tipo: tipoDaPartida(leitura.estado), tick: leitura.estado.tick, data };
    if (leitura.causa === 'sem-save') return { n, situacao: 'vazia' };
    return { n, situacao: 'recusada', causa: leitura.causa, detalhe: leitura.detalhe, data };
  });
}

/** O relogio de parede do laco externo, em ISO 8601. Injetado: o teste passa um fixo. */
export type Relogio = () => string;

export function criarArquivoDaPartida(
  sessao: Sessao, gaveta: Gaveta, dados: GameData = gameData, agora: Relogio = () => new Date().toISOString(),
): ArquivoDaPartida {
  return {
    salvar(n = 1) {
      const estado = sessao.estado;
      try {
        gaveta.setItem(chaveDaGaveta(n), salvar(estado, dados));
        const indice = lerIndice(gaveta);
        const novo: Indice = { ultima: n, gavetas: { ...indice.gavetas, [String(n)]: { tipo: tipoDaPartida(estado), data: agora() } } };
        gaveta.setItem(CHAVE_DO_INDICE, JSON.stringify(novo));
      } catch (erro) {
        return { ok: false, causa: 'gaveta', detalhe: mensagemDe(erro) };
      }
      return { ok: true, acao: 'salvou', tick: estado.tick };
    },
    carregar(n = 1) {
      const leitura = lerGaveta(gaveta, n, dados);
      if (!leitura.ok) return leitura;
      sessao.substituir(leitura.estado);
      return { ok: true, acao: 'carregou', tick: leitura.estado.tick };
    },
    gavetas() {
      return lerGavetas(gaveta, dados);
    },
  };
}
