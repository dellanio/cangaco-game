import type { Fase } from './fase-formato.mjs';

export declare const PASTA_DAS_FASES: string;
export declare const PASTA_DOS_TMJ: string;
export declare function gerarTodas(): Fase[];
export declare function pranchaDasFases(fases: Fase[]): { width: number; height: number; data: Uint8Array };
