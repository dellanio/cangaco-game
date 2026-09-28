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

/** F28d — o projetil do atirador (`units.json: projetil`), ou `null` para quem luta de perto. */
export function projetilDe(tipo: string, dados: GameData = gameData): string | null {
  const def = defDaTropa(tipo, dados);
  return def !== null && 'projetil' in def && typeof def.projetil === 'string' ? def.projetil : null;
}

/** F28d — tem escudo quem leva um dos escudos do dado nos `requisitos` (derivado). */
export function temEscudo(tipo: string, dados: GameData = gameData): boolean {
  const def = defDaTropa(tipo, dados);
  const requisitos = def !== null && 'requisitos' in def ? def.requisitos : [];
  return requisitos.some((m) => dados.combate.escudo.mercadorias.includes(m));
}

/** F28d — a defesa extra do escudo contra `projetil` (0 sem escudo ou de perto). */
export function defesaDoEscudo(alvoTipo: string, projetil: string | null, dados: GameData = gameData): number {
  if (projetil === null || !temEscudo(alvoTipo, dados)) return 0;
  const tabela: Readonly<Record<string, number>> = dados.combate.escudo.defesaContraProjetil;
  return tabela[projetil] ?? 0;
}

/** A chance de `atacante` acertar `alvo`, pela formula de `combat.json`:
 *  `clamp(attackEfetivo * multiplicadorDirecao / (defence * 100), piso, teto)`. Contra
 *  projetil (F28d), a `defence` soma a do escudo. */
export function chanceDeAcerto(atacante: Unidade, alvo: Unidade, dados: GameData = gameData): number {
  const a = defDaTropa(atacante.tipo, dados);
  const d = defDaTropa(alvo.tipo, dados);
  if (a === null || d === null) return 0;
  const attackEfetivo = a.attack + (d.montado ? a.attackVsCavalo : 0);
  const multiplicador = dados.combate.multiplicadorDirecao[ladoDoGolpe(atacante, alvo)];
  const defesa = d.defence + defesaDoEscudo(alvo.tipo, projetilDe(atacante.tipo, dados), dados);
  const bruta = (attackEfetivo * multiplicador) / (defesa * 100);
  return Math.min(dados.combate.tetoAcerto, Math.max(dados.combate.pisoAcerto, bruta));
}

/** F28d — a distancia EUCLIDIANA entre dois tiles, em tiles (centro a centro). */
export function distanciaEmTiles(a: { readonly gx: number; readonly gy: number }, b: { readonly gx: number; readonly gy: number }): number {
  return Math.hypot(b.gx - a.gx, b.gy - a.gy);
}

/** F28d — `b` esta no alcance do atirador em `a`: entre o minimo e o maximo do dado. */
export function noAlcance(
  a: { readonly gx: number; readonly gy: number }, b: { readonly gx: number; readonly gy: number }, dados: GameData = gameData,
): boolean {
  const d = distanciaEmTiles(a, b);
  const { alcanceMinimo_tiles: min, alcanceMaximo_tiles: max } = dados.combate.aDistancia;
  return d >= min && d <= max;
}

/** Folga de ponto flutuante na borda do arco: 45 graus em tile inteiro da cos(45) com
 *  erro no ultimo bit, e a borda e inclusiva. */
const FOLGA_DO_ARCO = 1e-9;

/**
 * F28d — `alvo` esta dentro do arco do atirador `u`: o angulo entre para onde ele olha e
 * a direcao do alvo e no maximo METADE de `aDistancia.arcoDeTiro_graus_total` (90 no
 * total, 45 para cada lado; KM_Terrain.pas:2021-2033). Borda inclusiva.
 */
export function noArco(u: Unidade, alvo: { readonly gx: number; readonly gy: number }, dados: GameData = gameData): boolean {
  const [fx, fy] = PASSOS[direcaoDe(u)] as readonly [number, number];
  const vx = alvo.gx - u.gx;
  const vy = alvo.gy - u.gy;
  const norma = Math.hypot(fx, fy) * Math.hypot(vx, vy);
  if (norma === 0) return false;
  const meio = (dados.combate.aDistancia.arcoDeTiro_graus_total / 2) * (Math.PI / 180);
  return (fx * vx + fy * vy) / norma >= Math.cos(meio) - FOLGA_DO_ARCO;
}

export function ehADistancia(tipo: string, dados: GameData = gameData): boolean {
  const def = defDaTropa(tipo, dados);
  return def !== null && 'aDistancia' in def && def.aDistancia === true;
}

/** Encostado: Chebyshev 1 (os oito vizinhos). */
export function encostadas(a: { readonly gx: number; readonly gy: number }, b: { readonly gx: number; readonly gy: number }): boolean {
  return Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy)) === 1;
}
