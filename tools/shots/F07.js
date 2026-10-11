'use strict';

// Roteiro da F07. Afirma ESTADO e MEDICAO, nao pixel: o que a cena publica em
// window.__cangaco, o texto do HUD e onde cada retangulo esta na pagina. O dado
// esperado vem dos JSON — nada digitado aqui que o jogo tambem saiba.
//
// O ponto que este roteiro existe para provar na TELA: o custo NAO sai do
// estoque no clique. O HUD tem que continuar igual depois de plantar (ele sai na
// entrega, F10) — se alguem "melhorar" debitando no clique, o HUD muda e aqui
// reprova.

const { retanguloDoCanvas } = require('./_canvas');
const { aneisEmVolta, lotePelaPlanta } = require('./_lote-pela-planta');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);

  const ler = (campo) => page.textContent(`#hud .valor[data-campo="${campo}"]`);
  const hud = async () => ({
    gold: await ler('gold'), timber: await ler('timber'), stone: await ler('stone'),
    comida: await ler('comida'), populacao: await ler('populacao'),
  });

  // pausa curta: window.__cangaco e publicado no POST_RENDER
  const esperarFrame = () => page.waitForTimeout(200);
  // F11a: o laco nasce pausado (`?pausado`, no runner) e o clique so ENFILEIRA o comando. Cada clique
  // que emite (ou poderia emitir) um comando roda UM passo, como o clique fazia antes do laco. Tambem
  // o que NAO deve plantar nada: sem o passo, um comando emitido por engano ficaria na fila.
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  // ponto de pagina no centro de um tile, dada a camera atual
  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    const x = canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  // 0. ponto de partida: 2 predios completos, nenhuma obra, HUD = tabela do cenario
  const inicio = await estado();
  afirmar(inicio.prediosRenderizados === economia.estadoInicial.predios.length,
    `no inicio deveria haver ${economia.estadoInicial.predios.length} predios, veio ${inicio.prediosRenderizados}`);
  afirmar(inicio.obrasRenderizadas === 0, `no inicio nao deveria haver obra, veio ${inicio.obrasRenderizadas}`);
  const hudAntes = await hud();
  const { estoque } = economia.estadoInicial;
  afirmar(
    hudAntes.gold === String(estoque.gold) && hudAntes.timber === String(estoque.timber) && hudAntes.stone === String(estoque.stone),
    `o HUD inicial deveria bater com economy.json, veio ${JSON.stringify(hudAntes)}`,
  );

  // 1. escolher o predio no painel (quarry: liberado pela arvore, cabe no canvas)
  const id = 'quarry';
  await page.click(`[data-predio="${id}"]`);
  await esperarFrame();
  afirmar((await estado()).ferramentaAtiva === id, `a ferramenta deveria estar em ${id}`);

  // 2. planta VERDE sobre o lote livre mais perto do armazem do cenario, escolhido pela propria planta
  //    (`_lote-pela-planta`). Ate 2026-10-11 era "logo abaixo do armazem"; ali agora e o rocado de
  //    partida, e predio nao se planta na roca (I-OBRA-SEM-PREDIO-NA-ROCA). O candidato so vale se o
  //    vizinho da segunda obra (passo 5) e o tile do clique sem ferramenta (passo 6) tambem forem lote
  //    valido: assim o passo 6 prova que so a falta da ferramenta impediu a obra.
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [larguraDoPredio] = defDe(id).tamanho;
  const { escolhido, recusados } = await lotePelaPlanta({
    page, estado, canvas, tilePx: TILE_PX, esperar: esperarFrame,
    candidatos: aneisEmVolta({ gx: armazem.gx, gy: armazem.gy }, 8)
      .map((t) => [t, { gx: t.gx + larguraDoPredio + 1, gy: t.gy }, { gx: t.gx - 4, gy: t.gy }]),
  });
  afirmar(escolhido !== null, `a planta deveria aprovar um lote perto do armazem (recusados: ${recusados})`);
  const livre = escolhido[0];
  console.log(`F07: lote (${livre.gx},${livre.gy}), ${recusados} candidatos recusados pela planta antes`);
  const pontoLivre = await pontoDoTile(livre.gx, livre.gy);
  await page.mouse.move(pontoLivre.x, pontoLivre.y);
  await esperarFrame();
  const verde = (await estado()).plantaFantasma;
  afirmar(verde !== null && verde.valida === true,
    `antes do clique a planta deveria ser valida em (${livre.gx},${livre.gy}), veio ${JSON.stringify(verde)}`);
  await capturar('antes-do-clique');

  // 3. CLICAR: a obra nasce no chao
  await page.mouse.click(pontoLivre.x, pontoLivre.y);
  await avancar(1);
  await esperarFrame();
  let s = await estado();
  afirmar(s.prediosRenderizados === inicio.prediosRenderizados + 1,
    `depois do clique deveria haver um predio a mais, veio ${s.prediosRenderizados}`);
  afirmar(s.obrasRenderizadas === 1, `deveria haver 1 obra desenhada, veio ${s.obrasRenderizadas}`);

  // 3a. o custo NAO saiu: o HUD e identico ao de antes do clique
  const hudDepois = await hud();
  afirmar(JSON.stringify(hudDepois) === JSON.stringify(hudAntes),
    `o custo nao deveria sair no clique: HUD antes ${JSON.stringify(hudAntes)}, depois ${JSON.stringify(hudDepois)}`);

  // 3b. a planta agora recusa o mesmo tile, por sobreposicao com a obra recem-criada
  afirmar(
    s.plantaFantasma !== null && s.plantaFantasma.valida === false && s.plantaFantasma.motivo === 'sobreposicao',
    `sobre a obra a planta deveria recusar por sobreposicao, veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  // 3c. a ferramenta segue ativa: o jogador planta varios em sequencia
  afirmar(s.ferramentaAtiva === id, `a ferramenta deveria seguir ativa depois de plantar, veio ${s.ferramentaAtiva}`);
  await capturar('obra-plantada');

  // 4. um segundo clique no MESMO tile e rejeitado: nada muda
  await page.mouse.click(pontoLivre.x, pontoLivre.y);
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.prediosRenderizados === inicio.prediosRenderizados + 1 && s.obrasRenderizadas === 1,
    `o segundo clique no mesmo tile deveria ser rejeitado, veio ${s.prediosRenderizados} predios / ${s.obrasRenderizadas} obras`);

  // 5. encostada na primeira obra, a planta recusa ('colado', I-OBRA-UM-TILE-ENTRE-PREDIOS);
  //    um tile adiante, livre, a segunda obra nasce
  const encostado = { gx: livre.gx + larguraDoPredio, gy: livre.gy };
  const pontoEncostado = await pontoDoTile(encostado.gx, encostado.gy);
  await page.mouse.move(pontoEncostado.x, pontoEncostado.y);
  await esperarFrame();
  const colada = (await estado()).plantaFantasma;
  afirmar(colada !== null && colada.valida === false && colada.motivo === 'colado',
    `encostada na obra a planta deveria recusar por 'colado', veio ${JSON.stringify(colada)}`);
  const vizinho = { gx: livre.gx + larguraDoPredio + 1, gy: livre.gy };
  const pontoVizinho = await pontoDoTile(vizinho.gx, vizinho.gy);
  await page.mouse.click(pontoVizinho.x, pontoVizinho.y);
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.obrasRenderizadas === 2 && s.prediosRenderizados === inicio.prediosRenderizados + 2,
    `deveria haver 2 obras, veio ${s.obrasRenderizadas}`);
  afirmar(JSON.stringify(await hud()) === JSON.stringify(hudAntes), 'o HUD segue intacto depois da segunda obra');
  await capturar('duas-obras');

  // 6. Esc encerra a ferramenta; clicar sem ferramenta nao planta nada
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar((await estado()).ferramentaAtiva === null, 'depois do Esc a ferramenta deveria ser null');
  const foraDeUso = await pontoDoTile(livre.gx - 4, livre.gy);
  await page.mouse.click(foraDeUso.x, foraDeUso.y);
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.obrasRenderizadas === 2, `sem ferramenta, clicar nao deveria plantar; obras: ${s.obrasRenderizadas}`);
}

module.exports = { roteiro };
