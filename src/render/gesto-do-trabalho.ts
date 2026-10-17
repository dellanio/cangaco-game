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
import { alvoDeNivelamento } from '../sim/obra';
import { canteiroDaObra, indiceDoObreiroNoLote, ordemDeNivelamento } from './nivelamento-obra';

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
  /** I-TELA-OBREIRO-NIVELA-O-LOTE: a animacao do obreiro que aplaina o lote. */
  readonly obreiroNivelando?: string;
  /** I-TELA-OBREIRO-NIVELA-O-LOTE: a velocidade do desenho do obreiro andando dentro do lote, em tiles por segundo. */
  readonly velocidadeNoLoteTilesPorSegundo?: number;
  /** I-TELA-LENHADOR-CORTA-E-DERRUBA: quem, alem do roceiro, volta com a colheita nas maos (o lenhador com a tora). */
  readonly tiposQueLevamAColheita?: readonly string[];
  /** I-TELA-LENHADOR-CORTA-E-DERRUBA: o lenhador junto ao tronco e as lascas. */
  readonly lenhador?: { readonly distanciaDoTroncoTiles: number; readonly quadrosDoGolpe: readonly number[]; readonly lascasPorGolpe: number };
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
  if (u.tipo === 'laborer' && acao === 'trabalhar' && u.fsm === 'nivelando' && config.obreiroNivelando !== undefined) {
    gesto = config.obreiroNivelando;
  } else if (u.tipo === 'laborer' && acao === 'trabalhar') {
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
  if (!(config.tiposDeRoceiro.includes(u.tipo) || (config.tiposQueLevamAColheita ?? []).includes(u.tipo)) || !levaColheita(estado, u)) return null;
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

/** I-TELA-OBREIRO-NIVELA-O-LOTE — onde o obreiro que nivela e desenhado: o tile em curso (absoluto) e o ponto, em
 *  tiles (fracionario), no caminho em zigue-zague. */
export interface PontoNoLote {
  readonly tile: { readonly gx: number; readonly gy: number };
  readonly gx: number;
  readonly gy: number;
}

/**
 * I-TELA-OBREIRO-NIVELA-O-LOTE — onde o obreiro que nivela e desenhado, ou `null` (nao nivela, ou a obra sumiu). O
 * tile e o em curso da leitura do canteiro (a mesma da F17d), mais a ordem do obreiro entre os que nivelam a mesma
 * obra, no zigue-zague; o ponto avanca dentro dele para o tile seguinte com a fracao do nivelamento, como quem capina
 * andando para a frente. So desenho: a posicao logica nao muda.
 */
export function tileDoNivelamento(
  estado: GameState, u: Pick<Unidade, 'id' | 'tipo' | 'fsm' | 'fsmData'>, caixaDe: CaixaDeTipo,
): PontoNoLote | null {
  if (u.tipo !== 'laborer' || u.fsm !== 'nivelando') return null;
  const tarefa = tarefaDa(estado, u);
  if (!tarefa || tarefa.tipo !== 'construir') return null;
  const obra = estado.predios.porId[tarefa.destino];
  if (!obra || obra.estado !== 'obra') return null;
  const caixa = caixaDe(obra.tipo, obra.gx, obra.gy);
  if (!caixa) return null;
  const largura = caixa.x1 - caixa.x0; const altura = caixa.y1 - caixa.y0;
  const canteiro = canteiroDaObra(obra.obra.nivelamento, alvoDeNivelamento(obra.tipo), largura * altura);
  // a ordem do obreiro entre os que nivelam esta obra, pela ordem das unidades no estado (estavel entre ticks)
  const colegas = estado.unidades.ordem.filter((id) => {
    const c = estado.unidades.porId[id];
    return c !== undefined && c.tipo === 'laborer' && c.fsm === 'nivelando' && c.fsmData.tarefa !== undefined
      && (() => { const t = estado.jobs.tarefas.porId[c.fsmData.tarefa as string]; return t?.tipo === 'construir' && t.destino === obra.id; })();
  });
  const ordem = ordemDeNivelamento(largura, altura);
  const indice = indiceDoObreiroNoLote(canteiro, Math.max(0, colegas.indexOf(u.id)));
  const t = ordem[indice];
  if (t === undefined) return null;
  const seguinte = ordem[indice + 1] ?? t;
  const f = canteiro.nivelada ? 0 : canteiro.oitavosDoTileEmCurso / 8;
  return { tile: { gx: caixa.x0 + t.gx, gy: caixa.y0 + t.gy }, gx: caixa.x0 + t.gx + (seguinte.gx - t.gx) * f, gy: caixa.y0 + t.gy + (seguinte.gy - t.gy) * f };
}

/** I-TELA-OBREIRO-NIVELA-O-LOTE — onde o desenho do obreiro esta, em px a partir do tile logico, e como ele chegou la. */
export interface DesenhoNoLote {
  readonly x: number;
  readonly y: number;
  /** o tempo da animacao (em ticks, `tempoDeAnimacao`) desta leitura */
  readonly tempo: number;
  /** ainda andando ate o alvo (o gesto e `andar`), ou ja no tile (o gesto do nivelamento) */
  readonly andando: boolean;
  /** px andados no lote, para o quadro do `andar` */
  readonly distanciaPx: number;
  /** o ultimo passo nao nulo, em px, para a direcao do corpo */
  readonly dx: number;
  readonly dy: number;
}

/**
 * I-TELA-OBREIRO-NIVELA-O-LOTE — um passo do desenho do obreiro em direcao ao `alvo` (px a partir do tile logico), a
 * `pxPorTick` no maximo. Sem alvo (o nivelamento acabou), ele volta andando ao proprio tile e, chegando, sai do lote
 * (`null`). Conta como andando (o gesto `andar`) so quem esta a mais de `limiarPx` do alvo: entrar no lote e voltar
 * ao posto; seguir o avanco lento do nivelamento e capinar.
 */
export function passoNoLote(
  anterior: DesenhoNoLote | null, alvo: { readonly x: number; readonly y: number } | null, tempo: number, pxPorTick: number,
  limiarPx = 0,
): DesenhoNoLote | null {
  if (anterior === null && alvo === null) return null;
  const de = anterior ?? { x: 0, y: 0, tempo, andando: false, distanciaPx: 0, dx: 0, dy: 0 };
  const para = alvo ?? { x: 0, y: 0 };
  const passo = Math.max(0, tempo - de.tempo) * pxPorTick;
  const ex = para.x - de.x; const ey = para.y - de.y;
  const falta = Math.hypot(ex, ey);
  if (falta <= passo || falta < 0.5) {
    if (alvo === null) return null;
    return { x: para.x, y: para.y, tempo, andando: false, distanciaPx: de.distanciaPx + falta, dx: falta > 0 ? ex : de.dx, dy: falta > 0 ? ey : de.dy };
  }
  const k = passo / falta;
  return { x: de.x + ex * k, y: de.y + ey * k, tempo, andando: falta > limiarPx, distanciaPx: de.distanciaPx + passo, dx: ex, dy: ey };
}
