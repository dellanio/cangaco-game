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

export interface RetanguloDaVista {
  readonly x: number; readonly y: number; readonly width: number; readonly height: number;
}

/** A posicao e o pe no anchor do manifesto; a copa pode cruzar a vista com o pe fora. */
export function arvoreNaVista(
  pe: { readonly x: number; readonly y: number }, anchor: readonly [number, number],
  tamanho: readonly [number, number], escala: number, vista: RetanguloDaVista,
): boolean {
  const esquerda = pe.x - anchor[0] * tamanho[0] * escala;
  const cima = pe.y - anchor[1] * tamanho[1] * escala;
  const direita = esquerda + tamanho[0] * escala;
  const baixo = cima + tamanho[1] * escala;
  return esquerda < vista.x + vista.width && direita > vista.x &&
    cima < vista.y + vista.height && baixo > vista.y;
}

export function quadroDoVentoMudou(
  anterior: { readonly tick: number; readonly alfa: number; readonly vista: string } | null,
  atual: { readonly tick: number; readonly alfa: number; readonly vista: string },
  spriteNovo: boolean,
): boolean {
  return spriteNovo || anterior === null || anterior.tick !== atual.tick ||
    anterior.alfa !== atual.alfa || anterior.vista !== atual.vista;
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
