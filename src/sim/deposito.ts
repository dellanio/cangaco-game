/**
 * Devolver mercadoria a um predio completo, na gaveta `saida` — que e de onde o
 * serf a retira de volta para a economia (F09/F10).
 *
 * Duas coisas demolem e devolvem: a estrada (F08) e o predio (F16a). QUANTO
 * devolver e QUEM recebe sao contas de cada uma delas, e diferentes de proposito
 * — a estrada nao tem porta de onde medir distancia, o predio tem. O deposito em
 * si e um so: em dois lugares, divergiria.
 */
import type { Colecao, Predio } from './state';

/**
 * Soma `quantidades` na gaveta `saida` de `destino`. `destino === null` (ou
 * destino que nao e predio completo) devolve a colecao INTACTA: e a perda
 * declarada da F16a — estoque de predio sem armazem alcancavel se perde, e quem
 * chama e que decide se isso e aceitavel. Nao checa capacidade: nenhuma gaveta
 * de armazem tem teto hoje (`capacidade` nula), e inventar um descarte aqui
 * seria regra de jogo nao pedida.
 */
export function devolverMercadorias(
  predios: Colecao<Predio>,
  quantidades: Readonly<Record<string, number>>,
  destino: string | null,
): Colecao<Predio> {
  if (destino === null) return predios;
  const positivas = Object.entries(quantidades).filter(([, q]) => q > 0);
  if (positivas.length === 0) return predios;

  const predio = predios.porId[destino];
  if (!predio || predio.estado !== 'completo') return predios;

  const saida = { ...predio.estoque.saida };
  for (const [mercadoria, quantidade] of positivas) {
    saida[mercadoria] = (saida[mercadoria] ?? 0) + quantidade;
  }
  return {
    porId: { ...predios.porId, [destino]: { ...predio, estoque: { ...predio.estoque, saida } } },
    ordem: predios.ordem,
  };
}
