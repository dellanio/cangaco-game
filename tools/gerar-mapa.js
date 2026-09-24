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
//
// F-T2a — A CAMADA DE RECURSO, que sai daqui junto com o terreno. Ela e ESPARSA
// (lista de tiles por tipo, nao uma grade), e as duas regioes protegidas acima
// valem para ela com uma diferenca escrita:
//
//   - ARVORE nao entra em nenhuma das duas. Na F-T2b ela vira OBSTACULO, e
//     arvore dentro do quadrante da vila ou encostada na borda quebraria os
//     mesmos caminhos que a moldura de grama existe para proteger. Plantar
//     agora onde a proxima feature vai bloquear e deixar a armadilha montada.
//   - PEDRA entra no quadrante da vila, de proposito e uma vez so: o LAJEDO DA
//     VILA. Sem pedra ao alcance a partida abre sem ter o que cortar — a
//     pedreira e um dos dois predios do menu inicial. Ele e um disco de 13
//     tiles em (24,31), longe do armazem (29,30) e da escola (34,30), e nao
//     toca o terreno: recurso e outra camada.


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

  return { largura, altura, grade, rng, ruido };
}

/** O disco de Chebyshev/euclidiano usado pelos aglomerados de recurso. */
function disco(gx, gy, raio) {
  const tiles = [];
  for (let dy = -raio; dy <= raio; dy += 1) {
    for (let dx = -raio; dx <= raio; dx += 1) {
      if (dx * dx + dy * dy <= raio * raio) tiles.push([gx + dx, gy + dy]);
    }
  }
  return tiles;
}

/** Centro e raio do lajedo da vila. Ver o cabecalho: e a unica pedra dentro do
 *  quadrante protegido, e existe para que a partida abra com o que cortar. */
const LAJEDO_DA_VILA = { gx: 24, gy: 31, raio: 2 };

/**
 * F-T2a — a camada esparsa de recurso, derivada do terreno ja gerado mais os
 * aglomerados proprios. Um tile tem NO MAXIMO um recurso: o `ocupado` corta a
 * sobreposicao aqui, na autoria, para o carregador nao ter que escolher um
 * vencedor em tempo de jogo.
 */
function gerarRecursos({ largura, altura, grade, rng }) {
  const recursos = { rock: [], tree: [], fish: [] };
  const ocupado = new Set();
  const por = (tipo, gx, gy) => {
    if (gx < 0 || gy < 0 || gx >= largura || gy >= altura) return;
    const chave = `${gx},${gy}`;
    if (ocupado.has(chave)) return;
    ocupado.add(chave);
    recursos[tipo].push([gx, gy]);
  };
  const ehGramaLivre = (gx, gy) => {
    if (grade[gy]?.[gx] !== 'grama') return false;
    if (gx < LIVRE_A_PARTIR_DE && gy < LIVRE_A_PARTIR_DE) return false;
    if (gx < MARGEM_DE_BORDA || gy < MARGEM_DE_BORDA) return false;
    return gx < largura - MARGEM_DE_BORDA && gy < altura - MARGEM_DE_BORDA;
  };

  // --- pedra: o lajedo da vila, primeiro, para nada mais disputar o tile -----
  for (const [gx, gy] of disco(LAJEDO_DA_VILA.gx, LAJEDO_DA_VILA.gy, LAJEDO_DA_VILA.raio)) {
    if (grade[gy]?.[gx] === 'grama') por('rock', gx, gy);
  }
  // --- pedra: a saia da serra e os lajedos soltos ----------------------------
  // So `rocha`, nunca `montanha`: o pico e cenario, a saia exposta e o que se
  // corta. E o que da papel distinto aos dois tipos de terreno da F-T1.
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      if (grade[gy][gx] === 'rocha') por('rock', gx, gy);
    }
  }

  // --- floresta: aglomerados fora das duas regioes protegidas ---------------
  for (let i = 0; i < 14; i += 1) {
    const gx = MARGEM_DE_BORDA + Math.floor(rng() * (largura - 2 * MARGEM_DE_BORDA));
    const gy = MARGEM_DE_BORDA + Math.floor(rng() * (altura - 2 * MARGEM_DE_BORDA));
    const raio = 3 + Math.floor(rng() * 3);
    for (const [tx, ty] of disco(gx, gy, raio)) {
      if (ehGramaLivre(tx, ty) && rng() < 0.82) por('tree', tx, ty);
    }
  }

  // --- cardume: o lago inteiro ----------------------------------------------
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      if (grade[gy][gx] === 'agua') por('fish', gx, gy);
    }
  }

  return recursos;
}

function montarArquivo() {
  const mundo = gerar();
  const { largura, altura, grade } = mundo;
  const linhas = grade.map((linha) => linha.map((tipo) => CHAR[tipo]).join(''));
  const recursos = gerarRecursos(mundo);

  const contagem = {};
  for (const linha of grade) for (const tipo of linha) contagem[tipo] = (contagem[tipo] || 0) + 1;
  const contagemDeRecursos = {};
  for (const [tipo, tiles] of Object.entries(recursos)) contagemDeRecursos[tipo] = tiles.length;

  return {
    id: ID,
    _doc: 'Mapa base do sertao. EMITIDO por tools/gerar-mapa.js — nao edite a mao sem '
      + 'apagar a semente ou aceitar que ela vira registro historico. O jogo nunca roda o '
      + 'gerador: le este arquivo. `linhas` e a camada de terreno, um char por tile, na '
      + 'legenda abaixo; `recursos` e a camada ESPARSA da F-T2a, uma lista de tiles [gx,gy] '
      + 'por tipo — QUANTO cada tile rende nao esta aqui, esta em data/resources.json. '
      + 'O quadrante noroeste ate o tile '
      + `${LIVRE_A_PARTIR_DE - 1} e uma moldura de ${MARGEM_DE_BORDA} tiles em volta do mapa sao `
      + 'todo grama de proposito: e onde nasce a vila de economy.json, onde vivem os cenarios '
      + 'de teste ja escritos, e a borda do mundo, que nao deve ser intransponivel.',
    gerador: 'tools/gerar-mapa.js',
    semente: SEMENTE,
    contagemPorTipo: contagem,
    contagemDeRecursos,
    largura,
    altura,
    legenda: LEGENDA,
    linhas,
    recursos,
  };
}

function serializar(arquivo) {
  // `linhas` uma por linha de texto (e o que faz o diff do git legivel) e
  // `recursos` com 8 tiles por linha (uma por tile daria 850 linhas de ruido, e
  // tudo numa so daria um diff ilegivel); o resto com indentacao normal.
  const { linhas, recursos, ...resto } = arquivo;
  const corpo = JSON.stringify(resto, null, 2).replace(/\n}$/, '');
  const linhasJson = linhas.map((l) => `    ${JSON.stringify(l)}`).join(',\n');
  const tiposJson = Object.entries(recursos).map(([tipo, tiles]) => {
    const blocos = [];
    for (let i = 0; i < tiles.length; i += 8) {
      blocos.push(`      ${tiles.slice(i, i + 8).map(([x, y]) => `[${x},${y}]`).join(', ')}`);
    }
    return `    ${JSON.stringify(tipo)}: [\n${blocos.join(',\n')}\n    ]`;
  }).join(',\n');
  return `${corpo},\n  "linhas": [\n${linhasJson}\n  ],\n  "recursos": {\n${tiposJson}\n  }\n}\n`;
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
