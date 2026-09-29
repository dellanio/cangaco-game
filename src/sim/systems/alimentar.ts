/**
 * C-COMIDA-01 (fome militar com o Feed; plano em docs/planos/2026-09-28-F-FEED-fome-militar.md).
 * O comando `FeedUnits` so marca o PEDIDO: quem leva a comida e o serf, pela tarefa
 * `comida-para-tropa` (C-COMIDA-01b). No KaM: `TKMUnitGroup.OrderFood` chama
 * `TKMUnitWarrior.OrderFood` em cada membro (units/KM_UnitGroup.pas:1459-1469), e o membro
 * so pede abaixo de TROOPS_FEED_MAX e se ainda nao pediu (units/KM_UnitWarrior.pas:290-296).
 */
import type { Command } from '../commands';
import type { GameData } from '../data/types';
import type { GameState, MotivoDeRecusaDeAlimentar, Unidade } from '../state';
import { classeDaUnidade } from '../condicao';
import { comUnidade } from '../units/movimento';
import type { ResultadoDeSistema } from './jobs';

type FeedUnits = Extract<Command, { type: 'FeedUnits' }>;

/** O militar pede comida agora? Abaixo do limiar do pedido e sem pedido em aberto. */
export function vaiPedirComida(u: Unidade, dados: GameData): boolean {
  return classeDaUnidade(u.tipo, dados) === 'militar' && u.pedidoDeComida === undefined
    && u.condicao < dados.condicao.ticksPedeComida;
}

export function motivoDaRecusaDeAlimentar(
  state: GameState, comando: FeedUnits, dados: GameData,
): { readonly motivo: MotivoDeRecusaDeAlimentar; readonly unidade: string | null } | null {
  if (comando.unidades.length === 0) return { motivo: 'sem-unidades', unidade: null };
  let lado: number | null = null;
  for (const id of comando.unidades) {
    const u = state.unidades.porId[id];
    if (u === undefined) return { motivo: 'unidade-inexistente', unidade: id };
    if (classeDaUnidade(u.tipo, dados) !== 'militar') return { motivo: 'unidade-nao-militar', unidade: id };
    if (lado !== null && u.lado !== lado) return { motivo: 'lados-diferentes', unidade: id };
    lado = u.lado;
  }
  const alguem = comando.unidades.some((id) => vaiPedirComida(state.unidades.porId[id] as Unidade, dados));
  return alguem ? null : { motivo: 'sem-fome', unidade: null };
}

export function aplicarFeedUnits(state: GameState, comando: FeedUnits, dados: GameData): ResultadoDeSistema {
  const recusa = motivoDaRecusaDeAlimentar(state, comando, dados);
  if (recusa !== null) {
    return { state, events: [{ type: 'command-rejected', command: 'FeedUnits', unidade: recusa.unidade, motivo: recusa.motivo }] };
  }
  let atual = state;
  for (const id of new Set(comando.unidades)) {
    const u = atual.unidades.porId[id] as Unidade;
    if (vaiPedirComida(u, dados)) atual = comUnidade(atual, { ...u, pedidoDeComida: true });
  }
  return { state: atual, events: [] };
}
