export declare const SAIDA: string;
export declare const LADO: number;
export declare const ESCALA: number;
export declare const QUADROS: readonly string[];
export declare const PALETA: readonly (readonly [number, number, number])[];
export declare function quadro(k: number): { width: number; height: number; data: Uint8Array };
export declare function gerar(): { nome: string; png: Uint8Array }[];
