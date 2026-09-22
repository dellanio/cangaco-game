/**
 * As invariantes da FSM do laborer (F11c), irma de `serf-invariantes.ts`. Devolve a lista
 * de violacoes (vazia = tudo certo). O laborer nunca carrega mercadoria — por isso nao ha
 * checagem de `carga`/conservacao de bens aqui: `bensPorMercadoria` (serf-invariantes.ts)
 * ja cobre isso, e martelar/nivelar nao move mercadoria nenhuma.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { GameState } from '../../src/sim/state';
import { custoDoPasso } from '../../src/sim/pathfinding';

export const ESTADOS_DO_LABORER = ['ocioso', 'indo_a_obra', 'nivelando', 'esperando_material', 'martelando'] as const;

export function violacoesDaFsmDoLaborer(estado: GameState, dados: GameData = gameData): string[] {
  const v: string[] = [];
  const { largura, altura } = dados.terreno.mapaPadrao;
  const tarefasPorUnidade = new Map<string, string[]>();
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (t && t.tipo === 'construir' && t.estado !== 'aberta' && t.reclamadaPor !== null) {
      tarefasPorUnidade.set(t.reclamadaPor, [...(tarefasPorUnidade.get(t.reclamadaPor) ?? []), id]);
    }
  }

  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (!u || u.tipo !== 'laborer') continue;
    const dadosDaFsm = u.fsmData;
    const suas = tarefasPorUnidade.get(id) ?? [];
    if (!(ESTADOS_DO_LABORER as readonly string[]).includes(u.fsm)) v.push(`${id}: estado '${u.fsm}' fora do GDD §6.3`);
    if (u.gx < 0 || u.gy < 0 || u.gx >= largura || u.gy >= altura) v.push(`${id}: fora do mapa (${u.gx},${u.gy})`);
    if (suas.length > 1) v.push(`${id}: segura ${suas.length} tarefas de construir`);

    const tarefa = dadosDaFsm.tarefa === undefined ? undefined : estado.jobs.tarefas.porId[dadosDaFsm.tarefa];
    const reclamadaPeloLaborer = tarefa !== undefined && tarefa.tipo === 'construir'
      && tarefa.estado === 'reclamada' && tarefa.reclamadaPor === id;

    switch (u.fsm) {
      case 'ocioso':
        if (Object.keys(dadosDaFsm).length > 0) v.push(`${id}: ocioso com fsmData nao vazio (${JSON.stringify(dadosDaFsm)})`);
        if (suas.length > 0) v.push(`${id}: ocioso mas a tarefa ${suas[0]} e dele`);
        break;
      case 'indo_a_obra':
      case 'nivelando':
      case 'esperando_material':
      case 'martelando':
        // NAO se checa aqui se o destino ainda e obra: por um tick, um laborer que estava
        // ANTES na ordem pode ver a obra completada por OUTRO laborer no mesmo tick (a
        // dobra sequencial) e so vira `ocioso` no tick seguinte, quando `sanearTarefas`
        // cancela a tarefa dele (`'destino-completo'`) — o mesmo caminho que o serf usa.
        if (!reclamadaPeloLaborer) v.push(`${id}: ${u.fsm} sem tarefa 'construir' reclamada por ele`);
        break;
      default:
        break;
    }

    // movimento: so `indo_a_obra` guarda caminho; os outros estados nao andam.
    const caminho = dadosDaFsm.caminho ?? [];
    if (caminho.length > 0 && u.fsm !== 'indo_a_obra') v.push(`${id}: ${u.fsm} com caminho pendente`);
    let atualPos = { gx: u.gx, gy: u.gy };
    for (const passo of caminho) {
      if (Math.max(Math.abs(passo.gx - atualPos.gx), Math.abs(passo.gy - atualPos.gy)) !== 1) {
        v.push(`${id}: caminho nao contiguo em (${passo.gx},${passo.gy})`);
      }
      atualPos = passo;
    }
    const progresso = dadosDaFsm.progresso ?? 0;
    if (!Number.isInteger(progresso) || progresso < 0) v.push(`${id}: progresso invalido (${progresso})`);
    if (u.fsm === 'indo_a_obra') {
      const proximo = caminho[0];
      if (proximo && progresso >= custoDoPasso(estado.estradas, { gx: u.gx, gy: u.gy }, proximo, dados)) {
        v.push(`${id}: progresso ${progresso} ja completou o passo`);
      }
      if (!proximo && progresso !== 0) v.push(`${id}: progresso ${progresso} sem caminho`);
    }
    if (u.fsm === 'martelando' && progresso >= dados.construcao.ticksPorMartelada) {
      v.push(`${id}: progresso ${progresso} ja completou a martelada`);
    }
  }

  // a outra direcao: toda 'construir' reclamada tem exatamente um laborer que a reconhece
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (!t || t.tipo !== 'construir' || t.estado === 'aberta' || t.reclamadaPor === null) continue;
    const u = estado.unidades.porId[t.reclamadaPor];
    if (u && u.fsmData.tarefa !== id) v.push(`${id}: o laborer ${u.id} nao a reconhece (fsmData.tarefa='${u.fsmData.tarefa}')`);
  }
  return v;
}
