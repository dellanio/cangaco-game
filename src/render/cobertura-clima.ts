/** Graphics com scrollFactor 0 ainda sofre zoom em torno da origem da camera. */
export function transformacaoDoClima(largura: number, altura: number, zoom: number, origemX: number, origemY: number) {
  const escala = 1 / zoom;
  return { escala, x: largura * origemX * (1 - escala), y: altura * origemY * (1 - escala) };
}
