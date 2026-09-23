/**
 * As invariantes da FSM do especialista (F14), irma de `laborer-invariantes.ts`.
 * Devolve a lista de violacoes (vazia = tudo certo). O ponto central: a POSSE
 * mora so no predio, entao "os dois lados concordam" e a coisa a verificar.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { GameState } from '../../src/sim/state';
import { predioAceita, predioDoOcupante, tiposQueOcupam } from '../../src/sim/ocupacao';

export const ESTADOS_DO_ESPECIALISTA = ['ocioso', 'indo_ocupar', 'trabalhando'] as const;

export function violacoesDaFsmDoEspecialista(estado: GameState, dados: GameData = gameData): string[] {
  const v: string[] = [];
  const ocupam = tiposQueOcupam(dados);
  const tarefasPorUnidade = new Map<string, string[]>();
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (t && t.tipo === 'ocupar' && t.estado !== 'aberta' && t.reclamadaPor !== null) {
      tarefasPorUnidade.set(t.reclamadaPor, [...(tarefasPorUnidade.get(t.reclamadaPor) ?? []), id]);
    }
  }

  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id];
    if (!u || !ocupam.has(u.tipo)) continue;
    if (!(ESTADOS_DO_ESPECIALISTA as readonly string[]).includes(u.fsm)) {
      v.push(`${id}: estado '${u.fsm}' fora do GDD §6.2`);
    }
    const suas = tarefasPorUnidade.get(id) ?? [];
    if (suas.length > 1) v.push(`${id}: segura ${suas.length} tarefas de ocupar`);
    const predio = predioDoOcupante(estado, id);

    switch (u.fsm) {
      case 'ocioso':
        if (Object.keys(u.fsmData).length > 0) v.push(`${id}: ocioso com fsmData nao vazio`);
        if (suas.length > 0) v.push(`${id}: ocioso mas a tarefa ${suas[0]} e dele`);
        if (predio !== null) v.push(`${id}: ocioso mas ocupa ${predio.id}`);
        break;
      case 'indo_ocupar':
        if (suas.length !== 1) v.push(`${id}: indo_ocupar sem tarefa 'ocupar' reclamada por ele`);
        if (predio !== null) v.push(`${id}: indo_ocupar mas ja ocupa ${predio.id}`);
        break;
      case 'trabalhando':
        if (predio === null) v.push(`${id}: trabalhando sem predio que o reconheca`);
        if (suas.length > 0) v.push(`${id}: trabalhando e ainda segura a tarefa ${suas[0]}`);
        if (Object.keys(u.fsmData).length > 0) v.push(`${id}: trabalhando com fsmData nao vazio`);
        break;
      default:
        break;
    }
    const caminho = u.fsmData.caminho ?? [];
    if (caminho.length > 0 && u.fsm !== 'indo_ocupar') v.push(`${id}: ${u.fsm} com caminho pendente`);
  }

  // a outra direcao: todo predio com ocupante aponta para uma unidade viva, do
  // tipo que ele aceita, e nenhuma unidade ocupa dois predios.
  const vistos = new Set<string>();
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id];
    if (!p || p.estado !== 'completo' || p.ocupante === null) continue;
    if (vistos.has(p.ocupante)) v.push(`${p.ocupante}: ocupa mais de um predio`);
    vistos.add(p.ocupante);
    const u = estado.unidades.porId[p.ocupante];
    if (!u) v.push(`${id}: ocupante '${p.ocupante}' nao existe`);
    else if (!predioAceita(p, u.tipo, dados)) v.push(`${id}: ocupante '${p.ocupante}' e ${u.tipo}, que o predio nao aceita`);
    else if (u.fsm !== 'trabalhando') v.push(`${id}: ocupante '${p.ocupante}' esta em '${u.fsm}'`);
  }
  return v;
}
