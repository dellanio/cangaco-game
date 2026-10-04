/**
 * D-MOVIMENTO-01d (JobBoard e porta por estado da chave) — "nasce na porta", com um valor POR ESTADO DA CHAVE da colisao civil (decisao do
 * operador, 2026-09-28: o mesmo caso e a mesma solucao do tick exato; a faixa foi recusada
 * porque aceitaria deriva futura sem avisar).
 *  - desligada: todos NA porta, como sempre foi;
 *  - ligada: cada um NA porta ou num VIZINHO dela (o empurrao tira o segundo do tile), e
 *    nenhum empilhado com outro.
 * Devolve a lista de quem esta fora do lugar (vazia = certo).
 */
import type { GameData } from '../../src/sim/data/types';
import type { TileDeGrid } from '../../src/sim/estradas';
import { colisaoCivilLigada } from '../../src/sim/colisao';

export function foraDaPorta(portas: readonly TileDeGrid[], onde: readonly TileDeGrid[], dados: GameData): string[] {
  const chave = (t: TileDeGrid): string => `${t.gx},${t.gy}`;
  const naPorta = (t: TileDeGrid): boolean => portas.some((p) => p.gx === t.gx && p.gy === t.gy);
  if (!colisaoCivilLigada(dados)) return onde.filter((t) => !naPorta(t)).map(chave);
  // I-MOVIMENTO-FILA-DE-CIVIS: com a porta cercada (sem vizinho livre), quem sai vai ao tile livre mais
  // perto, dentro de `margemDoEmpurrao` (o dado): medido na escola cercada por seis ociosos, 2 tiles
  const m = dados.movimento.colisaoCivil.margemDoEmpurrao;
  const junto = (t: TileDeGrid): boolean => portas.some((p) => Math.abs(p.gx - t.gx) <= m && Math.abs(p.gy - t.gy) <= m);
  const erros = onde.filter((t) => !junto(t)).map(chave);
  const vistos = new Set<string>();
  for (const t of onde) {
    if (vistos.has(chave(t))) erros.push(`${chave(t)} empilhado`);
    vistos.add(chave(t));
  }
  return erros;
}
