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
//
// A pedreira fica ao lado do lajedo (`_pedreira.js`) e, de pe, recebe o cabra e
// PRODUZ: o roteiro termina com pedra na saida. Antes ela ficava a leste da escola,
// sem rocha ao alcance, e a foto do `completo` retratava uma pedreira morta.

const { retanguloDoCanvas, arrastarDentroDoCanvas, pontoParaApertar } = require('./_canvas');
const { arrastosDaRua } = require('./_recursos');
const { pedreiraNoLajedo, esperarPedraNaSaida } = require('./_pedreira');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const { assets } = require('../../assets/manifest.json');
const temArte = (id) => assets.some((e) => e.id === id);

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

  /** Anda a camera com as setas ate a coluna cair no meio do quadro (molde da F-T3). */
  async function centrarEm(gx) {
    const alvo = Math.max(0, gx * TILE_PX - (canvas.right - canvas.left) / 2);
    for (let i = 0; i < 30; i += 1) {
      const { camera } = await estado();
      const delta = alvo - camera.scrollX;
      if (Math.abs(delta) < TILE_PX) return;
      const tecla = delta > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(tecla);
      await page.waitForTimeout(120);
      await page.keyboard.up(tecla);
      await esperarFrame();
    }
  }

  // --- a geometria, tirada dos JSON: a pedreira ao lado do lajedo, com a borda sul
  // na linha de porta do armazem, e a rua da pedreira ate a escola ---
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const escola = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu] = defDe('quarry').tamanho;
  const { pedreira, tilesDaRua: rua } = pedreiraNoLajedo({ armazem, escola, tamanhoDe: (id) => defDe(id).tamanho, afirmar });
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  const civil = defDe('quarry').trabalhador;
  afirmar(typeof civil === 'string', 'a pedreira precisa declarar `trabalhador` no dado');

  // 0. ponto de partida: nenhuma obra, so os 2 predios completos do cenario
  const s0 = await estado();
  afirmar(s0.obrasRenderizadas === 0, `no inicio nao deveria haver obra, veio ${s0.obrasRenderizadas}`);
  afirmar(
    so(s0.estagiosDeObraRenderizados, { completo: 2 }),
    `no inicio os 2 predios do cenario deveriam contar como 'completo', veio ${JSON.stringify(s0.estagiosDeObraRenderizados)}`,
  );

  // 1. planta o Quarry pela UI — nasce hp=0 e com o terreno por aplainar: MARCACAO
  // (F17e: com o chao ja nivelado e hp=0 o estagio seria FUNDACAO)
  await centrarEm(pedreira.gx + largQu);
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
  for (const { gy, de, ate } of arrastosDaRua(rua)) {
    await centrarEm(Math.floor((de + ate) / 2));
    await arrastarDentroDoCanvas(page, canvas, [await pontoDoTile({ gx: de, gy }), await pontoDoTile({ gx: ate, gy })]);
    await avancar(1); // o arrasto so enfileira o PlaceRoad
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await centrarEm(pedreira.gx + largQu);

  // 3. avanca ate o laborer martelar o primeiro golpe: hp sai de 0, a ESTRUTURA DE
  // MADEIRA aparece. Desde a F17g (e o lote de arte que deu PNG a pedreira), a
  // estrutura de um predio com arte e a REVELACAO da imagem de madeira, nao o estagio
  // 'estrutura' do fallback: a obra sai de `estagiosDeObraRenderizados` e entra em
  // `revelacaoDasObras` (BUG-M, 2026-09-28). A leitura continua estrita: madeira
  // subindo, pedra ainda nada, e nenhuma obra no fallback.
  // Horizonte generoso: nivelar (60 ticks / 2 laborers) + caminhada + a primeira entrega.
  afirmar(temArte('quarry'), 'este roteiro assume a pedreira com arte (revelacao da F17g)');
  s = await ate(
    (e) => Object.values(e.revelacaoDasObras).some((r) => r.madeira[0] > 0),
    10, 60, 'a obra deveria passar a ESTRUTURA DE MADEIRA (primeira martelada revela a madeira)',
  );
  {
    const revs = Object.values(s.revelacaoDasObras);
    afirmar(
      revs.length === 1 && revs[0].madeira[0] > 0 && revs[0].pedra[0] === 0,
      `no primeiro terco a obra deveria revelar so madeira, veio ${JSON.stringify(s.revelacaoDasObras)}`,
    );
  }
  afirmar(
    so(s.estagiosDeObraRenderizados, { completo: 2 }),
    `a obra revelada nao conta no fallback; so os 2 predios de pe, veio ${JSON.stringify(s.estagiosDeObraRenderizados)}`,
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

  // 5. a escola treina o cabra, e a pedreira PRODUZ. O clique de painel roda
  // despausado e segurando 150 ms (§8).
  const ID_PEDREIRA = Object.entries(s.prediosDoEstado).find(([, p]) => p.gx === pedreira.gx && p.gy === pedreira.gy)?.[0];
  afirmar(ID_PEDREIRA !== undefined, `a pedreira de pe deveria estar em (${pedreira.gx},${pedreira.gy})`);
  await centrarEm(meioDaEscola.gx);
  const pEscola = await pontoDoTile(meioDaEscola);
  await page.mouse.click(pEscola.x, pEscola.y);
  await esperarFrame();
  // UI-barra-a: o engajar rola no corpo da barra; o aperto cru nao rola sozinho.
  const botao = await pontoParaApertar(page, `#painel-predio [data-treinar="${civil}"]`);
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'o clique do treino precisa do relogio correndo');
  await page.mouse.move(botao.x, botao.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
  await page.keyboard.press('Escape');
  await esperarFrame();
  await ate((e) => e.prediosDoEstado[ID_PEDREIRA]?.ocupante != null, 50, 18, 'o cabra treinado deveria ocupar a pedreira');
  await centrarEm(pedreira.gx + largQu);
  await esperarPedraNaSaida(ctx, ID_PEDREIRA);
  await capturar('produzindo');
}

module.exports = { roteiro };
