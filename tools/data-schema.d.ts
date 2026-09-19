// Assinatura de tipos para tools/data-schema.js — ver tools/data-rules.d.ts.
export interface CampoEscalonado {
  readonly arquivo: string;
  readonly caminho: string;
  readonly unidade: string;
  readonly declaraEscalaEm: string;
}
export interface DeclaracaoEstrutural {
  readonly arquivo: string;
  readonly caminho: string;
  readonly motivo: string;
}
export interface CampoIsento {
  readonly arquivo: string;
  readonly caminho: string;
  readonly motivo: string;
}
export const ARQUIVOS: readonly string[];
export const CAMPOS_ESCALONADOS: readonly CampoEscalonado[];
export const DECLARACOES_ESTRUTURAIS: readonly DeclaracaoEstrutural[];
export const NAO_SAO_DURACAO: readonly CampoIsento[];
export function bateNomeDeTempo(chave: string): boolean;
