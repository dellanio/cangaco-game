/**
 * I-ARTE-MONTANHA-COM-VEIOS (pedido do operador, 2026-10-16) — o bloco de granito em pe de cada tile de montanha, e o
 * veio de ferro ou de ouro na face dele. Pura e sem `phaser`. A sim ja poe o ferro e o ouro na montanha (F21b), como o
 * KaM (`src/terrain/KM_Terrain.pas:1226-1242`); aqui so se escolhe a arte.
 */
import { LACOS_DO_MACICO as VARIANTES_DO_MACICO } from './manifesto-camadas';

export { ID_DO_MACICO } from './manifesto-camadas';
/** Os recursos cujo morrinho sai do mapa: na montanha, eles aparecem como veio no bloco. */
export const VEIOS_NA_MONTANHA: readonly string[] = ['iron_ore', 'gold_ore'];

/** Um numero estavel por tile (o mesmo tile, a mesma variante, em qualquer partida). */
function hashDoTile(gx: number, gy: number): number {
  let h = (Math.imul(gx, 0x27d4eb2d) ^ Math.imul(gy + 0x9e37, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

/**
 * O estado da arte do bloco do tile, ou \`null\` fora da montanha: o veio de ferro ou de ouro quando o tile tem o
 * recurso com quantidade; senao, o granito. \`granito_<1..4>\`, \`ferro_<1..2>\`, \`ouro_<1..2>\`.
 */
export function blocoDoMacico(
  terreno: string, gx: number, gy: number, recurso: { readonly tipo: string; readonly quantidade: number } | undefined,
): string | null {
  if (terreno !== 'montanha' && terreno !== 'rocha') return null;
  const h = hashDoTile(gx, gy);
  if (recurso !== undefined && recurso.quantidade > 0) {
    if (recurso.tipo === 'iron_ore') return `ferro_${(h % VARIANTES_DO_MACICO.ferro) + 1}`;
    if (recurso.tipo === 'gold_ore') return `ouro_${(h % VARIANTES_DO_MACICO.ouro) + 1}`;
  }
  // a rocha so tem bloco com o veio: no sertao, o veio na rocha e a saia de pedra encostada no macico (a ate 2 tiles);
  // esgotado, volta o lajedo de hoje
  return terreno === 'montanha' ? `granito_${(h % VARIANTES_DO_MACICO.granito) + 1}` : null;
}
