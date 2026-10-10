/**
 * I-PRODUCAO-ACUDE-IRRIGACAO — quem o Acude irriga (plano docs/planos/2026-10-05-acude-e-clima.md, etapa 5,
 * opcao A: pela distancia, sem serf levando agua). Puro: so le o estado e o dado.
 *
 * A fazenda (o predio cuja colheita e cultura do clima) esta irrigada quando ha um Acude completo do mesmo
 * lado, com `agua >= aguaMinimaParaIrrigar`, a ate `raio_tiles` (euclidiano, centro a centro). Com dois,
 * vale o mais perto, e o empate se desfaz pelo id: dois Acudes nao somam. O tile semeado por ela guarda
 * `irrigado: true`, e o crescer usa `multiplicadorComIrrigacao`.
 */
import type { GameData } from './data/types';
import { gameData } from './data';
import type { GameState, Predio, PredioCompleto } from './state';
import { ID_DO_ACUDE } from './state';
import { caixaDoPredio } from './footprint';
import { receitaDoTipo } from './producao';

/** O centro do footprint, em tiles (a caixa e semiaberta: x1 e y1 ficam fora). */
function centro(p: Predio, dados: GameData): { readonly x: number; readonly y: number } | null {
  const c = caixaDoPredio(p, dados);
  return c === null ? null : { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 };
}

/** A fazenda que o Acude pode irrigar: predio completo cuja colheita e cultura do clima. */
export function ehFazendaDoClima(p: Predio | undefined, dados: GameData = gameData): p is PredioCompleto {
  if (p === undefined || p.estado !== 'completo') return false;
  const colheita = receitaDoTipo(p.tipo, dados)?.colheita;
  return colheita !== undefined && colheita !== null && dados.clima.culturas.includes(colheita.recurso);
}

/** O Acude que irriga a fazenda agora, ou `null`. */
export function acudeDaFazenda(state: GameState, fazenda: PredioCompleto, dados: GameData = gameData): string | null {
  const daFazenda = centro(fazenda, dados);
  if (daFazenda === null) return null;
  let melhor: { readonly id: string; readonly d2: number } | null = null;
  for (const id of state.predios.ordem) {
    const a = state.predios.porId[id];
    if (a === undefined || a.estado !== 'completo' || a.tipo !== ID_DO_ACUDE || a.lado !== fazenda.lado) continue;
    if ((a.agua ?? 0) < dados.acude.aguaMinimaParaIrrigar) continue;
    const doAcude = centro(a, dados);
    if (doAcude === null) continue;
    const d2 = (doAcude.x - daFazenda.x) ** 2 + (doAcude.y - daFazenda.y) ** 2;
    if (d2 > dados.acude.raio_tiles ** 2) continue;
    if (melhor === null || d2 < melhor.d2 || (d2 === melhor.d2 && id < melhor.id)) melhor = { id, d2 };
  }
  return melhor === null ? null : melhor.id;
}

/** O multiplicador de crescimento do tile irrigado: o da estacao `m`, subido pelo bonus ate o teto, e
 *  nunca abaixo de `m` (no inverno, acima do teto, a irrigacao nao muda nada). */
export function multiplicadorComIrrigacao(m: number, dados: GameData = gameData): number {
  return Math.max(m, Math.min(dados.acude.tetoDoMultiplicador, m + dados.acude.bonusDeCrescimento));
}

/** Quantas fazendas OCUPADAS o Acude `acude` irriga agora: o que ele consome por vez. */
export function fazendasQueConsomem(state: GameState, acude: PredioCompleto, dados: GameData = gameData): number {
  let n = 0;
  for (const id of state.predios.ordem) {
    const f = state.predios.porId[id];
    if (!ehFazendaDoClima(f, dados) || f.ocupante === null) continue;
    if (acudeDaFazenda(state, f, dados) === acude.id) n += 1;
  }
  return n;
}
