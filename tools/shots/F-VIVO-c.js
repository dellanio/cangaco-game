'use strict';
// Roteiro da F-VIVO-c — OS ANIMAIS DO CURRAL.
//
// Afirma o que a cena publicou (`window.__cangaco.animaisDoCurral`), nunca pixel
// (§8). Qual idade sai de qual progresso e `render/animais.ts`, testado em Node
// (tests/F-VIVO-c-animais.test.ts); aqui se prova que a cena desenha o curral de
// um Curral OCUPADO E ALIMENTADO, com o relogio correndo:
//  1. no tick 0 da abertura nao ha curral nenhum;
//  2. o jogador carrega a partida (botao "carregar" da ajuda, F23b) e o Curral
//     `sf1` aparece com cinco animais, placeholder (o manifesto nao tem `animal`);
//  3. despausado, o laco anda; e com o tempo a idade de alguma posicao muda.
//
// A partida carregada e `test-output/F-VIVO-c.save.txt`, que o teste grava: a
// cadeia da carne da F19b andada ate o Curral ter milho. A tela NAO constroi a
// cadeia pela abertura (serraria -> fazenda -> milho, o mesmo limite da F18);
// o gesto do jogador aqui e carregar, e e ele que o roteiro exerce.
//
// A ajuda nao e painel da lista do §8 (#painel-predio, #menu-build, #alertas,
// #hud); a janela despausada do passo 3 cumpre a regra do relogio correndo.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const TILE_PX = require('../../data/terrain.json').tile_px;
const { predios } = require('../../data/buildings.json');

const ARQUIVO_DO_SAVE = 'test-output/F-VIVO-c.save.txt';
const CHAVE_DO_SAVE = 'cangaco:partida'; // src/arquivo-da-partida.ts
const ID_DA_MALHADA = 'sf1'; // tests/helpers/producao-cenario.ts, cadeia da carne
const JANELA_MS = 2000;
const AMOSTRA_MS = 250;
const TETO_ATE_MUDAR = 2000;
const PASSO = 10;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const canvas = await retanguloDoCanvas(page);

  async function centrarNoEixo(alvoEmTiles, eixo) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const vao = eixo === 'x' ? canvas.width : canvas.height;
      const alvo = Math.max(0, alvoEmTiles * TILE_PX - vao / 2);
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), [eixo, alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = Math.max(0, alvoEmTiles * TILE_PX - vao / 2);
    const [maisTecla, menosTecla] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      const tecla = delta > 0 ? maisTecla : menosTecla;
      await page.keyboard.down(tecla);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 120);
      await page.keyboard.up(tecla);
      await esperarFrame();
    }
  }

  // ---- 1. a abertura nao tem curral -------------------------------------------
  const inicio = await estado();
  afirmar(
    inicio.animaisDoCurral !== undefined && Object.keys(inicio.animaisDoCurral).length === 0,
    `no tick 0 nao ha criacao: nenhum curral, veio ${JSON.stringify(inicio.animaisDoCurral)}`,
  );

  // ---- 2. carregar a partida da cadeia da carne ---------------------------------
  afirmar(existsSync(ARQUIVO_DO_SAVE), `${ARQUIVO_DO_SAVE} nao existe: rode \`npm run test\` antes`);
  const texto = readFileSync(ARQUIVO_DO_SAVE, 'utf8');
  await page.evaluate(([chave, valor]) => window.localStorage.setItem(chave, valor), [CHAVE_DO_SAVE, texto]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const carregado = await estado();
  const malhada = carregado.prediosDoEstado[ID_DA_MALHADA];
  afirmar(malhada !== undefined && malhada.tipo === 'swine_farm',
    `a partida carregada deveria ter o Curral '${ID_DA_MALHADA}', veio ${JSON.stringify(malhada)}`);
  afirmar(malhada.ocupante != null, 'o Curral carregado deveria estar ocupado');
  const curral = carregado.animaisDoCurral[ID_DA_MALHADA];
  afirmar(Array.isArray(curral) && curral.length === 5,
    `o Curral ocupado e alimentada deveria ter 5 animais, veio ${JSON.stringify(curral)}`);
  afirmar(curral.every((a) => a.sprite === false),
    'sem PNG de animal no manifesto: todo animal deveria ser placeholder');
  afirmar(curral.every((a) => a.animal === 'pigs' && a.idade >= 1 && a.idade <= 3),
    `animal e idade fora do dominio: ${JSON.stringify(curral)}`);

  const [larg, alt] = predios.find((p) => p.id === 'swine_farm').tamanho;
  await centrarNoEixo(malhada.gx + larg / 2, 'x');
  await centrarNoEixo(malhada.gy + alt / 2, 'y');
  await esperarFrame();
  await capturar('1-curral');

  // ---- 3. despausado o laco anda; com o tempo a idade muda -----------------------
  // O criador passa a maior parte do tempo esperando milho (a cadeia da F19b e fina):
  // a espera e por CONDICAO — o laco saiu do quadro 1 —, nunca por numero chutado.
  const animando = (x) => (x.animaisDoCurral[ID_DA_MALHADA] ?? []).some((a) => a.quadro > 1);
  let comLaco = await estado();
  let esperados = 0;
  while (!animando(comLaco) && esperados < TETO_ATE_MUDAR) {
    await avancar(1);
    esperados += 1;
    await page.waitForTimeout(30);
    comLaco = await estado();
  }
  afirmar(animando(comLaco), `o criador deveria trabalhar e o laco andar em ${TETO_ATE_MUDAR} ticks`);
  const amostras = [];
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'a janela precisa do relogio correndo');
  for (let t = 0; t < JANELA_MS; t += AMOSTRA_MS) {
    await page.waitForTimeout(AMOSTRA_MS);
    const s = await estado();
    const c = s.animaisDoCurral[ID_DA_MALHADA];
    amostras.push({ tick: s.tick, quadros: c?.map((a) => a.quadro) ?? null, idades: c?.map((a) => a.idade) ?? null });
  }
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
  afirmar(amostras.every((a) => a.idades !== null && a.idades.length === 5),
    `o curral nao deveria esvaziar na janela, veio ${JSON.stringify(amostras)}`);
  const quadros = new Set(amostras.map((a) => a.quadros[0]));
  afirmar(quadros.size >= 2, `o laco deveria andar na janela despausada, veio ${JSON.stringify(amostras)}`);

  const idadesAntes = (await estado()).animaisDoCurral[ID_DA_MALHADA].map((a) => a.idade).join('');
  let s = await estado();
  let gastos = 0;
  const idadesDe = (x) => (x.animaisDoCurral[ID_DA_MALHADA] ?? []).map((a) => a.idade).join('');
  while (idadesDe(s) === idadesAntes && gastos < TETO_ATE_MUDAR) {
    await avancar(PASSO);
    gastos += PASSO;
    await esperarFrame();
    s = await estado();
  }
  afirmar(idadesDe(s) !== idadesAntes && idadesDe(s).length === 5,
    `a idade deveria mudar com o ciclo: antes ${idadesAntes}, depois ${idadesDe(s)} em ${gastos} ticks`);
  await capturar('2-outra-idade');

  const resumo = { amostras, quadrosDistintos: [...quadros], idadesAntes, idadesDepois: idadesDe(s), ticksAteMudar: gastos, ticksAteOLaco: esperados };
  console.log(`F-VIVO-c: ${JSON.stringify(resumo)}`);
}

module.exports = { roteiro };
