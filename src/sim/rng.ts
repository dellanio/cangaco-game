/** Estado do RNG. Objeto JSON puro: sem classe, sem closure, sem metodo. */
export interface RngState {
  /** Semente original, preservada para repro de bug (BUGS.md: semente + tick). */
  readonly seed: number;
  /** Posicao no fluxo. Avanca a cada consumo. */
  readonly cursor: number;
}

export function createRng(seed: number): RngState {
  return { seed: seed | 0, cursor: seed | 0 };
}

/** mulberry32. Puro: devolve o proximo estado junto com o valor. */
export function nextU32(rng: RngState): { readonly rng: RngState; readonly value: number } {
  const cursor = (rng.cursor + 0x6d2b79f5) | 0;
  let t = cursor;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;
  return { rng: { seed: rng.seed, cursor }, value };
}

export function nextFloat(rng: RngState): { readonly rng: RngState; readonly value: number } {
  const passo = nextU32(rng);
  return { rng: passo.rng, value: passo.value / 4294967296 };
}

/**
 * Inteiro em [minInclusive, maxExclusive), sem vies.
 *
 * Modulo puro enviesaria as primeiras faces quando a amplitude nao divide
 * 2^32. Aqui o topo do fluxo — o pedaco que nao completa um bloco inteiro —
 * e descartado e um novo valor e sorteado. Isto importa: `nextInt` decide
 * desempate no JobBoard e chance de acerto no combate, e balancear em cima
 * de um vies significa recalibrar tudo quando ele for corrigido.
 *
 * Continua deterministico: o numero de descartes e funcao do estado, entao
 * a mesma semente descarta exatamente nas mesmas horas.
 */
export function nextInt(
  rng: RngState,
  minInclusive: number,
  maxExclusive: number,
): { readonly rng: RngState; readonly value: number } {
  if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
    throw new Error('nextInt exige limites inteiros.');
  }
  const amplitude = maxExclusive - minInclusive;
  if (amplitude <= 0) {
    throw new Error(`nextInt exige maxExclusive > minInclusive (recebeu ${minInclusive}, ${maxExclusive}).`);
  }

  // Maior multiplo de `amplitude` que cabe em 2^32. Tudo acima disso e descarte.
  const limite = 4294967296 - (4294967296 % amplitude);
  let atual = rng;
  for (;;) {
    const passo = nextU32(atual);
    atual = passo.rng;
    if (passo.value < limite) {
      return { rng: atual, value: minInclusive + (passo.value % amplitude) };
    }
  }
}
