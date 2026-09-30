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
const producao = require(path.join(RAIZ, 'data', 'production.json'));

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
  // DENTRO DA FOLGA desde a noite 17 (decisao do operador, 2026-09-26): antes
  // ficava fora, a 6 tiles do armazem, e fora do quadro de abertura — o jogador
  // abria a partida sem ver terra arada. `campoArado` entrou em
  // `terrenoPermitido`. O custo que a folga protegia (campoArado 1,45 contra 1,30
  // da grama) fica fora do caminho do patio: a faixa comeca duas linhas abaixo
  // da linha de porta, e a linha 34, entre as duas, continua grama.
  for (const [gx, gy] of faixa(ROCADO_DA_VILA)) {
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

/** F18h — a roca da vila: a unica terra arada perto da vila, e existe para que a
 *  partida abra com o que arar. Ate a noite 17 era um disco de raio 2 em (26,40),
 *  fora da folga — perto, mas fora do quadro de abertura, que vai ate y=36
 *  (medido, 2026-09-26). Decisao do operador: as manchas entram na folga, em
 *  FAIXA ao sul da vila, porque roca de verdade e alongada e porque um disco de
 *  raio 2 nao cabe entre a linha de porta e a borda do quadro sem encostar num
 *  predio. Canto de cima-esquerda e tamanho, em tiles. */
const ROCADO_DA_VILA = { gx: 26, gy: 35, largura: 5, altura: 2 };

/** F-CANA-b — o partido de cana da vila: irmao do `ROCADO_DA_VILA`, mesma faixa,
 *  do outro lado do eixo da vila, e pelo mesmo motivo — a partida abre com o que o
 *  Canavial colher. A cana nao e terreno (so o milho deriva do `campoArado`),
 *  entao a mancha entra na camada ESPARSA, como o lajedo; e `grapes` esta em
 *  `recursoPermitido` para caber na folga. */
const CANAVIAL_DA_VILA = { gx: 34, gy: 35, largura: 5, altura: 2 };

/** Os tiles de uma mancha retangular (`ROCADO_DA_VILA`, `CANAVIAL_DA_VILA`). */
function faixa({ gx, gy, largura, altura }) {
  const tiles = [];
  for (let dy = 0; dy < altura; dy += 1) {
    for (let dx = 0; dx < largura; dx += 1) tiles.push([gx + dx, gy + dy]);
  }
  return tiles;
}

/** Centro e raio do lajedo da vila. Ver o cabecalho: e a unica pedra dentro do
 *  quadrante protegido, e existe para que a partida abra com o que cortar. */
const LAJEDO_DA_VILA = { gx: 24, gy: 31, raio: 2 };

/**
 * F21b - os veios de minerio da serra: os tipos, na ordem, e o teto de cada veio.
 *
 * QUANTOS veios nao esta aqui, e isso e deliberado: nao e escolha livre. A serra
 * tem 453 tiles e so 97 que uma mina consegue trabalhar (o porque esta em
 * `gerarRecursos`), repartidos em 9 afloramentos separados. Cada afloramento
 * recebe UM veio, e os afloramentos vao para os tres tipos em rodizio, do maior
 * para o menor. Pedir "5 veios de carvao" daria cinco pedidos para tres lugares:
 * numero bonito que o mapa nao tem como cumprir, e a corrida sairia calada com
 * menos veio do que o pedido - exatamente o tipo de dado sem lastro no mundo que
 * a F21b existe para tirar do jogo.
 *
 * Proporcao, e por que: carvao e o que mais se queima (a metalurgia gasta 1.2 de
 * carvao por ciclo contra 1.0 de minerio de ouro), ferro alimenta duas oficinas,
 * e ouro e o mais raro. O rodizio ja entrega ao carvao os afloramentos maiores;
 * o teto por veio inclina mais um pouco. Os numeros sao de AUTORIA do mapa, como
 * o raio dos aglomerados de arvore; o rendimento por tile, que e balanceamento,
 * mora em `data/resources.json`.
 *
 * A ordem da lista faz parte da semente E do rodizio: trocar `coal` de lugar
 * redesenha os tres tipos. Se um dia precisar mudar, mude sabendo disso.
 */
const VEIOS_DE_MINERIO = [
  { tipo: 'coal', tamanho: 12 },
  { tipo: 'iron_ore', tamanho: 10 },
  { tipo: 'gold_ore', tamanho: 6 },
];

/** Guarda de acoplamento com a receita: o tipo semeado aqui precisa ter
 *  EXATAMENTE uma receita que o colhe. Minerio no mapa sem mina que o tire e
 *  dado morto, e duas minas com alcances diferentes para o mesmo veio seriam uma
 *  escolha que ninguem fez. Reprova em vez de decidir calado. */
function conferirQuemColhe(recurso) {
  const receitas = Object.entries(producao.predios).filter(
    ([, def]) => def && def.colheita && def.colheita.recurso === recurso,
  );
  if (receitas.length !== 1) {
    throw new Error(
      `gerar-mapa: production.json precisa de exatamente UMA receita colhendo '${recurso}' `
      + `(achou ${receitas.length})`,
    );
  }
}

/**
 * F-T2a — a camada esparsa de recurso, derivada do terreno ja gerado mais os
 * aglomerados proprios. Um tile tem NO MAXIMO um recurso: o `ocupado` corta a
 * sobreposicao aqui, na autoria, para o carregador nao ter que escolher um
 * vencedor em tempo de jogo.
 */
function gerarRecursos({ largura, altura, grade, rng }) {
  const recursos = {
    rock: [], tree: [], fish: [], coal: [], iron_ore: [], gold_ore: [], grapes: [],
  };
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


  // --- veios de minerio: na CARA da serra, onde um mineiro consegue encostar --
  // F21b, e por ultimo pelo mesmo motivo escrito acima para o mato do nascente:
  // semeado depois de tudo, nao desloca o RNG de nada que ja estava aqui, e a
  // floresta, o cardume e o lajedo saem tile por tile identicos ao de antes.
  //
  // ONDE, e por que nao "na montanha" e ponto: `sim/aproximacao.ts` decide de
  // onde se trabalha um tile — o proprio tile, se for andavel, ou um dos oito
  // vizinhos andaveis — e diz, por escrito, que lista vazia e "veio no meio da
  // serra". A montanha tem 453 tiles e so 31 deles tem chao andavel ao lado: uma
  // semeadura que ignorasse isso encheria o mapa de minerio que mina nenhuma
  // alcanca, e a mina ficaria esperando pra sempre um tile que nunca vem. Entao o
  // criterio aqui e o MESMO predicado do runtime: tile da serra (a montanha ou a
  // saia de rocha colada nela) com pelo menos um vizinho andavel.
  //
  // A saia de rocha entra, e isso TIRA pedra dali: o tile que vira veio sai de
  // `rock`. E o que faz a diferenca entre pedra e minerio ser de LUGAR — a pedra
  // continua no lajedo da vila e nos lajedos soltos do sertao, e o que a serra
  // tem de proprio e o veio. Sem isso sobrariam 31 tiles de minerio no mundo
  // inteiro, contra 66 de saia util.
  const INTRANSPONIVEL = new Set(terreno.intransponivel);
  const andavel = (gx, gy) => {
    const tipo = grade[gy]?.[gx];
    return tipo !== undefined && !INTRANSPONIVEL.has(tipo);
  };
  const vizinhos = (gx, gy) => {
    const lista = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = gx + dx;
        const ny = gy + dy;
        if (nx >= 0 && ny >= 0 && nx < largura && ny < altura) lista.push([nx, ny]);
      }
    }
    return lista;
  };
  const daSerra = (gx, gy) => {
    const tipo = grade[gy][gx];
    if (tipo === 'montanha') return true;
    return tipo === 'rocha' && vizinhos(gx, gy).some(([nx, ny]) => grade[ny][nx] === 'montanha');
  };
  const candidatos = [];
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      if (!daSerra(gx, gy)) continue;
      if (!vizinhos(gx, gy).some(([nx, ny]) => andavel(nx, ny))) continue;
      candidatos.push([gx, gy]);
    }
  }

  // Um veio por AFLORAMENTO, e nao um sorteio solto entre os candidatos: os 66
  // tiles uteis da saia vem em manchas separadas ao longo da cordilheira, e dois
  // veios caindo na mesma mancha dariam uma jazida so com dois nomes, deixando
  // metade da serra pelada. Assim cada tipo aparece espalhado, que e o que faz o
  // lugar da mina importar.
  const emCandidato = new Set(candidatos.map(([gx, gy]) => `${gx},${gy}`));
  const afloramentos = [];
  const visto = new Set();
  for (const [gx, gy] of candidatos) {
    const raiz = `${gx},${gy}`;
    if (visto.has(raiz)) continue;
    visto.add(raiz);
    const mancha = [];
    const pilha = [[gx, gy]];
    while (pilha.length > 0) {
      const [cx, cy] = pilha.pop();
      mancha.push([cx, cy]);
      for (const [nx, ny] of vizinhos(cx, cy)) {
        const chave = `${nx},${ny}`;
        if (!emCandidato.has(chave) || visto.has(chave)) continue;
        visto.add(chave);
        pilha.push([nx, ny]);
      }
    }
    afloramentos.push(mancha);
  }
  // Ordem estavel antes do sorteio: o flood acima ja e deterministico, mas
  // depender da ordem dele seria depender de detalhe de implementacao.
  afloramentos.sort((a, b) => b.length - a.length || a[0][1] - b[0][1] || a[0][0] - b[0][0]);

  // O tile de veio TIRA a pedra dali: `por()` recusaria o tile ja ocupado, e a
  // recusa calada e que daria o mapa com menos minerio do que o numero pedia.
  const semPedra = (gx, gy) => {
    const chave = `${gx},${gy}`;
    if (!ocupado.has(chave)) return;
    const i = recursos.rock.findIndex(([rx, ry]) => rx === gx && ry === gy);
    if (i < 0) return; // ocupado por outra coisa: `por` recusa, e esta certo
    recursos.rock.splice(i, 1);
    ocupado.delete(chave);
  };

  // Rodizio, e nao sorteio: afloramento maior para o primeiro tipo da lista, o
  // seguinte para o segundo, e assim por diante. Sortear qual mancha recebe qual
  // tipo seria pior de proposito - daria a corrida em que o ouro cai so no
  // pedaco de um tile e o carvao leva os dois maiores. O que o RNG decide aqui e
  // o DESENHO do veio dentro da mancha, nao quem fica com o que.
  for (let i = 0; i < afloramentos.length; i += 1) {
    const { tipo, tamanho } = VEIOS_DE_MINERIO[i % VEIOS_DE_MINERIO.length];
    conferirQuemColhe(tipo);
    const mancha = afloramentos[i];
    const naMancha = new Set(mancha.map(([gx, gy]) => `${gx},${gy}`));
    const veio = [];
    const posto = new Set();
    const assentar = ([gx, gy]) => {
      semPedra(gx, gy);
      por(tipo, gx, gy);
      posto.add(`${gx},${gy}`);
      veio.push([gx, gy]);
    };
    assentar(mancha[Math.floor(rng() * mancha.length)]);
    while (veio.length < tamanho) {
      // Onda 8-conexa DENTRO do afloramento: a cada passo, os vizinhos livres de
      // todo o veio, e um deles sorteado. Cresce em mancha, como afloramento de
      // verdade, e nao em fila indiana como cresceria um passeio aleatorio.
      const frente = new Map();
      for (const [gx, gy] of veio) {
        for (const [nx, ny] of vizinhos(gx, gy)) {
          const chave = `${nx},${ny}`;
          if (!naMancha.has(chave) || posto.has(chave)) continue;
          frente.set(chave, [nx, ny]);
        }
      }
      if (frente.size === 0) break;
      const lista = [...frente.values()];
      assentar(lista[Math.floor(rng() * lista.length)]);
    }
  }

  // --- a cana da vila: o partido que a abertura MOSTRA ------------------------
  // F-CANA-b, decisao do operador (BUG-L): o mesmo conserto do rocado. Por
  // ULTIMO, depois dos veios, porque os veios sorteiam e isto nao sorteia nada:
  // entrar antes deslocaria o RNG de todo o minerio. Tile ja ocupado, sob a vila
  // ou na folga sem `grapes` em `recursoPermitido` `por()` recusa — o teste da
  // F-CANA-b compara a mancha inteira, para a recusa calada nao a encolher sem ninguem ver.
  for (const [gx, gy] of faixa(CANAVIAL_DA_VILA)) {
    if (grade[gy]?.[gx] === 'grama') por('grapes', gx, gy);
  }

  return recursos;
}

