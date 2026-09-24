#!/usr/bin/env node
'use strict';

// Gerador do mapa base (F-T1). EMITE o arquivo `data/maps/<id>.json`; o JOGO
// NUNCA roda este script. O que entra no git e o que o jogo carrega e o JSON
// emitido — este arquivo e ferramenta de autoria, e a semente fica gravada no
// cabeçalho do mapa para que a proxima geracao seja reproduzivel.
//
//   node tools/gerar-mapa.js                 # regrava data/maps/sertao-128.json
//   node tools/gerar-mapa.js --conferir      # sai 1 se o arquivo no disco diferir
//
// Respeita o Anexo B do GDD ("mapas feitos a mao", sem geracao procedural no
// MVP): gerar e autoria, nao runtime. Se o mapa emitido nao servir, edita-se o
// JSON a mao e a semente vira registro historico.
//
// DUAS REGIOES NASCEM EM GRAMA DE PROPOSITO, e nao por gosto de paisagem:
//
//   1. O quadrante noroeste ate o tile 71. A vila inicial de `economy.json`
//      (storehouse em 29,30) e todo cenario de teste com coordenada LITERAL
//      vivem la — o maior par literal que a suite usa e (64,63).
//   2. Uma moldura de 8 tiles em volta do mapa inteiro. Esta so apareceu quando
//      a suite rodou: ha teste que nao escreve a coordenada, CALCULA a partir de
//      `terrain.mapaPadrao` (`largura - 1`, `altura - 1`) para provar que nada
//      presume 128 — F06 encosta uma pedreira na borda direita, F18b pede
//      caminho entre os dois ultimos tiles da linha de baixo. A serra do sudeste
//      cobria os dois pontos. A moldura tambem e a leitura honesta do mapa: a
//      borda e o limite do mundo, e por o intransponivel encostado nela so
//      inventa um caso em que "fora do mapa" e "montanha" se confundem.
//
// Terreno variado em qualquer das duas mudaria fixture de feature fechada, que e
// exatamente o que a perna 4 do aceite da F-T1 proibe.

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const terreno = require(path.join(RAIZ, 'data', 'terrain.json'));

const SEMENTE = 20260924;
const ID = 'sertao-128';
const SAIDA = path.join(RAIZ, 'data', 'maps', `${ID}.json`);
/** Primeiro tile que PODE deixar de ser grama no eixo do quadrante. Ver o cabecalho. */
const LIVRE_A_PARTIR_DE = 72;
/** Largura da moldura de grama em volta do mapa. Ver o cabecalho. */
const MARGEM_DE_BORDA = 8;

const LEGENDA = {
  g: 'grama',
  c: 'campoArado',
  a: 'areia',
  w: 'agua',
  r: 'rocha',
  m: 'montanha',
};
const CHAR = Object.fromEntries(Object.entries(LEGENDA).map(([ch, tipo]) => [tipo, ch]));

/** mulberry32 — o mesmo algoritmo do `sim/rng.ts`, reescrito aqui porque
 *  ferramenta em CommonJS nao importa TypeScript. Determinismo do JOGO nao
 *  depende disto: o que o jogo le e o JSON emitido. */
