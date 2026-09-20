/**
 * As invariantes do JobBoard, para o teste de propriedade e o cenario de carga.
 * Devolve a lista de violacoes (vazia = tudo certo). Roda DEPOIS de cada `step`:
 * `sanearTarefas` roda dentro do step, entao o que um evento externo estragou tem
 * que ter sido consertado quando o tick fecha.
 *
 * O ponto central: nao existe reserva sem tarefa (a reserva e derivada), entao "nao
 * ha reserva orfa" se reduz a "nenhuma tarefa `reclamada` invalida sobrevive a um
 * tick" — e e isto que se verifica aqui.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { GameState } from '../../src/sim/state';
import { distanciaDaTarefa, nivelDoTipo, TIPO_QUE_CARREGA } from '../../src/sim/jobs';
import { disponivelNaOrigem, vagaNoDestino } from '../../src/sim/reservas';
import { ID_DO_ARMAZEM } from '../../src/sim/state';

export function violacoesDeInvariantes(estado: GameState, dados: GameData = gameData): string[] {
  const v: string[] = [];
  const { tarefas } = estado.jobs;

  const idsOrdem = [...tarefas.ordem].sort();
  const idsMapa = Object.keys(tarefas.porId).sort();
  if (JSON.stringify(idsOrdem) !== JSON.stringify(idsMapa)) v.push('jobs.tarefas: ordem e porId divergem');
  if (new Set(tarefas.ordem).size !== tarefas.ordem.length) v.push('jobs.tarefas: id repetido em ordem');

  const unidadesEmUso = new Map<string, string>();
  const contagemPorDestino = new Map<string, { total: number; obra: string; mercadoria: string }>();
  const reservasPorOrigem = new Set<string>();
  const reservasPorDestino = new Set<string>();

  for (const id of tarefas.ordem) {
    const t = tarefas.porId[id];
    if (!t) {
      v.push(`${id}: em ordem mas ausente de porId`);
      continue;
    }
    if (t.id !== `t${t.numero}`) v.push(`${id}: id nao e t<numero>`);
    if (t.numero >= estado.proximoId) v.push(`${id}: numero >= proximoId (colisao futura de id)`);
    try {
      nivelDoTipo(t.tipo, dados);
    } catch {
      v.push(`${id}: tipo '${t.tipo}' fora da escada do dado`);
    }

    const origem = estado.predios.porId[t.origem];
    if (!origem || origem.estado !== 'completo' || origem.tipo !== ID_DO_ARMAZEM) v.push(`${id}: origem '${t.origem}' nao e armazem completo`);
    const destino = estado.predios.porId[t.destino];
    if (!destino || destino.estado !== 'obra') v.push(`${id}: destino '${t.destino}' nao e obra`);
    if (origem && destino && distanciaDaTarefa(estado, t, dados) === null) v.push(`${id}: sem caminho por estrada`);

    if (t.estado === 'aberta' && t.reclamadaPor !== null) v.push(`${id}: aberta mas com reclamadaPor`);
    if (t.estado === 'reclamada') {
      if (t.reclamadaPor === null) {
        v.push(`${id}: reclamada sem unidade`);
      } else {
        const u = estado.unidades.porId[t.reclamadaPor];
        if (!u || u.tipo !== TIPO_QUE_CARREGA) v.push(`${id}: reclamada por unidade inexistente ou que nao carrega`);
        const outra = unidadesEmUso.get(t.reclamadaPor);
        if (outra !== undefined) v.push(`${id}: a unidade ${t.reclamadaPor} tambem segura ${outra}`);
        unidadesEmUso.set(t.reclamadaPor, id);
      }
      reservasPorOrigem.add(`${t.origem}|${t.mercadoria}`);
      reservasPorDestino.add(`${t.destino}|${t.mercadoria}`);
    }

    const chave = `${t.destino}|${t.mercadoria}`;
    const atual = contagemPorDestino.get(chave) ?? { total: 0, obra: t.destino, mercadoria: t.mercadoria };
    contagemPorDestino.set(chave, { ...atual, total: atual.total + 1 });
  }

  // nunca mais tarefas do que a obra precisa (aberta ou reclamada)
  for (const { total, obra, mercadoria } of contagemPorDestino.values()) {
    const p = estado.predios.porId[obra];
    const faltam = p && p.estado === 'obra' ? (p.obra.faltam[mercadoria] ?? 0) : 0;
    if (total > faltam) v.push(`${obra}/${mercadoria}: ${total} tarefas para faltam=${faltam}`);
  }
  // reservado <= disponivel nas DUAS pontas (disponivel/vaga nunca negativos)
  for (const chave of reservasPorOrigem) {
    const [predio, mercadoria] = chave.split('|') as [string, string];
    if (disponivelNaOrigem(estado, predio, mercadoria) < 0) v.push(`${predio}/${mercadoria}: reservado na origem acima do estoque`);
  }
  for (const chave of reservasPorDestino) {
    const [predio, mercadoria] = chave.split('|') as [string, string];
    if (vagaNoDestino(estado, predio, mercadoria) < 0) v.push(`${predio}/${mercadoria}: reservado no destino acima da vaga`);
  }
  return v;
}
