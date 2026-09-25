/**
 * As invariantes da FSM do especialista (F14), irma de `laborer-invariantes.ts`.
 * Devolve a lista de violacoes (vazia = tudo certo). O ponto central: a POSSE
 * mora so no predio, entao "os dois lados concordam" e a coisa a verificar.
 *
 * F15a — os estados de PRODUCAO (`esperando_insumo`, `saida_cheia`) passaram a
 * existir. Aqui eles valem tudo o que `trabalhando` valia: quem esta em
 * qualquer um dos tres OCUPA um predio. Uma pedreira sem estrada fica em
 * `saida_cheia` desde a F15a (D6) e continua legitimamente ocupada.
 *
 * F-T3 — e agora ha tres estados EM CAMPO (`indo_colher`, `colhendo`,
 * `voltando`). Eles tambem OCUPAM: o predio continua apontando para a unidade
 * enquanto ela esta na roca, senao o alerta `sem-trabalhador` acenderia a cada
 * ciclo. O que muda e o resto — em campo a unidade TEM caminho e TEM tarefa de
 * colheita na mao, as duas coisas que nos estados de producao eram violacao.
 * A invariante propria do campo e de POSICAO: quem esta `colhendo` esta no tile
 * da sua tarefa ou ao lado dele. Foi so isso que a F-T3 afrouxou; tudo que valia
 * antes para `trabalhando` continua valendo.
 */
import { gameData } from '../../src/sim/data';
import type { GameData } from '../../src/sim/data/types';
import type { GameState } from '../../src/sim/state';
import { ehTarefaDeColheita } from '../../src/sim/state';
import { predioAceita, predioDoOcupante, tiposQueOcupam } from '../../src/sim/ocupacao';
import { caixaDoPredio, type CaixaEmTiles } from '../../src/sim/footprint';

/** F15a — os tres estados em que o especialista trabalha DENTRO do predio: tem
 *  predio, nao segura tarefa de ocupar e tem `fsmData` vazio. O que os distingue
 *  e o ciclo, nao a ocupacao. */
export const ESTADOS_DE_PRODUCAO = ['trabalhando', 'esperando_insumo', 'saida_cheia'] as const;

/** F-T3 — os tres estados em que ele esta FORA do predio, mas ainda o ocupa. */
export const ESTADOS_EM_CAMPO = ['indo_colher', 'colhendo', 'voltando'] as const;

export const ESTADOS_DO_ESPECIALISTA = [
  'ocioso', 'indo_ocupar', ...ESTADOS_DE_PRODUCAO, ...ESTADOS_EM_CAMPO,
] as const;

/** Estado que exige predio dos dois lados: producao OU campo. E a pergunta que o
 *  lado do PREDIO faz sobre o seu ocupante. */
const ocupa = (fsm: string): boolean => (
  (ESTADOS_DE_PRODUCAO as readonly string[]).includes(fsm)
  || (ESTADOS_EM_CAMPO as readonly string[]).includes(fsm)
);

/** F-T3 — onde o caminho pendente e legitimo. `colhendo` nao esta aqui de
 *  proposito: chegar ao tile CONSOME o caminho no mesmo tick. */
const ANDANDO = ['indo_ocupar', 'indo_colher', 'voltando'] as const;

/** Distancia de Chebyshev de um tile a uma caixa MEIO-ABERTA. Zero dentro dela,
 *  1 na borda de fora — que e onde a porta do predio esta. */
function distanciaACaixa(gx: number, gy: number, caixa: CaixaEmTiles): number {
  const dx = Math.max(caixa.x0 - gx, 0, gx - (caixa.x1 - 1));
  const dy = Math.max(caixa.y0 - gy, 0, gy - (caixa.y1 - 1));
  return Math.max(dx, dy);
}

