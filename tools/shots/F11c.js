'use strict';

// Roteiro da F11c. Afirma ESTADO, nao pixel: a contagem por estagio que
// `WorldScene.atualizarPredios` publica em `window.__cangaco.estagiosDeObraRenderizados`
// (F11c, ver debug.ts). O dado esperado vem dos JSON — nada digitado aqui que o jogo
// tambem saiba.
//
// O que este roteiro existe para provar NA TELA: uma obra plantada pela UI passa
// pelos estagios visuais (marcacao -> ... -> completo), so pelo `step()` — nenhum
// comando alem de plantar o Quarry e desenhar a rua. A prova dos SEIS estagios da
// F17e e o roteiro dela (tools/shots/F17e.js); aqui ficam as tres leituras que a
// F11c fixou: nada martelado, em obra, de pe.
//
// Tempo por `window.__cangaco.avancar(n)` (laco nasce pausado, `?pausado`).

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);

  const esperarFrame = () => page.waitForTimeout(200); // window.__cangaco sai no POST_RENDER
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

  /** F17e: exatamente estas contagens, e zero em todo o resto — inclusive num
   *  estagio que nao existia quando este roteiro foi escrito. Mais estrito que o
   *  `JSON.stringify` do record inteiro, que so comparava a lista de entao. */
  const so = (record, esperado) => Object.entries(record)
    .every(([estagio, n]) => n === (esperado[estagio] ?? 0));

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

  // --- a geometria, tirada dos JSON (mesmo layout do roteiro F10: obra a leste da
  // escola, na fileira do armazem, com a rua ligando as duas portas) ---
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const escola = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
  const [, alturaDoArmazem] = defDe('storehouse').tamanho;
  const [, alturaDaPedreira] = defDe('quarry').tamanho;

  const yPortaDoArmazem = armazem.gy + alturaDoArmazem;
  const pedreira = { gx: escola.gx + 4, gy: armazem.gy };
  const yPortaDaPedreira = pedreira.gy + alturaDaPedreira;
  afirmar(yPortaDaPedreira === yPortaDoArmazem - 1, 'a geometria supoe a porta da obra uma fileira ACIMA da do armazem');
  const inicioDaRua = { gx: armazem.gx, gy: yPortaDoArmazem };
  const cantoDaRua = { gx: pedreira.gx, gy: yPortaDoArmazem };
  const pontaDaRua = { gx: pedreira.gx, gy: yPortaDaPedreira };

  // 0. ponto de partida: nenhuma obra, so os 2 predios completos do cenario
  const s0 = await estado();
  afirmar(s0.obrasRenderizadas === 0, `no inicio nao deveria haver obra, veio ${s0.obrasRenderizadas}`);
  afirmar(
    so(s0.estagiosDeObraRenderizados, { completo: 2 }),
    `no inicio os 2 predios do cenario deveriam contar como 'completo', veio ${JSON.stringify(s0.estagiosDeObraRenderizados)}`,
  );

  // 1. planta o Quarry pela UI — nasce hp=0 e com o terreno por aplainar: MARCACAO
  // (F17e: com o chao ja nivelado e hp=0 o estagio seria FUNDACAO)
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  const pPedreira = await pontoDoTile(pedreira);
  await page.mouse.move(pPedreira.x, pPedreira.y);
  await esperarFrame();
  await page.mouse.click(pPedreira.x, pPedreira.y);
  await avancar(1); // o clique so enfileira o comando; um passo o aplica (F11a)
  await esperarFrame();
  await page.keyboard.press('Escape');
  let s = await estado();
  afirmar(s.obrasRenderizadas === 1, `deveria haver 1 obra, veio ${s.obrasRenderizadas}`);
  afirmar(
    so(s.estagiosDeObraRenderizados, { marcacao: 1, completo: 2 }),
    `recem-plantada (hp=0, terreno por aplainar) a obra deveria contar como 'marcacao', veio ${JSON.stringify(s.estagiosDeObraRenderizados)}`,
  );
  await capturar('marcacao');

  // 2. desenha a rua ate a obra, pela UI: sem ela o serf nunca entrega material, e sem
  // material o laborer nivela mas trava em `esperando_material` para sempre (obra nao
  // trabalhavel — a MESMA regra que evita a partida travar em silencio, CLAUDE.md/plano F11c)
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await arrastarDentroDoCanvas(
    page, canvas, [await pontoDoTile(inicioDaRua), await pontoDoTile(cantoDaRua), await pontoDoTile(pontaDaRua)],
  );
  await avancar(1); // o arrasto so enfileira o PlaceRoad
  await esperarFrame();
  await page.keyboard.press('Escape');

  // 3. avanca ate o laborer martelar o primeiro golpe: hp sai de 0, estagio ESTRUTURA.
  // F17e: a primeira martelada cai em ESTRUTURA, e nao mais no generico 'madeira' —
  // 250 de HP na pedreira poem a fronteira estrutura/paredes em 83.
  // Horizonte generoso: nivelar (60 ticks / 2 laborers) + caminhada + a primeira entrega.
  s = await ate(
    (e) => e.estagiosDeObraRenderizados.estrutura === 1,
    10, 60, 'a obra deveria passar a ESTRUTURA (primeira martelada)',
  );
  afirmar(
    so(s.estagiosDeObraRenderizados, { estrutura: 1, completo: 2 }),
    `com hp>0 e no primeiro terco a obra deveria contar como 'estrutura', veio ${JSON.stringify(s.estagiosDeObraRenderizados)}`,
  );
  afirmar(s.obrasRenderizadas === 1, `a obra em estrutura ainda e 'obra' (nao completou), veio ${s.obrasRenderizadas}`);
  await capturar('estrutura');

  // 4. avanca ate a obra terminar: hp chega no teto (250), o predio nasce, nao ha mais obra.
  s = await ate(
    (e) => e.obrasRenderizadas === 0,
    20, 150, 'a obra deveria terminar (building-completed) e sumir de obrasRenderizadas',
  );
  afirmar(
    so(s.estagiosDeObraRenderizados, { completo: 3 }),
    `de pe, o Quarry deveria somar ao 'completo' dos 2 predios do cenario (3 no total), veio ${JSON.stringify(s.estagiosDeObraRenderizados)}`,
  );
  afirmar(s.prediosRenderizados === 3, `deveriam existir 3 predios desenhados (armazem, escola, pedreira), veio ${s.prediosRenderizados}`);
  await capturar('completo');
}

module.exports = { roteiro };
