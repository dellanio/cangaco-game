import type { Fase } from './fase-formato.mjs';

export interface TileLayer {
  id: number; name: string; type: 'tilelayer'; width: number; height: number; data: number[];
  opacity: number; visible: boolean; x: number; y: number;
}
export interface ObjetoDoTiled {
  id: number; name: string; type: string; x: number; y: number; width: number; height: number;
  point: boolean; rotation: number; visible: boolean;
  properties: { name: string; type: string; value: number | string }[];
}
export interface ObjectLayer {
  id: number; name: string; type: 'objectgroup'; draworder: string; objects: ObjetoDoTiled[];
  opacity: number; visible: boolean; x: number; y: number;
}
export interface Tmj {
  width: number; height: number; tilewidth: number; tileheight: number;
  orientation: string; type: 'map'; version: string; tiledversion: string; infinite: boolean;
  renderorder: string; compressionlevel: number; nextlayerid: number; nextobjectid: number;
  layers: (TileLayer | ObjectLayer)[];
  tilesets: { firstgid: number; source: string }[];
  properties: { name: string; type: string; value: string }[];
}
export declare const TILE_PX: number;
export declare const PASTA_DA_PALETA: string;
export declare const PALETA: readonly { camada: 'terreno' | 'recursos'; tipo: string; letra?: string; cor: string }[];
export declare function pngDaPaleta(): Uint8Array;
export declare function tsjDaPaleta(): string;
export declare function exportar(fase: Fase, paleta?: string): Tmj;
export declare function importar(tmj: Tmj): Fase;
