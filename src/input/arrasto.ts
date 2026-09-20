import type { TileClicado } from './colocar';

/**
 * A linha 4-CONECTADA de `a` ate `b`, extremos incluidos: so passos ortogonais,
 * `|dx| + |dy| + 1` tiles, nunca um salto diagonal. E o que o arrasto usa para
 * preencher o caminho entre duas amostras do mouse — um `mousemove` rapido pula
 * tiles, e uma estrada com buraco nao conecta.
 *
 * Caminhada de grade: a cada passo anda no eixo cuja fracao percorrida esta
 * atrasada, comparando em inteiros `(1 + 2*ix) * ny` contra `(1 + 2*iy) * nx`
 * (sem ponto flutuante, sem divisao). Pura e deterministica.
 */
export function tilesEntre(a: TileClicado, b: TileClicado): TileClicado[] {
  const nx = Math.abs(b.gx - a.gx);
  const ny = Math.abs(b.gy - a.gy);
  const passoX = b.gx >= a.gx ? 1 : -1;
  const passoY = b.gy >= a.gy ? 1 : -1;

  let gx = a.gx;
  let gy = a.gy;
  const tiles: TileClicado[] = [{ gx, gy }];
  let ix = 0;
  let iy = 0;
  while (ix < nx || iy < ny) {
    if ((1 + 2 * ix) * ny < (1 + 2 * iy) * nx) {
      gx += passoX;
      ix += 1;
    } else {
      gy += passoY;
      iy += 1;
    }
    tiles.push({ gx, gy });
  }
  return tiles;
}
