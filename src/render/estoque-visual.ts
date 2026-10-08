import dados from '../../data/estoque-visual.json';
import type {Predio} from '../sim/state';
import {posicoesNaPilha, pilhasDoPredio} from './pilhas';
import type {DadosDasPilhas, PilhaDesenhada} from './pilhas';

export function pilhasVisiveisDoPredio(predio: Predio, contexto: DadosDasPilhas): PilhaDesenhada[] {
  if (predio.estado === 'completo' && dados.ocultarEmPrediosCompletos.includes(predio.tipo)) return [];
  return pilhasDoPredio(predio, contexto).map(pilha => {
    const regra = dados.peixesPendurados;
    if (predio.estado !== 'completo' || predio.tipo !== regra.predio || pilha.mercadoria !== regra.mercadoria) return pilha;
    return { ...pilha, n: Math.min(predio.estoque.entrada[pilha.mercadoria] ?? 0, regra.teto) };
  });
}

/** Pontos locais normalizados; a corda faz parte do sprite, nao da casa. */
export function pontosDosPeixesPendurados(tipo: string, mercadoria: string, n: number): readonly (readonly [number, number])[] | null {
  const regra = dados.peixesPendurados;
  if (tipo !== regra.predio || mercadoria !== regra.mercadoria) return null;
  const quantos = Math.max(0, Math.min(Math.floor(n), regra.teto));
  const esquerda = Math.ceil(quantos / 2);
  return Array.from({ length: quantos }, (_, i) => {
    const lado = i < esquerda ? 0 : 1;
    const indice = lado === 0 ? i : i - esquerda;
    const ponto = regra.laterais[lado]!;
    return [ponto[0]! + indice * regra.passoX, ponto[1]! + indice * regra.passoY[lado]!] as const;
  });
}

export function ladoPadraoDoEstoque(tilePx: number): number {
  return tilePx * dados.ladoEmTiles;
}

/** Tamanho usado tanto no desenho real quanto na evidencia publicada. */
export function ladoDaMercadoriaNoEstoque(tipo: string, mercadoria: string, ladoPadrao: number): number {
  const porPredio: Readonly<Record<string, Readonly<Record<string, number>> | undefined>> = dados.escalaPorPredio;
  return ladoPadrao * (porPredio[tipo]?.[mercadoria] ?? dados.escalaPadrao);
}

/** Fileira na area de estoque; os outros estoques conservam a pilha tradicional. */
export function posicoesDaMercadoriaNoEstoque(tipo: string, mercadoria: string, n: number): readonly (readonly [number, number])[] {
  const regras: Readonly<Record<string, Readonly<Record<string, { readonly espacamentoEmLados: number }>> | undefined>> = dados.fileirasPorPredio;
  const regra = regras[tipo]?.[mercadoria];
  if (regra === undefined) return posicoesNaPilha(n);
  return Array.from({length: n}, (_, i) => [(i - (n - 1) / 2) * regra.espacamentoEmLados, 0] as const);
}
