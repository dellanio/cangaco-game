/**
 * I-TELA-RUA-SENDO-ASSENTADA — o estagio de cada tile do canteiro da rua, derivado do estado: a pedra no tile
 * (`pedraNoCanteiro`) e o progresso do obreiro que o assenta (`fsmData.progresso` contra
 * `ticksAssentarEstradaPorTile`). A sim nao muda e nao sabe que existe estagio: e so desenho.
 */
import type { GameState } from '../sim/state';
import { chaveDeTile } from '../sim/estradas';

export type EstagioDaRua = 'marcado' | 'pedras' | 'obra-1' | 'obra-2';

/** O estagio de cada tile do canteiro, pela chave `gx,gy`. */
export function estagiosDaRuaEmObra(
  estado: Pick<GameState, 'estradasPlanejadas' | 'pedraNoCanteiro' | 'unidades' | 'jobs'>,
  ticksPorTile: number,
): Readonly<Record<string, EstagioDaRua>> {
  const batendo = new Map<string, number>();
  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (u?.tipo !== 'laborer' || u.fsm !== 'martelando' || u.fsmData.tarefa === undefined) continue;
    const t = estado.jobs.tarefas.porId[u.fsmData.tarefa];
    if (t?.tipo !== 'assentar-estrada') continue;
    batendo.set(chaveDeTile(t.destinoTile), u.fsmData.progresso ?? 0);
  }
  const r: Record<string, EstagioDaRua> = {};
  for (const chave of Object.keys(estado.estradasPlanejadas)) {
    const progresso = batendo.get(chave);
    if (progresso !== undefined) r[chave] = 2 * progresso < ticksPorTile ? 'obra-1' : 'obra-2';
    else r[chave] = (estado.pedraNoCanteiro[chave] ?? 0) > 0 ? 'pedras' : 'marcado';
  }
  return r;
}

/** Uma chave curta dos estagios, para a camada saber quando redesenhar. */
export function assinaturaDosEstagios(estagios: Readonly<Record<string, EstagioDaRua>>): string {
  return Object.keys(estagios).sort().map((k) => `${k}:${estagios[k] ?? ''}`).join('|');
}
