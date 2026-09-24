import type { TileClicado } from './colocar';

/**
 * A linha 8-CONECTADA de `a` ate `b`, extremos incluidos: cada passo anda um tile
 * em X, em Y ou nos dois, `max(|dx|, |dy|) + 1` tiles. E o que o arrasto usa para
 * preencher o caminho entre duas amostras do mouse — um `mousemove` rapido pula
 * tiles, e uma estrada com buraco nao conecta.
 *
 * Ate a F18d era 4-conectada, porque a estrada so ligava em cruz e a escada de
 * passos ortogonais era a unica rua de verdade. Com a F18e a estrada liga em
 * diagonal, e a escada viraria o dobro de tiles pagos pelo mesmo trajeto.
 *
 * Bresenham inteiro: `err` guarda a diferenca acumulada entre os dois eixos, e o
 * passo anda em cada eixo que esteja atrasado — quando os dois estao, sai a
 * diagonal. Sem ponto flutuante, sem divisao. Pura e deterministica.
 */
export function tilesEntre(a: TileClicado, b: TileClicado): TileClicado[] {
  const nx = Math.abs(b.gx - a.gx);
  const ny = Math.abs(b.gy - a.gy);
  const passoX = b.gx >= a.gx ? 1 : -1;
  const passoY = b.gy >= a.gy ? 1 : -1;

  let gx = a.gx;
  let gy = a.gy;
  const tiles: TileClicado[] = [{ gx, gy }];
  let err = nx - ny;
  while (gx !== b.gx || gy !== b.gy) {
    const dobro = 2 * err;
    if (dobro > -ny) {
      err -= ny;
      gx += passoX;
    }
    if (dobro < nx) {
      err += nx;
      gy += passoY;
    }
    tiles.push({ gx, gy });
  }
  return tiles;
}
