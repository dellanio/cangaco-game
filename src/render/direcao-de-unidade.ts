import tipos from '../../data/units.json';
import { DIRECOES, direcaoDoPasso } from './manifesto';
import type { Direcao } from './manifesto';
const militares = new Set([...tipos.militares.tipos, ...tipos.mercenarios.tipos].map((t) => t.id));
export function tipoMilitar(tipo: string): boolean { return militares.has(tipo); }
export function direcaoMilitar(direcao: number | undefined): Direcao {
  const d = direcao ?? 4;
  if (!Number.isInteger(d) || d < 0 || d > 7) throw new Error(`Direção militar inválida: ${d}`);
  return DIRECOES[d]!;
}
export function alvoDaDirecao(tipo: string, direcao: number | undefined, dx: number, dy: number, direcoes: 4 | 8 | null): Direcao | null {
  return tipoMilitar(tipo) ? direcaoMilitar(direcao) : direcoes === null ? null : direcaoDoPasso(dx, dy, direcoes);
}
