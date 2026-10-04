export interface CandidatoDeSom {
  valido: boolean;
  numero?: number;
  titulo?: string;
  url?: string;
  licenca?: string;
  texto: string;
  /** Link que o operador escreveu na coluna `aprovado`, fora da lista. */
  novo?: boolean;
}
export interface LinhaDeSom {
  id: string;
  tocaQuando: string;
  candidatos: CandidatoDeSom[];
  aprovado: string;
}
export function lerSonsCandidatos(md: string): LinhaDeSom[];
export function escolhaDoOperador(linha: LinhaDeSom): CandidatoDeSom | 'nenhum' | 'invalido' | null;
