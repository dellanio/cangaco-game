export type CamadaAnimada = 'vento' | 'agua' | 'chaoDaCana' | 'nevoa';
export type CustoDoQuadro = Record<CamadaAnimada, { ms: number; chamadas: number; itens: number }>;

export function custoZerado(): CustoDoQuadro {
  return {
    vento: { ms: 0, chamadas: 0, itens: 0 },
    agua: { ms: 0, chamadas: 0, itens: 0 },
    chaoDaCana: { ms: 0, chamadas: 0, itens: 0 },
    // F-TELA-NEVOA: itens = tiles da textura da nevoa repintados (o mapa inteiro, so quando o estado muda)
    nevoa: { ms: 0, chamadas: 0, itens: 0 },
  };
}

/** Soma pura: o unico relogio e a funcao recebida do chamador. */
export function somarCusto(
  custo: CustoDoQuadro, camada: CamadaAnimada, inicio: number, itens: number, agora: () => number,
): CustoDoQuadro {
  const anterior = custo[camada];
  return {
    ...custo,
    [camada]: {
      ms: anterior.ms + Math.max(0, agora() - inicio),
      chamadas: anterior.chamadas + 1,
      itens: anterior.itens + itens,
    },
  };
}
