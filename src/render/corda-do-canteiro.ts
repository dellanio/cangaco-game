/**
 * I-TELA-CORDA-ENTRE-AS-ESTACAS (pedido do operador, 2026-10-16) — as cordas do canteiro, esticadas entre os nos das
 * quatro estacas do lote. Aritmetica pura, sem phaser: a cena so desenha os pontos.
 *
 * Os nos ficam na altura `alturaDoNo` acima do pe de cada estaca (o canto do lote). Cada corda liga dois cantos
 * vizinhos e cede no meio (`barriga`, para baixo na tela), na fracao `cedePorPx` do vao e nunca alem de `barrigaMaxima`.
 */
export interface Ponto { readonly x: number; readonly y: number }
export interface CordaDoCanteiro {
  readonly lado: 'cima' | 'baixo' | 'esquerda' | 'direita';
  readonly de: Ponto;
  readonly ate: Ponto;
  /** o ponto de controle da curva quadratica: o meio do vao, baixado pela barriga */
  readonly meio: Ponto;
  readonly barriga: number;
}

export interface FormaDaCorda {
  readonly alturaDoNo: number;
  readonly cedePorPx: number;
  readonly barrigaMaxima: number;
}

export function cordasDoLote(larguraPx: number, alturaPx: number, forma: FormaDaCorda): readonly CordaDoCanteiro[] {
  const no = (x: number, y: number): Ponto => ({ x, y: y - forma.alturaDoNo });
  const [nw, ne, sw, se] = [no(0, 0), no(larguraPx, 0), no(0, alturaPx), no(larguraPx, alturaPx)];
  const corda = (lado: CordaDoCanteiro['lado'], de: Ponto, ate: Ponto): CordaDoCanteiro => {
    const barriga = Math.min(forma.barrigaMaxima, Math.hypot(ate.x - de.x, ate.y - de.y) * forma.cedePorPx);
    // a curva quadratica passa pela metade da distancia do controle: o controle desce o dobro da barriga
    return { lado, de, ate, barriga, meio: { x: (de.x + ate.x) / 2, y: (de.y + ate.y) / 2 + barriga * 2 } };
  };
  return [corda('cima', nw, ne), corda('direita', ne, se), corda('baixo', sw, se), corda('esquerda', nw, sw)];
}
