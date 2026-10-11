'use strict';
// O lote de um roteiro escolhido pela PLANTA do jogo, e nao por um modelo da regra copiado no roteiro.
// Nasceu no fechamento de 2026-10-11: com predio proibido sobre a roca (I-OBRA-SEM-PREDIO-NA-ROCA),
// "logo abaixo do armazem" caiu no rocado de partida, e o modelo de lote livre dos roteiros nao sabia
// do terreno de cima da vila. Quem responde e o `canPlace` da sim, pelo `plantaFantasma` da ponte.
//
// A ferramenta do predio ja tem de estar armada. Cada candidato e uma LISTA de tiles (o lote e os que
// o roteiro vai usar junto, como o vizinho de uma segunda obra): o primeiro candidato em que todo tile
// esta na vista e a planta diz `valida` ganha. Devolve tambem quantos foram recusados, para o log.

/** Os tiles em aneis de Chebyshev em volta de `centro`, do mais perto ao mais longe, ate `raio`. */
function aneisEmVolta(centro, raio) {
  const tiles = [];
  for (let r = 1; r <= raio; r += 1) {
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r) tiles.push({ gx: centro.gx + dx, gy: centro.gy + dy });
      }
    }
  }
  return tiles;
}

/**
 * @param {{ page: any, estado: () => Promise<any>, canvas: {left:number,top:number,right:number,bottom:number},
 *           tilePx: number, candidatos: {gx:number,gy:number}[][], esperar?: () => Promise<void> }} e
 * @returns {Promise<{ escolhido: {gx:number,gy:number}[] | null, recusados: number }>}
 */
async function lotePelaPlanta({ page, estado, canvas, tilePx, candidatos, esperar }) {
  const pausa = esperar ?? (() => page.waitForTimeout(120));
  let recusados = 0;
  for (const tiles of candidatos) {
    let ok = true;
    for (const t of tiles) {
      const { camera } = await estado();
      const x = canvas.left + t.gx * tilePx + tilePx / 2 - camera.scrollX;
      const y = canvas.top + t.gy * tilePx + tilePx / 2 - camera.scrollY;
      if (!(x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom)) { ok = false; break; }
      await page.mouse.move(x, y);
      await pausa();
      const planta = (await estado()).plantaFantasma;
      if (planta === null || planta.gx !== t.gx || planta.gy !== t.gy || planta.valida !== true) { ok = false; break; }
    }
    if (ok) return { escolhido: tiles, recusados };
    recusados += 1;
  }
  return { escolhido: null, recusados };
}

module.exports = { aneisEmVolta, lotePelaPlanta };
