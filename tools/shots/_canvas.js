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

/**
 * UI-barra-a — o ponto de PAGINA onde apertar o elemento com `mouse.down/up`, como o
 * jogador faz: rola o corpo da barra ate o elemento aparecer (a grade do engajar
 * rola, decisao do operador) e confere que o que esta sob o ponto e o proprio
 * elemento ou um filho dele. `page.click()` rolava sozinho; o aperto cru nao, e
 * sem isto o aperto caiu no lema da marca, embaixo do corpo (medido no F11c:
 * botao em y 683..704, corpo visivel ate 672). Coberto por outra coisa, reprova.
 */
async function pontoParaApertar(page, seletor) {
  const resultado = await page.evaluate((s) => {
    const alvo = window.document.querySelector(s);
    if (!alvo) return { erro: `nenhum elemento casa com ${s}` };
    alvo.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = alvo.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const sob = window.document.elementFromPoint(x, y);
    if (!sob || !alvo.contains(sob)) {
      const quem = sob ? `${sob.tagName.toLowerCase()}${sob.id ? `#${sob.id}` : ''}.${sob.className}` : 'nada';
      return { erro: `${s} esta coberto em (${Math.round(x)},${Math.round(y)}) por ${quem}` };
    }
    return { x, y };
  }, seletor);
  if (resultado.erro) throw new Error(`pontoParaApertar: ${resultado.erro}`);
  return resultado;
}

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

/**
 * F18a — o CENTRO de um tile no canvas, ciente de zoom.
 *
 * Ate a F18a cada roteiro calculava `canvas.left + gx * TILE_PX - camera.scrollX`
 * a mao, e essa formula so vale em zoom 1: com zoom, tela = (mundo - scroll) * zoom.
 * Enquanto o nivel inicial for 1 os roteiros antigos continuam certos; qualquer
 * roteiro que MEXA no zoom tem de passar por aqui.
 *
 * `camera` e o `window.__cangaco.camera` que a cena publica no POST_RENDER:
 * { scrollX, scrollY, zoom } — ja com o clamp de setBounds aplicado.
 */
function pontoDoTileNaTela(canvas, tile, camera, tilePx) {
  const mundoX = tile.gx * tilePx + tilePx / 2;
  const mundoY = tile.gy * tilePx + tilePx / 2;
  // F18b: a origem da camera e 0.5, entao ampliar e AFASTAR do centro do quadro,
  // nao do canto. Esta e a inversa exata de `mundoSobPonto` (`render/zoom.ts`),
  // com ancora e origem valendo meio quadro. Em zoom 1 os dois termos de origem
  // se cancelam e sobra `(mundo - scroll)`, que era a formula anterior — por isso
  // ela nunca acusou: ate a F18b nenhum roteiro calculava ponto fora do neutro.
  const meioX = canvas.width / 2;
  const meioY = canvas.height / 2;
  return {
    x: canvas.left + (mundoX - camera.scrollX - meioX) * camera.zoom + meioX,
    y: canvas.top + (mundoY - camera.scrollY - meioY) * camera.zoom + meioY,
  };
}

/**
 * F18b — a borda sudeste do mundo que a camera consegue mostrar, em pixel de
 * mundo, ja com o clamp de `setBounds` aplicado.
 *
 * O clamp do Phaser nao para o `scroll` na borda do mapa: ele para a area
 * EXIBIDA, que com origem 0.5 vai de `scroll + meio - meio/zoom` a
 * `scroll + meio + meio/zoom`. Medido na F18b: num mapa de 8192 px e quadro de
 * 1020, o scroll encosta em 6662, nao em 7172.
 */
function bordaVisivel(canvas, camera) {
  return {
    x: camera.scrollX + canvas.width / 2 + (canvas.width / camera.zoom) / 2,
    y: camera.scrollY + canvas.height / 2 + (canvas.height / camera.zoom) / 2,
  };
}

module.exports = {
  retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas, pontoDoTileNaTela, bordaVisivel, pontoParaApertar,
};
