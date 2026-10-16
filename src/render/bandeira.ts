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

/**
 * I-ARTE-BANDEIRA-COM-VOLUME (pedido do operador, 2026-10-16) — o pano com volume: o tom de cada faixa entre dois
 * segmentos segue a inclinacao da onda. A luz vem de cima, levemente do sul (decisao de 2026-10-01): a faixa que desce
 * para a ponta (dy > 0, a face voltada para a luz) clareia, a que sobe escurece. A faixa colada ao mastro fica na
 * sombra dele. Puro: devolve um fator por faixa, 1 sendo a cor do bando.
 */
export const TONS_DO_PANO = {
  /** quanto a inclinacao da onda mexe no tom (por unidade de dy/dx) */
  ganhoDaInclinacao: 1.6,
  /** o tom minimo e maximo, para a cor do bando continuar reconhecivel */
  minimo: 0.62,
  maximo: 1.3,
  /** a sombra do mastro na primeira faixa */
  sombraDoMastro: 0.82,
} as const;

export function tonsDoPano(pontos: readonly { x: number; y: number }[], segmentos: number): number[] {
  const tons: number[] = [];
  for (let i = 0; i < segmentos; i += 1) {
    const a = pontos[i];
    const b = pontos[i + 1];
    if (a === undefined || b === undefined) break;
    const dx = b.x - a.x;
    const inclinacao = dx === 0 ? 0 : (b.y - a.y) / dx;
    let tom = 1 + inclinacao * TONS_DO_PANO.ganhoDaInclinacao;
    if (i === 0) tom *= TONS_DO_PANO.sombraDoMastro;
    tons.push(Math.max(TONS_DO_PANO.minimo, Math.min(TONS_DO_PANO.maximo, tom)));
  }
  return tons;
}

/** A cor `0xRRGGBB` vezes o tom, por canal, com teto em 255. */
export function corComTom(corBase: number, tom: number): number {
  const canal = (deslocamento: number): number => Math.min(255, Math.round(((corBase >> deslocamento) & 0xff) * tom));
  return (canal(16) << 16) | (canal(8) << 8) | canal(0);
}
