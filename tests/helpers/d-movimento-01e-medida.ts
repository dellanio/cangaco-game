/**
 * D-MOVIMENTO-01e (aceite da colisao civil) — a medida do transporte: quanto a mercadoria ESPERA na gaveta (lei de Little). A
 * espera media da madeira na saida das serrarias e a soma, tick a tick, da madeira parada
 * nas saidas, dividida pela madeira produzida na mesma janela. Mede o que o jogador sente:
 * o predio produz e nada chega.
 */
import type { GameData } from '../../src/sim/data/types';
import type { GameState, PredioCompleto } from '../../src/sim/state';
import { step } from '../../src/sim/tick';
import { violacoesDaColisao } from './jobs-invariantes';
import type { CenarioDaColisaoNaVila } from './d-movimento-01e-cenario';

export interface MedidaDaEspera {
  readonly ticks: number;
  /** Ticks, em media, que cada madeira passa na gaveta de saida da serraria. */
  readonly esperaDaMadeiraNaGaveta: number;
  readonly madeiraProduzida: number;
  readonly madeiraEntregue: number;
  readonly maiorEspera: number;
  readonly violacoes: readonly string[];
}

export function medirEsperaNaGaveta(c: CenarioDaColisaoNaVila, ticks: number, dados: GameData, aquecimento: number): MedidaDaEspera {
  let s: GameState = c.estado;
  let area = 0;
  let produzida = 0;
  let entregue = 0;
  let maiorEspera = 0;
  const violacoes: string[] = [];
  for (let t = 0; t < ticks; t += 1) {
    s = step(s, [], dados);
    if (t < aquecimento) continue;
    for (const id of c.serrarias) area += (s.predios.porId[id] as PredioCompleto).estoque.saida['timber'] ?? 0;
    for (const e of s.events) {
      if (e.type === 'goods-produced' && e.mercadoria === 'timber' && c.serrarias.includes(e.predio)) produzida += e.quantidade;
      if (e.type === 'task-completed' && e.mercadoria === 'timber' && e.destino === c.armazem) entregue += 1;
    }
    for (const id of s.unidades.ordem) {
      const u = s.unidades.porId[id];
      maiorEspera = Math.max(maiorEspera, u?.fsmData.bloqueado ?? 0, u?.saindo ?? 0);
    }
    if (violacoes.length < 5) violacoes.push(...violacoesDaColisao(s, dados).map((v) => `t${s.tick}: ${v}`));
  }
  return {
    ticks, esperaDaMadeiraNaGaveta: produzida === 0 ? Number.NaN : +(area / produzida).toFixed(1),
    madeiraProduzida: produzida, madeiraEntregue: entregue, maiorEspera, violacoes,
  };
}
