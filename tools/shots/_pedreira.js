'use strict';

// A pedreira que PRODUZ, para todo roteiro que planta uma.
//
// A geometria e a da F-T3: a pedreira ao LADO do lajedo, a oeste do armazem, com a
// borda sul na linha de porta, e a rua ate a escola. Os roteiros F16b, F17b, F17e e
// F11c punham a pedreira a direita da escola, onde nao ha rocha ao alcance: a sonda
// da F-VIVO-a (2026-09-26) mediu a pedreira ocupada no tick 363 e `progresso` 0 ate
// o 2600. Eles ficavam verdes porque nenhum afirmava producao, e retratavam uma vila
// que nao funciona. Por isso a posicao sai daqui, com a rocha AFIRMADA, e o roteiro
// afirma a pedra na saida com `esperarPedraNaSaida`.

const { caixaLivre, ruaComDesvio } = require('./_recursos');
const producao = require('../../data/production.json');
const mapa = require('../../data/maps/sertao-128.json');

/** Sonda da F-VIVO-a: a saida da pedreira tem pilha em ~20 % dos ticks, porque o
 *  carregador leva a pedra logo. Passo curto para ve-la; teto com folga sobre o
 *  que a F-VIVO-a mediu. Falhar por teto e falhar. */
const PASSO_FINO = 5;
const TETO_ATE_SAIDA = 1500;

/**
 * A pedreira a oeste do armazem, na primeira caixa livre, e a rua da pedreira a
 * escola. Reprova se nao houver rocha ao alcance: sem ela, a saida nunca enche.
 *
 * @param armazem, escola  os predios iniciais do `economy.json` ({gx, gy})
 * @param tamanhoDe        (id) => [largura, altura] do `buildings.json`
 */
function pedreiraNoLajedo({ armazem, escola, tamanhoDe, afirmar }) {
  const [, altAr] = tamanhoDe('storehouse');
  const [largEs, altEs] = tamanhoDe('schoolhouse');
  const [largQu, altQu] = tamanhoDe('quarry');
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'a rua da pedreira assume armazem e escola na mesma linha de porta');
  let gx = armazem.gx - largQu - 1;
  while (gx > 0 && !caixaLivre(gx, yRua - altQu, largQu, altQu)) gx -= 1;
  const pedreira = { gx, gy: yRua - altQu };
  const alcance = producao.predios.quarry.colheita.alcance_tiles;
  const rochaAoAlcance = mapa.recursos.rock.filter(([rx, ry]) => (
    rx >= pedreira.gx - alcance && rx <= pedreira.gx + largQu - 1 + alcance
    && ry >= pedreira.gy - alcance && ry <= pedreira.gy + altQu - 1 + alcance
  ));
  afirmar(rochaAoAlcance.length > 0, `a pedreira de (${pedreira.gx},${pedreira.gy}) nao tem rocha ao alcance: a saida nunca encheria`);
  return { pedreira, yRua, tilesDaRua: ruaComDesvio(pedreira.gx, escola.gx + largEs - 1, yRua) };
}

/**
 * Avanca de passo fino ate a pedreira `id` ter pedra na gaveta de saida — a prova
 * de que ela PRODUZ — e devolve o estado desse instante. Reprova no teto.
 */
async function esperarPedraNaSaida(ctx, id, { teto = TETO_ATE_SAIDA } = {}) {
  const { page, estado, afirmar } = ctx;
  const temPedra = (s) => (s.pilhasDesenhadas[id] ?? []).some((p) => p.gaveta === 'saida' && p.mercadoria === 'stone');
  let s = await estado();
  let gastos = 0;
  while (!temPedra(s) && gastos < teto) {
    await page.evaluate((k) => window.__cangaco.avancar(k), PASSO_FINO);
    gastos += PASSO_FINO;
    await page.waitForTimeout(200); // __cangaco sai no POST_RENDER
    s = await estado();
  }
  afirmar(temPedra(s), `a pedreira '${id}' deveria produzir: sem pedra na saida em ${teto} ticks (tick ${s.tick}; ${JSON.stringify(s.prediosDoEstado[id])})`);
  return s;
}

module.exports = { pedreiraNoLajedo, esperarPedraNaSaida };
