import type { PontoDaChamine, ParticulaDaFumaca } from './fumaca';

export interface ConfigDaFagulha {
  readonly semente: number;
  readonly maximoPorFogo: number;
  readonly vidaTicks: number;
  readonly intervaloPulsosTicks: number;
  readonly particulasPorPulso: number;
  readonly subidaTilesPorTick: number;
  readonly dispersaoTilesPorTick: number;
  readonly raioTiles: number;
  readonly opacidade: number;
  readonly cor: string;
}

function hash(semente: number, pulso: number, indice: number, ponto: PontoDaChamine): number {
  let h = Math.imul(semente ^ Math.round(ponto.x * 1024), 0x9e3779b1)
    ^ Math.imul(pulso ^ Math.round(ponto.y * 1024), 0x85ebca6b) ^ Math.imul(indice, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** Pulsos pelo tick; parar corta nascimentos e deixa cada ponto terminar sua vida. */
export function particulasDaFagulha(
  config: ConfigDaFagulha, tick: number, alfa: number, ponto: PontoDaChamine,
  trabalhandoDesde: number | null, parouEm: number | null,
): ParticulaDaFumaca[] {
  if (trabalhandoDesde === null) return [];
  const tempo = tick + alfa;
  const primeiro = Math.max(0, Math.floor((tempo - config.vidaTicks - trabalhandoDesde) / config.intervaloPulsosTicks) + 1);
  const ultimo = Math.floor((tempo - trabalhandoDesde) / config.intervaloPulsosTicks);
  const particulas: ParticulaDaFumaca[] = [];
  for (let pulso = ultimo; pulso >= primeiro && particulas.length < config.maximoPorFogo; pulso -= 1) {
    const nascimento = trabalhandoDesde + pulso * config.intervaloPulsosTicks;
    if (parouEm !== null && nascimento >= parouEm) continue;
    const idade = tempo - nascimento;
    for (let i = 0; i < config.particulasPorPulso && particulas.length < config.maximoPorFogo; i += 1) {
      const variacao = hash(config.semente, nascimento, i, ponto);
      const vida = config.vidaTicks * (0.65 + variacao * 0.35);
      if (idade < 0 || idade >= vida) continue;
      particulas.push({
        id: `${ponto.x},${ponto.y}:${nascimento}:${i}`, nascimento,
        x: ponto.x + (variacao * 2 - 1) * idade * config.dispersaoTilesPorTick,
        y: ponto.y - idade * config.subidaTilesPorTick * (0.8 + variacao * 0.4),
        raio: config.raioTiles, opacidade: config.opacidade * (1 - idade / vida),
      });
    }
  }
  return particulas;
}
