'use strict';

// Desde a F06 o canvas nao ocupa a pagina inteira: fica numa celula de grade,
// abaixo do HUD e ao lado do painel. Coordenada de pagina deixou de ser
// coordenada de canvas — os roteiros que movem o mouse convertem por aqui.
// Nao e um roteiro (shot.js so carrega shots/<nome>.js por nome).

async function retanguloDe(page, seletor) {
  return page.evaluate((s) => {
    const r = window.document.querySelector(s).getBoundingClientRect();
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }, seletor);
}

const retanguloDoCanvas = (page) => retanguloDe(page, '#jogo canvas');

const dentro = (retangulo, ponto) => ponto.x > retangulo.left && ponto.x < retangulo.right
  && ponto.y > retangulo.top && ponto.y < retangulo.bottom;

/**
 * Arrasta o mouse por `pontos` (coordenadas de PAGINA), com o botao esquerdo apertado.
 *
 * O erro da F06 vira ERRO DESTE HELPER, nao convencao que alguem esquece: um
 * `mousemove` que sai do canvas para de ser entregue ao Phaser (o Chromium so
 * despacha o evento a quem esta sob o ponteiro), entao o excesso pedido nunca vira
 * movimento — e o teste passa ou falha por um motivo que nao e o que ele diz medir.
 * Por isso LANCA se qualquer ponto cair fora do retangulo do canvas.
 *
 * O unico movimento que precisa sair — o que prova o CANCELAMENTO — e feito a mao,
 * com um `page.mouse.move` explicito FORA deste helper, com o porque escrito no
 * roteiro: assim sair do canvas nunca acontece por engano.
 *
 * Entre um ponto e o seguinte usa `steps`, para o Phaser ver amostras no caminho e
 * nao um salto unico. Com `soltar: false` o botao segue apertado e quem chamou
 * decide (afirmar a previa, apertar Esc) e solta com `page.mouse.up()`.
 */
async function arrastarDentroDoCanvas(page, canvas, pontos, opcoes = {}) {
  const { passos = 8, soltar = true } = opcoes;
  if (pontos.length < 2) throw new Error('arrastarDentroDoCanvas: preciso de pelo menos 2 pontos');
  for (const ponto of pontos) {
    if (!dentro(canvas, ponto)) {
      throw new Error(
        `arrastarDentroDoCanvas: o ponto (${ponto.x}, ${ponto.y}) esta fora do canvas `
        + `(${canvas.left},${canvas.top})-(${canvas.right},${canvas.bottom}); um mousemove fora do `
        + 'canvas nao chega ao Phaser (achado da F06). Para provar o cancelamento, saia do canvas '
        + 'com um page.mouse.move explicito, fora deste helper.',
      );
    }
  }
  await page.mouse.move(pontos[0].x, pontos[0].y);
  await page.mouse.down();
  for (const ponto of pontos.slice(1)) await page.mouse.move(ponto.x, ponto.y, { steps: passos });
  if (soltar) await page.mouse.up();
}

module.exports = { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas };
