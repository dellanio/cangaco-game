'use strict';

// F-TR por partes — parte do cenario real da F-T3: rua, pedreira, trabalhador,
// ida ao lajedo, coleta e volta. Depois deixa a mesma pedreira consumir ate UM
// tile sair de `state.recursos`. O aceite nao afirma pixel nem quantidade fixa:
// afirma a transicao de comportamento — o tile some e cada vizinho cardinal
// ainda presente perde exatamente o bit que apontava para ele.
const { roteiro: roteiroDaPedreira } = require('./F-T3');
const { quadrosDoTerreno } = require('./_terreno-tr');

const PASSO = 25;
const TETO = 6_000;
const VIZINHOS = [
  { dx: 0, dy: -1, bitParaRemover: 4 },
  { dx: 1, dy: 0, bitParaRemover: 8 },
  { dx: 0, dy: 1, bitParaRemover: 1 },
  { dx: -1, dy: 0, bitParaRemover: 2 },
];

function tileDaChave(chave) {
  const [gx, gy] = chave.split(',').map(Number);
  return { gx, gy };
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  await roteiroDaPedreira(ctx);

  let s = await estado();
  const antes = { ...s.mascarasDoLajedo };
  const chavesAntes = Object.keys(antes);
  afirmar(chavesAntes.length > 0, 'o cenario da pedreira deveria comecar com lajedo mascarado');
  await capturar('lajedo-antes-de-esgotar');

  let removida = null;
  let gastos = 0;
  while (removida === null && gastos < TETO) {
    await page.evaluate((passos) => window.__cangaco.avancar(passos), PASSO);
    gastos += PASSO;
    await page.waitForTimeout(100);
    s = await estado();
    removida = chavesAntes.find((chave) => s.mascarasDoLajedo[chave] === undefined) ?? null;
  }
  afirmar(removida !== null, `a pedreira deveria esgotar um tile de rock em ${TETO} ticks`);

  const depois = s.mascarasDoLajedo;
  afirmar(
    Object.keys(depois).length === chavesAntes.length - 1,
    'o marco deve observar exatamente um tile sair, sem pular dois esgotamentos',
  );
  const { gx, gy } = tileDaChave(removida);
  let vizinhosConferidos = 0;
  for (const { dx, dy, bitParaRemover } of VIZINHOS) {
    const chaveDoVizinho = `${gx + dx},${gy + dy}`;
    if (antes[chaveDoVizinho] === undefined || depois[chaveDoVizinho] === undefined) continue;
    vizinhosConferidos += 1;
    afirmar(
      depois[chaveDoVizinho] === (antes[chaveDoVizinho] & ~bitParaRemover),
      `o vizinho ${chaveDoVizinho} deveria perder somente o bit ${bitParaRemover}: `
        + `${antes[chaveDoVizinho]} -> ${depois[chaveDoVizinho]}`,
    );
  }
  afirmar(vizinhosConferidos > 0, `o tile esgotado ${removida} deveria tocar outro rock`);
  await capturar('lajedo-recosturado-apos-esgotar');

  // F-TR-a: textura por tipo e transicao nos dois quadros do mapa real
  await quadrosDoTerreno(ctx);
}

module.exports = { roteiro };
