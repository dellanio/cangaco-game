/**
 * Aritmetica pura, ZERO imports (nem `../sim/data`, nem Phaser), como
 * `estagio-obra.ts` (F11c): quanto de cada material ja chegou a uma obra.
 *
 * O estado guarda so o que FALTA (`PredioEmObra.obra.faltam`); o entregue e
 * `custo - faltam` — contrato ja escrito em `sim/obra.ts`
 * (`entreguesPorMercadoria`) e em `sim/selectors.ts`. Aqui ele nao e duplicado
 * da sim: e a mesma conta feita do lado da tela, porque `render/` nao pode
 * importar `sim/data` fora dos dois funis e `sim/` nao pode saber que existe
 * tela. O dado de entrada vem todo de fora.
 *
 * A lista de mercadorias chega por parametro em vez de ser lida de
 * `economia.mercadorias`: e o que mantem este arquivo sem import e dentro da
 * regra estrutural de `render/` (guarda em `tests/F04-grid-ortogonal.test.ts`).
 *
 * A F17b desenha isto de duas formas — blocos no mapa e `chegou/total` no
 * painel. Uma funcao so, de proposito: duas contas para o mesmo numero acabam
 * divergindo.
 */
export interface LinhaDoMedidor {
  /** Id NEUTRO da mercadoria (`stone`). Quem traduz e o tema, na tela. */
  readonly mercadoria: string;
  readonly entregue: number;
  readonly total: number;
}

export function medidorDaObra(
  faltam: Readonly<Record<string, number>>,
  custo: Readonly<Record<string, number>>,
  mercadorias: readonly string[],
): LinhaDoMedidor[] {
  const linhas: LinhaDoMedidor[] = [];
  for (const mercadoria of mercadorias) {
    const total = custo[mercadoria] ?? 0;
    // Mercadoria que o predio nao custa nao vira fileira: fileira vazia e ruido.
    if (total <= 0) continue;
    const falta = faltam[mercadoria] ?? 0;
    // O piso em 0 existe porque `faltam` pode exceder o custo se o dado mudar
    // entre um save e outro; entregue negativo viraria um `for` que nao roda e
    // um medidor silenciosamente vazio.
    linhas.push({ mercadoria, entregue: Math.max(0, total - falta), total });
  }
  return linhas;
}