// D-TERRENO-01 — A ALTURA SO DE RENDER (opcao A do relevo, docs/planos/relevo-a.md). Sai daqui
// para um arquivo PROPRIO, `data/maps/<id>.relevo.json`, que so o render le: a sim nao sabe que a
// altura existe. Quatro escolhas escritas:
//
//   - a altura mora no VERTICE, o canto do tile, como no KaM: o tile (gx,gy) tem os cantos
//     (gx,gy), (gx+1,gy), (gx,gy+1) e (gx+1,gy+1), e a grade tem (L+1) x (A+1) vertices;
//   - o RNG e proprio (`relevo.geracao.semente`) e roda depois de tudo: o terreno e os recursos
//     nao consomem nada dele, e o `sertao-128.json` sai byte a byte igual;
//   - o ruido so usa + - * / e floor, e o resultado vira degrau INTEIRO: nada de Math.sin num
//     numero que vai para o arquivo;
//   - so relevo SUAVE: fora de `tiposSemLimiteDeDeclive`, os 4 cantos de um tile ficam a no maximo
//     `decliveMaximoEmDegraus`. A altura grande so existe no miolo da montanha, que ja e
//     intransponivel: a sombra nunca sugere um obstaculo que a sim nao tem.
const RELEVO = require(path.join(RAIZ, 'data', 'relevo.json'));
const SAIDA_DO_RELEVO = path.join(RAIZ, 'data', 'maps', `${ID}.relevo.json`);
/** O formato, nao balanceamento: um char base-36 por vertice, degrau de 0 a 35. */
const DIGITOS_DO_RELEVO = '0123456789abcdefghijklmnopqrstuvwxyz';

