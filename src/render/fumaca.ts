import type { DadosDoVento } from './vento';

export interface ConfigDaFumaca {
  readonly semente: number;
  readonly maximoPorChamine: number;
  readonly vidaTicks: number;
  readonly intervaloTicks: number;
  readonly subidaTilesPorTick: number;
  readonly velocidadeTilesPorTick: number;
  readonly raioInicialTiles: number;
  readonly crescimentoTilesPorTick: number;
  readonly opacidade: number;
  readonly cor: string;
}

/** Coordenadas de mundo em tiles, ja convertidas da ancora do PNG. */
export interface PontoDaChamine { readonly x: number; readonly y: number }
export interface ParticulaDaFumaca {
  readonly id: string;
  readonly nascimento: number;
  readonly x: number;
  readonly y: number;
  readonly raio: number;
  readonly opacidade: number;
}

// Copia pequena do hash da poeira: aquele arquivo esta sob trabalho de outro Codex.
function hash(semente: number, nascimento: number, indice: number, sal: number): number {
  let h = Math.imul(semente ^ sal, 0x9e3779b1) ^ Math.imul(nascimento, 0x85ebca6b) ^ Math.imul(indice, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** Sem estado: os nascimentos pertencem a [trabalhandoDesde, parouEm).
 * Parar corta apenas nascimentos; cada particula termina a propria vida. */
export function particulasDaFumaca(
  config: ConfigDaFumaca, vento: DadosDoVento, tick: number, alfa: number,
  ponto: PontoDaChamine, trabalhandoDesde: number | null, parouEm: number | null,
): ParticulaDaFumaca[] {
  if (trabalhandoDesde === null) return [];
  const tempo = tick + alfa;
  const primeiro = Math.max(0, Math.floor((tempo - config.vidaTicks - trabalhandoDesde) / config.intervaloTicks) + 1);
  const ultimo = Math.floor((tempo - trabalhandoDesde) / config.intervaloTicks);
  const particulas: ParticulaDaFumaca[] = [];
  const indice = Math.imul(Math.round(ponto.x * 1024), 31) ^ Math.round(ponto.y * 1024);
  for (let i = ultimo; i >= primeiro && particulas.length < config.maximoPorChamine; i -= 1) {
    const nascimento = trabalhandoDesde + i * config.intervaloTicks;
    if (parouEm !== null && nascimento >= parouEm) continue;
    const idade = tempo - nascimento;
    const vida = config.vidaTicks * (0.5 + hash(config.semente, nascimento, indice, 1) * 0.5);
    if (idade < 0 || idade >= vida) continue;
    const deslocamento = idade * vento.forca * config.velocidadeTilesPorTick;
    particulas.push({
      id: `${indice}:${nascimento}`, nascimento,
      x: ponto.x + deslocamento * vento.direcao.x,
      y: ponto.y - idade * config.subidaTilesPorTick + deslocamento * vento.direcao.y,
      raio: config.raioInicialTiles + idade * config.crescimentoTilesPorTick,
      opacidade: config.opacidade * (1 - idade / vida),
    });
  }
  return particulas;
}
