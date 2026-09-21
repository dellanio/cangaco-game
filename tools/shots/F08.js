'use strict';

// Roteiro da F08. Afirma ESTADO e MEDICAO, nao pixel: o que a cena publica em
// window.__cangaco, o texto do HUD e onde cada retangulo esta na pagina. O dado
// esperado vem dos JSON — nada digitado aqui que o jogo tambem saiba.
//
// Dois pontos que este roteiro existe para provar NA TELA:
//  - aqui, ao contrario da obra da F07, o custo SAI no comando: a Pedra do HUD cai
//    `tiles x custoStonePorTile` ao soltar o arrasto (e NAO durante ele);
//  - demolir devolve `floor(removidos x devolucaoAoDemolir)`, e um arrasto que sai
//    do canvas nao gasta nada (cancela).
//
// Todo arrasto usa `arrastarDentroDoCanvas`, que LANCA se um ponto sair do canvas
// (achado da F06: fora dele o Chromium nao entrega mousemove ao Phaser). O unico
// movimento que sai — o do passo 5 — e um `page.mouse.move` explicito, fora do helper.

const { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const painel = await retanguloDe(page, '#menu-build');

  const ler = (campo) => page.textContent(`#hud .valor[data-campo="${campo}"]`);
  const hud = async () => ({
    gold: await ler('gold'), timber: await ler('timber'), stone: await ler('stone'),
    comida: await ler('comida'), populacao: await ler('populacao'),
  });
  const esperarFrame = () => page.waitForTimeout(200); // window.__cangaco sai no POST_RENDER
  // F11a: o laco nasce pausado (`?pausado`, no runner) e o clique so ENFILEIRA o comando. Cada gesto
  // que emite (ou poderia emitir) um comando roda UM passo, como o clique fazia antes do laco.
  // Tambem depois dos gestos que NAO devem emitir nada: sem o passo, um comando emitido por engano
  // ficaria na fila e "nao construiu nada" passaria em falso.
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function pontoDoTile(tile) {
    const { camera } = await estado();
    const x = canvas.left + tile.gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + tile.gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${tile.gx},${tile.gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  const custoPorTile = terreno.estrada.custoStonePorTile;
  const fracao = terreno.estrada.devolucaoAoDemolir;
  const pedraInicial = economia.estadoInicial.estoque.stone;

  // geometria do L, tirada dos JSON: a rua ao longo da borda sul do armazem ate o
  // canto da escola, e dali duas casas para baixo
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const escola = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
  const [larguraDoArmazem, alturaDoArmazem] = defDe('storehouse').tamanho;
  const yRua = armazem.gy + alturaDoArmazem;
  const inicio = { gx: armazem.gx, gy: yRua };
  const canto = { gx: escola.gx + 1, gy: yRua };
  const ponta = { gx: canto.gx, gy: yRua + 2 };
  const totalDeTiles = (canto.gx - inicio.gx + 1) + (ponta.gy - canto.gy);
  const meio = [
    { gx: armazem.gx + larguraDoArmazem, gy: yRua },
    { gx: armazem.gx + larguraDoArmazem + 1, gy: yRua },
  ];

  // 0. ponto de partida: nenhuma estrada, HUD = tabela do cenario
  const inicioDoEstado = await estado();
  afirmar(inicioDoEstado.estradasRenderizadas === 0, `no inicio nao deveria haver estrada, veio ${inicioDoEstado.estradasRenderizadas}`);
  const hudInicial = await hud();
  afirmar(hudInicial.stone === String(pedraInicial), `a Pedra inicial deveria ser ${pedraInicial}, veio ${hudInicial.stone}`);

  // 1. o painel tem a ferramenta, com o custo do dado
  const textoDaEstrada = await page.textContent('[data-ferramenta="estrada"]');
  afirmar(textoDaEstrada.includes(String(custoPorTile)), `o botao da estrada deveria mostrar o custo ${custoPorTile}, veio: ${textoDaEstrada}`);
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  afirmar(await page.getAttribute('[data-ferramenta="estrada"]', 'aria-pressed') === 'true', 'o botao da estrada deveria ficar marcado');

  // 2. ARRASTAR o L, sem soltar: so previa, e a Pedra ainda intacta
  const pInicio = await pontoDoTile(inicio);
  const pCanto = await pontoDoTile(canto);
  const pPonta = await pontoDoTile(ponta);
  await arrastarDentroDoCanvas(page, canvas, [pInicio, pCanto, pPonta], { soltar: false });
  await esperarFrame();
  let s = await estado();
  afirmar(
    s.previaDeEstrada !== null && s.previaDeEstrada.modo === 'estrada' && s.previaDeEstrada.tiles === totalDeTiles
      && s.previaDeEstrada.valida === true && s.previaDeEstrada.custo === totalDeTiles * custoPorTile,
    `a previa deveria ter ${totalDeTiles} tiles validos custando ${totalDeTiles * custoPorTile}, veio ${JSON.stringify(s.previaDeEstrada)}`,
  );
  afirmar(s.estradasRenderizadas === 0, 'enquanto arrasta ainda nao ha estrada no estado');
  afirmar((await hud()).stone === hudInicial.stone, 'enquanto arrasta a Pedra NAO deve cair: so ao soltar');
  await capturar('previa-do-arrasto');

  // 3. SOLTAR: a estrada nasce e o custo SAI
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.estradasRenderizadas === totalDeTiles, `deveria haver ${totalDeTiles} tiles de estrada, veio ${s.estradasRenderizadas}`);
  afirmar(s.previaDeEstrada === null, 'depois de soltar a previa some');
  const hudDepoisDeConstruir = await hud();
  const pedraEsperada = pedraInicial - totalDeTiles * custoPorTile;
  afirmar(
    hudDepoisDeConstruir.stone === String(pedraEsperada),
    `a Pedra deveria cair de ${pedraInicial} para ${pedraEsperada} (${totalDeTiles} x ${custoPorTile}), veio ${hudDepoisDeConstruir.stone}`,
  );
  afirmar(
    hudDepoisDeConstruir.gold === hudInicial.gold && hudDepoisDeConstruir.timber === hudInicial.timber
      && hudDepoisDeConstruir.comida === hudInicial.comida,
    'so a Pedra deveria mudar',
  );
  await capturar('estrada-desenhada');

  // 4. DEMOLIR 2 tiles do meio: a rede parte, a estrada perde 2 e a Pedra SOBE floor(2 x fracao)
  await page.click('[data-ferramenta="demolir-estrada"]');
  await esperarFrame();
  const pMeio0 = await pontoDoTile(meio[0]);
  const pMeio1 = await pontoDoTile(meio[1]);
  await arrastarDentroDoCanvas(page, canvas, [pMeio0, pMeio1], { soltar: false });
  await esperarFrame();
  s = await estado();
  afirmar(
    s.previaDeEstrada !== null && s.previaDeEstrada.modo === 'demolir-estrada' && s.previaDeEstrada.tiles === 2,
    `a previa da demolicao deveria mostrar 2 tiles, veio ${JSON.stringify(s.previaDeEstrada)}`,
  );
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.estradasRenderizadas === totalDeTiles - 2, `deveriam sobrar ${totalDeTiles - 2} tiles, veio ${s.estradasRenderizadas}`);
  const devolvida = Math.floor(2 * fracao);
  const pedraDepoisDeDemolir = pedraEsperada + devolvida;
  afirmar(
    (await hud()).stone === String(pedraDepoisDeDemolir),
    `a Pedra deveria subir ${devolvida} (floor(2 x ${fracao})) para ${pedraDepoisDeDemolir}, veio ${(await hud()).stone}`,
  );
  await capturar('estrada-partida');

  // 5. SAIR DO CANVAS com o botao apertado CANCELA: nada e gasto nem construido.
  //    Este e o UNICO arrasto que sai do canvas, de proposito: e a prova do
  //    cancelamento. Fora do canvas o Chromium nao entrega mais mousemove ao Phaser,
  //    entao o trecho conhecido estaria truncado — cancelar e o padrao conservador.
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  // dois tiles livres a esquerda do armazem, bem dentro da area visivel
  const livre0 = await pontoDoTile({ gx: armazem.gx - 3, gy: yRua });
  const livre1 = await pontoDoTile({ gx: armazem.gx - 1, gy: yRua });
  const foraDoCanvas = { x: painel.left + painel.width / 2, y: painel.top + 200 };
  await arrastarDentroDoCanvas(page, canvas, [livre0, livre1], { soltar: false });
  await esperarFrame();
  afirmar((await estado()).previaDeEstrada !== null, 'antes de sair, o arrasto deveria ter previa');
  await page.mouse.move(foraDoCanvas.x, foraDoCanvas.y, { steps: 6 }); // sai do canvas, botao apertado
  await esperarFrame();
  afirmar((await estado()).previaDeEstrada === null, 'ao sair do canvas o arrasto deveria ser cancelado (previa some)');
  await page.mouse.up(); // o mouseup fora do canvas chega sem arrasto e e ignorado
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.estradasRenderizadas === totalDeTiles - 2, `sair do canvas nao deveria construir nada, veio ${s.estradasRenderizadas}`);
  afirmar((await hud()).stone === String(pedraDepoisDeDemolir), 'sair do canvas nao deveria gastar pedra');

  // 6. Esc no MEIO do arrasto tambem cancela e desmarca a ferramenta
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await arrastarDentroDoCanvas(page, canvas, [livre0, livre1], { soltar: false });
  await esperarFrame();
  afirmar((await estado()).previaDeEstrada !== null, 'antes do Esc o arrasto deveria ter previa');
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar((await estado()).previaDeEstrada === null, 'o Esc no meio do arrasto deveria cancelar (previa some)');
  await page.mouse.up();
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.estradasRenderizadas === totalDeTiles - 2, `o Esc nao deveria construir nada, veio ${s.estradasRenderizadas}`);
  afirmar((await hud()).stone === String(pedraDepoisDeDemolir), 'o Esc nao deveria gastar pedra');
  afirmar(await page.getAttribute('[data-ferramenta="estrada"]', 'aria-pressed') === 'false', 'depois do Esc a ferramenta deveria estar desmarcada');
}

module.exports = { roteiro };
