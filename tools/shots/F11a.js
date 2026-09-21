'use strict';

// Roteiro da F11a — o laco de tempo fixo. Afirma ESTADO e MEDICAO (o que a cena publica em
// window.__cangaco, o texto do aviso, o HUD), nao pixel. O que prova NA TELA, com o navegador
// real e o timer real:
//  - o runner abre a pagina com `?pausado`: o laco nasce pausado, tick 0, com o aviso na barra;
//  - pausado nao anda (1 s de parede) e o clique so ENFILEIRA: a obra so nasce no proximo passo;
//  - `avancar` lanca com o timer rodando; rodando em 1x o aviso SOME;
//  - com uma unidade em movimento a posicao DESENHADA passa a diferir da do tick (interpolacao),
//    e nunca desliza: fica sempre a menos de um salto da posicao do tick;
//  - `+` e `-` mudam a velocidade (aviso 2x, 3x, some de volta em 1x); `P` pausa e despausa;
//  - aba oculta pausa e voltar NAO retoma.
// A velocidade nao muda o balanceamento: isso e do teste headless (relogio falso), nao daqui.
// Nada e injetado no estado: o cenario e montado so pela UI, como nas F07, F08 e F10.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const time = require('../../data/time.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const AVISO = '#hud [data-campo="aviso-tempo"]';
// o mesmo limiar de `render/unidades.ts` (SALTO_MAXIMO_EM_TILES): a unidade desenhada nunca
// fica mais longe que isto da posicao do tick
const SALTO_EM_TILES = 2;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);

  const esperarFrame = () => page.waitForTimeout(200); // window.__cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const retomar = () => page.evaluate(() => window.__cangaco.retomar());
  const aviso = async () => ({
    visivel: await page.isVisible(AVISO),
    texto: ((await page.textContent(AVISO)) ?? '').trim(),
  });

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

  // --- a geometria, tirada dos JSON (a mesma da F10: pedreira a leste da escola, rua em L) ---
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const escola = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
  const [, alturaDoArmazem] = defDe('storehouse').tamanho;
  const [, alturaDaPedreira] = defDe('quarry').tamanho;
  const yPortaDoArmazem = armazem.gy + alturaDoArmazem;
  const pedreira = { gx: escola.gx + 4, gy: armazem.gy };
  const yPortaDaPedreira = pedreira.gy + alturaDaPedreira;
  const inicioDaRua = { gx: armazem.gx, gy: yPortaDoArmazem };
  const cantoDaRua = { gx: pedreira.gx, gy: yPortaDoArmazem };
  const pontaDaRua = { gx: pedreira.gx, gy: yPortaDaPedreira };
  const tilesDaRua = (cantoDaRua.gx - inicioDaRua.gx + 1) + (cantoDaRua.gy - pontaDaRua.gy);

  // 0. NASCE PAUSADO (o runner abre com ?pausado): tick 0, 1x, alfa 1, aviso de pausa na barra
  const s0 = await estado();
  afirmar(s0.pausado === true, `com ?pausado o laco deveria nascer pausado, veio pausado=${s0.pausado}`);
  afirmar(s0.tick === 0, `o roteiro deveria comecar no tick 0, veio ${s0.tick} (a janela de ticks que ?pausado existe para evitar)`);
  afirmar(s0.velocidade === time.velocidadeDeJogo.padrao, `a velocidade inicial deveria ser o padrao do dado (${time.velocidadeDeJogo.padrao}), veio ${s0.velocidade}`);
  afirmar(s0.alfaDeInterpolacao === 1, `pausado o alfa deveria valer 1, veio ${s0.alfaDeInterpolacao}`);
  let av = await aviso();
  afirmar(av.visivel && av.texto === tema.hud.pausado,
    `pausado o aviso deveria mostrar '${tema.hud.pausado}' (do tema), veio ${JSON.stringify(av)}`);
  await capturar('pausado');

  // 1. PAUSADO NAO ANDA: 1 s de relogio de parede sem nenhum tick e sem mexer nas unidades
  await page.waitForTimeout(1000);
  const s1 = await estado();
  afirmar(s1.tick === 0, `pausado por 1 s o tick deveria seguir 0, veio ${s1.tick}`);
  afirmar(JSON.stringify(s1.unidadesRenderizadas) === JSON.stringify(s0.unidadesRenderizadas),
    'pausado por 1 s as unidades deveriam estar exatamente onde estavam');

  // 2. O CLIQUE SO ENFILEIRA: pausado, plantar nao faz a obra nascer. Um passo depois, nasce.
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  const pPedreira = await pontoDoTile(pedreira);
  await page.mouse.move(pPedreira.x, pPedreira.y);
  await esperarFrame();
  await page.mouse.click(pPedreira.x, pPedreira.y);
  await page.waitForTimeout(500);
  let s = await estado();
  afirmar(s.obrasRenderizadas === 0, `pausado o clique so enfileira: nao deveria haver obra, veio ${s.obrasRenderizadas}`);
  afirmar(s.tick === 0, `nenhum passo rodou, o tick deveria seguir 0, veio ${s.tick}`);
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.obrasRenderizadas === 1, `depois de avancar(1) a obra deveria existir, veio ${s.obrasRenderizadas}`);
  afirmar(s.tick === 1, `avancar(1) deveria dar tick 1, veio ${s.tick}`);
  await page.keyboard.press('Escape');

  // 3. a rua ate a obra, para as tarefas existirem e os serfs terem para onde andar
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await arrastarDentroDoCanvas(
    page, canvas, [await pontoDoTile(inicioDaRua), await pontoDoTile(cantoDaRua), await pontoDoTile(pontaDaRua)],
  );
  await avancar(1);
  await esperarFrame();
  s = await estado();
  afirmar(s.estradasRenderizadas === tilesDaRua, `deveria haver ${tilesDaRua} tiles de estrada, veio ${s.estradasRenderizadas}`);
  await page.keyboard.press('Escape');

  // 4. pausado a posicao desenhada e a do tick (alfa 1): o screenshot pausado e o da F10, sem interpolar
  afirmar(s.unidadesRenderizadas.every((u) => u.gxDesenhado === u.gx && u.gyDesenhado === u.gy),
    'pausado a posicao desenhada deveria ser igual a do tick');

  // 5. RETOMAR: avancar(n) passa a LANCAR, e em 1x o aviso SOME
  await retomar();
  let mensagem = null;
  try {
    await avancar(1);
  } catch (erro) {
    mensagem = String(erro.message);
  }
  afirmar(mensagem !== null && /rodando/.test(mensagem),
    `avancar(1) com o timer rodando deveria lancar, mensagem: ${JSON.stringify(mensagem)}`);
  s = await estado();
  afirmar(s.pausado === false && s.velocidade === 1, `deveria estar rodando a 1x, veio ${JSON.stringify({ p: s.pausado, v: s.velocidade })}`);
  await page.waitForFunction(() => window.__cangaco && window.__cangaco.tick >= 5, undefined, { timeout: 8000 });
  av = await aviso();
  afirmar(!av.visivel && av.texto === '', `em 1x despausado o aviso deveria sumir, veio ${JSON.stringify(av)}`);
  await capturar('rodando-1x-sem-aviso');

  // 6. INTERPOLACAO: com uma unidade em movimento, a posicao desenhada difere da do tick (entre
  // ticks) e nunca desliza. Amostra o navegador real ate ver isso, ou falha.
  let viuInterpolando = false;
  let maiorDistancia = 0;
  let alfaFora = null;
  for (let i = 0; i < 200 && !viuInterpolando; i++) {
    const e = await estado();
    if (!(e.alfaDeInterpolacao >= 0 && e.alfaDeInterpolacao <= 1)) alfaFora = e.alfaDeInterpolacao;
    for (const u of e.unidadesRenderizadas) {
      const d = Math.hypot(u.gxDesenhado - u.gx, u.gyDesenhado - u.gy);
      maiorDistancia = Math.max(maiorDistancia, d);
      if (d > 1e-9) viuInterpolando = true;
    }
    if (!viuInterpolando) await page.waitForTimeout(40);
  }
  afirmar(alfaFora === null, `o alfa deveria estar sempre em [0, 1], veio ${alfaFora}`);
  afirmar(viuInterpolando, 'com serfs em movimento e o timer rodando, alguma unidade deveria ser desenhada ENTRE dois ticks');
  afirmar(maiorDistancia <= SALTO_EM_TILES,
    `a unidade desenhada nunca deveria ficar a mais de ${SALTO_EM_TILES} tiles da do tick, chegou a ${maiorDistancia}`);

  // 7. VELOCIDADE: `+` sobe (2x, 3x), `-` desce, o aviso mostra a velocidade e some em 1x
  const opcoes = time.velocidadeDeJogo.opcoes;
  await page.keyboard.press('+');
  await esperarFrame();
  s = await estado();
  afirmar(s.velocidade === opcoes[1], `depois de '+' a velocidade deveria ser ${opcoes[1]}, veio ${s.velocidade}`);
  av = await aviso();
  afirmar(av.visivel && av.texto === `${opcoes[1]}x`, `a 2x o aviso deveria dizer '${opcoes[1]}x', veio ${JSON.stringify(av)}`);
  await capturar('2x-com-aviso');
  await page.keyboard.press('+');
  await page.keyboard.press('+'); // ja no teto: nao passa da ultima opcao
  await esperarFrame();
  s = await estado();
  afirmar(s.velocidade === opcoes[opcoes.length - 1], `no teto a velocidade deveria ser ${opcoes[opcoes.length - 1]}, veio ${s.velocidade}`);
  for (let i = 0; i < opcoes.length + 1; i++) await page.keyboard.press('-');
  await esperarFrame();
  s = await estado();
  afirmar(s.velocidade === opcoes[0], `no piso a velocidade deveria ser ${opcoes[0]}, veio ${s.velocidade}`);
  av = await aviso();
  afirmar(!av.visivel, `de volta a 1x o aviso deveria sumir, veio ${JSON.stringify(av)}`);

  // 8. `P` PAUSA e despausa; pausado o tick nao anda
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado === true, 'P deveria pausar');
  av = await aviso();
  afirmar(av.visivel && av.texto === tema.hud.pausado, `P: o aviso deveria mostrar a pausa, veio ${JSON.stringify(av)}`);
  const tickPausado = s.tick;
  await page.waitForTimeout(600);
  afirmar((await estado()).tick === tickPausado, 'pausado com P o tick nao deveria andar');
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'P de novo deveria retomar');
  await page.waitForFunction((t) => window.__cangaco.tick > t, tickPausado, { timeout: 8000 });

  // 9. ABA OCULTA PAUSA E VOLTAR NAO RETOMA (o evento real, com o `hidden` do documento trocado)
  // (via `window.`: e a unica global de browser que o lint conhece nos roteiros, ver eslint.config.mjs)
  const visibilidade = (oculta) => page.evaluate((h) => {
    Object.defineProperty(window.document, 'hidden', { configurable: true, get: () => h });
    window.document.dispatchEvent(new window.Event('visibilitychange'));
  }, oculta);
  await visibilidade(true);
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'aba oculta deveria pausar o jogo');
  await visibilidade(false);
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'voltar a aba NAO deveria retomar: o jogador aperta P');
  av = await aviso();
  afirmar(av.visivel && av.texto === tema.hud.pausado, `ao voltar o aviso deveria seguir mostrando a pausa, veio ${JSON.stringify(av)}`);
}

module.exports = { roteiro };
