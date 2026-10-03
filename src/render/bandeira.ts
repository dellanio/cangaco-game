import { faseDoTile, transformacaoDoVento, type DadosDoVento } from './vento';

export interface ConfigDaBandeira {
  readonly segmentos: number;
  readonly amplitudeMaximaPx: number;
  readonly comprimentoDeOndaPx: number;
  readonly velocidadePxPorTick: number;
  readonly larguraPx: number;
  readonly alturaPx: number;
}

/** Coordenadas relativas ao ponto onde o pano se prende ao mastro. */
export function panoDaBandeira(
  vento: DadosDoVento, config: ConfigDaBandeira, tick: number, alfa: number, gx: number, gy: number,
): { x: number; y: number }[] {
  const rajada = transformacaoDoVento(vento, tick, alfa, gx, gy, 0, 0).intensidadeDaRajada;
  const amplitude = config.amplitudeMaximaPx * vento.forca * (1 + rajada) / 2;
  const fase = faseDoTile(gx, gy) * Math.PI * 2;
  const tempoLocal = tick + alfa - (gx * vento.direcao.x + gy * vento.direcao.y)
    / vento.rajada.velocidadeTilesPorTick;
  const topo = Array.from({ length: config.segmentos + 1 }, (_, i) => {
    const fracao = i / config.segmentos;
    const x = config.larguraPx * fracao;
    const onda = (x - tempoLocal * config.velocidadePxPorTick) / config.comprimentoDeOndaPx;
    return { x, y: i === 0 || vento.forca === 0 ? 0 : amplitude * fracao * Math.sin(onda * Math.PI * 2 + fase) };
  });
  return [...topo, ...topo.map(({ x, y }) => ({ x, y: y + config.alturaPx })).reverse()];
}