export function violacoesDaFsmDoEspecialista(estado: GameState, dados: GameData = gameData): string[] {
  const v: string[] = [];
  const ocupam = tiposQueOcupam(dados);
  const tarefasPorUnidade = new Map<string, string[]>();
  const colheitasPorUnidade = new Map<string, string[]>();
  for (const id of estado.jobs.tarefas.ordem) {
    const t = estado.jobs.tarefas.porId[id];
    if (t && t.tipo === 'ocupar' && t.estado !== 'aberta' && t.reclamadaPor !== null) {
      tarefasPorUnidade.set(t.reclamadaPor, [...(tarefasPorUnidade.get(t.reclamadaPor) ?? []), id]);
    }
    if (t && ehTarefaDeColheita(t) && t.reclamadaPor !== null) {
      colheitasPorUnidade.set(t.reclamadaPor, [...(colheitasPorUnidade.get(t.reclamadaPor) ?? []), id]);
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
    const colheitas = colheitasPorUnidade.get(id) ?? [];
    if (colheitas.length > 1) v.push(`${id}: segura ${colheitas.length} tarefas de colheita`);
    // a tarefa de colheita e do PREDIO que ele ocupa, em qualquer estado: tile
    // reservado para um predio e trabalhado por quem ocupa outro seria roubo
    for (const tid of colheitas) {
      const t = estado.jobs.tarefas.porId[tid];
      if (t === undefined || !ehTarefaDeColheita(t)) continue;
      if (predio === null) v.push(`${id}: segura a colheita ${tid} sem ocupar predio nenhum`);
      else if (t.destino !== predio.id) v.push(`${id}: ocupa ${predio.id} e segura colheita de ${t.destino}`);
    }

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
      case 'esperando_insumo':
      case 'saida_cheia':
        if (predio === null) v.push(`${id}: ${u.fsm} sem predio que o reconheca`);
        if (suas.length > 0) v.push(`${id}: ${u.fsm} e ainda segura a tarefa ${suas[0]}`);
        if (Object.keys(u.fsmData).length > 0) v.push(`${id}: ${u.fsm} com fsmData nao vazio`);
        break;
      // F-T3 — em campo: predio ainda dele, tarefa de colheita na mao (a `voltando`
      // pode ter perdido o tile no caminho, e e por isso que ela nao exige),
      // e `fsmData.tarefa` apontando para a MESMA tarefa que o quadro registra.
      case 'indo_colher':
      case 'colhendo':
      case 'voltando':
        if (predio === null) v.push(`${id}: ${u.fsm} sem predio que o reconheca`);
        if (suas.length > 0) v.push(`${id}: ${u.fsm} e ainda segura a tarefa de ocupar ${suas[0]}`);
        // ... exceto com o predio PAUSADO: `motivoDoDestino` cancela a colheita do
        // predio pausado (F16c) e o ocupante congela no campo, sem tarefa, ate o
        // jogador despausar. Fora da pausa, colher sem tarefa e tile sem reserva.
        if (u.fsm !== 'voltando' && colheitas.length !== 1 && predio?.pausado !== true) {
          v.push(`${id}: ${u.fsm} sem tarefa de colheita reclamada por ele`);
        }
        if (u.fsmData.tarefa !== undefined && !colheitas.includes(u.fsmData.tarefa)) {
          v.push(`${id}: ${u.fsm} aponta para a tarefa ${u.fsmData.tarefa}, que nao e dele`);
        }
        break;
      default:
        break;
    }

    // F-T3 — a invariante de POSICAO do campo: quem esta `colhendo` esta NO tile
    // da sua tarefa ou num dos oito vizinhos (`alvosDeAproximacao`). Trabalhar de
    // longe seria o defeito silencioso deste desvio — a pedra apareceria na gaveta
    // com o roceiro ainda a meio caminho.
    if (u.fsm === 'colhendo') {
      const tid = colheitas[0];
      const t = tid === undefined ? undefined : estado.jobs.tarefas.porId[tid];
      if (t !== undefined && ehTarefaDeColheita(t)) {
        const d = Math.max(Math.abs(u.gx - t.origemTile.gx), Math.abs(u.gy - t.origemTile.gy));
        if (d > 1) v.push(`${id}: colhendo a ${d} tiles de ${t.origemTile.gx},${t.origemTile.gy}`);
      }
    }

    const caminho = u.fsmData.caminho ?? [];
    if (caminho.length > 0 && !(ANDANDO as readonly string[]).includes(u.fsm)) {
      v.push(`${id}: ${u.fsm} com caminho pendente`);
    }
    // F-T3 — e o contrario tambem e violacao: quem anda sem caminho so e legitimo
    // no tick da CHEGADA, e chegar tem lugar. `indo_colher` sem caminho esta no
    // tile da tarefa ou ao lado dele; `voltando` sem caminho esta na porta do
    // proprio predio. Fora disso e unidade parada para sempre a meio caminho — o
    // travamento silencioso que nenhuma contagem de tarefa pega.
    if (caminho.length === 0 && u.fsm === 'indo_colher') {
      const tid = colheitas[0];
      const t = tid === undefined ? undefined : estado.jobs.tarefas.porId[tid];
      if (t !== undefined && ehTarefaDeColheita(t)) {
        const d = Math.max(Math.abs(u.gx - t.origemTile.gx), Math.abs(u.gy - t.origemTile.gy));
        if (d > 1) v.push(`${id}: indo_colher sem caminho a ${d} tiles de ${t.origemTile.gx},${t.origemTile.gy}`);
      }
    }
    if (caminho.length === 0 && u.fsm === 'voltando' && predio !== null) {
      const caixa = caixaDoPredio(predio, dados);
      const d = caixa === null ? 0 : distanciaACaixa(u.gx, u.gy, caixa);
      if (d > 1) v.push(`${id}: voltando sem caminho a ${d} tiles de ${predio.id}`);
    }
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
    else if (!ocupa(u.fsm)) v.push(`${id}: ocupante '${p.ocupante}' esta em '${u.fsm}'`);
  }
  return v;
}
