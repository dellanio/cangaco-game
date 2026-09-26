'use strict';

// Roteiro da F23b — GUARDAR E RETOMAR A PARTIDA PELA TELA.
//
// O headless (`tests/F23b-arquivo-da-partida.test.ts`) prova o arquivo com uma
// gaveta de mentira. Aqui o que se prova e o gesto de verdade: os botoes na secao
// "Partida" da tela de ajuda (H),
// o `localStorage` do navegador e a pagina RECARREGADA, que volta ao tick 0 e so
// reencontra a aldeia porque o jogador pediu.
//
// A prova de "a mesma aldeia" nao e olho na foto: depois de retomar, guardar de
// novo tem de dar o MESMO texto, byte a byte, que o save de antes do reload. Se o
// estado retomado diferisse em qualquer campo, o texto diferiria.
//
// Um passo e DESPAUSADO, com mouse.down / 150 ms / mouse.up (CLAUDE.md §8): o
// retomar com o relogio correndo e o caso em que o laco redesenha entre o aperto e
// a soltura.

const tema = require('../../data/theme-sertao.json');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');
const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const { caixaLivre } = require('./_recursos');

const TILE_PX = 64;
/** A obra que o roteiro planta antes de guardar: e o que a pagina recarregada NAO
 *  tem, e o que faz a foto da aldeia retomada provar alguma coisa. */
const OBRA = 'woodcutters';

/** A chave de `src/arquivo-da-partida.ts`. O passo 3 afirma que e a unica que o
 *  guardar ACRESCENTOU (a ajuda e a prancha ja tem as suas): se ela mudar la, este
 *  roteiro acusa em vez de ler vazio. */
const CHAVE = 'cangaco:partida';
const TICKS_ANTES_DE_GUARDAR = 300;
const PASSO_DE_AVANCO = 50; // um `avancar` seco e grande estoura o frame (F16b)
/** Teto do passo despausado: ~0,5 s a 10 Hz, com folga. E seguranca contra o
 *  relogio disparar, nao medida de desempenho. */
const TETO_DE_TICKS_DESPAUSADO = 60;

