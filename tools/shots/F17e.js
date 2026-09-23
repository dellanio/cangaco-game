'use strict';

// Roteiro da F17e — OS SEIS ESTAGIOS VISUAIS, NO MESMO CENARIO.
//
// O que ele existe para provar: uma obra plantada pela UI passa pelos SEIS
// estagios, so pelo `step()`, e cada um deles chega a ser desenhado. Um PNG por
// estagio, tirado no tick em que o estagio aparece pela PRIMEIRA vez.
//
// Afirma numero, nunca pixel (§8): a contagem por estagio sai de
// `window.__cangaco.estagiosDeObraRenderizados`. A lista dos seis NAO esta
// digitada aqui — ela vem das chaves que a propria cena publica, senao o roteiro
// provaria a lista dele mesmo em vez da do jogo.
//
// `completo` e o unico que nao se conta por presenca: os 2 predios do cenario ja
// nascem completos. Para a obra, o que vale e a contagem SUBIR de 2 para 3.
//
// ENQUADRAMENTO: o BALANCE_LOG de 2026-09-23 registra que o quadro herdado poe a
// obra parcialmente fora. Aqui o footprint inteiro e medido contra o canvas antes
// da primeira foto, e a medida vai na mensagem do afirmar.

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

const TIPO_DA_OBRA = 'quarry';
/** Passo pequeno de proposito: `hpPorMartelada` e 5 e a martelada leva poucos
 *  ticks, entao cada estagio dura dezenas de ticks. Um passo de 5 nunca pula um
 *  estagio inteiro entre duas leituras — e o que torna "os seis apareceram"
 *  alcancavel, e nao sorte. */
const PASSO = 5;
/** O roteiro da F11c leva a MESMA obra de hp 0 ate o fim dentro de 3000 ticks.
 *  Falhar por teto E FALHAR, nao motivo para dormir mais. */
