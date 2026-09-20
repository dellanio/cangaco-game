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

module.exports = { retanguloDe, retanguloDoCanvas };
