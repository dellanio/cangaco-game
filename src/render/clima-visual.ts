/**
 * I-TELA-CLIMA-VISUAL — o mundo muda com a estacao (so tela). A estacao vem da sim (`sim/clima.ts`,
 * funcao do tick); daqui sai o veu de cor da vista, a chuva do inverno e o calor da seca. Regra pura,
 * sem Phaser: a cena desenha o que estas funcoes devolvem. Os numeros sao de `data/clima-visual.json`.
 */
import type { FaseDoClima } from '../sim/clima';

export interface CorComAlfa { readonly cor: string; readonly alfa: number }

export interface ConfigDoClimaVisual {
  readonly semente: number;
  readonly veu: { readonly inverno: CorComAlfa; readonly seca: CorComAlfa };
  readonly chuva: {
    readonly maximo: number; readonly comprimentoPx: number; readonly velocidadePxPorTick: number;
    readonly inclinacao: number; readonly cor: string; readonly alfa: number;
  };
  readonly calor: { readonly maximo: number; readonly velocidadePxPorTick: number; readonly raioPx: number; readonly cor: string; readonly alfa: number };
}

/** Quanto do inverno (0 a 1) a fase tem: 1 no inverno, 0 na seca, a rampa nas transicoes. */
export function pesoDoInverno(fase: FaseDoClima | null): number {
  if (fase === null) return 0;
  const t = fase.decorrido / (fase.decorrido + fase.falta);
  switch (fase.id) {
    case 'inverno': return 1;
    case 'seca': return 0;
    case 'transicaoSeca': return 1 - t;
    case 'transicaoChuva': return t;
    default: return 0;
  }
}

const hex = (c: string): [number, number, number] => [1, 3, 5].map((i) => Number.parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
const paraHex = (rgb: readonly number[]): string => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** O veu da vista: a cor e o alfa do inverno e da seca misturados pelo peso do inverno. */
export function veuDaEstacao(fase: FaseDoClima | null, config: Pick<ConfigDoClimaVisual, 'veu'>): CorComAlfa | null {
  if (fase === null) return null;
  const p = pesoDoInverno(fase);
  const a = hex(config.veu.inverno.cor);
  const b = hex(config.veu.seca.cor);
  return {
    cor: paraHex(a.map((v, i) => v * p + b[i]! * (1 - p))),
    alfa: config.veu.inverno.alfa * p + config.veu.seca.alfa * (1 - p),
  };
}

/** Hash sem estado: o indice e a semente definem cada particula para sempre. */
function hash(semente: number, indice: number, sal: number): number {
  let h = Math.imul(semente ^ sal, 0x9e3779b1) ^ Math.imul(indice + 1, 0x85ebca6b);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** Uma gota: o traco de (x, y) ate (x + dx, y + dy), em px da vista. */
export interface Gota { readonly x: number; readonly y: number; readonly dx: number; readonly dy: number }

/** As gotas na vista no instante `tempo` (tick + alfa): tantas quanto o peso do inverno pede. */
export function gotasDaChuva(
  fase: FaseDoClima | null, tempo: number, largura: number, altura: number, config: ConfigDoClimaVisual,
): Gota[] {
  const n = Math.round(config.chuva.maximo * pesoDoInverno(fase));
  const { comprimentoPx, velocidadePxPorTick, inclinacao } = config.chuva;
  const ciclo = altura + comprimentoPx;
  const gotas: Gota[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = hash(config.semente, i, 1) * (largura + altura * inclinacao);
    const y = ((hash(config.semente, i, 2) * ciclo + tempo * velocidadePxPorTick * (0.8 + 0.4 * hash(config.semente, i, 3))) % ciclo) - comprimentoPx;
    gotas.push({ x: x0 - y * inclinacao, y, dx: -comprimentoPx * inclinacao, dy: comprimentoPx });
  }
  return gotas;
}

/** As particulas de calor na vista (a seca): sobem devagar, oscilando de lado. */
export function particulasDoCalor(
  fase: FaseDoClima | null, tempo: number, largura: number, altura: number, config: ConfigDoClimaVisual,
): { readonly x: number; readonly y: number }[] {
  const n = Math.round(config.calor.maximo * (1 - pesoDoInverno(fase)) * (fase === null ? 0 : 1));
  const r: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const subida = (hash(config.semente, i, 5) * altura + tempo * config.calor.velocidadePxPorTick) % altura;
    const x = hash(config.semente, i, 4) * largura + Math.sin(tempo / 6 + i) * 4;
    r.push({ x, y: altura - subida });
  }
  return r;
}
