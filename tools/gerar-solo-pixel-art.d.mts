export declare const SAIDA: string;
export declare const LADO: number;
export declare const ESCALA: number;
export declare const MARGEM: number;
export declare const VARIANTES: readonly string[];
export declare const PALETA: readonly (readonly [number, number, number])[];
export declare function variante(nome: string): { width: number; height: number; data: Uint8Array };
export declare function gerar(): { nome: string; png: Uint8Array }[];
