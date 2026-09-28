/**
 * F28a — a regra do golpe entre unidades, num lugar so: direcao, frente/flanco/costas,
 * attack efetivo e a chance de acerto da formula de `combat.json`. Pura, sem RNG: o
 * sorteio e de quem chama (`systems/combate.ts`), com o RNG do estado.
 */
import type { Unidade } from './state';
import type { GameData } from './data/types';
import { gameData } from './data';

/** Direcao ausente: 4, sul, de frente para a camera (`Unidade.direcao`). */
export const DIRECAO_PADRAO = 4;

/** Os oito vizinhos na ordem das direcoes: 0 = norte, sentido horario. */
const PASSOS: readonly (readonly [number, number])[] = [
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
];

export function direcaoDe(u: Unidade): number {
  return u.direcao ?? DIRECAO_PADRAO;
}

/** A direcao (0..7) de `de` para `para`, pelo sinal de dx e dy. `null` no mesmo tile. */
export function direcaoEntre(
  de: { readonly gx: number; readonly gy: number }, para: { readonly gx: number; readonly gy: number },
): number | null {
  const dx = Math.sign(para.gx - de.gx);
  const dy = Math.sign(para.gy - de.gy);
  if (dx === 0 && dy === 0) return null;
  return PASSOS.findIndex(([x, y]) => x === dx && y === dy);
}

export type LadoDoGolpe = 'frente' | 'flanco' | 'costas';

/**
 * De que lado do ALVO o golpe vem: a diferenca entre para onde o alvo olha e a direcao
 * do alvo ao atacante. 0 ou 1 passo (45 graus) e frente, 2 e flanco, 3 ou 4 e costas.
 * No mesmo tile, frente. (Leitura da sessao autonoma, PARA REVISAO.)
 */
export function ladoDoGolpe(atacante: Unidade, alvo: Unidade): LadoDoGolpe {
  const ate = direcaoEntre(alvo, atacante);
  if (ate === null) return 'frente';
  const bruta = Math.abs(ate - direcaoDe(alvo)) % 8;
  const diferenca = Math.min(bruta, 8 - bruta);
  if (diferenca <= 1) return 'frente';
  if (diferenca === 2) return 'flanco';
  return 'costas';
}

type DefDeTropa = GameData['unidades']['militares']['tipos'][number] | GameData['unidades']['mercenarios']['tipos'][number];

export function defDaTropa(tipo: string, dados: GameData = gameData): DefDeTropa | null {
  return dados.unidades.militares.tipos.find((t) => t.id === tipo)
    ?? dados.unidades.mercenarios.tipos.find((t) => t.id === tipo) ?? null;
}

/** A chance de `atacante` acertar `alvo`, pela formula de `combat.json`:
 *  `clamp(attackEfetivo * multiplicadorDirecao / (defence * 100), piso, teto)`. */
export function chanceDeAcerto(atacante: Unidade, alvo: Unidade, dados: GameData = gameData): number {
  const a = defDaTropa(atacante.tipo, dados);
  const d = defDaTropa(alvo.tipo, dados);
  if (a === null || d === null) return 0;
  const attackEfetivo = a.attack + (d.montado ? a.attackVsCavalo : 0);
  const multiplicador = dados.combate.multiplicadorDirecao[ladoDoGolpe(atacante, alvo)];
  const bruta = (attackEfetivo * multiplicador) / (d.defence * 100);
  return Math.min(dados.combate.tetoAcerto, Math.max(dados.combate.pisoAcerto, bruta));
}

export function ehADistancia(tipo: string, dados: GameData = gameData): boolean {
  const def = defDaTropa(tipo, dados);
  return def !== null && 'aDistancia' in def && def.aDistancia === true;
}

/** Encostado: Chebyshev 1 (os oito vizinhos). */
export function encostadas(a: { readonly gx: number; readonly gy: number }, b: { readonly gx: number; readonly gy: number }): boolean {
  return Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy)) === 1;
}
