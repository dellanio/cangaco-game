/**
 * F-SPR — quantas direcoes de sprite cada tipo de unidade tem, lido de
 * `data/units.json` (`direcoesDeSprite`). O numero vive no dado (CLAUDE.md §2.3):
 * civis, militares e mercenarios, todos 8 (decisao do operador, 2026-09-30; os mercenarios
 * entraram na D-TELA-05e), declarados no `_comum` do grupo, com override por tipo se um dia
 * existir. Tipo que nao declara resolve `null`: sem direcao, sem sprite, fica o placeholder.
 *
 * Este arquivo NAO importa `phaser` nem `sim/data` (teste estrutural da F04): le o
 * JSON direto, como `nome-de-unidade.ts` le o tema.
 */
import unidadesJson from '../../data/units.json';

interface TipoDoDado { readonly id: string; readonly direcoesDeSprite?: number }
interface GrupoDoDado { readonly _comum?: { readonly direcoesDeSprite?: number }; readonly tipos: readonly TipoDoDado[] }

const GRUPOS = ['civis', 'militares', 'mercenarios'] as const;

function comoDirecoes(n: number | undefined, tipo: string): 4 | 8 | null {
  if (n === undefined) return null;
  if (n === 4 || n === 8) return n;
  throw new Error(`render/direcoes-de-sprite: '${tipo}' declara ${n} direcoes; o render conhece 4 e 8.`);
}

/** Tipo -> 4 | 8 | null, para todo tipo de `units.json`. */
export function direcoesPorTipo(dado: unknown = unidadesJson): ReadonlyMap<string, 4 | 8 | null> {
  const mapa = new Map<string, 4 | 8 | null>();
  const grupos = dado as Readonly<Record<string, GrupoDoDado | undefined>>;
  for (const nome of GRUPOS) {
    const grupo = grupos[nome];
    if (!grupo) continue;
    for (const t of grupo.tipos) {
      mapa.set(t.id, comoDirecoes(t.direcoesDeSprite ?? grupo._comum?.direcoesDeSprite, t.id));
    }
  }
  return mapa;
}

const doJogo = direcoesPorTipo();

/** As direcoes de um tipo do jogo; tipo desconhecido tambem resolve `null`. */
export function direcoesDoTipo(tipo: string): 4 | 8 | null {
  return doJogo.get(tipo) ?? null;
}