const TETO = 4000;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);

  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function telaDoTile(gx, gy) {
    const { camera } = await estado();
    return {
      x: canvas.left + gx * TILE_PX - camera.scrollX,
      y: canvas.top + gy * TILE_PX - camera.scrollY,
    };
  }

  async function pontoDoTile(gx, gy) {
    const canto = await telaDoTile(gx, gy);
    const p = { x: canto.x + TILE_PX / 2, y: canto.y + TILE_PX / 2 };
    afirmar(
      p.x > canvas.left && p.x < canvas.right && p.y > canvas.top && p.y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${p.x},${p.y})`,
    );
    return p;
  }

  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largObra, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  // A obra encostada na escola, sem o tile de folga que os roteiros anteriores
  // deixavam. Medido, e nao escolhido: com a folga de 1 tile (a geometria da
  // F11c) o footprint transborda o canvas em 2 px a direita, e a ultima coluna
  // da obra sai do quadro — exatamente o que o BALANCE_LOG de 2026-09-23
  // registrou. 2 px nao atrapalhavam um retangulo unico; atrapalham uma foto que
  // existe para mostrar a silhueta do estagio.
  const obra = { gx: escola.gx + largEs, gy: yRua - altObra };
  const meioDaObra = { gx: obra.gx + Math.floor(largObra / 2), gy: obra.gy };
  const pontaEsquerda = { gx: armazem.gx, gy: yRua };
  const pontaDireita = { gx: obra.gx + largObra - 1, gy: yRua };
  const tilesDaRua = pontaDireita.gx - pontaEsquerda.gx + 1;

  // ---- 0. ENQUADRAMENTO: o footprint INTEIRO cabe no canvas? ---------------
  const canto = await telaDoTile(obra.gx, obra.gy);
  const fim = await telaDoTile(obra.gx + largObra, obra.gy + altObra);
  const sobra = {
    esquerda: Math.round(canto.x - canvas.left),
    direita: Math.round(canvas.right - fim.x),
    topo: Math.round(canto.y - canvas.top),
    base: Math.round(canvas.bottom - fim.y),
  };
  afirmar(true, `enquadramento medido: canvas ${Math.round(canvas.width)}x${Math.round(canvas.height)}, `
    + `footprint ${largObra}x${altObra} tiles em (${obra.gx},${obra.gy}), sobra ${JSON.stringify(sobra)}`);
  afirmar(
    sobra.esquerda >= 0 && sobra.direita >= 0 && sobra.topo >= 0 && sobra.base >= 0,
    `o footprint inteiro da obra tem de caber no canvas para a foto do estagio valer: sobra ${JSON.stringify(sobra)}`,
  );

  // ---- 1. a rua ------------------------------------------------------------
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  const pEsq = await pontoDoTile(pontaEsquerda.gx, pontaEsquerda.gy);
  const pDir = await pontoDoTile(pontaDireita.gx, pontaDireita.gy);
  await arrastarDentroDoCanvas(page, canvas, [pEsq, pDir]);
  await avancar(1);
  await esperarFrame();
  const comRua = await estado();
  afirmar(
    comRua.estradasRenderizadas === tilesDaRua,
    `a rua deveria ter ${tilesDaRua} tiles, veio ${comRua.estradasRenderizadas}`,
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 2. a linha de base, ANTES de plantar --------------------------------
  const inicial = await estado();
  const ESTAGIOS = Object.keys(inicial.estagiosDeObraRenderizados);
  afirmar(
    ESTAGIOS.length === 6,
    `a cena deveria publicar os SEIS estagios da F17e, veio ${JSON.stringify(ESTAGIOS)}`,
  );
  const COMPLETOS_ANTES = inicial.estagiosDeObraRenderizados.completo;
  afirmar(
    inicial.obrasRenderizadas === 0 && COMPLETOS_ANTES === 2,
    `no inicio ha 2 predios de pe e nenhuma obra, veio ${JSON.stringify(inicial.estagiosDeObraRenderizados)}`,
  );

  // ---- 3. planta a obra ----------------------------------------------------
  await page.click(`[data-predio="${TIPO_DA_OBRA}"]`);
  await esperarFrame();
  await clicarNoTile(obra.gx, obra.gy);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const achado = Object.entries((await estado()).prediosDoEstado)
    .find(([, p]) => p.gx === obra.gx && p.gy === obra.gy);
  afirmar(achado !== undefined, `deveria existir um predio plantado em (${obra.gx},${obra.gy})`);
  afirmar(achado[1].estado === 'obra', 'o predio recem-plantado deveria estar em obra');

  // ---- 4. ACEITE: os seis aparecem, e cada um vira um PNG -------------------
  // A obra e UNICA no cenario, entao contagem >= 1 num estagio em obra e ela.
  // `completo` e diferente: os 2 predios ja estao la, e o que prova a obra de pe
  // e a contagem SUBIR.
  const vistos = new Map();
  const jaFotografado = new Set();

  async function registrar() {
    const s = await estado();
    const contagem = s.estagiosDeObraRenderizados;
    for (const estagio of ESTAGIOS) {
      const apareceu = estagio === 'completo'
        ? contagem.completo > COMPLETOS_ANTES
        : contagem[estagio] >= 1;
      if (!apareceu) continue;
      if (!vistos.has(estagio)) vistos.set(estagio, { tick: s.tick, contagem: { ...contagem } });
      if (!jaFotografado.has(estagio)) {
        jaFotografado.add(estagio);
        await capturar(estagio); // screenshots/F17e-<n>-<estagio>.png
      }
    }
    return s;
  }

  await registrar();
  let ticks = 0;
  while (vistos.size < ESTAGIOS.length && ticks < TETO) {
    await avancar(PASSO);
    ticks += PASSO;
    await esperarFrame();
    await registrar();
  }

  const faltando = ESTAGIOS.filter((e) => !vistos.has(e));
  afirmar(
    faltando.length === 0,
    `em ${TETO} ticks estes estagios nunca apareceram: ${JSON.stringify(faltando)} `
      + `(vistos: ${JSON.stringify([...vistos.keys()])})`,
  );

  // A ordem em que apareceram e a ordem em que a obra sobe: nenhum estagio
  // apareceu depois de um que vem mais tarde na fila.
  const ordemVista = [...vistos.entries()].sort((a, b) => a[1].tick - b[1].tick).map(([e]) => e);
  afirmar(
    JSON.stringify(ordemVista) === JSON.stringify(ESTAGIOS),
    `os seis deveriam aparecer na ordem que a cena publica: esperado ${JSON.stringify(ESTAGIOS)}, veio ${JSON.stringify(ordemVista)}`,
  );
  afirmar(
    (await estado()).estagiosDeObraRenderizados.completo === COMPLETOS_ANTES + 1,
    'no fim a obra tem de estar de pe, somando 1 ao completo do cenario',
  );
  afirmar(
    jaFotografado.size === ESTAGIOS.length,
    `deveria haver um PNG por estagio, veio ${jaFotografado.size}`,
  );

  // ---- 5. o painel do predio pronto, para fechar o passeio ------------------
  await clicarNoTile(meioDaObra.gx, meioDaObra.gy);
  afirmar(
    (await page.getAttribute('#painel-predio', 'data-estado-do-predio')) === 'completo',
    'no fim o painel deveria abrir um predio completo, nao uma obra',
  );
}

module.exports = { roteiro };
