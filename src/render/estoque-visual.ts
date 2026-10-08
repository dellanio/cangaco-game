import dados from '../../data/estoque-visual.json';
import type {Predio} from '../sim/state';
import {pilhasDoPredio} from './pilhas';
import type {DadosDasPilhas, PilhaDesenhada} from './pilhas';

export function pilhasVisiveisDoPredio(predio: Predio, contexto: DadosDasPilhas): PilhaDesenhada[] {
  if (predio.estado === 'completo' && dados.ocultarEmPrediosCompletos.includes(predio.tipo)) return [];
  return pilhasDoPredio(predio, contexto);
}

export function ladoPadraoDoEstoque(tilePx: number): number {
  return tilePx * dados.ladoEmTiles;
}

/** Tamanho usado tanto no desenho real quanto na evidencia publicada. */
export function ladoDaMercadoriaNoEstoque(tipo: string, mercadoria: string, ladoPadrao: number): number {
  const porPredio: Readonly<Record<string, Readonly<Record<string, number>> | undefined>> = dados.escalaPorPredio;
  return ladoPadrao * (porPredio[tipo]?.[mercadoria] ?? dados.escalaPadrao);
}
