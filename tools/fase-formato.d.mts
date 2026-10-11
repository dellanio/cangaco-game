export interface PredioDaFase { id: string; gx: number; gy: number }
export interface UnidadeDaFase { tipo: string; quantidade: number; gx: number; gy: number }
export interface LadoDaFase {
  lado: number;
  nome: string;
  estoque: Record<string, number>;
  predios: PredioDaFase[];
  unidades: UnidadeDaFase[];
}
export interface MapaDaFase {
  largura: number;
  altura: number;
  legenda: Record<string, string>;
  linhas: string[];
  recursos: Record<string, [number, number][]>;
}
export interface ObjetivoDaFase {
  tipo: string;
  lado?: number;
  alvo?: string;
  predios?: string[];
  unidade?: string;
  segundos?: number;
  ondas?: number;
}
export interface OndaDaFase {
  aos_segundos: number;
  lado: number;
  de: { gx: number; gy: number };
  tropas: { tipo: string; quantidade: number }[];
}
export interface Fase {
  id: string;
  fase: number;
  local: string;
  titulo: string;
  ato: string;
  modo: 'construir' | 'lutar';
  escala: string;
  semente: number;
  gerador: string;
  _doc: string;
  narrativa: string;
  desafio: string;
  libera: { predios: string[]; tropas: string[] };
  objetivos: { vitoria: ObjetivoDaFase[]; derrota: ObjetivoDaFase[] };
  ondas: OndaDaFase[];
  lados: LadoDaFase[];
  mapa: MapaDaFase;
}
export declare const LEGENDA: Readonly<Record<string, string>>;
export declare const RECURSOS_DO_MAPA: readonly string[];
export declare function recursosCanonicos(recursos: Record<string, [number, number][]>): Record<string, [number, number][]>;
export declare function faseCanonica(fase: Fase): Fase;
export declare function escreverFase(fase: Fase): string;
