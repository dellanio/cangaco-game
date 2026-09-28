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
//
// A pedreira fica ao lado do lajedo (`_pedreira.js`) e, de pe, recebe o cabra e
// PRODUZ: o roteiro termina com pedra na saida. Antes ela ficava encostada na
// escola, sem rocha ao alcance, e a foto do `completo` retratava uma pedreira que
// nunca daria pedra.
//
// OS SEIS ESTAGIOS SO EXISTEM PARA PREDIO SEM ARTE (F17g: com o par madeira +
// completo, a obra e revelada pelo `hp`). A pedreira ganhou arte e o roteiro
// quebrou por isso — pela segunda vez. Agora ele abre a pagina com
// `?semArte=quarry` (`_sem-arte.js`): o fallback e exercitado na pedreira qualquer
// que seja o manifesto, e a pagina confirma que leu o parametro.

const { retanguloDoCanvas, arrastarDentroDoCanvas, pontoParaApertar } = require('./_canvas');
const { erguerRua } = require('./_estradas');
const { arrastosDaRua } = require('./_recursos');
const { pedreiraNoLajedo, esperarPedraNaSaida } = require('./_pedreira');
const { abrirSemArte } = require('./_sem-arte');
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
/** Teto da espera pelo cabra ocupar, o mesmo da F-VIVO-a (mesma geometria). */
const TETO_ATE_OCUPAR = 900;
const PASSO_DE_AVANCO = 50; // um `avancar` seco e grande estoura o frame (F16b)

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  await abrirSemArte(ctx, [TIPO_DA_OBRA]);
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

  /** Anda a camera com as setas ate a coluna cair no meio do quadro (molde da F-T3). */
  async function centrarEm(gx) {
    const alvo = Math.max(0, gx * TILE_PX - (canvas.right - canvas.left) / 2);
    for (let i = 0; i < 30; i += 1) {
      const { camera } = await estado();
      const delta = alvo - camera.scrollX;
      if (Math.abs(delta) < TILE_PX) return;
      const tecla = delta > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(tecla);
      await page.waitForTimeout(120);
      await page.keyboard.up(tecla);
      await esperarFrame();
    }
  }

  // ---- geometria, tirada dos JSON ------------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largObra, altObra] = defDe(TIPO_DA_OBRA).tamanho;
  const { pedreira: obra, tilesDaRua: rua } = pedreiraNoLajedo({ armazem, escola, tamanhoDe: (id) => defDe(id).tamanho, afirmar });
  const meioDaObra = { gx: obra.gx + Math.floor(largObra / 2), gy: obra.gy };
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  const tilesDaRua = rua.length;
  const civil = defDe(TIPO_DA_OBRA).trabalhador;
  afirmar(typeof civil === 'string', 'a pedreira precisa declarar `trabalhador` no dado');

  // ---- 1. a rua ------------------------------------------------------------
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const { gy, de, ate } of arrastosDaRua(rua)) {
    await centrarEm(Math.floor((de + ate) / 2));
    await arrastarDentroDoCanvas(page, canvas, [await pontoDoTile(de, gy), await pontoDoTile(ate, gy)]);
    await avancar(1);
    await esperarFrame();
  }
  const desenhada = await estado();
  afirmar(
    desenhada.estradasPlanejadasRenderizadas === tilesDaRua && desenhada.estradasRenderizadas === 0,
    `o arrasto deveria DESENHAR ${tilesDaRua} tiles e erguer 0, veio `
      + `${desenhada.estradasPlanejadasRenderizadas} e ${desenhada.estradasRenderizadas}`,
  );
  // os cinco estagios so aparecem se o material chegar, e material so anda por rua DE PE:
  // desde a F18d-1b quem ergue o tile e o laborer, e isso custa ticks
  await erguerRua(ctx, { tiles: tilesDaRua });
  const comRua = await estado();
  afirmar(
    comRua.estradasRenderizadas === tilesDaRua && comRua.estradasPlanejadasRenderizadas === 0,
    `a rua deveria estar DE PE com ${tilesDaRua} tiles, veio ${comRua.estradasRenderizadas} de pe e ${comRua.estradasPlanejadasRenderizadas} no canteiro`,
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 1b. ENQUADRAMENTO: o footprint INTEIRO cabe no canvas? --------------
  // Medido com a camera ja parada na obra, que e o quadro de todas as fotos.
  await centrarEm(meioDaObra.gx);
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
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 6. a escola treina o cabra, e a pedreira PRODUZ -----------------------
  // O clique de painel que roda despausado e segurando 150 ms (§8).
  await centrarEm(meioDaEscola.gx);
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  // UI-barra-a: o engajar rola no corpo da barra; o aperto cru nao rola sozinho.
  const botao = await pontoParaApertar(page, `#painel-predio [data-treinar="${civil}"]`);
  await page.keyboard.press('p');
  afirmar(!(await estado()).pausado, 'o clique do treino precisa do relogio correndo');
  await page.mouse.move(botao.x, botao.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado, 'o roteiro deveria ter pausado de volta');
  await page.keyboard.press('Escape');
  await esperarFrame();
  const ID_OBRA = achado[0];
  let s = await estado();
  for (let t = 0; s.prediosDoEstado[ID_OBRA]?.ocupante == null && t < TETO_ATE_OCUPAR; t += PASSO_DE_AVANCO) {
    await avancar(PASSO_DE_AVANCO);
    await esperarFrame();
    s = await estado();
  }
  afirmar(s.prediosDoEstado[ID_OBRA]?.ocupante != null, `em ${TETO_ATE_OCUPAR} ticks o cabra treinado deveria ter ocupado a pedreira, veio ${JSON.stringify(s.prediosDoEstado[ID_OBRA])}`);
  await centrarEm(meioDaObra.gx);
  await esperarPedraNaSaida(ctx, ID_OBRA);
  await capturar('produzindo');
}

module.exports = { roteiro };
