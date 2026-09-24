'use strict';

// A espera que toda migracao da F18d-2 precisa, num lugar so.
//
// Desde a F18d-1b o arrasto nao ergue rua: ele DESENHA o traçado (canteiro) e
// reserva a pedra. Quem poe o tile de pe — e so entao debita a pedra — e o
// laborer, e isso consome ticks. Todo roteiro que precisa da rua de pe espera
// por aqui em vez de escrever um `avancar(N)` chutado: o N depende de quantos
// laborers estao livres e de quanto eles andam, e um numero adivinhado que
// funciona hoje passa a falhar no primeiro ajuste de `data/`.
//
// A espera e por CONDICAO (o canteiro esvaziou), nunca por tempo fixo, e o teto
// existe para o caso em que ela nunca acontece: ai o roteiro falha dizendo os
// dois contadores e o tick, que e o que permite saber se foi lentidao ou
// travamento (tarefa que nao nasceu, pedra que nao ha).
//
// Nao e um roteiro (shot.js so carrega shots/<nome>.js por nome).

const BLOCO_DE_TICKS = 10;
const TETO_DE_TICKS = 600;

/**
 * Avanca o relogio ate o canteiro esvaziar e devolve quantos ticks custou.
 *
 * @param ctx o mesmo `{ page, estado, afirmar }` que o runner passa ao roteiro
 * @param opcoes.tiles quantos tiles de estrada devem estar DE PE no fim
 * @param opcoes.teto  maximo de ticks a gastar antes de reprovar
 */
async function erguerRua(ctx, { tiles, teto = TETO_DE_TICKS, bloco = BLOCO_DE_TICKS } = {}) {
  const { page, estado, afirmar } = ctx;
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const esperarFrame = () => page.waitForTimeout(200); // window.__cangaco sai no POST_RENDER

  let gastos = 0;
  let s = await estado();
  while (s.estradasPlanejadasRenderizadas > 0 && gastos < teto) {
    await avancar(bloco);
    gastos += bloco;
    await esperarFrame();
    s = await estado();
  }

  afirmar(
    s.estradasPlanejadasRenderizadas === 0,
    `o canteiro deveria ter sido assentado em ate ${teto} ticks; no tick ${s.tick} ainda ha `
    + `${s.estradasPlanejadasRenderizadas} planejados e ${s.estradasRenderizadas} de pe`,
  );
  if (tiles !== undefined) {
    afirmar(
      s.estradasRenderizadas === tiles,
      `depois de assentar deveriam existir ${tiles} tiles de pe, veio ${s.estradasRenderizadas}`,
    );
  }
  return { ticks: gastos, dePe: s.estradasRenderizadas };
}

module.exports = { erguerRua, BLOCO_DE_TICKS };
