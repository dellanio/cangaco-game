'use strict';

// Roteiro da F10. Afirma ESTADO e MEDICAO, nao pixel: o que a cena publica em
// window.__cangaco (as unidades desenhadas, o tick), o texto do HUD e onde cada retangulo
// esta na pagina. O dado esperado vem dos JSON — nada digitado aqui que o jogo tambem saiba.
//
// O que este roteiro existe para provar NA TELA:
//  - o serf SE MOVE: entre um `avancar` e outro a posicao desenhada e FRACIONARIA (no meio de
//    um passo), nao so de tile em tile;
//  - o material SAI do armazem na coleta e some do HUD enquanto vai a caminho (em transito nao
//    e estoque de ninguem), e a carga aparece sobre o serf;
//  - no fim a obra recebeu tudo: o HUD ficou `custo` abaixo, e os serfs voltam a ociosos.
//
// O tempo avanca por `window.__cangaco.avancar(n)` — a PONTE DE HARNESS DA F10 (nao e o laco de
// 10 Hz, que e da F11; ver a nota do F11 no BUILD_PLAN). O cenario e montado so pela UI, como
// nas F07 e F08: nada e injetado no estado.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
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
  const esperarFrame = () => page.waitForTimeout(200); // window.__cangaco sai no POST_RENDER

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

  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const serfsDe = (s) => s.unidadesRenderizadas.filter((u) => u.tipo === 'serf');

  /** Avanca de `passo` em `passo` ticks ate a condicao valer; falha alto se nunca vale. */
  async function ate(cond, passo, maximo, descricao) {
    for (let i = 0; i < maximo; i++) {
      const s = await estado();
      if (cond(s)) return s;
      await avancar(passo);
      await esperarFrame();
    }
    return afirmar(false, `a condicao '${descricao}' nunca valeu em ${maximo} tentativas de ${passo} ticks`);
  }

  // --- a geometria, tirada dos JSON ---
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const escola = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
  const [, alturaDoArmazem] = defDe('storehouse').tamanho;
  const [, alturaDaPedreira] = defDe('quarry').tamanho;
  const custoPorTile = terreno.estrada.custoStonePorTile;
  const { estoque } = economia.estadoInicial;
  const totalDeUnidades = Object.values(economia.estadoInicial.unidades).reduce((a, b) => a + b, 0);
  const serfsDoDado = economia.estadoInicial.unidades.serf;

  // a Pedreira fica a leste da escola, na fileira do armazem; a rua sai da porta do armazem
  // (borda sul, y = gy + altura), corre para leste e sobe ate a porta da obra
  const yPortaDoArmazem = armazem.gy + alturaDoArmazem;
  const pedreira = { gx: escola.gx + 4, gy: armazem.gy };
  const yPortaDaPedreira = pedreira.gy + alturaDaPedreira;
  afirmar(yPortaDaPedreira === yPortaDoArmazem - 1, 'a geometria supoe a porta da obra uma fileira ACIMA da do armazem');
  const inicioDaRua = { gx: armazem.gx, gy: yPortaDoArmazem };
  const cantoDaRua = { gx: pedreira.gx, gy: yPortaDoArmazem };
  const pontaDaRua = { gx: pedreira.gx, gy: yPortaDaPedreira };
  const tilesDaRua = (cantoDaRua.gx - inicioDaRua.gx + 1) + (cantoDaRua.gy - pontaDaRua.gy);
  const custoDaRua = tilesDaRua * custoPorTile;

  // 0. ponto de partida: os serfs e laborers do dado, todos ociosos e sem carga, no tick 0
  const s0 = await estado();
  afirmar(s0.unidadesRenderizadas.length === totalDeUnidades,
    `deveria haver ${totalDeUnidades} unidades desenhadas, veio ${s0.unidadesRenderizadas.length}`);
  afirmar(serfsDe(s0).length === serfsDoDado, `deveria haver ${serfsDoDado} serfs, veio ${serfsDe(s0).length}`);
  afirmar(s0.unidadesRenderizadas.every((u) => u.fsm === 'ocioso' && u.carga === null),
    'no inicio toda unidade deveria estar ociosa e sem carga');
  afirmar(s0.unidadesRenderizadas.every((u) => Number.isInteger(u.gx) && Number.isInteger(u.gy)),
    'parada, a unidade esta num tile inteiro');
  afirmar(typeof s0.tick === 'number', 'o tick deveria estar publicado');
  const hudInicial = await hud();
  afirmar(hudInicial.timber === String(estoque.timber) && hudInicial.stone === String(estoque.stone),
    `o HUD inicial deveria bater com economy.json, veio ${JSON.stringify(hudInicial)}`);

  // 1. planta a Pedreira pela UI
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  const pPedreira = await pontoDoTile(pedreira);
  await page.mouse.move(pPedreira.x, pPedreira.y);
  await esperarFrame();
  await page.mouse.click(pPedreira.x, pPedreira.y);
  await esperarFrame();
  let s = await estado();
  afirmar(s.obrasRenderizadas === 1, `deveria haver 1 obra, veio ${s.obrasRenderizadas}`);
  await page.keyboard.press('Escape');

  // 2. desenha a rua ate a obra, pela UI (o custo sai no comando: desvio da F08)
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await arrastarDentroDoCanvas(
    page, canvas, [await pontoDoTile(inicioDaRua), await pontoDoTile(cantoDaRua), await pontoDoTile(pontaDaRua)],
  );
  await esperarFrame();
  s = await estado();
  afirmar(s.estradasRenderizadas === tilesDaRua, `deveria haver ${tilesDaRua} tiles de estrada, veio ${s.estradasRenderizadas}`);
  await page.keyboard.press('Escape');
  const hudDaRua = await hud();
  afirmar(hudDaRua.stone === String(estoque.stone - custoDaRua),
    `a Pedra deveria cair para ${estoque.stone - custoDaRua} (${tilesDaRua} tiles x ${custoPorTile}), veio ${hudDaRua.stone}`);
  const tickDaRua = s.tick;

  // a obra esta ligada: a sim ja gerou as tarefas, mas nenhum serf se mexeu (o tick so andou por comando)
  afirmar(serfsDe(s).every((u) => u.fsm === 'ocioso'), 'antes de avancar o tempo os serfs continuam ociosos');
  await capturar('serfs-ociosos');

  // 3. avanca o tempo: os serfs reclamam e SE MOVEM. Espera ver uma posicao FRACIONARIA.
  s = await ate(
    (e) => serfsDe(e).some((u) => !Number.isInteger(u.gx) || !Number.isInteger(u.gy)),
    1, 40, 'algum serf a meio de um passo (posicao fracionaria)',
  );
  afirmar(s.tick > tickDaRua, `o tick deveria ter avancado (era ${tickDaRua}, agora ${s.tick})`);
  const emMovimento = serfsDe(s).filter((u) => u.fsm === 'indo_buscar');
  afirmar(emMovimento.length >= 1, `algum serf deveria estar em indo_buscar, veio ${JSON.stringify(serfsDe(s).map((u) => u.fsm))}`);
  afirmar(emMovimento.some((u) => !Number.isInteger(u.gx) || !Number.isInteger(u.gy)), 'um serf indo buscar esta entre dois tiles');
  await capturar('serfs-a-caminho');

  // 4. a carga aparece sobre o serf e o material JA SAIU do armazem (o HUD so soma armazens)
  s = await ate((e) => serfsDe(e).some((u) => u.fsm === 'indo_entregar' && u.carga !== null), 2, 60, 'algum serf carregado a caminho da obra');
  const carregados = serfsDe(s).filter((u) => u.carga !== null);
  afirmar(carregados.every((u) => ['timber', 'stone'].includes(u.carga)), `a carga deveria ser timber ou stone, veio ${JSON.stringify(carregados)}`);
  const hudEmTransito = await hud();
  const somaAntes = Number(hudDaRua.timber) + Number(hudDaRua.stone);
  const somaAgora = Number(hudEmTransito.timber) + Number(hudEmTransito.stone);
  afirmar(somaAgora <= somaAntes - carregados.length,
    `com ${carregados.length} serf(s) carregado(s) o HUD deveria ter caido ao menos isso: era ${somaAntes}, agora ${somaAgora}`);
  await capturar('carga-em-transito');

  // 5. deixa acabar: a obra recebe o custo inteiro e os serfs voltam a ociosos. Um serf recem-entregue
  // pode parecer ocioso por um tick antes de reclamar a proxima tarefa; por isso o criterio e
  // "todos ociosos E o HUD no valor final", conferidos juntos.
  const def = defDe('quarry');
  const timberFinal = estoque.timber - def.timber;
  const stoneFinal = estoque.stone - custoDaRua - def.stone;
  let fim = null;
  let hudFinal = null;
  for (let i = 0; i < 100 && fim === null; i++) {
    const e = await estado();
    const h = await hud();
    if (serfsDe(e).every((u) => u.fsm === 'ocioso' && u.carga === null)
        && h.timber === String(timberFinal) && h.stone === String(stoneFinal)) {
      fim = e;
      hudFinal = h;
    } else {
      await avancar(20);
      await esperarFrame();
    }
  }
  afirmar(fim !== null, `a obra nao recebeu tudo em 2000 ticks: HUD esperado Tabua ${timberFinal} e Pedra ${stoneFinal}, agora ${JSON.stringify(await hud())}`);
  afirmar(hudFinal.timber === String(timberFinal) && hudFinal.stone === String(stoneFinal),
    `no fim o HUD deveria ser Tabua ${timberFinal} e Pedra ${stoneFinal} (o custo da Pedreira sai na entrega)`);
  afirmar(serfsDe(fim).every((u) => Number.isInteger(u.gx) && Number.isInteger(u.gy)), 'parados de novo, os serfs estao em tiles inteiros');
  afirmar(fim.unidadesRenderizadas.length === totalDeUnidades, 'nenhuma unidade sumiu no caminho');
  await capturar('obra-entregue');
}

module.exports = { roteiro };