function mulberry32(semente) {
  let a = semente >>> 0;
  return function proximo() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Elipse com a borda sacudida pela semente: contorno de mapa desenhado a mao
 *  nao tem raio constante. `folga` afasta a borda (praia em volta do lago). */
function dentroDaElipse(gx, gy, centro, rx, ry, ruido, folga = 0) {
  const dx = (gx - centro.gx) / (rx + folga);
  const dy = (gy - centro.gy) / (ry + folga);
  const angulo = Math.atan2(dy, dx);
  const tremor = 1 + 0.14 * Math.sin(angulo * 3 + ruido) + 0.08 * Math.sin(angulo * 5 - ruido);
  return dx * dx + dy * dy <= tremor;
}

function gerar() {
  const { largura, altura } = terreno.mapaPadrao;
  const rng = mulberry32(SEMENTE);
  const ruido = [];
  for (let i = 0; i < 8; i += 1) ruido.push(rng() * Math.PI * 2);

  const grade = [];
  for (let gy = 0; gy < altura; gy += 1) grade.push(new Array(largura).fill('grama'));

  const por = (gx, gy, tipo) => {
    if (gx < 0 || gy < 0 || gx >= largura || gy >= altura) return;
    if (gx < LIVRE_A_PARTIR_DE && gy < LIVRE_A_PARTIR_DE) return; // quadrante da vila
    if (gx < MARGEM_DE_BORDA || gy < MARGEM_DE_BORDA) return; // moldura
    if (gx >= largura - MARGEM_DE_BORDA || gy >= altura - MARGEM_DE_BORDA) return;
    grade[gy][gx] = tipo;
  };

  // --- o lago, com praia em volta -------------------------------------------
  // Fica no leste, longe da vila: e ele que da agua ao Fisherman (GDD §4) e e
  // o obstaculo que o A* tem de contornar no mapa de verdade.
  const lago = { gx: 92, gy: 46 };
  for (let gy = 34; gy < 60; gy += 1) {
    for (let gx = 78; gx < 108; gx += 1) {
      if (dentroDaElipse(gx, gy, lago, 11, 7, ruido[0])) por(gx, gy, 'agua');
      else if (dentroDaElipse(gx, gy, lago, 11, 7, ruido[1], 2.2)) por(gx, gy, 'areia');
    }
  }

  // --- a serra do sudeste: montanha com rocha na saia -----------------------
  // Corpo intransponivel; e onde a F-T2 vai por o veio de pedra e de minerio.
  for (let gy = 84; gy < altura; gy += 1) {
    for (let gx = 88; gx < largura; gx += 1) {
      const eixo = Math.abs((gx - 88) - (gy - 84) * 0.8);
      const espessura = 7 + 3 * Math.sin((gx + gy) * 0.19 + ruido[2]);
      if (eixo < espessura) por(gx, gy, 'montanha');
      else if (eixo < espessura + 2.5) por(gx, gy, 'rocha');
    }
  }
  // Lajedos soltos ao pe da serra: rocha e obstaculo pontual, nao so parede.
  for (let i = 0; i < 26; i += 1) {
    const gx = 74 + Math.floor(rng() * 40);
    const gy = 74 + Math.floor(rng() * 24);
    const raio = 1 + Math.floor(rng() * 2);
    for (let dy = -raio; dy <= raio; dy += 1) {
      for (let dx = -raio; dx <= raio; dx += 1) {
        if (dx * dx + dy * dy <= raio * raio && grade[gy + dy]?.[gx + dx] === 'grama') por(gx + dx, gy + dy, 'rocha');
      }
    }
  }

  // --- a faixa de areia do sul ----------------------------------------------
  for (let gx = 0; gx < largura; gx += 1) {
    const centro = 112 + 6 * Math.sin(gx * 0.07 + ruido[3]);
    const meia = 5 + 3 * Math.sin(gx * 0.11 + ruido[4]);
    for (let gy = Math.round(centro - meia); gy <= Math.round(centro + meia); gy += 1) {
      if (grade[gy]?.[gx] === 'grama') por(gx, gy, 'areia');
    }
  }

  // --- solo arado: as duas manchas que dao INSTANCIA ao custo `campoArado` --
  // Sem nenhum tile deste tipo no mapa, `custoDeMovimento.campoArado` seguiria
  // sendo dado sem leitor de fato (nota da F-T1). O campo de milho da F18 e
  // outra coisa: la ele e RECURSO por acao, criado pelo jogador.
  for (const centro of [{ gx: 77, gy: 62 }, { gx: 112, gy: 26 }]) {
    for (let gy = centro.gy - 6; gy <= centro.gy + 6; gy += 1) {
      for (let gx = centro.gx - 6; gx <= centro.gx + 6; gx += 1) {
        if (dentroDaElipse(gx, gy, centro, 5, 4, ruido[5]) && grade[gy]?.[gx] === 'grama') por(gx, gy, 'campoArado');
      }
    }
  }

  return { largura, altura, grade };
}

function montarArquivo() {
  const { largura, altura, grade } = gerar();
  const linhas = grade.map((linha) => linha.map((tipo) => CHAR[tipo]).join(''));

  const contagem = {};
  for (const linha of grade) for (const tipo of linha) contagem[tipo] = (contagem[tipo] || 0) + 1;

  return {
    id: ID,
    _doc: 'Mapa base do sertao. EMITIDO por tools/gerar-mapa.js — nao edite a mao sem '
      + 'apagar a semente ou aceitar que ela vira registro historico. O jogo nunca roda o '
      + 'gerador: le este arquivo. `linhas` e a camada de terreno, um char por tile, na '
      + 'legenda abaixo; os recursos naturais (arvore, veio, cardume) sao lista esparsa e '
      + 'entram na F-T2. O quadrante noroeste ate o tile '
      + `${LIVRE_A_PARTIR_DE - 1} e uma moldura de ${MARGEM_DE_BORDA} tiles em volta do mapa sao `
      + 'todo grama de proposito: e onde nasce a vila de economy.json, onde vivem os cenarios '
      + 'de teste ja escritos, e a borda do mundo, que nao deve ser intransponivel.',
    gerador: 'tools/gerar-mapa.js',
    semente: SEMENTE,
    contagemPorTipo: contagem,
    largura,
    altura,
    legenda: LEGENDA,
    linhas,
  };
}

function serializar(arquivo) {
  // `linhas` uma por linha de texto (e o que faz o diff do git legivel); o resto
  // com indentacao normal.
  const { linhas, ...resto } = arquivo;
  const corpo = JSON.stringify(resto, null, 2).replace(/\n}$/, '');
  const linhasJson = linhas.map((l) => `    ${JSON.stringify(l)}`).join(',\n');
  return `${corpo},\n  "linhas": [\n${linhasJson}\n  ]\n}\n`;
}

function main() {
  const conferir = process.argv.includes('--conferir');
  const texto = serializar(montarArquivo());
  if (conferir) {
    const atual = fs.existsSync(SAIDA) ? fs.readFileSync(SAIDA, 'utf8') : '';
    if (atual.replace(/\r\n/g, '\n') !== texto) {
      console.error(`gerar-mapa: ${path.relative(RAIZ, SAIDA)} difere do que a semente ${SEMENTE} emite.`);
      process.exit(1);
    }
    console.log(`gerar-mapa: ${path.relative(RAIZ, SAIDA)} confere com a semente ${SEMENTE}.`);
    return;
  }
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  fs.writeFileSync(SAIDA, texto);
  console.log(`gerar-mapa: ${path.relative(RAIZ, SAIDA)} escrito (semente ${SEMENTE}).`);
}

if (require.main === module) main();

module.exports = { montarArquivo, serializar, LIVRE_A_PARTIR_DE, MARGEM_DE_BORDA, LEGENDA };
