import dados from '../../data/enfeites.json';
import type { GameState } from '../sim/state';
import { caixaDeTipoNoMapa } from './predios';
import type { TerrenoDeRender } from './mapa';

export interface PecaDoSitio { readonly id: string; readonly dx: number; readonly dy: number }
export interface ConfigDosEnfeites {
  readonly raioDaVila: number;
  /** o que e natural (laje, ossada), espalhado e raro */
  readonly avulsos: { readonly densidade: number; readonly pesos: Readonly<Record<string, number>> };
  /** I-TELA-ENFEITES-EM-SITIOS — os enfeites de gente, so juntos, em poucos sitios abandonados */
  readonly sitios: { readonly quantidadePorArea: number; readonly distanciaMinima: number; readonly arranjo: readonly PecaDoSitio[] };
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

/** O tile aceita enfeite: chao (grama ou areia) fora do raio da vila. */
export function tileDeEnfeite(gx: number, gy: number, terreno: string, vila: CentroDaVila, config: ConfigDosEnfeites = configDosEnfeites): boolean {
  return (terreno === 'grama' || terreno === 'areia') && (gx - vila.gx) ** 2 + (gy - vila.gy) ** 2 > config.raioDaVila ** 2;
}

/** O enfeite AVULSO do tile (so o natural, raro), ou `null`. */
export function enfeiteNoTile(gx: number, gy: number, semente: number, terreno: string, vila: CentroDaVila, config: ConfigDosEnfeites = configDosEnfeites): string | null {
  if (!tileDeEnfeite(gx, gy, terreno, vila, config)) return null;
  const h = hashDoEnfeite(gx, gy, semente);
  if (h / 0x100000000 >= config.avulsos.densidade) return null;
  const pesos = Object.entries(config.avulsos.pesos).filter(([, peso]) => peso > 0);
  const total = pesos.reduce((s, [,peso]) => s+peso, 0);
  let escolha = hashDoEnfeite(gy, gx, h) / 0x100000000 * total;
  for (const [id, peso] of pesos) { escolha -= peso; if (escolha < 0) return id; }
  return null;
}

/**
 * I-TELA-ENFEITES-EM-SITIOS — os centros dos sitios abandonados: os tiles de chao na ordem do hash da semente, o primeiro
 * cujo arranjo inteiro cai em tile de enfeite e longe (`distanciaMinima`) dos ja escolhidos, ate a quantidade do mapa.
 */
export function sitiosDoMapa(terreno: TerrenoDeRender, semente: number, vila: CentroDaVila, config: ConfigDosEnfeites = configDosEnfeites): readonly CentroDaVila[] {
  const tipo = (gx: number, gy: number): string => gx < 0 || gy < 0 || gx >= terreno.largura || gy >= terreno.altura ? ''
    : terreno.tipos[terreno.codigos[gy * terreno.largura + gx]!] ?? '';
  const quantidade = Math.round(config.sitios.quantidadePorArea * terreno.largura * terreno.altura);
  const candidatos: { gx: number; gy: number; h: number }[] = [];
  for (let gy = 0; gy < terreno.altura; gy++) for (let gx = 0; gx < terreno.largura; gx++) {
    if (config.sitios.arranjo.every((p) => tileDeEnfeite(gx + p.dx, gy + p.dy, tipo(gx + p.dx, gy + p.dy), vila, config))) {
      candidatos.push({ gx, gy, h: hashDoEnfeite(gx, gy, semente ^ 0x51710) });
    }
  }
  candidatos.sort((a, b) => a.h - b.h || a.gy - b.gy || a.gx - b.gx);
  const escolhidos: CentroDaVila[] = [];
  const d2 = config.sitios.distanciaMinima ** 2;
  for (const c of candidatos) {
    if (escolhidos.length >= quantidade) break;
    if (escolhidos.every((e) => (e.gx - c.gx) ** 2 + (e.gy - c.gy) ** 2 >= d2)) escolhidos.push({ gx: c.gx, gy: c.gy });
  }
  return escolhidos;
}

export function candidatosAEnfeite(terreno: TerrenoDeRender, semente: number, vila: CentroDaVila, config: ConfigDosEnfeites = configDosEnfeites): readonly Enfeite[] {
  const resultado: Enfeite[] = [];
  const doSitio = new Set<string>();
  for (const centro of sitiosDoMapa(terreno, semente, vila, config)) for (const p of config.sitios.arranjo) {
    resultado.push({ gx: centro.gx + p.dx, gy: centro.gy + p.dy, id: p.id });
    doSitio.add(`${centro.gx + p.dx},${centro.gy + p.dy}`);
  }
  for (let gy=0; gy<terreno.altura; gy++) for (let gx=0; gx<terreno.largura; gx++) {
    if (doSitio.has(`${gx},${gy}`)) continue;
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
