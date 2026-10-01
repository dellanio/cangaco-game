'use strict';
// Roteiro da D-TELA-03a (a carga sobre o serf com icone) e da D-TELA-03b (a pilha da casa com
// icone), Leva 1 da animacao direcional.
//
// Carrega a partida que `tests/D-TELA-03-logistica.test.ts` grava: a oficina de armas com 3
// machados na saida e nada na entrada, o quartel ligado a ela por rua, e nenhum machado no
// armazem. O pedido do operador: um serf levando arma da oficina ao quartel, e a pilha da oficina
// diminuindo quando ele retira.
//   1. um passo com o jogo ANDANDO (§8), e depois o relogio pela ponte (`avancar`);
//   2. o serf com tabua: a carga e o ICONE (`marcaDaCarga` 'icone'), captura;
//   3. o serf com o machado: a carga e TEXTO (o machado nao tem icone; o quadrado no lugar e a
//      pergunta 2 do §12 do plano), com o nome do tema; a pilha de machado da oficina caiu de 3
//      para 2 e e quadrado (sem PNG nem icone), captura;
//   4. a tabua entregue na entrada da oficina e pilha com ICONE, captura.
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const tema = require('../../data/theme-sertao.json');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const CHAVE_DO_SAVE = 'cangaco:partida';
const OFICINA = 'oficina';
const QUARTEL = 'quartel';
const ARMA = 'hand_axe';
/** Teto de seguranca do laco, em chamadas de `avancar`: nao e afirmacao de tempo. */
const TETO = 900;
const PASSO = 2;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const fixar = (scroll) => page.evaluate((s) => window.__cangaco.fixarCamera(s), scroll);
  const centrarEm = async (gx, gy) => {
    await fixar({ scrollX: Math.round(gx * TILE_PX - canvas.width / 2), scrollY: Math.round(gy * TILE_PX - canvas.height / 2) });
    await esperarFrame();
  };

  const arquivo = 'test-output/D-TELA-03.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  let s = await estado();
  const oficina = s.prediosDoEstado[OFICINA];
  afirmar(oficina !== undefined && oficina.tipo === 'weapons_workshop', 'a partida deveria ter a oficina de armas');
  afirmar(s.prediosDoEstado[QUARTEL]?.tipo === 'barracks', 'a partida deveria ter o quartel');
  const pilhaDeArma = (st) => (st.pilhasDesenhadas[OFICINA] ?? []).find((p) => p.gaveta === 'saida' && p.mercadoria === ARMA);
  const antes = pilhaDeArma(s);
  afirmar(antes !== undefined && antes.n === 3, `a oficina deveria abrir com 3 machados na pilha: ${JSON.stringify(s.pilhasDesenhadas[OFICINA])}`);
  afirmar(antes.fonte === 'quadrado' && antes.sprite === false, `o machado nao tem PNG nem icone: deveria ser quadrado, veio ${JSON.stringify(antes)}`);

  // 1. um passo com o jogo andando (§8): a marca sobrevive ao redesenho do laco
  await page.keyboard.press('p');
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  await esperarFrame();

  let tabua = null;
  let machado = null;
  let entrada = null;
  for (let i = 0; i < TETO && (tabua === null || machado === null || entrada === null); i += 1) {
    await page.evaluate((n) => window.__cangaco.avancar(n), PASSO);
    await page.waitForTimeout(60);
    s = await estado();
    if (tabua === null) {
      const u = s.unidadesRenderizadas.find((x) => x.carga === 'timber' && x.visivel);
      if (u !== undefined) {
        // 2. a tabua vai com o icone
        afirmar(u.marcaDaCarga === 'icone', `a tabua deveria ir com o icone: ${JSON.stringify(u)}`);
        tabua = { id: u.id, tick: s.tick };
        await centrarEm(u.gx, u.gy);
        await capturar('serf-com-tabua-icone');
      }
    }
    if (machado === null) {
      const u = s.unidadesRenderizadas.find((x) => x.carga === ARMA);
      if (u !== undefined) {
        // 3. o machado vai em texto, e a pilha da oficina desceu
        afirmar(u.marcaDaCarga === 'texto' && u.rotuloDaCarga === tema.mercadorias[ARMA],
          `o machado deveria ir como texto "${tema.mercadorias[ARMA]}": ${JSON.stringify(u)}`);
        const agora = pilhaDeArma(s);
        afirmar(agora !== undefined && agora.n === antes.n - 1 && agora.fonte === 'quadrado',
          `a pilha de machado deveria cair de ${antes.n} para ${antes.n - 1} quando o serf retira: ${JSON.stringify(agora)}`);
        machado = { id: u.id, tick: s.tick, pilha: agora.n };
        await centrarEm(oficina.gx + 2, oficina.gy + 1);
        await capturar('serf-com-machado-pilha-desceu');
      }
    }
    if (entrada === null) {
      const p = (s.pilhasDesenhadas[OFICINA] ?? []).find((x) => x.gaveta === 'entrada' && x.mercadoria === 'timber');
      if (p !== undefined) {
        // 4. a tabua entregue e pilha com icone
        afirmar(p.fonte === 'icone' && p.sprite === false, `a tabua na entrada deveria ser icone: ${JSON.stringify(p)}`);
        entrada = { tick: s.tick, n: p.n };
        await centrarEm(oficina.gx + 2, oficina.gy + 1);
        await capturar('pilha-de-tabua-icone');
      }
    }
  }
  afirmar(tabua !== null, `nenhum serf levou tabua em ${TETO * PASSO} ticks`);
  afirmar(machado !== null, `nenhum serf retirou machado da oficina em ${TETO * PASSO} ticks`);
  afirmar(entrada !== null, `a tabua nao chegou a entrada da oficina em ${TETO * PASSO} ticks`);
  console.log(`D-TELA-03: tabua ${JSON.stringify(tabua)}, machado ${JSON.stringify(machado)}, entrada ${JSON.stringify(entrada)}`);
}

module.exports = { roteiro };
