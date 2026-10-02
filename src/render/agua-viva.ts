export interface ConfigDaAgua {
  readonly periodo: number;
  readonly variantes: readonly string[];
}

export interface CelulaDaAgua {
  readonly gx: number;
  readonly gy: number;
  readonly tipo: string;
  readonly varianteAtual: string;
}

// O deslocamento de fase e inteiro: uma celula so avanca na fronteira do periodo.
export function varianteDaAgua(config: ConfigDaAgua, tick: number, gx: number, gy: number): string {
  const fase = ((Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663)) >>> 0) % config.variantes.length;
  return config.variantes[(Math.floor(tick / config.periodo) + fase) % config.variantes.length] as string;
}

export function celulasDaAguaParaTrocar(config: ConfigDaAgua, tick: number, celulas: readonly CelulaDaAgua[]) {
  return celulas.flatMap((celula) => {
    if (celula.tipo !== 'agua') return [];
    const variante = varianteDaAgua(config, tick, celula.gx, celula.gy);
    return variante === celula.varianteAtual ? [] : [{ gx: celula.gx, gy: celula.gy, variante }];
  });
}
