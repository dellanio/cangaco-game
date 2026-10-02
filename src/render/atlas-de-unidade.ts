import type { EntradaDeCamada } from './manifesto';

export interface QuadroDeAtlas {
  readonly sourceSize: { readonly w: number; readonly h: number };
  readonly spriteSourceSize: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly frame: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}
export interface AtlasDeUnidade { readonly frames: Readonly<Record<string, QuadroDeAtlas>> }

/** Mesma validação para o manifesto real e a entrada isolada de depuração. */
export function violacoesDoAtlas(entrada: EntradaDeCamada, atlas: AtlasDeUnidade): string[] {
  if (!entrada.animacoes) return [];
  const erros: string[] = [];
  const direcoes = new Set(Object.keys(atlas.frames)
    .filter((nome) => nome.startsWith(`${entrada.id}/`)).map((nome) => nome.split('/')[2]));
  for (const [animacao, dado] of Object.entries(entrada.animacoes)) {
    const prefixo = `${entrada.id}/${animacao}/`;
    const nomes = Object.keys(atlas.frames).filter((nome) => nome.startsWith(prefixo));
    if (nomes.length === 0) erros.push(`quadro-ausente: ${prefixo}`);
    for (const direcao of direcoes) {
      const base = `${prefixo}${direcao}/`;
      if (nomes.filter((nome) => nome.startsWith(base)).length !== dado.quadros) {
        erros.push(`contagem-de-direcao: ${base}`);
      }
      for (let q = 0; q < dado.quadros; q++) {
        const nome = `${base}${String(q).padStart(4, '0')}`;
        if (!atlas.frames[nome]) erros.push(`quadro-ausente: ${nome}`);
      }
    }
  }
  for (const [nome, quadro] of Object.entries(atlas.frames)) {
    if (quadro.sourceSize.w !== entrada.tamanho[0] || quadro.sourceSize.h !== entrada.tamanho[1]) {
      erros.push(`sourceSize: ${nome}`);
    }
  }
  return erros;
}
