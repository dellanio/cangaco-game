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
// F-D3: a vila inicial nao e escrita aqui, e lida de onde ela ja mora.
const economia = require(path.join(RAIZ, 'data', 'economy.json'));
const construcoes = require(path.join(RAIZ, 'data', 'buildings.json'));

const SEMENTE = 20260924;
const ID = 'sertao-128';
const SAIDA = path.join(RAIZ, 'data', 'maps', `${ID}.json`);
/** F-D3 — a reserva da vila, de `data/terrain.json`. O raio, o terreno que ela
 *  admite e os recursos que ela admite sao DADO; este arquivo so obedece. */
const RESERVA = terreno.geracao.reservaDaVila;
/** Largura da moldura de grama em volta do mapa. Ver o cabecalho. */
const MARGEM_DE_BORDA = 8;

/** Os tiles que a vila inicial OCUPA: o footprint de cada predio de
 *  `economy.estadoInicial` mais o tile de spawn. DERIVADO, nunca digitado — se a
 *  vila mudar de lugar no dado, a reserva anda junto sem ninguem se lembrar. */
function tilesDaVila() {
  const tamanhoPorId = Object.fromEntries(construcoes.predios.map((p) => [p.id, p.tamanho]));
  const tiles = [];
  for (const predio of economia.estadoInicial.predios) {
    const [larguraDoPredio, alturaDoPredio] = tamanhoPorId[predio.id];
    for (let dy = 0; dy < alturaDoPredio; dy += 1) {
      for (let dx = 0; dx < larguraDoPredio; dx += 1) tiles.push([predio.gx + dx, predio.gy + dy]);
    }
  }
  const spawn = economia.estadoInicial.spawnDeUnidades;
  if (spawn) tiles.push([spawn.gx, spawn.gy]);
  return tiles;
}

/** DOIS conjuntos, e nao um: o que a vila OCUPA e a FOLGA em volta dela.
 *  Montados uma vez — o gerador pergunta por tile, dezenas de milhares de vezes.
 *
 *  A diferenca entre os dois e o que o aceite 2 pede: sob o footprint nao pode
 *  NADA (nem terreno intransponivel nem recurso, e por isso `OCUPADOS` nao
 *  consulta `recursoPermitido`); na folga o que nao pode e o que IMPEDE a vila
 *  de funcionar — terreno que nao se pisa e recurso que vira obstaculo. Pedra
 *  ao alcance da pedreira nao e obstaculo: e materia-prima, e e justamente o
 *  que a abertura precisa ter perto. Quem decide qual recurso passa e
 *  `recursoPermitido`, no dado. */
const OCUPADOS = new Set(tilesDaVila().map(([gx, gy]) => `${gx},${gy}`));
const RESERVADOS = new Set(
  tilesDaVila().flatMap(([gx, gy]) => {
    const perto = [];
    for (let dy = -RESERVA.raio; dy <= RESERVA.raio; dy += 1) {
      for (let dx = -RESERVA.raio; dx <= RESERVA.raio; dx += 1) perto.push(`${gx + dx},${gy + dy}`);
    }
    return perto;
  }),
);

function naVila(gx, gy) {
  return OCUPADOS.has(`${gx},${gy}`);
}

