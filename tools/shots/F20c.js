'use strict';

// F20c — o marcador de fome no mundo.
//
// A vila de abertura NAO tem Bodega (`economy.json`: storehouse e schoolhouse), entao nenhum
// civil tem onde comer: a condicao de todos cai 1 por tick desde o tick 0. O roteiro nao
// precisa montar nada — ele so ADIANTA o relogio com `window.__cangaco.avancar(n)`, com o laco
// pausado, e fotografa a mesma vila em tres regimes:
//
//   1. condicao cheia          -> nenhum marcador;
//   2. abaixo de `civilVaiComer` e ainda acima de `alertaVisual` -> COM FOME e ainda SEM
//      marcador. E o regime que prova que o icone nao e "ele vai comer" e sim "ele foi e nao
//      conseguiu" (falha de abastecimento), como o item da fila pediu;
//   3. abaixo de `alertaVisual` -> marcador aceso na MESMA unidade da foto 1.
//
// Nenhum limiar e digitado aqui: as fracoes vem de `data/condition.json` e a condicao cheia em
// ticks e derivada de `data/time.json` do mesmo jeito que o carregador da sim faz. A
// equivalencia entre comparar FRACAO (o que este roteiro faz) e comparar TICK (o que a sim faz)
// e provada para toda condicao possivel em `tests/F20c-marcador-de-fome.test.ts` — sem aquele
// teste, este roteiro estaria afirmando contra uma aritmetica que ninguem verificou.

const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const condicao = require('../../data/condition.json');
const time = require('../../data/time.json');
const tema = require('../../data/theme-sertao.json');
const unidades = require('../../data/units.json');

const TILE_PX = 64;
const BLOCO = 250; // ticks por chamada de `avancar`: bloco grande trava o rAF, pequeno e lento
const PASSOS_DE_ZOOM = 4;
const LIMIARES = condicao.limiares;

/**
 * A condicao cheia de um civil em TICKS, pela mesma conta do carregador (`data/loader.ts`):
 * minutos na escala 1.0 -> segundos -> dividido pela escala `economia` -> x tickHz, arredondado.
 */
const CHEIA_EM_TICKS = Math.round(
  (condicao.duracaoCondicaoCheia_min_base.civil * 60 * time.tickHz) / time.escalas[condicao.escala],
);
// O dreno e de 1 por tick, entao o pior caso e cair de cheia ate o limiar. O teto existe para o
// roteiro falhar dizendo o que nao aconteceu, em vez de girar para sempre.
const TETO_DE_TICKS = Math.ceil(CHEIA_EM_TICKS * (1 - LIMIARES.alertaVisual)) + 2 * BLOCO;

/**
 * So civil drena condicao (`condition.regraMilitar`: o militar nao vai ao Inn), entao so civil
 * pode ter marcador. A lista de tipos vem do DADO, nunca digitada aqui.
 */
const TIPOS_CIVIS = new Set(unidades.civis.tipos.map((t) => t.id));
const civisDe = (renderizadas) => renderizadas.filter((u) => TIPOS_CIVIS.has(u.tipo));

/** O que a tela deveria mostrar, pela fracao publicada e pela fracao do dado. */
const deveriaTerMarcador = (u) => u.fracaoDeCondicao <= LIMIARES.alertaVisual;

function divergentes(unidades) {
  return unidades
    .filter((u) => u.marcadorDeFome !== deveriaTerMarcador(u))
    .map((u) => `${u.id} fracao=${u.fracaoDeCondicao.toFixed(4)} marcador=${u.marcadorDeFome}`);
}

async function roteiro(ctx) {
  const { page, estado, afirmar, capturar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const esperarFrame = () => page.waitForTimeout(100);

  // ---- 1. condicao cheia: a tela esta limpa ---------------------------------
  const abertura = await estado();
  const naAbertura = civisDe(abertura.unidadesRenderizadas);
  afirmar(
    naAbertura.length > 0,
    `a vila de abertura precisa de civis desenhados para haver fome, veio ${naAbertura.length}`,
  );
  afirmar(
    abertura.tick === 0,
    `o roteiro abre com '?pausado' e tick 0; veio tick ${abertura.tick}`,
  );
  afirmar(
    naAbertura.every((u) => u.fracaoDeCondicao === 1),
    `no tick 0 todo civil deveria estar de condicao cheia: ${JSON.stringify(
      naAbertura.map((u) => [u.id, u.fracaoDeCondicao]),
    )}`,
  );
  afirmar(
    naAbertura.every((u) => u.marcadorDeFome === false),
    'nenhuma unidade de condicao cheia pode ter marcador de fome',
  );
  afirmar(divergentes(naAbertura).length === 0, `marcador fora do limiar: ${divergentes(naAbertura)}`);
  await capturar('cheia-sem-marcador');

  // A unidade que o aceite segue: "acima do limiar NAO tem marcador; a MESMA abaixo dele tem".
  const alvo = naAbertura[0].id;

  // ---- 2. com fome e ainda sem marcador ------------------------------------
  // A espera e por CONDICAO (a fracao publicada), nunca por um numero de ticks chutado.
  const avancarAte = async (pronto, descricao) => {
    let s = await estado();
    let ticks = 0;
    while (!pronto(civisDe(s.unidadesRenderizadas)) && ticks < TETO_DE_TICKS) {
      await avancar(BLOCO);
      ticks += BLOCO;
      s = await estado();
    }
    await esperarFrame();
    s = await estado();
    afirmar(
      pronto(civisDe(s.unidadesRenderizadas)),
      `deveria dar para ${descricao} em ate ${TETO_DE_TICKS} ticks; parou no tick ${s.tick}`,
    );
    return s;
  };

  const comFome = await avancarAte(
    (civis) => civis.every((u) => u.fracaoDeCondicao <= LIMIARES.civilVaiComer
      && u.fracaoDeCondicao > LIMIARES.alertaVisual),
    'todo civil cruzar o limiar de ir comer sem cruzar o do marcador',
  );
  const civisComFome = civisDe(comFome.unidadesRenderizadas);
  afirmar(
    civisComFome.length === naAbertura.length,
    `ninguem pode morrer antes do limiar do marcador: eram ${naAbertura.length}, sao ${civisComFome.length}`,
  );
  afirmar(
    civisComFome.every((u) => u.marcadorDeFome === false),
    'com fome e acima de `alertaVisual` a tela continua limpa — o marcador nao e "vai comer"',
  );
  afirmar(divergentes(civisComFome).length === 0, `marcador fora do limiar: ${divergentes(civisComFome)}`);
  await capturar('com-fome-sem-marcador');

  // ---- 3. abaixo do limiar: o marcador acende -------------------------------
  const emAlerta = await avancarAte(
    (civis) => civis.every((u) => u.fracaoDeCondicao <= LIMIARES.alertaVisual),
    'todo civil cruzar `alertaVisual`',
  );
  const civisEmAlerta = civisDe(emAlerta.unidadesRenderizadas);
  afirmar(
    civisEmAlerta.length === naAbertura.length,
    `a foto do marcador precisa da vila viva: eram ${naAbertura.length}, sao ${civisEmAlerta.length}`,
  );
  afirmar(
    civisEmAlerta.every((u) => u.marcadorDeFome === true),
    `abaixo de ${LIMIARES.alertaVisual} todo civil deveria ter marcador: ${JSON.stringify(
      civisEmAlerta.map((u) => [u.id, u.fracaoDeCondicao, u.marcadorDeFome]),
    )}`,
  );
  const oAlvo = civisEmAlerta.find((u) => u.id === alvo);
  afirmar(
    oAlvo !== undefined && oAlvo.marcadorDeFome === true,
    `a MESMA unidade da primeira foto (${alvo}) deveria ter marcador agora`,
  );

  // O dreno e de 1 por tick: a fracao publicada tem de bater com o tick corrido, o que amarra a
  // conta deste roteiro (derivada de condition.json + time.json) a do carregador da sim.
  const condicaoEsperada = CHEIA_EM_TICKS - emAlerta.tick;
  afirmar(
    Math.round(oAlvo.fracaoDeCondicao * CHEIA_EM_TICKS) === condicaoEsperada,
    `no tick ${emAlerta.tick} a condicao de ${alvo} deveria ser ${condicaoEsperada} de `
      + `${CHEIA_EM_TICKS}, a fracao publicada da ${Math.round(oAlvo.fracaoDeCondicao * CHEIA_EM_TICKS)}`,
  );
  await capturar('abaixo-do-limiar-com-marcador');

  // ---- 4. um passo DESPAUSADO (§8): o marcador sobrevive ao redesenho -------
  // Com o laco pausado o quadro e sempre o mesmo (alfa 1). Um passo de relogio de verdade
  // redesenha com interpolacao, e e nele que um marcador criado no lugar errado — ou recriado a
  // cada quadro — apareceria piscando ou fora da unidade.
  const anteDoPasso = emAlerta.tick;
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('p');
  await esperarFrame();
  const depoisDoPasso = await estado();
  afirmar(
    depoisDoPasso.tick > anteDoPasso,
    `o passo despausado deveria adiantar o tick: ${anteDoPasso} -> ${depoisDoPasso.tick}`,
  );
  const civisDepois = civisDe(depoisDoPasso.unidadesRenderizadas);
  afirmar(
    civisDepois.every((u) => u.marcadorDeFome === true),
    'o marcador tem de continuar aceso depois de o laco rodar de verdade',
  );
  afirmar(divergentes(civisDepois).length === 0, `marcador fora do limiar: ${divergentes(civisDepois)}`);

  // ---- 5. de perto, para a foto provar o que diz ----------------------------
  // Em zoom 1 o rotulo do tema tem 12 px de altura. A foto so serve se der para LER, e o ponto
  // do alvo tem de estar dentro do canvas — medido, nao suposto.
  const alvoDepois = civisDepois.find((u) => u.id === alvo);
  afirmar(alvoDepois !== undefined, `a unidade ${alvo} deveria seguir no quadro`);
  const pontoDoAlvo = async () => {
    const s = await estado();
    const u = s.unidadesRenderizadas.find((x) => x.id === alvo);
    if (u === undefined) throw new Error(`shot: ${alvo} saiu do quadro`);
    return pontoDoTileNaTela(canvas, { gx: u.gxDesenhado, gy: u.gyDesenhado }, s.camera, TILE_PX);
  };
  const dentroDoCanvas = (p) => p.x > canvas.left && p.x < canvas.right
    && p.y > canvas.top && p.y < canvas.bottom;

  let onde = await pontoDoAlvo();
  afirmar(
    dentroDoCanvas(onde),
    `${alvo} deveria estar visivel antes do zoom, cairia em (${Math.round(onde.x)},${Math.round(onde.y)})`,
  );
  await page.mouse.move(onde.x, onde.y);
  for (let i = 0; i < PASSOS_DE_ZOOM; i += 1) {
    await page.mouse.wheel(0, -120);
    await esperarFrame();
  }
  const comZoom = await estado();
  onde = await pontoDoAlvo();
  afirmar(
    comZoom.camera.zoom > 1 && dentroDoCanvas(onde),
    `no zoom ${comZoom.camera.zoom} ${alvo} deveria seguir no quadro, cairia em `
      + `(${Math.round(onde.x)},${Math.round(onde.y)})`,
  );
  afirmar(
    comZoom.unidadesRenderizadas.find((u) => u.id === alvo).marcadorDeFome === true,
    'o zoom e da camera: nao pode apagar o marcador',
  );
  afirmar(
    typeof tema.marcadores.fome.rotulo === 'string' && tema.marcadores.fome.rotulo.length > 0,
    'o rotulo do marcador e o texto do JOGADOR e mora no tema (CLAUDE.md §9)',
  );
  await capturar('marcador-de-perto');
}

module.exports = { roteiro };
