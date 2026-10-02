import { transformacaoDoVento } from './vento';
import type { DadosDoVento } from './vento';

export interface ConfigDaPoeira {
  readonly semente: number;
  readonly maximoNaVista: number;
  readonly vidaTicks: number;
  readonly nascimentosPorTick: number;
  readonly velocidadeTilesPorTick: number;
  readonly fracaoPalha: number;
  readonly limiarDaRajada: number;
  readonly intervaloDoRedemoinhoTicks: number;
  readonly duracaoDoRedemoinhoTicks: number;
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
  readonly evento: 'rajada' | 'redemoinho';
  readonly redemoinho: number | null;
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
  const dentroDaVista = (x: number, y: number): boolean =>
    x >= vista.x && y >= vista.y && x < vista.x + vista.largura && y < vista.y + vista.altura;
  const tileValido = (x: number, y: number): boolean => {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    return gx >= 0 && gy >= 0 && gx < vista.larguraMapa && gy < vista.alturaMapa && !ehAgua(gx, gy);
  };
  const intensidade = (x: number, y: number, instante: number): number =>
    transformacaoDoVento(vento, Math.floor(instante), instante % 1, Math.floor(x), Math.floor(y), 0, 0)
      .intensidadeDaRajada;
  const primeiroNascimento = Math.floor(tempo - config.vidaTicks) + 1;
  for (let nascimento = primeiroNascimento; nascimento <= Math.floor(tempo); nascimento += 1) {
    for (let indice = 0; indice < config.nascimentosPorTick; indice += 1) {
      const idade = tempo - nascimento;
      const vida = 1 + Math.floor(hash(config.semente, nascimento, indice, 1) * config.vidaTicks);
      if (idade < 0 || idade >= vida) continue;
      const origemX = hash(config.semente, nascimento, indice, 2) * vista.larguraMapa;
      const origemY = hash(config.semente, nascimento, indice, 3) * vista.alturaMapa;
      if (!tileValido(origemX, origemY)
        || intensidade(origemX, origemY, nascimento) <= config.limiarDaRajada) continue;
      const x = origemX
        + vento.direcao.x * vento.forca * config.velocidadeTilesPorTick * idade;
      const y = origemY
        + vento.direcao.y * vento.forca * config.velocidadeTilesPorTick * idade;
      if (!dentroDaVista(x, y) || !tileValido(x, y)
        || intensidade(x, y, tempo) <= config.limiarDaRajada) continue;
      const gx = Math.floor(x);
      const gy = Math.floor(y);
      particulas.push({
        id: `rajada:${nascimento}:${indice}`,
        tipo: hash(config.semente, nascimento, indice, 4) < config.fracaoPalha ? 'palha' : 'poeira',
        x, y, gx, gy, nascimento, evento: 'rajada', redemoinho: null,
      });
      if (particulas.length === config.maximoNaVista) return particulas;
    }
  }
  // Um inicio sorteado em cada ciclo garante a media pedida sem sobrepor eventos.
  const intervalo = config.intervaloDoRedemoinhoTicks;
  const ciclo = Math.floor(tempo / intervalo);
  const inicio = ciclo * intervalo
    + Math.floor(hash(config.semente, ciclo, 0, 5) * (intervalo - config.duracaoDoRedemoinhoTicks + 1));
  const idadeDoRedemoinho = tempo - inicio;
  if (idadeDoRedemoinho < 0 || idadeDoRedemoinho >= config.duracaoDoRedemoinhoTicks) return particulas;
  const centroX = vista.x + hash(config.semente, ciclo, 0, 6) * vista.largura
    + vento.direcao.x * vento.forca * config.velocidadeTilesPorTick * idadeDoRedemoinho;
  const centroY = vista.y + hash(config.semente, ciclo, 0, 7) * vista.altura
    + vento.direcao.y * vento.forca * config.velocidadeTilesPorTick * idadeDoRedemoinho;
  const vagas = config.maximoNaVista - particulas.length;
  for (let indice = 0; indice < vagas; indice += 1) {
    const raio = 0.3 + hash(config.semente, ciclo, indice, 8) * 1.4;
    const angulo = hash(config.semente, ciclo, indice, 9) * Math.PI * 2 + idadeDoRedemoinho * 0.4;
    const x = centroX + Math.cos(angulo) * raio;
    const y = centroY + Math.sin(angulo) * raio;
    if (!dentroDaVista(x, y) || !tileValido(x, y)) continue;
    particulas.push({
      id: `redemoinho:${ciclo}:${indice}`,
      tipo: hash(config.semente, ciclo, indice, 10) < config.fracaoPalha ? 'palha' : 'poeira',
      x, y, gx: Math.floor(x), gy: Math.floor(y), nascimento: inicio,
      evento: 'redemoinho', redemoinho: ciclo,
    });
  }
  return particulas;
}

export function rajadaNaVista(vento: DadosDoVento, tick: number, alfa: number, vista: VistaDaPoeira): number {
  let maior = 0;
  for (let gy = Math.max(0, Math.floor(vista.y)); gy < Math.min(vista.alturaMapa, vista.y + vista.altura); gy += 1) {
    for (let gx = Math.max(0, Math.floor(vista.x)); gx < Math.min(vista.larguraMapa, vista.x + vista.largura); gx += 1) {
      maior = Math.max(maior, transformacaoDoVento(vento, tick, alfa, gx, gy, 0, 0).intensidadeDaRajada);
    }
  }
  return maior;
}
