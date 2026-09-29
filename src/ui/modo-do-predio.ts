// F-REPL-d — o seletor de modo do painel (o lenhador: "Cortar" / "Cortar e plantar").
//
// Puro: nem DOM, nem `sim/data`. Os modos de cada tipo chegam do `main.ts`, a raiz de
// composicao, como a lista de mercadorias da feira (C-TELA-05). O seletor aparece para
// toda receita que declara `modos`, nunca por `tipo === 'woodcutters'` (nota da F-REPL-b).
import type { Command } from '../sim/commands';

/** Os modos de um tipo, na ordem do dado, e o de quem nasce. */
export interface ModosDoTipo {
  readonly ids: readonly string[];
  readonly padrao: string;
}

/** O pedaco de `receitas[tipo]` que o seletor le, por forma: `ui/` nao importa `sim/data`. */
type ReceitasComModos = Readonly<Record<string, {
  readonly modos: { readonly porModo: Readonly<Record<string, unknown>>; readonly padrao: string } | null;
} | undefined>>;

/** Os modos do tipo, na ordem das chaves de `porModo`, ou `null` quando a receita nao
 *  declara (ou o tipo nao tem receita). */
export function modosDoTipo(receitas: ReceitasComModos, tipo: string): ModosDoTipo | null {
  const modos = receitas[tipo]?.modos ?? null;
  return modos === null ? null : { ids: Object.keys(modos.porModo), padrao: modos.padrao };
}

export interface NomeDoModo {
  readonly nome: string;
  readonly desc: string;
}

export interface OpcaoDeModo {
  readonly id: string;
  readonly nome: string;
  readonly desc: string;
  readonly atual: boolean;
}

/** Um botao por modo, com o nome do tema (o id neutro quando falta) e o atual marcado.
 *  `modoAtual` ausente e o padrao, como na sim. `null` (receita sem modos) da `[]`. */
export function opcoesDeModo(
  modos: ModosDoTipo | null, modoAtual: string | undefined,
  nomes: Readonly<Record<string, NomeDoModo | undefined>> | undefined,
): readonly OpcaoDeModo[] {
  if (modos === null) return [];
  const atual = modoAtual ?? modos.padrao;
  return modos.ids.map((id) => ({
    id,
    nome: nomes?.[id]?.nome ?? id,
    desc: nomes?.[id]?.desc ?? '',
    atual: id === atual,
  }));
}

/** O botao manda o VALOR, nunca "o outro modo": com a tela um tick atrasada, alternar
 *  desfaria o que o jogador acabou de escolher (o mesmo criterio do pausar, F16c). */
export function comandoDeModo(predio: string, modo: string): Command {
  return { type: 'SetBuildingMode', predio, modo };
}
