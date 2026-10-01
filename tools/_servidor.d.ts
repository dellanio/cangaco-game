export function derrubarServidor(processo: { pid?: number; kill(): boolean }): void;
export function portaJaResponde(url: string): Promise<boolean>;
export function mensagemDePortaOcupada(quem: string, porta: number, variavel: string): string;
export function arquivoDoRegistro(porta: number): string;
export function gravarRegistro(porta: number, vite: number): void;
export function apagarRegistro(porta: number, vite: number): void;
export function ehViteNaPorta(linhaDeComando: string, porta: number): boolean;
export interface RegistroDoVite { readonly porta: number; readonly vite: number; readonly dono: number }
export function podeEncerrar(a: {
  registro: RegistroDoVite | null | undefined; porta: number; linhaDeComando: string | null; donoVivo: boolean;
}): boolean;
export function liberarViteOrfao(porta: number): Promise<{ encerrado: boolean; motivo: string }>;
