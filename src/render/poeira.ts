import type { DadosDoVento } from './vento';

export interface ConfigDaPoeira {
  readonly semente: number;
  readonly maximoNaVista: number;
  readonly vidaTicks: number;
  readonly nascimentosPorTick: number;
  readonly velocidadeTilesPorTick: number;
  readonly fracaoPalha: number;
  readonly corPoeira: string;
  readonly corPalha: string;
}

export interface VistaDaPoeira {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
  readonly larguraMapa: number;
  readonly alturaMapa: number;
}

export interface ParticulaDaPoeira {
  readonly id: string;
  readonly tipo: 'poeira' | 'palha';
  readonly x: number;
  readonly y: number;
  readonly gx: number;
  readonly gy: number;
  readonly nascimento: number;
}

/** Hash sem estado: nascimento e indice definem cada particula para sempre. */
function hash(semente: number, nascimento: number, indice: number, sal: number): number {
  let h = Math.imul(semente ^ sal, 0x9e3779b1) ^ Math.imul(nascimento, 0x85ebca6b) ^ Math.imul(indice, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** Posicoes em tiles; nenhuma memoria entre quadros ou dependencia do Phaser. */
export function particulasDaPoeira(
  config: ConfigDaPoeira, vento: DadosDoVento, tick: number, alfa: number,
  vista: VistaDaPoeira, ehAgua: (gx: number, gy: number) => boolean,
): ParticulaDaPoeira[] {
  if (vento.forca <= 0) return [];
  const particulas: ParticulaDaPoeira[] = [];
  const tempo = tick + alfa;
  const primeiroNascimento = Math.floor(tempo - config.vidaTicks) + 1;
  for (let nascimento = primeiroNascimento; nascimento <= Math.floor(tempo); nascimento += 1) {
    for (let indice = 0; indice < config.nascimentosPorTick; indice += 1) {
      const idade = tempo - nascimento;
      const vida = 1 + Math.floor(hash(config.semente, nascimento, indice, 1) * config.vidaTicks);
      if (idade < 0 || idade >= vida) continue;
      const x = hash(config.semente, nascimento, indice, 2) * vista.larguraMapa
        + vento.direcao.x * vento.forca * config.velocidadeTilesPorTick * idade;
      const y = hash(config.semente, nascimento, indice, 3) * vista.alturaMapa
        + vento.direcao.y * vento.forca * config.velocidadeTilesPorTick * idade;
      if (x < vista.x || y < vista.y || x >= vista.x + vista.largura || y >= vista.y + vista.altura) continue;
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      if (gx < 0 || gy < 0 || gx >= vista.larguraMapa || gy >= vista.alturaMapa || ehAgua(gx, gy)) continue;
      particulas.push({
        id: `${nascimento}:${indice}`,
        tipo: hash(config.semente, nascimento, indice, 4) < config.fracaoPalha ? 'palha' : 'poeira',
        x, y, gx, gy, nascimento,
      });
      if (particulas.length === config.maximoNaVista) return particulas;
    }
  }
  return particulas;
}
