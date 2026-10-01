/**
 * BUG-T (tropa travada) — o que os testes da troca mutua e a varredura da suite longa dividem.
 * Movido de `tests/BUG-T-troca-mutua.test.ts` sem mudar nada (decisao do operador, 2026-10-01).
 */
import { gameData } from '../../src/sim/data';
import type { GameState } from '../../src/sim/state';
import { classeDaUnidade } from '../../src/sim/condicao';

/** Pares de militares no mesmo tile neste estado. */
export function sobrepostos(s: GameState): string[] {
  const vistos = new Map<string, string>();
  const erros: string[] = [];
  for (const id of s.unidades.ordem) {
    const u = s.unidades.porId[id];
    if (u === undefined || classeDaUnidade(u.tipo, gameData) !== 'militar') continue;
    const k = `${u.gx},${u.gy}`;
    const outro = vistos.get(k);
    if (outro !== undefined) erros.push(`t${s.tick} ${outro}+${id}@${k}`);
    else vistos.set(k, id);
  }
  return erros;
}
