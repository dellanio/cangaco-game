/**
 * C-IA-02b — o PREFEITO minimo da IA (plano em docs/planos/2026-09-29-C-IA-02b-prefeito-minimo.md).
 *
 * O `CheckUnitCount` do KaM (KM_AIMayor.pas:142-270), sem AutoBuild: a IA nao ergue
 * predio, so pede a escola dela quem falta para a vila que ja tem.
 *  - ESPECIALISTA: cada predio completo do lado com `trabalhador` pede um daquele tipo;
 *    vivos + fila das escolas do lado cobrem a demanda. Conta por TIPO, nao por predio
 *    vazio: o especialista novo leva tempo para chegar, e contar o predio vazio pediria
 *    outro a cada revisao. Um por escola por revisao, o primeiro tipo na ordem de
 *    `units.json: civis.tipos`. So com ouro para pagar o treino (conservador: o KaM nao
 *    olha ouro aqui, mas sem ouro o item esperaria na fila para sempre).
 *  - SERF: enquanto a fila esta abaixo de `filaAlvo` e o ouro dos armazens passa de
 *    `ouroMinimoParaSerf`, ate `round(serfsPorPredio x predios completos)`.
 *  - Recruta e peao ficam de fora (sem cadeia de armas, sem AutoBuild).
 * Funcao pura: devolve os pedidos; quem os aplica e `systems/ia.ts`, com o mesmo
 * `EnqueueTraining` do jogador.
 */
import type { GameData } from './data/types';
import type { GameState, PredioCompleto } from './state';
import { ID_DO_RECRUTA, MERCADORIA_DE_OURO } from './state';
import { custoDeTreino, ehEscolaCompleta, filaDaEscola } from './escola';
import { trabalhadorDoTipo } from './ocupacao';
import { TIPO_QUE_CARREGA } from './jobs';
import { estoqueDosArmazens } from './selectors';

export interface PedidoDoPrefeito {
  readonly predio: string;
  readonly unidade: string;
}

/** Se o tick que o `step` produz e de revisao do prefeito (o `UpdateState` do KaM, a
 *  cada 48 ticks). */
export function ehTickDaRevisao(tick: number, ticksDaRevisao: number): boolean {
  // F-IA-DIFICULDADE: o periodo vem do nivel da IA (`numerosDaIA`); no normal, o de hoje
  return tick % ticksDaRevisao === 0;
}

export function pedidosDoPrefeito(state: GameState, lado: number, dados: GameData): readonly PedidoDoPrefeito[] {
  const completos = state.predios.ordem
    .map((id) => state.predios.porId[id])
    .filter((p): p is PredioCompleto => p !== undefined && p.lado === lado && p.estado === 'completo');
  const escolas = completos.filter(ehEscolaCompleta);
  if (escolas.length === 0) return [];

  const demanda: Record<string, number> = {};
  for (const p of completos) {
    const tipo = trabalhadorDoTipo(p.tipo, dados);
    if (tipo !== null && tipo !== ID_DO_RECRUTA) demanda[tipo] = (demanda[tipo] ?? 0) + 1;
  }
  const existente: Record<string, number> = {};
  for (const id of state.unidades.ordem) {
    const u = state.unidades.porId[id];
    if (u !== undefined && u.lado === lado) existente[u.tipo] = (existente[u.tipo] ?? 0) + 1;
  }
  const filas = new Map(escolas.map((e) => [e.id, filaDaEscola(state, e.id).length]));
  for (const e of escolas) {
    for (const item of filaDaEscola(state, e.id)) existente[item.unidade] = (existente[item.unidade] ?? 0) + 1;
  }

  const { filaAlvo, serfsPorPredio, ouroMinimoParaSerf } = dados.economia.prefeito;
  const ouroNosArmazens = estoqueDosArmazens(state, lado)[MERCADORIA_DE_OURO] ?? 0;
  const pedidos: PedidoDoPrefeito[] = [];
  const pedir = (predio: string, unidade: string): void => {
    pedidos.push({ predio, unidade });
    filas.set(predio, (filas.get(predio) ?? 0) + 1);
    existente[unidade] = (existente[unidade] ?? 0) + 1;
  };

  // especialista: um por escola, se ha ouro para pagar mais um treino dela
  for (const e of escolas) {
    if ((filas.get(e.id) ?? 0) >= filaAlvo) continue;
    const aguardando = filaDaEscola(state, e.id).filter((i) => i.estado === 'aguardando').length;
    const ouro = ouroNosArmazens + (e.estoque.entrada[MERCADORIA_DE_OURO] ?? 0);
    if (ouro < custoDeTreino(dados) * (aguardando + 1)) continue;
    const tipo = dados.unidades.civis.tipos
      .map((c) => c.id)
      .find((t) => (demanda[t] ?? 0) > (existente[t] ?? 0));
    if (tipo !== undefined) pedir(e.id, tipo);
  }

  // serfs: so com ouro de sobra (o HasEnoughGoldForAux do KaM)
  if (ouroNosArmazens <= ouroMinimoParaSerf) return pedidos;
  const serfsAlvo = Math.round(serfsPorPredio * completos.length);
  for (const e of escolas) {
    while ((filas.get(e.id) ?? 0) < filaAlvo && (existente[TIPO_QUE_CARREGA] ?? 0) < serfsAlvo) {
      pedir(e.id, TIPO_QUE_CARREGA);
    }
  }
  return pedidos;
}
