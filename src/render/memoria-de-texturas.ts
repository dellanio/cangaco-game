export interface FonteDeTextura { readonly width: number; readonly height: number }
export interface TexturaNaMemoria { readonly key: string; readonly source: readonly FonteDeTextura[] }

/** Texturas e fontes reais do TextureManager; RGBA8, não estimativa de GPU. */
export function memoriaDeTexturas(texturas: readonly TexturaNaMemoria[]): number {
  return texturas.reduce((total, textura) => total + textura.source.reduce(
    (bytes, fonte) => bytes + fonte.width * fonte.height * 4, 0,
  ), 0);
}
