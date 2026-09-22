/**
 * As invariantes da FSM do serf (F10), para os testes de propriedade e o cenario de carga.
 * Devolve a lista de violacoes (vazia = tudo certo). Complementa `violacoesDeInvariantes`
 * (que olha o quadro de tarefas): aqui e a COERENCIA serf <-> tarefa <-> carga, o
 * movimento (caminho contiguo, progresso menor que o passo) e a conservacao de bens.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { GameState } from '../../src/sim/state';
import { custoDoPasso } from '../../src/sim/pathfinding';

export const ESTADOS_DO_SERF = ['ocioso', 'indo_buscar', 'carregando', 'indo_entregar', 'entregando', 'devolvendo'] as const;

export function violacoesDaFsm(estado: GameState, dados: GameData = gameData): string[] {
  const v: string[] = [];
  const { largura, altura } = dados.terreno.mapaPadrao;
  const tarefasPorUnidade = new Map<string, string[]>();
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (t && t.estado !== 'aberta' && t.reclamadaPor !== null) {
      tarefasPorUnidade.set(t.reclamadaPor, [...(tarefasPorUnidade.get(t.reclamadaPor) ?? []), id]);
    }
  }

  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (!u || u.tipo !== 'serf') continue;
    const dadosDaFsm = u.fsmData;
    const suas = tarefasPorUnidade.get(id) ?? [];
    if (!(ESTADOS_DO_SERF as readonly string[]).includes(u.fsm)) v.push(`${id}: estado '${u.fsm}' fora do GDD §6.2`);
    if (u.gx < 0 || u.gy < 0 || u.gx >= largura || u.gy >= altura) v.push(`${id}: fora do mapa (${u.gx},${u.gy})`);
    if (suas.length > 1) v.push(`${id}: segura ${suas.length} tarefas`);

    const tarefa = dadosDaFsm.tarefa === undefined ? undefined : estado.jobs.tarefas.porId[dadosDaFsm.tarefa];
    const temCarga = dadosDaFsm.carga !== undefined;

    switch (u.fsm) {
      case 'ocioso':
        if (Object.keys(dadosDaFsm).length > 0) v.push(`${id}: ocioso com fsmData nao vazio (${JSON.stringify(dadosDaFsm)})`);
        if (suas.length > 0) v.push(`${id}: ocioso mas a tarefa ${suas[0]} e dele`);
        break;
      case 'indo_buscar':
      case 'carregando':
        if (!tarefa || tarefa.estado !== 'reclamada' || tarefa.reclamadaPor !== id) v.push(`${id}: ${u.fsm} sem tarefa reclamada por ele`);
        if (temCarga) v.push(`${id}: ${u.fsm} ja com carga`);
        break;
      case 'indo_entregar':
      case 'entregando':
        if (!tarefa || tarefa.estado !== 'carregando' || tarefa.reclamadaPor !== id) v.push(`${id}: ${u.fsm} sem tarefa carregando dele`);
        if (!temCarga) v.push(`${id}: ${u.fsm} sem carga`);
        else if (tarefa && tarefa.tipo === 'material-para-obra' && dadosDaFsm.carga !== tarefa.mercadoria) {
          v.push(`${id}: carga '${dadosDaFsm.carga}' difere da tarefa '${tarefa.mercadoria}'`);
        }
        break;
      case 'devolvendo':
        if (!temCarga) v.push(`${id}: devolvendo sem carga`);
        if (suas.length > 0) v.push(`${id}: devolvendo mas ainda tem a tarefa ${suas[0]}`);
        break;
      default:
        break;
    }
    if (temCarga && !['indo_entregar', 'entregando', 'devolvendo'].includes(u.fsm)) v.push(`${id}: carga fora de indo_entregar/entregando/devolvendo`);

    // movimento: caminho contiguo a partir de onde esta, progresso menor que o passo em curso
    const caminho = dadosDaFsm.caminho ?? [];
    let atual = { gx: u.gx, gy: u.gy };
    for (const passo of caminho) {
      if (Math.max(Math.abs(passo.gx - atual.gx), Math.abs(passo.gy - atual.gy)) !== 1) v.push(`${id}: caminho nao contiguo em (${passo.gx},${passo.gy})`);
      atual = passo;
    }
    const progresso = dadosDaFsm.progresso ?? 0;
    if (!Number.isInteger(progresso) || progresso < 0) v.push(`${id}: progresso invalido (${progresso})`);
    const proximo = caminho[0];
    if (proximo && progresso >= custoDoPasso(estado.estradas, { gx: u.gx, gy: u.gy }, proximo, dados)) v.push(`${id}: progresso ${progresso} ja completou o passo`);
    if (!proximo && progresso !== 0) v.push(`${id}: progresso ${progresso} sem caminho`);
  }

  // a outra direcao: toda tarefa em curso tem exatamente um serf que a reconhece
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (!t || t.estado === 'aberta' || t.reclamadaPor === null) continue;
    const u = estado.unidades.porId[t.reclamadaPor];
    if (u && u.fsmData.tarefa !== id) v.push(`${id}: o serf ${u.id} nao a reconhece (fsmData.tarefa='${u.fsmData.tarefa}')`);
  }
  return v;
}

/**
 * Bens por mercadoria que a sim tem que CONSERVAR entre dois ticks sem injecao externa:
 * estoques (as duas gavetas de todo predio completo) + cargas em transito - o que ainda
 * falta as obras. Coletar move 1 do estoque para a carga (soma igual); entregar tira 1 da
 * carga e 1 do `faltam` (soma igual); devolver move 1 da carga de volta ao estoque.
 */
export function bensPorMercadoria(estado: GameState): Record<string, number> {
  const total: Record<string, number> = {};
  const somar = (mercadoria: string, n: number): void => {
    total[mercadoria] = (total[mercadoria] ?? 0) + n;
  };
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (!p) continue;
    if (p.estado === 'completo') {
      for (const [m, n] of Object.entries(p.estoque.entrada)) somar(m, n);
      for (const [m, n] of Object.entries(p.estoque.saida)) somar(m, n);
    } else {
      for (const [m, n] of Object.entries(p.obra.faltam)) somar(m, -n);
    }
  }
  for (const id of estado.unidades.ordem) {
    const carga = estado.unidades.porId[id]?.fsmData.carga;
    if (carga !== undefined) somar(carga, 1);
  }
  return total;
}
