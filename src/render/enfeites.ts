import dados from '../../data/enfeites.json';
import type { GameState } from '../sim/state';
import { caixaDeTipoNoMapa } from './predios';
import type { TerrenoDeRender } from './mapa';

export interface ConfigDosEnfeites {
  readonly densidade: number;
  readonly raioDaVila: number;
  readonly pesos: Readonly<Record<string, number>>;
}
export interface Enfeite { readonly gx: number; readonly gy: number; readonly id: string }
export interface CentroDaVila { readonly gx: number; readonly gy: number }
export const configDosEnfeites: ConfigDosEnfeites = dados;

/** Inteiros de mistura sao constantes do hash, nunca numeros de jogo. */
export function hashDoEnfeite(gx: number, gy: number, semente: number): number {
  let h = (Math.imul(gx, 0x1f123bb5) ^ Math.imul(gy, 0x5f356495) ^ semente) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}
export function enfeiteNoTile(gx: number, gy: number, semente: number, terreno: string, vila: CentroDaVila, config: ConfigDosEnfeites = configDosEnfeites): string | null {
  if (terreno !== 'grama' && terreno !== 'areia') return null;
  if ((gx-vila.gx)**2 + (gy-vila.gy)**2 <= config.raioDaVila**2) return null;
  const h = hashDoEnfeite(gx, gy, semente);
  if (h / 0x100000000 >= config.densidade) return null;
  const pesos = Object.entries(config.pesos).filter(([, peso]) => peso > 0);
  const total = pesos.reduce((s, [,peso]) => s+peso, 0);
  let escolha = hashDoEnfeite(gy, gx, h) / 0x100000000 * total;
  for (const [id, peso] of pesos) { escolha -= peso; if (escolha < 0) return id; }
  return null;
}
export function candidatosAEnfeite(terreno: TerrenoDeRender, semente: number, vila: CentroDaVila, config: ConfigDosEnfeites = configDosEnfeites): readonly Enfeite[] {
  const resultado: Enfeite[] = [];
  for (let gy=0; gy<terreno.altura; gy++) for (let gx=0; gx<terreno.largura; gx++) {
    const tipo = terreno.tipos[terreno.codigos[gy*terreno.largura+gx]!];
    const id = enfeiteNoTile(gx, gy, semente, tipo ?? '', vila, config);
    if (id) resultado.push({ gx, gy, id });
  }
  return resultado;
}
export function enfeitesLivres(candidatos: readonly Enfeite[], estado: GameState): readonly Enfeite[] {
  const ocupados = new Set([...Object.keys(estado.estradas), ...Object.keys(estado.estradasPlanejadas), ...Object.keys(estado.camposPlanejados), ...Object.keys(estado.recursos)]);
  for (const id of estado.predios.ordem) {
    const p = estado.predios.porId[id]!;
    const caixa = caixaDeTipoNoMapa(p.tipo, p.gx, p.gy);
    if (!caixa) continue;
    for (let y=caixa.y0; y<caixa.y1; y++) for(let x=caixa.x0; x<caixa.x1; x++) ocupados.add(`${x},${y}`);
  }
  for (const id of estado.unidades.ordem) {
    const u = estado.unidades.porId[id]!;
    if ((u.fsmData.progresso ?? 0) === 0) ocupados.add(`${u.gx},${u.gy}`);
  }
  return candidatos.filter(e => !ocupados.has(`${e.gx},${e.gy}`));
}
/** Cache local de render. Mesma referencia/tick/partida nao refaz a ocupacao. */
export class MemoriaDosEnfeites {
  private estado: GameState | null = null;
  private partida = -1;
  private resultado: readonly Enfeite[] = [];
  recalculos = 0;
  constructor(private readonly candidatos: readonly Enfeite[]) {}
  atualizar(estado: GameState | null, partida: number): readonly Enfeite[] {
    if (estado === this.estado && partida === this.partida) return this.resultado;
    this.estado = estado; this.partida = partida;
    this.recalculos++;
    this.resultado = estado ? enfeitesLivres(this.candidatos, estado) : [];
    return this.resultado;
  }
}
