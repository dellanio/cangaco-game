export const TETO_DA_LINHA: number;
export function palavras(comando: string): string[];
export function comandoDoVitest(cangacoVitest: string | undefined, execPath: string, vitestMjs: string): string[];
export function tamanhoDaLinha(argv: readonly string[]): number;
export function corridaDoVitest(
  base: readonly string[], arquivos: readonly string[], relatorio: string, teto?: number,
): { modo: 'related' | 'suite-inteira'; argv: string[]; tamanho: number; motivo?: string };