function naReserva(gx, gy) {
  return RESERVADOS.has(`${gx},${gy}`);
}

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
    if (naReserva(gx, gy) && !RESERVA.terrenoPermitido.includes(tipo)) return; // F-D3
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

  // --- o rocado da vila: a terra arada que a abertura MOSTRA -----------------
  // F18h, exigencia do operador: com as duas manchas grandes a 42 tiles da vila,
  // NENHUMA delas e aproveitavel na abertura — medido, a posicao de fazenda mais
  // proxima com tile aravel ao alcance estava a 37 tiles do armazem. E o mesmo
  // motivo do `LAJEDO_DA_VILA`: a partida tem de abrir com o que arar, como abre
  // com o que cortar. As manchas grandes FICAM (decisao do operador): elas sao
  // razao para explorar o mapa, e com a ferramenta da F18h o jogador escolhe
  // entre aproveitar uma mancha ou abrir a propria roca.
  //
  // FORA DA FOLGA, e de proposito. O lajedo cabe DENTRO dela porque `rock` esta em
  // `recursoPermitido`; `campoArado` nao esta em `terrenoPermitido`, e nao se
  // acrescenta: o que a folga protege e o custo de caminho do patio da vila
  // (campoArado custa 1,45 contra 1,30 da grama), e nao ha nada a ganhar em
  // encarecer as ruas da abertura para pousar a roca tres tiles mais ao norte.
  // Ela encosta na borda SUL da folga, o que basta para estar a vista: o disco de
  // raio 2 fica a 6 tiles do footprint do armazem, contra os 37 de antes.
  for (const [gx, gy] of disco(ROCADO_DA_VILA.gx, ROCADO_DA_VILA.gy, ROCADO_DA_VILA.raio)) {
    if (grade[gy]?.[gx] === 'grama') por(gx, gy, 'campoArado');
  }

  // --- o acude do norte: a agua que a abertura MOSTRA -----------------------
  // F-D3. Por ultimo para nao deslocar o RNG de nada acima (ele nao sorteia
  // nada: o tremor da borda sai do `ruido` que ja foi tirado).
  //
  // A caixa dele nao e gosto, e medida: `gy 23..` por cima, `gx 25..` pela
  // esquerda, e a reserva da vila fechando por baixo. As duas bordas custaram
  // uma rodada de teste vermelho cada, e as duas ensinam a mesma coisa — o
  // cenario de teste nao ocupa so a coordenada que ele escreve:
  //
  // - a OESTE: os cenarios CALCULAM coordenada. O F18e sai de (10,20) e anda
  //   `dx = 12`; o F10-desempate trabalha em volta de (18..20, 33); o F10-falhas
  //   planta uma pedreira no terceiro tile do caminho do serf, que cai em
  //   (23,23) e cuja porta e (23..25, 25). A primeira versao, `rx 10` a partir
  //   de `gx 27`, molhou o patio inteiro deles. `gx 27` deixa esse patio seco e
  //   ainda cai dentro do quadro visivel, que comeca em `gx 25,03`.
  // - ao NORTE: o armazem de cenario do F10-desempate esta em (30,20) e e 3x3.
  //   Ele ocupa ate `gy 22` — e a PORTA dele, por onde entra todo material, e a
  //   linha DE BAIXO do footprint, `gy 23`. Varrer coordenada literal nao acha
  //   nada disso: o par escrito no teste custa quatro linhas de mapa, tres de
  //   predio e uma de porta. `gy 24` e o primeiro tile que sobra.
  for (let gy = 24; gy < 34; gy += 1) {
    for (let gx = 27; gx < 44; gx += 1) {
      if (dentroDaElipse(gx, gy, ACUDE, ACUDE.rx, ACUDE.ry, ruido[6])) por(gx, gy, 'agua');
      else if (dentroDaElipse(gx, gy, ACUDE, ACUDE.rx, ACUDE.ry, ruido[7], 1.4)) por(gx, gy, 'areia');
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

/** F-D3 — o acude do norte e o mato do nascente: a geografia que a abertura
 *  mostra. Coordenada e AUTORIA, como o lago e a serra ja eram; o que e dado e
 *  a reserva de `terrain.json`, que diz ate onde eles podem chegar. */
const ACUDE = { gx: 33, gy: 25.5, rx: 6, ry: 2.0 };
const MATO_DO_NASCENTE = { gx: 39, gy: 25, raio: 3 };

/** F18h — centro e raio da roca da vila: a unica terra arada perto do quadrante
 *  protegido, e existe para que a partida abra com o que arar. Irma do
 *  `LAJEDO_DA_VILA` em tamanho (raio 2, 13 tiles) e em motivo; ver o comentario
 *  do bloco que a escreve para por que ela fica FORA da folga e ele dentro. */
const ROCADO_DA_VILA = { gx: 26, gy: 40, raio: 2 };

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
    // F-D3: um choke point so para TODO recurso — inclusive o lajedo da vila,
    // que ate aqui era a excecao escrita a mao. Sob o footprint nao entra
    // recurso nenhum (aceite 2); na folga entra o que `recursoPermitido`
    // autorizar, e nada mais.
    if (naVila(gx, gy)) return;
    if (naReserva(gx, gy) && !RESERVA.recursoPermitido.includes(tipo)) return;
    ocupado.add(chave);
    recursos[tipo].push([gx, gy]);
  };
  const ehGramaLivre = (gx, gy) => {
    if (grade[gy]?.[gx] !== 'grama') return false;
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

  // --- floresta: aglomerados no mato aberto ---------------------------------
  // O sorteio vem ANTES do filtro, e nao depois (F-D3): com o `&&` curto-
  // circuitando, cada tile recusado deixava de consumir o RNG, e entao o raio da
  // reserva — que e dado que alguem vai querer ajustar — embaralhava a floresta
  // do mapa inteiro. Separado assim, mexer no raio muda so o que esta perto da
  // vila.
  //
  // DEZ, e nao os 14 de antes (F-D3): com a faixa do quadrante, quatro dos
  // catorze aglomerados caiam no noroeste e eram descartados inteiros, sem que
  // nada estivesse escrito a respeito. Tirada a faixa, os catorze passaram a
  // valer e a camada de recurso saltou para 1133 tiles / 44,1 KB, estourando o
  // teto medido da F-T2a (900 tiles, teto de 40 KB). O numero explicito faz o
  // trabalho que o efeito colateral fazia calado.
  for (let i = 0; i < 10; i += 1) {
    const gx = MARGEM_DE_BORDA + Math.floor(rng() * (largura - 2 * MARGEM_DE_BORDA));
    const gy = MARGEM_DE_BORDA + Math.floor(rng() * (altura - 2 * MARGEM_DE_BORDA));
    const raio = 3 + Math.floor(rng() * 3);
    for (const [tx, ty] of disco(gx, gy, raio)) {
      const sorte = rng();
      if (sorte < 0.82 && ehGramaLivre(tx, ty)) por('tree', tx, ty);
    }
  }

  // --- cardume: o lago inteiro ----------------------------------------------
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      if (grade[gy][gx] === 'agua') por('fish', gx, gy);
    }
  }

  // --- o mato do nascente: a lenha que a abertura MOSTRA ---------------------
  // F-D3, e por ultimo de proposito: assim ele nao desloca o RNG de nada que ja
  // estava aqui. Autoria, como o lago e a serra; o que e dado e a reserva, que
  // diz onde ele tem de parar.
  for (const [tx, ty] of disco(MATO_DO_NASCENTE.gx, MATO_DO_NASCENTE.gy, MATO_DO_NASCENTE.raio)) {
    const sorte = rng();
    if (sorte < 0.85 && ehGramaLivre(tx, ty)) por('tree', tx, ty);
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
      + 'Duas regioes nascem em grama de proposito: a RESERVA DA VILA '
      + `(raio ${RESERVA.raio} em volta de cada tile que a vila inicial ocupa, de terrain.json) `
      + `e uma moldura de ${MARGEM_DE_BORDA} tiles em volta do mapa. A primeira e o que garante `
      + 'que a vila cabe; a segunda, que a borda do mundo nao e intransponivel. Ate a F-D3 a '
      + 'primeira era uma faixa de 72 tiles no quadrante noroeste, e era ela que mantinha agua, '
      + 'mato e pedra fora do alcance da abertura.',
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

module.exports = {
  montarArquivo, serializar, LEGENDA, MARGEM_DE_BORDA,
  // F-D3: o teste da guarda importa a reserva DAQUI em vez de remontar a
  // conta dele — se o gerador e o teste discordarem, discordam no mesmo lugar.
  RESERVA, tilesDaVila, naVila, naReserva,
};
