/** Vento de tela. O tempo vem exclusivamente do tick e da interpolacao do laco. */
export interface DadosDoVento {
  readonly direcao: { readonly x: number; readonly y: number };
  readonly forca: number;
  readonly amplitudeMaximaGraus: number;
  readonly periodoTicks: number;
  readonly rajada: {
    readonly intervaloTicks: number;
    readonly duracaoTicks: number;
    readonly velocidadeTilesPorTick: number;
  };
  readonly vegetacaoQueBalanca: readonly string[];
}

export interface TransformacaoDoVento {
  readonly xPe: number;
  readonly yPe: number;
  readonly origem: readonly [0.5, 1];
  readonly deslocamentoGraus: number;
  readonly rotacao: number;
  readonly intensidadeDaRajada: number;
}

const volta = (valor: number, periodo: number): number => ((valor % periodo) + periodo) % periodo;

/** Mistura de coordenadas inteiras; a fase nao depende de ordem de iteracao. */
export function faseDoTile(gx: number, gy: number): number {
  let h = Math.imul(gx, 0x1f123bb5) ^ Math.imul(gy, 0x5f356495);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

export function balancaVegetacao(id: string, dados: DadosDoVento): boolean {
  return dados.vegetacaoQueBalanca.includes(id);
}

export function transformacaoDoVento(
  dados: DadosDoVento, tick: number, alfaDeInterpolacao: number,
  gx: number, gy: number, xPe: number, yPe: number,
): TransformacaoDoVento {
  const tempo = tick + alfaDeInterpolacao;
  const distanciaMontante = gx * dados.direcao.x + gy * dados.direcao.y;
  const tempoLocal = tempo - distanciaMontante / dados.rajada.velocidadeTilesPorTick;
  const posicaoDaRajada = volta(tempoLocal, dados.rajada.intervaloTicks);
  // Uma onda triangular tem pico unico e chega ao tile jusante depois do montante.
  const meio = dados.rajada.duracaoTicks / 2;
  const intensidadeDaRajada = posicaoDaRajada < dados.rajada.duracaoTicks
    ? 1 - Math.abs(posicaoDaRajada - meio) / meio : 0;
  const fase = faseDoTile(gx, gy) * Math.PI * 2;
  const oscilacao = Math.sin((tempo / dados.periodoTicks) * Math.PI * 2 + fase);
  const deslocamentoGraus = dados.forca === 0 ? 0
    : dados.amplitudeMaximaGraus * dados.forca * oscilacao * (1 + intensidadeDaRajada) / 2;
  return {
    xPe, yPe, origem: [0.5, 1], deslocamentoGraus,
    rotacao: deslocamentoGraus * Math.PI / 180, intensidadeDaRajada,
  };
}
