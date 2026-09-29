/**
 * C-COMBATE-01b — o storm attack (plano em docs/planos/2026-09-29-C-COMBATE-01b-storm-attack.md).
 * Ordem direta (CLAUDE.md §1): nao passa pelo JobBoard.
 *
 * Quem carrega anda em linha reta para a frente do lider, um tile por passo, com o passo
 * dividido por `stormAttack.multiplicadorVelocidade` (`custoDoPassoDaUnidade`), ate andar a
 * distancia sorteada ou dar com o tile da frente fechado. Ai fica `ocioso`, e a luta da C6
 * pega quem parou encostado num inimigo. No caminho, o encostado num inimigo passa a lutar
 * (`sistemaDoCombate`). Com `stormAttack.incontrolavel`, as ordens diretas pulam quem esta em
 * carga (`emCargaIncontrolavel`).
 */
import type { Command } from '../commands';
import type { GameState, MotivoDeRecusaDeCarga, Unidade } from '../state';
import type { GameData } from '../data/types';
import { classeDaUnidade } from '../condicao';
import { passoAndavel } from '../pathfinding';
import { nextInt } from '../rng';
import { direcaoDe, passoDaDirecao } from '../combate';
import { FSM_EM_CARGA, carregaNaInvestida, custoDoPassoDaUnidade } from '../carga';
import { comUnidade, militarOcupa, noTile, ocioso } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';
import { semRetomar } from './combate';

export type StormAttack = Extract<Command, { readonly type: 'StormAttack' }>;

export function motivoDaRecusaDeCarga(
  state: GameState, comando: StormAttack, dados: GameData,
): { readonly motivo: MotivoDeRecusaDeCarga; readonly unidade: string | null } | null {
  if (comando.unidades.length === 0) return { motivo: 'sem-unidades', unidade: null };
  let lado: number | null = null;
  let algumCarrega = false;
  for (const id of comando.unidades) {
    const u = state.unidades.porId[id];
    if (u === undefined) return { motivo: 'unidade-inexistente', unidade: id };
    if (classeDaUnidade(u.tipo, dados) !== 'militar') return { motivo: 'unidade-nao-militar', unidade: id };
    if (lado !== null && u.lado !== lado) return { motivo: 'lados-diferentes', unidade: id };
    lado = u.lado;
    if (carregaNaInvestida(u.tipo, dados)) algumCarrega = true;
  }
  if (!algumCarrega) return { motivo: 'sem-infantaria-corpo-a-corpo', unidade: null };
  return null;
}

export function aplicarStormAttack(state: GameState, comando: StormAttack, dados: GameData): ResultadoDeSistema {
  const recusa = motivoDaRecusaDeCarga(state, comando, dados);
  if (recusa !== null) {
    return {
      state,
      events: [{ type: 'command-rejected', command: 'StormAttack', unidade: recusa.unidade, motivo: recusa.motivo }],
    };
  }
  const ids = [...new Set(comando.unidades)];
  const lider = state.unidades.porId[ids[0] ?? ''] as Unidade;
  const direcao = direcaoDe(lider);
  const { min, max } = dados.combate.stormAttack.distancia_tiles;
  let atual = state;
  for (const id of ids) {
    const u = atual.unidades.porId[id];
    if (u === undefined || u.fsm === FSM_EM_CARGA || !carregaNaInvestida(u.tipo, dados)) continue;
    // a distancia de cada um, na ordem da lista, no RNG do estado
    const sorteio = nextInt(atual.rng, min, max + 1);
    // o passo em curso termina antes, e nao conta na distancia (C-MOVIMENTO-02: sem o salto
    // para tras)
    const indo = u.fsmData.caminho?.[0];
    const progresso = u.fsmData.progresso ?? 0;
    const carga = { cargaRestante: sorteio.value, cargaDirecao: direcao };
    atual = comUnidade({ ...atual, rng: sorteio.rng }, {
      ...semRetomar(u), fsm: FSM_EM_CARGA, direcao,
      fsmData: indo !== undefined && progresso > 0
        ? { caminho: [indo], progresso, replanejar: true, ...carga }
        : { caminho: [], progresso: 0, ...carga },
    });
  }
  return { state: atual, events: [] };
}

/** O tile esta com um companheiro que tambem carrega: quem vem atras espera ele sair, em vez
 *  de parar (a fileira de tras da formacao carrega junto com a da frente). */
function companheiroEmCarga(state: GameState, tile: { gx: number; gy: number }, u: Unidade): boolean {
  for (const id of state.unidades.ordem) {
    const o = state.unidades.porId[id];
    if (o === undefined || id === u.id || o.fsm !== FSM_EM_CARGA || o.lado !== u.lado) continue;
    const indo = o.fsmData.caminho?.[0];
    const aqui = indo !== undefined && (o.fsmData.progresso ?? 0) > 0 ? indo : noTile(o);
    if (aqui.gx === tile.gx && aqui.gy === tile.gy) return true;
  }
  return false;
}

/** A carga acaba: ocioso, virado para onde carregava. */
function fimDaCarga(u: Unidade): Unidade {
  return { ...ocioso(u), direcao: u.fsmData.cargaDirecao ?? direcaoDe(u) };
}

function passoEmCarga(state: GameState, u: Unidade, dados: GameData): GameState {
  let caminho = u.fsmData.caminho ?? [];
  let progresso = u.fsmData.progresso ?? 0;
  const restante = u.fsmData.cargaRestante ?? 0;
  if (caminho.length === 0) {
    // no centro do tile: acabou a distancia, ou o tile da frente esta fechado
    if (restante <= 0) return comUnidade(state, fimDaCarga(u));
    const [dx, dy] = passoDaDirecao(u.fsmData.cargaDirecao ?? direcaoDe(u));
    const frente = { gx: u.gx + dx, gy: u.gy + dy };
    if (!passoAndavel(state, noTile(u), frente, 'livre', dados)) return comUnidade(state, fimDaCarga(u));
    if (militarOcupa(state, frente, u.id, dados)) {
      return companheiroEmCarga(state, frente, u) ? state : comUnidade(state, fimDaCarga(u));
    }
    caminho = [frente];
    progresso = 0;
  }
  const proximo = caminho[0] as { gx: number; gy: number };
  progresso += 1;
  if (progresso < custoDoPassoDaUnidade(state, u, proximo, dados)) {
    return comUnidade(state, { ...u, fsmData: { ...u.fsmData, caminho, progresso } });
  }
  // o passo termina; o que a ordem pegou em curso (`replanejar`) nao conta na distancia
  const { replanejar, ...resto } = u.fsmData;
  const cargaRestante = replanejar === true ? restante : restante - 1;
  return comUnidade(state, { ...u, gx: proximo.gx, gy: proximo.gy, fsmData: { ...resto, caminho: [], progresso: 0, cargaRestante } });
}

/** Um tick de cada unidade em carga, em `unidades.ordem`. */
export function sistemaDaCarga(state: GameState, dados: GameData): ResultadoDeSistema {
  let atual = state;
  for (const id of state.unidades.ordem) {
    const u = atual.unidades.porId[id];
    if (u === undefined || u.fsm !== FSM_EM_CARGA) continue;
    atual = passoEmCarga(atual, u, dados);
  }
  return { state: atual, events: [] };
}
