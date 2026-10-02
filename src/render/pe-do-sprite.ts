/** Borda inferior desenhada a partir da origem e do recorte do Frame do Phaser. */
export function peDoSprite(imagem: {
  readonly y: number; readonly displayOriginY: number; readonly scaleY: number;
  readonly frame: { readonly y: number; readonly height: number };
}): number {
  return imagem.y + (imagem.frame.y + imagem.frame.height - imagem.displayOriginY) * imagem.scaleY;
}
