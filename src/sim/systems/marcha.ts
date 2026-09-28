/**
 * F26a — a ordem de MOVER a tropa (`MoveUnits`). Ordem direta (CLAUDE.md §1): nao
 * passa pelo JobBoard.
 *
 * O grupo nao e formacao (C-COMBATE-01, formação): cada unidade so recebe um tile andavel PROPRIO em volta
 * do destino, para nao parar empilhada. Os tiles saem em aneis de Chebyshev a partir do
 * destino, em varredura de linha (`gy`, depois `gx`), e a i-esima unidade da lista (sem
 * repetidos) fica com o i-esimo. Deterministico e sem RNG.
 */
import type { Command } from '../commands';
import type { GameState, MotivoDeRecusaDeMarcha, Unidade } from '../state';
import type { GameData } from '../data/types';
import type { TileDeGrid } from '../estradas';
import { classeDaUnidade } from '../condicao';
import { buscarCaminho, passoAndavel, tileAndavel } from '../pathfinding';
import { andar, chegou, comUnidade, noTile, ocioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';
import { semRetomar, viradaPeloPasso } from './combate';

export type MoveUnits = Extract<Command, { readonly type: 'MoveUnits' }>;

export const FSM_MARCHANDO = 'marchando';

export function motivoDaRecusaDeMarcha(
  state: GameState, comando: MoveUnits, dados: GameData,
): { readonly motivo: MotivoDeRecusaDeMarcha; readonly unidade: string | null } | null {
  if (comando.unidades.length === 0) return { motivo: 'sem-unidades', unidade: null };
  let lado: number | null = null;
  for (const id of comando.unidades) {
    const u = state.unidades.porId[id];
    if (u === undefined) return { motivo: 'unidade-inexistente', unidade: id };
    if (classeDaUnidade(u.tipo, dados) !== 'militar') return { motivo: 'unidade-nao-militar', unidade: id };
    if (lado !== null && u.lado !== lado) return { motivo: 'lados-diferentes', unidade: id };
    lado = u.lado;
  }
  if (!tileAndavel(state, comando.destino, 'livre', dados)) return { motivo: 'destino-inandavel', unidade: null };
  return null;
}

/** Os `n` primeiros tiles andaveis em volta de `destino`, anel a anel. O anel para no
 *  lado do mapa: quando nao ha `n`, devolve os que ha, e as ultimas unidades repetem. */
export function tilesDoGrupo(state: GameState, destino: TileDeGrid, n: number, dados: GameData): TileDeGrid[] {
  const { largura, altura } = dados.terreno.mapaPadrao;
  const tiles: TileDeGrid[] = [];
  const maiorAnel = Math.max(largura, altura);
  for (let r = 0; r <= maiorAnel && tiles.length < n; r += 1) {
    for (let gy = destino.gy - r; gy <= destino.gy + r && tiles.length < n; gy += 1) {
      for (let gx = destino.gx - r; gx <= destino.gx + r && tiles.length < n; gx += 1) {
        const naBorda = Math.max(Math.abs(gx - destino.gx), Math.abs(gy - destino.gy)) === r;
        if (naBorda && tileAndavel(state, { gx, gy }, 'livre', dados)) tiles.push({ gx, gy });
      }
    }
  }
  return tiles;
}

export function aplicarMoveUnits(state: GameState, comando: MoveUnits, dados: GameData): ResultadoDeSistema {
  const recusa = motivoDaRecusaDeMarcha(state, comando, dados);
  if (recusa !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'MoveUnits', unidade: recusa.unidade, motivo: recusa.motivo }],
    };
  }
  const ids = [...new Set(comando.unidades)];
  const alvos = tilesDoGrupo(state, comando.destino, ids.length, dados);
  let atual = state;
  ids.forEach((id, i) => {
    const u = atual.unidades.porId[id];
    const alvo = alvos[Math.min(i, alvos.length - 1)];
    if (u === undefined || alvo === undefined) return;
    // o caminho e planejado no primeiro tick do sistema, de onde a unidade estiver
    atual = comUnidade(atual, { ...semRetomar(u), fsm: FSM_MARCHANDO, fsmData: { caminho: [], progresso: 0, alvoTile: alvo } });
  });
  return { state: atual, events: [] };
}

function passoMarchando(state: GameState, u: Unidade, dados: GameData): ResultadoDeSistema {
  const alvo = u.fsmData.alvoTile;
  if (alvo === undefined || (u.gx === alvo.gx && u.gy === alvo.gy)) {
    return { state: comUnidade(state, ocioso(u)), events: [] };
  }
  let atual = u;
  const caminho = u.fsmData.caminho ?? [];
  const proximo = caminho[0];
  if (proximo === undefined || !passoAndavel(state, noTile(u), proximo, 'livre', dados)) {
    const rota = buscarCaminho(state, noTile(u), [alvo], 'livre', dados);
    if (rota === null || rota.tiles.length === 0) return { state: comUnidade(state, ocioso(u)), events: [] };
    atual = { ...u, fsmData: { alvoTile: alvo, caminho: rota.tiles, progresso: 0 } };
  }
  // F28a: a unidade vira para onde anda (frente/flanco/costas e o arco do arqueiro)
  const andou = viradaPeloPasso(noTile(atual), andar(state, atual, dados));
  return { state: comUnidade(state, chegou(andou) ? ocioso(andou) : andou), events: [] };
}

/** Um tick de cada unidade marchando, em `unidades.ordem`. */
export function sistemaDaMarcha(state: GameState, dados: GameData): ResultadoDeSistema {
  let atual = state;
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || u.fsm !== FSM_MARCHANDO) continue;
    atual = passoMarchando(atual, u, dados).state;
  }
  return { state: atual, events: [] };
}
