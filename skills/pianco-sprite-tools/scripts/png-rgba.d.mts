export interface ImagemRgba { width: number; height: number; data: Uint8Array }
export declare function encodePng(imagem: ImagemRgba): Uint8Array;
export declare function decodePng(bytes: Uint8Array): ImagemRgba;
