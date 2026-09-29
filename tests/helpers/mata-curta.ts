/**
 * F-REPL — o lenhador `w1` do `cenarioOraculo` com a mata encurtada, para o
 * replantio aparecer numa janela de teste. Ate a D-PRODUCAO-02, na mata inteira (9 tiles)
 * o rodizio cortava adulta antes de plantar e, em 12 000 ticks, nao replantava nenhum toco;
 * agora o toco que acabou de esgotar e replantado antes de seguir (`replantaOQueCortou`),
 * e a mata curta continua servindo para o toco aparecer cedo.
 *
 * A mata e encurtada no ESTADO, depois do cenario montado: encurtar no dado
 * (`comJazida`) muda onde a abertura poe o lenhador. `w2` fica pausado pelo comando,
 * para nao dividir os tiles de `w1`.
 */
import type { Command } from '../../src/sim/commands';
import type { GameData } from '../../src/sim/data/types';
import type { GameState, RecursoNoTile } from '../../src/sim/state';
import { receitaDoTipo } from '../../src/sim/producao';
import { tileMaduro, tilesDeColheita } from '../../src/sim/recursos';
import { step } from '../../src/sim/tick';
import { cenarioOraculo, comEspacoNaSaida } from './producao-cenario';

/** O dado de antes da F-REPL-a: a mesma arvore, sem `reposicao`. */
export function semReposicao(dados: GameData): GameData {
  const tree = dados.recursos.tipos.tree;
  if (tree === undefined) throw new Error('fixture');
  return { ...dados, recursos: { ...dados.recursos, tipos: { ...dados.recursos.tipos, tree: { ...tree, reposicao: null } } } };
}

export const pausarW2: Command = { type: 'SetBuildingPaused', predio: 'w2', pausado: true };

/** Os tiles de arvore ao alcance de `w1` no cenario montado. */
export function tilesDeW1(s: GameState, dados: GameData): readonly string[] {
  const w1 = s.predios.porId.w1;
  const colheita = receitaDoTipo('woodcutters', dados)?.colheita ?? null;
  if (w1?.estado !== 'completo' || colheita === null) throw new Error('fixture');
  return tilesDeColheita(s, w1, colheita, dados);
}

/** Cenario do oraculo com a mata de `w1` encurtada a `n` tiles, e `w2` pausado.
 *  `comandos` vao no mesmo primeiro passo (o modo, na F-REPL-b). */
export function mataCurta(
  dados: GameData, n: number, comandos: readonly Command[] = [],
): { s: GameState; tiles: readonly string[] } {
  const s0 = cenarioOraculo(dados);
  const todos = tilesDeW1(s0, dados);
  const ficam = todos.slice(0, n);
  const recursos: Record<string, RecursoNoTile> = {};
  for (const [k, r] of Object.entries(s0.recursos)) {
    if (r.tipo === 'tree' && todos.includes(k) && !ficam.includes(k)) continue;
    recursos[k] = r;
  }
  return { s: step({ ...s0, recursos }, [pausarW2, ...comandos], dados), tiles: ficam };
}

const adultas = (s: GameState, tiles: readonly string[], dados: GameData): number => tiles.filter((k) => {
  const r = s.recursos[k];
  return r !== undefined && r.quantidade > 0 && tileMaduro(s, r, dados);
}).length;

export interface Corrida {
  readonly troncos: number;
  /** o primeiro tick em que nao sobrou arvore adulta nos tiles */
  readonly semAdulta: number | null;
  /** troncos entregues DEPOIS de `semAdulta` */
  readonly depois: number;
  readonly replantios: number;
  /** ticks x unidade em pe num tile de arvore com quantidade > 0 */
  readonly dentroDaArvore: number;
}

/** Roda `janela` ticks com a gaveta de `w1` esvaziada a cada passo. `aCada` recebe
 *  o estado de cada tick (a F-REPL-b compara duas corridas no instante). */
export function correr(
  inicial: GameState, tiles: readonly string[], dados: GameData, janela: number,
  aCada: (s: GameState) => void = () => undefined,
): Corrida & { readonly final: GameState } {
  let s = inicial;
  let troncos = 0;
  let semAdulta: number | null = null;
  let depois = 0;
  let replantios = 0;
  let dentroDaArvore = 0;
  for (let i = 0; i < janela; i += 1) {
    const antes = s.recursos;
    s = comEspacoNaSaida(step(s, [], dados), 'w1');
    aCada(s);
    for (const e of s.events) {
      if (e.type === 'goods-produced' && e.predio === 'w1') {
        troncos += e.quantidade;
        if (semAdulta !== null) depois += e.quantidade;
      }
    }
    if (semAdulta === null && adultas(s, tiles, dados) === 0) semAdulta = s.tick;
    for (const k of tiles) {
      if ((antes[k]?.quantidade ?? 0) === 0 && (s.recursos[k]?.quantidade ?? 0) > 0) replantios += 1;
    }
    for (const u of Object.values(s.unidades.porId)) {
      const r = s.recursos[`${u.gx},${u.gy}`];
      if (r !== undefined && r.tipo === 'tree' && r.quantidade > 0) dentroDaArvore += 1;
    }
  }
  return { troncos, semAdulta, depois, replantios, dentroDaArvore, final: s };
}
