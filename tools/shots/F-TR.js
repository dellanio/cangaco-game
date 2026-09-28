'use strict';

// F-TR por partes — parte do cenario real da F-T3: rua, pedreira, trabalhador,
// ida ao lajedo, coleta e volta. Depois deixa a mesma pedreira consumir ate UM
// tile sair de `state.recursos`. O aceite nao afirma pixel nem quantidade fixa:
// afirma a transicao de comportamento — o tile some e cada vizinho cardinal
// ainda presente perde exatamente o bit que apontava para ele.
//
// F-TR-b — o lajedo ENCOLHENDO: a mesma pedreira segue comendo ate ESGOTAMENTOS
// tiles terem saido, um de cada vez. Depois de cada um, o roteiro tira a mascara
// N/L/S/O de cada rocha do CONJUNTO de rochas (conta propria, nao a funcao da cena)
// e confere contra a textura que o sprite daquele tile DESENHA (`lajedoDesenhado`,
// lido de volta da imagem). Borda que nao se refez reprova aqui.
const { roteiro: roteiroDaPedreira } = require('./F-T3');
const { quadrosDoTerreno } = require('./_terreno-tr');

const PASSO = 25;
const TETO = 6_000;
/** Quantos tiles o lajedo perde no F-TR-b: o primeiro (F-TR-a) e mais dois. */
const ESGOTAMENTOS = 3;
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

  // F-TR-b: o lajedo encolhendo, com as bordas conferidas pelo que foi desenhado
  const conferirBordas = (estadoAgora, rotulo) => {
    const rochas = estadoAgora.mascarasDoLajedo; // o conjunto vem do estado
    let conferidas = 0;
    for (const chave of Object.keys(rochas)) {
      const { gx, gy } = tileDaChave(chave);
      const mascara = VIZINHOS.reduce((m, { dx, dy, bitParaRemover }) => (
        // o bit que o VIZINHO perde e o bit que ESTE tile tem na direcao oposta
        rochas[`${gx - dx},${gy - dy}`] !== undefined ? m | bitParaRemover : m
      ), 0);
      const desenhado = estadoAgora.lajedoDesenhado[chave];
      afirmar(desenhado === `m${mascara}`, `${rotulo}: a rocha ${chave} deveria desenhar m${mascara}, desenha ${desenhado}`);
      conferidas += 1;
    }
    afirmar(conferidas > 0, `${rotulo}: deveria haver rocha para conferir`);
    for (const chave of Object.keys(estadoAgora.lajedoDesenhado)) {
      afirmar(rochas[chave] !== undefined, `${rotulo}: ${chave} saiu do estado e ainda tem sprite de rocha`);
    }
    return conferidas;
  };
  const tamanhos = [chavesAntes.length, Object.keys(depois).length];
  conferirBordas(s, 'esgotamento 1');
  for (let n = 2; n <= ESGOTAMENTOS; n += 1) {
    const anteriores = Object.keys(s.mascarasDoLajedo);
    let saiu = null;
    gastos = 0;
    while (saiu === null && gastos < TETO) {
      await page.evaluate((passos) => window.__cangaco.avancar(passos), PASSO);
      gastos += PASSO;
      await page.waitForTimeout(100);
      s = await estado();
      saiu = anteriores.find((chave) => s.mascarasDoLajedo[chave] === undefined) ?? null;
    }
    afirmar(saiu !== null, `esgotamento ${n}: a pedreira deveria esgotar mais um tile em ${TETO} ticks`);
    const agora = Object.keys(s.mascarasDoLajedo).length;
    afirmar(agora === anteriores.length - 1, `esgotamento ${n}: o lajedo deveria perder exatamente um tile (${anteriores.length} -> ${agora})`);
    tamanhos.push(agora);
    const conferidas = conferirBordas(s, `esgotamento ${n}`);
    console.log(`F-TR-b: esgotamento ${n} em ${saiu}, ${agora} rochas, ${conferidas} bordas conferidas`);
  }
  afirmar(tamanhos.every((t, i) => i === 0 || t === tamanhos[i - 1] - 1), `o lajedo deveria encolher de um em um: ${tamanhos}`);
  await capturar(`lajedo-encolhido-${ESGOTAMENTOS}-tiles`);

  // F-TR-a: textura por tipo e transicao nos dois quadros do mapa real
  await quadrosDoTerreno(ctx);
}

module.exports = { roteiro };