/** Ruido de valor semeado: grade grossa de amostras em [0,1), interpolada bilinear com smoothstep. */
function ruidoDeValor(rng, largura, altura, celula) {
  const gl = Math.ceil(largura / celula) + 2;
  const ga = Math.ceil(altura / celula) + 2;
  const grossa = Array.from({ length: gl * ga }, () => rng());
  const suave = (t) => t * t * (3 - 2 * t);
  const g = (i, j) => grossa[j * gl + i];
  return (x, y) => {
    const cx = x / celula;
    const cy = y / celula;
    const ix = Math.floor(cx);
    const iy = Math.floor(cy);
    const fx = suave(cx - ix);
    const fy = suave(cy - iy);
    const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * fx;
    const b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** Os indices dos 4 cantos do tile (gx,gy) na grade de vertices de largura `vl`. */
function cantosDoTile(gx, gy, vl) {
  return [gy * vl + gx, gy * vl + gx + 1, (gy + 1) * vl + gx, (gy + 1) * vl + gx + 1];
}

function temLimiteDeDeclive(grade, gx, gy, cfg) {
  return !cfg.tiposSemLimiteDeDeclive.includes(grade[gy][gx]);
}

/**
 * Baixa todo canto que passa de `min + decliveMaximo` num tile com limite, ate nao sobrar nenhum.
 * So BAIXA: a altura e inteira, nunca cresce e tem piso, entao o laco termina. Muta `h` e devolve
 * quantas vezes baixou um vertice.
 */
function forcarDecliveMaximo(h, grade, cfg) {
  const altura = grade.length;
  const largura = grade[0].length;
  const vl = largura + 1;
  let baixados = 0;
  for (let mudou = true; mudou;) {
    mudou = false;
    for (let gy = 0; gy < altura; gy += 1) {
      for (let gx = 0; gx < largura; gx += 1) {
        if (!temLimiteDeDeclive(grade, gx, gy, cfg)) continue;
        const cantos = cantosDoTile(gx, gy, vl);
        const teto = Math.min(...cantos.map((i) => h[i])) + cfg.decliveMaximoEmDegraus;
        for (const i of cantos) {
          if (h[i] > teto) {
            h[i] = teto;
            baixados += 1;
            mudou = true;
          }
        }
      }
    }
  }
  return baixados;
}

/** Os tiles com limite cuja amplitude entre os 4 cantos passa do declive maximo: [gx, gy, amp]. */
function declivesForaDoLimite(h, grade, cfg) {
  const altura = grade.length;
  const largura = grade[0].length;
  const vl = largura + 1;
  const fora = [];
  for (let gy = 0; gy < altura; gy += 1) {
    for (let gx = 0; gx < largura; gx += 1) {
      if (!temLimiteDeDeclive(grade, gx, gy, cfg)) continue;
      const v = cantosDoTile(gx, gy, vl).map((i) => h[i]);
      const amplitude = Math.max(...v) - Math.min(...v);
      if (amplitude > cfg.decliveMaximoEmDegraus) fora.push([gx, gy, amplitude]);
    }
  }
  return fora;
}

/** A altura por vertice: a media da base dos tiles que tocam o vertice, mais o ruido, em degrau
 *  inteiro de 0 a 35, e depois o declive forcado. */
function montarRelevo(grade, cfg) {
  const altura = grade.length;
  const largura = grade[0].length;
  const vl = largura + 1;
  const va = altura + 1;
  const ruido = ruidoDeValor(mulberry32(cfg.semente), vl, va, cfg.celulaDoRuidoEmTiles);
  const h = new Array(vl * va);
  for (let vy = 0; vy < va; vy += 1) {
    for (let vx = 0; vx < vl; vx += 1) {
      let soma = 0;
      let tiles = 0;
      for (const [gx, gy] of [[vx - 1, vy - 1], [vx, vy - 1], [vx - 1, vy], [vx, vy]]) {
        if (gx < 0 || gy < 0 || gx >= largura || gy >= altura) continue;
        soma += cfg.basePorTipo[grade[gy][gx]];
        tiles += 1;
      }
      const bruto = Math.round(soma / tiles + cfg.amplitudeDoRuidoEmDegraus * ruido(vx, vy));
      h[vy * vl + vx] = Math.max(0, Math.min(DIGITOS_DO_RELEVO.length - 1, bruto));
    }
  }
  forcarDecliveMaximo(h, grade, cfg);
  return { largura: vl, altura: va, h };
}

/** `cfg` so para o teste provar que outra semente da outro relevo; o arquivo usa o dado. */
function montarArquivoDeRelevo(cfg = RELEVO.geracao) {
  const { grade } = gerar();
  const { largura, altura, h } = montarRelevo(grade, cfg);
  const linhas = [];
  for (let vy = 0; vy < altura; vy += 1) {
    let linha = '';
    for (let vx = 0; vx < largura; vx += 1) linha += DIGITOS_DO_RELEVO[h[vy * largura + vx]];
    linhas.push(linha);
  }
  return {
    id: ID,
    _doc: 'Altura SO DE RENDER (opcao A do relevo, docs/planos/relevo-a.md). EMITIDO por '
      + 'tools/gerar-mapa.js a partir de data/relevo.json (geracao) e dos tipos do mapa; nao edite a '
      + 'mao. sim/ nunca le este arquivo. Uma linha por fileira de VERTICES: o tile (gx,gy) tem os '
      + 'cantos (gx,gy), (gx+1,gy), (gx,gy+1) e (gx+1,gy+1). Um char por vertice, na ordem '
      + `"${DIGITOS_DO_RELEVO}": o degrau inteiro de 0 a 35.`,
    gerador: 'tools/gerar-mapa.js',
    mapa: `data/maps/${ID}.json`,
    semente: cfg.semente,
    largura,
    altura,
    linhas,
  };
}

function serializarRelevo(arquivo) {
  const { linhas, ...resto } = arquivo;
  const corpo = JSON.stringify(resto, null, 2).replace(/\n}$/, '');
  return `${corpo},\n  "linhas": [\n${linhas.map((l) => `    ${JSON.stringify(l)}`).join(',\n')}\n  ]\n}\n`;
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
  // D-TERRENO-01: dois arquivos, cada um com a sua semente; o `--conferir` confere os dois.
  const saidas = [
    { caminho: SAIDA, texto: serializar(montarArquivo()), semente: SEMENTE },
    { caminho: SAIDA_DO_RELEVO, texto: serializarRelevo(montarArquivoDeRelevo()), semente: RELEVO.geracao.semente },
  ];
  if (conferir) {
    let difere = false;
    for (const { caminho, texto, semente } of saidas) {
      const atual = fs.existsSync(caminho) ? fs.readFileSync(caminho, 'utf8') : '';
      if (atual.replace(/\r\n/g, '\n') !== texto) {
        console.error(`gerar-mapa: ${path.relative(RAIZ, caminho)} difere do que a semente ${semente} emite.`);
        difere = true;
      } else {
        console.log(`gerar-mapa: ${path.relative(RAIZ, caminho)} confere com a semente ${semente}.`);
      }
    }
    if (difere) process.exit(1);
    return;
  }
  for (const { caminho, texto, semente } of saidas) {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, texto);
    console.log(`gerar-mapa: ${path.relative(RAIZ, caminho)} escrito (semente ${semente}).`);
  }
}

if (require.main === module) main();

module.exports = {
  montarArquivo, serializar, LEGENDA, MARGEM_DE_BORDA,
  // F-D3: o teste da guarda importa a reserva DAQUI em vez de remontar a
  // conta dele — se o gerador e o teste discordarem, discordam no mesmo lugar.
  RESERVA, tilesDaVila, naVila, naReserva,
  CANAVIAL_DA_VILA, ROCADO_DA_VILA, disco, faixa,
  // D-TERRENO-01: o teste roda o mesmo codigo que grava o relevo.
  montarRelevo, montarArquivoDeRelevo, serializarRelevo, forcarDecliveMaximo, declivesForaDoLimite,
  DIGITOS_DO_RELEVO,
};