const ROTULOS = tema.hud.arquivo;
const BOTAO = (acao) => `#ajuda .arquivo button[data-acao="${acao}"]`;
const RECADO = '#ajuda .arquivo [data-campo="arquivo"]';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = async (n) => {
    for (let feitos = 0; feitos < n; feitos += PASSO_DE_AVANCO) {
      await page.evaluate((k) => window.__cangaco.avancar(k), Math.min(PASSO_DE_AVANCO, n - feitos));
      await esperarFrame();
    }
  };
  const recado = async () => ((await page.isVisible(RECADO)) ? page.textContent(RECADO) : null);
  const gaveta = () => page.evaluate(() => Object.fromEntries(Object.entries(window.localStorage)));
  const hud = () => page.$$eval('#hud .valor[data-campo]', (ns) => ns.map((n) => `${n.dataset.campo}=${n.textContent}`).join(' '));
  const aldeia = async () => {
    const e = await estado();
    return { tick: e.tick, predios: JSON.stringify(e.prediosDoEstado), hud: await hud() };
  };
  const clicar = async (acao) => {
    await page.click(BOTAO(acao));
    await esperarFrame();
  };

  const caixa = (sel) => page.$eval(sel, (n) => {
    const r = n.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width };
  });
  /** Abre a ajuda (H) e mede, a cada vez: os botoes dentro da caixa dela e ACIMA
   *  do primeiro grupo de atalhos — a ajuda rola, e botao que so aparece rolando
   *  e botao que o jogador nao acha. */
  async function abrirAjuda() {
    if (await page.isHidden('#ajuda')) await page.keyboard.press('h');
    await esperarFrame();
    afirmar(await page.isVisible('#ajuda'), 'a tecla H deveria abrir a ajuda');
    const ajuda = await caixa('#ajuda');
    const secao = await caixa('#ajuda .arquivo');
    const grupo = await caixa('#ajuda .grupo');
    afirmar(secao.w > 0, 'a secao Partida deveria estar visivel na ajuda');
    afirmar(
      secao.left >= ajuda.left && secao.right <= ajuda.right && secao.top >= ajuda.top && secao.bottom <= ajuda.bottom,
      `a secao Partida deveria caber na caixa da ajuda sem rolar: ${JSON.stringify({ secao, ajuda })}`,
    );
    afirmar(secao.bottom <= grupo.top, `a secao Partida deveria vir antes dos atalhos: ${JSON.stringify({ secao, grupo })}`);
  }

  // ---- 0. os botoes estao na ajuda, com o rotulo do tema ------------------------
  await abrirAjuda();
  afirmar(await page.textContent(BOTAO('salvar')) === ROTULOS.salvar, 'o botao de guardar deveria usar o rotulo do tema');
  afirmar(await page.textContent(BOTAO('carregar')) === ROTULOS.carregar, 'o botao de retomar deveria usar o rotulo do tema');
  afirmar((await recado()) === null, 'o recado deveria nascer escondido');
  const chavesDeAntes = Object.keys(await gaveta()).filter((k) => k !== CHAVE).sort();

  // ---- 1. o jogador planta uma obra e a aldeia anda -------------------------------
  // A obra fica logo abaixo da Casa do Coronel, no primeiro lugar livre: sem ela,
  // a aldeia do tick 300 e a do tick 0 sao a mesma foto (os serfs estao parados).
  await page.keyboard.press('h');
  await esperarFrame();
  const coronel = economia.estadoInicial.predios.find((p) => p.id === 'schoolhouse');
  const [largC, altC] = predios.find((p) => p.id === coronel.id).tamanho;
  const [largO, altO] = predios.find((p) => p.id === OBRA).tamanho;
  let lugar = null;
  for (let dy = 1; dy < 8 && lugar === null; dy += 1) {
    for (let dx = 0; dx < largC + 4 && lugar === null; dx += 1) {
      if (caixaLivre(coronel.gx + dx, coronel.gy + altC + dy, largO, altO)) lugar = { gx: coronel.gx + dx, gy: coronel.gy + altC + dy };
    }
  }
  afirmar(lugar !== null, `nao achei lugar livre para a obra abaixo de '${coronel.id}'`);
  const prediosNoInicio = Object.keys((await estado()).prediosDoEstado).length;
  await page.click(`[data-predio="${OBRA}"]`);
  await esperarFrame();
  const canvas = await retanguloDoCanvas(page);
  const ponto = pontoDoTileNaTela(canvas, lugar, (await estado()).camera, TILE_PX);
  await page.mouse.click(ponto.x, ponto.y);
  await avancar(1);
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar(
    Object.keys((await estado()).prediosDoEstado).length === prediosNoInicio + 1,
    `a obra deveria ter nascido em (${lugar.gx},${lugar.gy})`,
  );
  await avancar(TICKS_ANTES_DE_GUARDAR - 1);
  await abrirAjuda();
  const antes = await aldeia();
  afirmar(antes.tick === TICKS_ANTES_DE_GUARDAR, `a aldeia deveria estar no tick ${TICKS_ANTES_DE_GUARDAR}, esta no ${antes.tick}`);

  // ---- 2. retomar sem nada guardado: recado, e a partida fica ------------------
  await clicar('carregar');
  afirmar((await recado()) === ROTULOS.semSave, `sem save, o recado deveria ser '${ROTULOS.semSave}', veio '${await recado()}'`);
  afirmar(JSON.stringify(await aldeia()) === JSON.stringify(antes), 'retomar sem save nao pode mexer na partida');

  // ---- 3. guardar -----------------------------------------------------------------
  await clicar('salvar');
  afirmar((await recado()) === ROTULOS.salvou, `o recado deveria ser '${ROTULOS.salvou}', veio '${await recado()}'`);
  const guardado = await gaveta();
  afirmar(
    JSON.stringify(Object.keys(guardado).sort()) === JSON.stringify([...chavesDeAntes, CHAVE].sort()),
    `guardar deveria acrescentar so a chave '${CHAVE}' a ${JSON.stringify(chavesDeAntes)}, a gaveta tem ${JSON.stringify(Object.keys(guardado))}`,
  );
  const texto = guardado[CHAVE];
  afirmar(JSON.parse(texto).estado.tick === TICKS_ANTES_DE_GUARDAR, 'o save deveria ser do tick em que o jogador guardou');
  // a aldeia, sem a ajuda por cima: e esta foto que a `retomada` tem de repetir
  await page.keyboard.press('h');
  await esperarFrame();
  await capturar('guardada');

  // ---- 4. recarregar a pagina: partida nova, tick 0 -------------------------------
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto));
  await esperarFrame();
  afirmar((await estado()).tick === 0, 'a pagina recarregada deveria abrir uma partida nova, no tick 0');
  afirmar(
    Object.keys((await estado()).prediosDoEstado).length === prediosNoInicio,
    'a pagina recarregada nao deveria ter a obra: ela so volta se o jogador retomar',
  );
  afirmar((await recado()) === null, 'o recado nao sobrevive ao reload');
  afirmar((await gaveta())[CHAVE] === texto, 'o save deveria sobreviver ao reload');
  await abrirAjuda();

  // ---- 5. retomar DESPAUSADO, segurando o botao (§8) -------------------------------
  const b = await caixa(BOTAO('carregar'));
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'o passo 5 precisa do relogio correndo');
  await page.mouse.move((b.left + b.right) / 2, (b.top + b.bottom) / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  const despausado = await estado();
  afirmar(despausado.pausado, 'o roteiro deveria ter pausado de volta');
  afirmar((await recado()) === ROTULOS.carregou, `o recado deveria ser '${ROTULOS.carregou}', veio '${await recado()}'`);
  afirmar(
    despausado.tick >= TICKS_ANTES_DE_GUARDAR && despausado.tick <= TICKS_ANTES_DE_GUARDAR + TETO_DE_TICKS_DESPAUSADO,
    `retomada com o relogio correndo, a partida deveria seguir do tick ${TICKS_ANTES_DE_GUARDAR}, esta no ${despausado.tick}`,
  );
  afirmar(
    JSON.stringify(Object.keys(despausado.prediosDoEstado).sort()) === JSON.stringify(Object.keys(JSON.parse(antes.predios)).sort()),
    'retomada, a partida deveria ter os mesmos predios da guardada',
  );

  // ---- 6. retomar pausado: a MESMA aldeia, e o save de novo sai identico -----------
  await clicar('carregar');
  const depois = await aldeia();
  afirmar(depois.tick === antes.tick, `retomada pausada, o tick deveria ser ${antes.tick}, e ${depois.tick}`);
  afirmar(depois.predios === antes.predios, 'os predios retomados deveriam ser os guardados, campo a campo');
  afirmar(depois.hud === antes.hud, `a barra deveria mostrar o mesmo: antes '${antes.hud}', depois '${depois.hud}'`);
  await clicar('salvar');
  afirmar((await gaveta())[CHAVE] === texto, 'guardar a partida retomada deveria dar o mesmo texto, byte a byte');
  await clicar('carregar');
  await capturar('recado-retomada');
  await page.keyboard.press('h');
  await esperarFrame();
  await capturar('retomada');
  await abrirAjuda();

  // ---- 7. save estragado: recado com o motivo, e a partida fica --------------------
  await page.evaluate((k) => window.localStorage.setItem(k, '{'), CHAVE);
  await clicar('carregar');
  const recusa = ROTULOS.recusado.replace('{detalhe}', 'o save nao e JSON valido');
  afirmar((await recado()) === recusa, `o recado deveria ser '${recusa}', veio '${await recado()}'`);
  afirmar(JSON.stringify(await aldeia()) === JSON.stringify(depois), 'um save estragado nao pode mexer na partida');
}

module.exports = { roteiro };
