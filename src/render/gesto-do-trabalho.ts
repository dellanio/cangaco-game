/**
 * G-TELA-OBREIRO-POR-TAREFA e G-TELA-ROCEIRO-NO-CAMPO (pedidos do operador, 2026-10-04) — o gesto e o
 * lugar de desenho de quem trabalha, lidos do estado (a tarefa e a fase). So apresentacao: nada aqui
 * muda a posicao logica, o relogio ou a tarefa. Os numeros de tela moram em `data/gesto-do-trabalho.json`.
 *
 * - O obreiro faz o gesto da TAREFA: martela a obra, assenta a pedra da estrada, ara o campo.
 * - O roceiro faz o gesto da FASE: enxada ao semear, facao ao colher, e volta com a colheita nas maos.
 * Quem nao tem a animacao no manifesto continua com a de hoje (o `trabalhar` e o `andar`).
 */
import type { GameState, Tarefa, Unidade } from '../sim/state';
import type { CaixaEmTiles } from '../sim/footprint';
import { predioDoOcupante } from '../sim/ocupacao';

/** A caixa em tiles de um tipo de predio posto em (gx, gy): em `render/`, o funil `caixaDeTipoNoMapa`. */
export type CaixaDeTipo = (tipo: string, gx: number, gy: number) => CaixaEmTiles | null;

export interface GestoDoTrabalho {
  /** Animacao do obreiro por tipo de tarefa. */
  readonly obreiroPorTarefa: Readonly<Record<string, string>>;
  /** Animacao do roceiro por estado da FSM. */
  readonly roceiroPorEstado: Readonly<Record<string, string>>;
  /** Quantos px o obreiro avanca na direcao da obra ao martelar. */
  readonly avancoDoMartelarPx: number;
  /** A colheita que o roceiro leva nas maos, por tipo de predio (id do icone). */
  readonly colheitaPorPredio: Readonly<Record<string, string>>;
  /** Tipos que contam como roceiro (quem semeia e colhe campo). */
  readonly tiposDeRoceiro: readonly string[];
}

type Animacoes = Readonly<Record<string, unknown>> | undefined;

function tarefaDa(estado: GameState, u: Pick<Unidade, 'fsmData'>): Tarefa | undefined {
  const id = u.fsmData.tarefa;
  return id ? estado.jobs.tarefas.porId[id] : undefined;
}

/** A animacao do gesto, ou a `acao` de hoje quando nao ha gesto ou o manifesto nao tem a animacao. */
export function animacaoDoGesto(
  estado: GameState, u: Pick<Unidade, 'tipo' | 'fsm' | 'fsmData'>, acao: string, animacoes: Animacoes, config: GestoDoTrabalho,
): string {
  let gesto: string | undefined;
  if (u.tipo === 'laborer' && acao === 'trabalhar') {
    const tarefa = tarefaDa(estado, u);
    gesto = tarefa ? config.obreiroPorTarefa[tarefa.tipo] : undefined;
  } else if (config.tiposDeRoceiro.includes(u.tipo)) {
    if (acao === 'trabalhar') gesto = config.roceiroPorEstado[u.fsm];
    else if (acao === 'andar' && levaColheita(estado, u)) gesto = 'carregando';
  }
  return gesto !== undefined && animacoes?.[gesto] !== undefined ? gesto : acao;
}

/** O roceiro voltando de uma colheita (a tarefa que ele leva e uma `colher`). */
export function levaColheita(estado: GameState, u: Pick<Unidade, 'fsm' | 'fsmData'>): boolean {
  return u.fsm === 'voltando' && tarefaDa(estado, u)?.tipo === 'colher';
}

/** O icone da colheita nas maos do roceiro que volta, ou `null`. */
export function colheitaNasMaos(
  estado: GameState, u: Pick<Unidade, 'id' | 'tipo' | 'fsm' | 'fsmData'>, config: GestoDoTrabalho,
): string | null {
  if (!config.tiposDeRoceiro.includes(u.tipo) || !levaColheita(estado, u)) return null;
  const tarefa = tarefaDa(estado, u);
  const predio = tarefa && 'destino' in tarefa ? estado.predios.porId[tarefa.destino] : undefined;
  return predio ? config.colheitaPorPredio[predio.tipo] ?? null : null;
}

/** O tile em que o trabalho acontece, quando o desenho deve ir para ele. */
function tileDoTrabalho(estado: GameState, u: Pick<Unidade, 'id' | 'tipo' | 'fsm' | 'fsmData'>, config: GestoDoTrabalho): { gx: number; gy: number } | null {
  if (!config.tiposDeRoceiro.includes(u.tipo)) return null;
  if (u.fsm === 'colhendo') {
    const tarefa = tarefaDa(estado, u);
    return tarefa && 'origemTile' in tarefa ? tarefa.origemTile : null;
  }
  if (u.fsm === 'semeando') return predioDoOcupante(estado, u.id)?.producao?.plantio?.tile ?? null;
  return null;
}

/**
 * Quanto o DESENHO anda, em px de tela, a partir do tile logico da unidade. O roceiro vai para o meio
 * do tile do campo que trabalha (a sim o deixa no vizinho); o obreiro, martelando a obra, avanca
 * `avancoDoMartelarPx` na direcao do centro dela. `ladoPx` e o lado do tile na tela.
 */
export function deslocamentoDoTrabalho(
  estado: GameState, u: Pick<Unidade, 'id' | 'tipo' | 'fsm' | 'fsmData' | 'gx' | 'gy'>, acao: string,
  ladoPx: number, config: GestoDoTrabalho, caixaDe: CaixaDeTipo,
): { readonly x: number; readonly y: number } {
  if (acao !== 'trabalhar') return { x: 0, y: 0 };
  const tile = tileDoTrabalho(estado, u, config);
  if (tile) return { x: (tile.gx - u.gx) * ladoPx, y: (tile.gy - u.gy) * ladoPx };
  if (u.tipo === 'laborer' && u.fsm === 'martelando') {
    const tarefa = tarefaDa(estado, u);
    if (!tarefa || (tarefa.tipo !== 'construir' && tarefa.tipo !== 'reparar')) return { x: 0, y: 0 };
    const obra = estado.predios.porId[tarefa.destino];
    const caixa = obra ? caixaDe(obra.tipo, obra.gx, obra.gy) : null;
    if (!caixa) return { x: 0, y: 0 };
    const dx = (caixa.x0 + caixa.x1) / 2 - (u.gx + 0.5); const dy = (caixa.y0 + caixa.y1) / 2 - (u.gy + 0.5);
    const d = Math.hypot(dx, dy);
    return d === 0 ? { x: 0, y: 0 } : { x: (dx / d) * config.avancoDoMartelarPx, y: (dy / d) * config.avancoDoMartelarPx };
  }
  return { x: 0, y: 0 };
}
