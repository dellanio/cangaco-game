'use strict';
// Roteiro da F17 — O ACEITE DA FASE A NA TELA.
//
// A mesma abertura que `tests/F17-aceite.test.ts` roda headless, aqui feita com
// o mouse: arrastar a rua, plantar as quatro casas, enfileirar os quatro cabras
// na escola, esperar a vila trabalhar. Nenhum atalho — nao existe ponte para
// injetar predio, unidade ou estoque, e e de proposito: se a cadeia quebrar em
// qualquer elo, este roteiro reprova.
//
// O que ele prova que o teste headless NAO prova:
//  - o DESBLOQUEIO aparece no menu Build. A serraria nao esta la no comeco; ela
//    nasce no menu quando a primeira casa de lenhador fica pronta, e o roteiro
//    afirma as duas coisas (ausente antes, presente depois) antes de clicar.
//  - o HUD mostra o timber subindo acima do inicial — o mesmo numero do criterio,
//    lido de onde o jogador le.
//
// LIGADOS POR ESTRADA nao vira campo novo de depuracao: a ligacao se prova por
// CONSEQUENCIA, que e mais forte que um booleano — material so chega a obra com
// rede, e cabra treinado so ocupa predio que recebeu material. Os quatro ficarem
// completos e ocupados JA e a prova. O booleano esta afirmado no headless, onde
// `predioLigadoAoArmazem` e importavel.
//
// A gaveta `saida` de predio de producao nao e afirmada em lugar nenhum: ela fica
// vazia quase sempre (nota da F16b no item da F17). Estoque se prova no ARMAZEM.
//
// A vila tem 21 tiles de largura e o canvas mostra ~15: `centrarEm` anda a camera
// com o botao do meio antes de cada clique, como o jogador faria.
const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** A abertura do GDD §1.3, na ordem em que entra na fila. Mesma lista do
 *  headless (`tests/helpers/abertura.ts`), que e a que o criterio nomeia. */
const TIPOS_DA_ABERTURA = ['woodcutters', 'woodcutters', 'quarry', 'sawmill'];

// Medido na sonda desta sessao (docs/planos/F17-aceite.md §8): a serraria
// desbloqueia no tick 504 e o criterio fecha no 3184. Os tetos abaixo sao esses
// numeros com folga — o roteiro PARA no marco, nao no teto.
const TETO_ATE_DESBLOQUEAR = 900;
const TETO_ATE_O_CRITERIO = 4200;
const PASSO_DE_AVANCO = 50; // um avancar seco e grande estoura o frame (F16b)

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const margem = TILE_PX; // nunca clicar colado na borda do canvas

  const pontoDoTile = (gx, gy, camera) => ({
    x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
    y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
  });

  /**
   * Anda a camera ate (gx,gy) ficar no meio do canvas, arrastando com o botao do
   * meio — o mesmo gesto da F04. Em passos limitados ao canvas: um mousemove que
   * sai dele nao chega ao Phaser (achado da F06). A camera tem limites, entao o
   * alvo pode nao chegar ao centro; por isso o laco para quando PARA de mover.
   */
  async function centrarEm(gx, gy) {
    const centroX = (canvas.left + canvas.right) / 2;
    const centroY = (canvas.top + canvas.bottom) / 2;
    const maxPasso = Math.min(canvas.width, canvas.height) / 2 - margem;
    for (let tentativa = 0; tentativa < 10; tentativa += 1) {
      const { camera } = await estado();
      const alvo = pontoDoTile(gx, gy, camera);
      const faltaX = alvo.x - centroX;
      const faltaY = alvo.y - centroY;
      if (Math.abs(faltaX) < TILE_PX / 2 && Math.abs(faltaY) < TILE_PX / 2) return;
      const dx = Math.max(-maxPasso, Math.min(maxPasso, -faltaX));
      const dy = Math.max(-maxPasso, Math.min(maxPasso, -faltaY));
      await page.mouse.move(centroX, centroY);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(centroX + dx, centroY + dy, { steps: 8 });
      await page.mouse.up({ button: 'middle' });
      await esperarFrame();
      const depois = await estado();
      if (depois.camera.scrollX === camera.scrollX && depois.camera.scrollY === camera.scrollY) {
        return; // bateu no limite do mapa: daqui nao anda mais
      }
    }
  }

  /** Traz o tile para a tela e devolve o ponto de PAGINA dele, ja conferido. */
  async function pontoVisivel(gx, gy) {
    await centrarEm(gx, gy);
    const { camera } = await estado();
    const p = pontoDoTile(gx, gy, camera);
    afirmar(
      p.x > canvas.left + margem && p.x < canvas.right - margem
        && p.y > canvas.top + margem && p.y < canvas.bottom - margem,
      `o tile (${gx},${gy}) deveria estar visivel depois de andar a camera, caiu em (${p.x},${p.y})`,
    );
    return p;
  }

  async function clicarNoTile(gx, gy) {
    const p = await pontoVisivel(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  const prediosDoEstado = async () => (await estado()).prediosDoEstado;

  /** O predio cujo CANTO e este tile, ou null. O id nao e previsivel: a obra que
   *  acabou de nascer recebe o proximo numero livre. */
  async function predioNoCanto(gx, gy) {
    const todos = await prediosDoEstado();
    const achado = Object.entries(todos).find(([, p]) => p.gx === gx && p.gy === gy);
    return achado === undefined ? null : { id: achado[0], ...achado[1] };
  }

  /**
   * O item esta LIBERADO no menu? Presenca nao serve: o menu Build mostra o
   * predio bloqueado tambem, com `aria-disabled` e o texto do requisito (decisao
   * da F06 — esconder faria o jogador nao saber que a serraria existe). Quem
   * muda com o desbloqueio e o atributo, e e nele que a assercao tem de bater.
   */
  async function liberadoNoMenu(tipo) {
    const item = await page.$(`[data-predio="${tipo}"]`);
    afirmar(item !== null, `o menu Build deveria listar ${tipo}, bloqueado ou nao`);
    return (await item.getAttribute('aria-disabled')) !== 'true';
  }
  const noHud = async (campo) => Number(await page.textContent(`#hud [data-campo="${campo}"]`));

  // ---- geometria, derivada do dado -----------------------------------------
  // A MESMA de `tests/helpers/abertura.ts`: uma fila encostada na linha de porta
  // do armazem, a serraria por ultimo (perto do armazem, que e a perna de maior
  // trafego), e uma rua reta so que serve as quatro, o armazem e a escola.
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const altAr = defDe('storehouse').tamanho[1];
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  const alturas = [...new Set(TIPOS_DA_ABERTURA.map((t) => defDe(t).tamanho[1]))];
  afirmar(alturas.length === 1, `a fila unica exige altura igual nos quatro, veio ${JSON.stringify(alturas)}`);
  const larguraTotal = TIPOS_DA_ABERTURA.reduce((s, t) => s + defDe(t).tamanho[0], 0);
  let x = armazem.gx - larguraTotal;
  const plantas = TIPOS_DA_ABERTURA.map((tipo) => {
    const planta = { tipo, gx: x, gy: yRua - alturas[0], civil: defDe(tipo).trabalhador };
    x += defDe(tipo).tamanho[0];
    return planta;
  });
  // A rua tem que alcancar a porta da ESCOLA: sem ela o ouro do treino nao chega,
  // a fila fica em `sem-estrada` para sempre (F13b) e ninguem ocupa nada. Medido
  // na sonda desta sessao — foi assim que a primeira corrida reprovou.
  const ruaDe = plantas[0].gx;
  const ruaAte = escola.gx;
  const tilesDaRua = ruaAte - ruaDe + 1;
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  const timberInicial = economia.estadoInicial.estoque.timber;

  // ---- 1. a vila como ela comeca -------------------------------------------
  afirmar(await page.isHidden('#painel-predio'), 'o painel deveria nascer fechado');
  afirmar(
    (await noHud('timber')) === timberInicial,
    `o HUD deveria abrir com ${timberInicial} de timber, veio ${await noHud('timber')}`,
  );
  afirmar(
    await liberadoNoMenu('woodcutters'),
    'a casa de lenhador deveria estar no menu desde o inicio: e a raiz da cadeia',
  );
  // GUARDA DO DESBLOQUEIO: a serraria depende de um Woodcutter completo, entao
  // ela NAO pode estar no menu agora. Afirmar so a presenca depois nao provaria
  // desbloqueio nenhum — provaria que o menu tem a serraria, o que seria verdade
  // tambem se ela estivesse la desde sempre.
  afirmar(
    !(await liberadoNoMenu('sawmill')),
    'a serraria deveria estar BLOQUEADA no menu antes de existir um Woodcutter completo',
  );
  await capturar('vila-inicial');

  // ---- 2. a rua ------------------------------------------------------------
  // Em dois arrastos porque 19 tiles nao cabem no canvas de uma vez. Sao dois
  // comandos PlaceRoad com um tile em comum — a rede e uma so.
  const meio = Math.floor((ruaDe + ruaAte) / 2);
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const [de, ate] of [[ruaDe, meio], [meio, ruaAte]]) {
    await centrarEm(Math.floor((de + ate) / 2), yRua);
    const { camera } = await estado();
    await arrastarDentroDoCanvas(page, canvas, [
      pontoDoTile(de, yRua, camera), pontoDoTile(ate, yRua, camera),
    ]);
    await avancar(1);
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar(
    (await estado()).estradasRenderizadas === tilesDaRua,
    `a rua deveria ter ${tilesDaRua} tiles, veio ${(await estado()).estradasRenderizadas}`,
  );

  // ---- 3. as tres casas que ja da para plantar ------------------------------
  for (const planta of plantas.filter((p) => p.tipo !== 'sawmill')) {
    await page.click(`[data-predio="${planta.tipo}"]`);
    await esperarFrame();
    await clicarNoTile(planta.gx, planta.gy);
    await avancar(1);
    await page.keyboard.press('Escape'); // larga a planta fantasma
    await esperarFrame();
    const posta = await predioNoCanto(planta.gx, planta.gy);
    afirmar(
      posta !== null && posta.tipo === planta.tipo && posta.estado === 'obra',
      `o clique deveria ter posto uma obra de ${planta.tipo} em (${planta.gx},${planta.gy}), `
        + `veio ${JSON.stringify(posta)}`,
    );
  }
  await capturar('tres-obras');

  // ---- 4. a escola enfileira os quatro cabras -------------------------------
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  for (const planta of plantas) {
    const temBotao = (await page.$$(`#painel-predio [data-treinar="${planta.civil}"]`)).length > 0;
    afirmar(temBotao, `a escola deveria oferecer ${planta.civil} na fila de treino`);
    await page.click(`#painel-predio [data-treinar="${planta.civil}"]`);
    await esperarFrame();
  }
  await avancar(1);
  await esperarFrame();
  const fila = Object.values((await estado()).filaDeTreino).flat();
  afirmar(
    fila.length === plantas.length,
    `os quatro pedidos deveriam estar na fila da escola, veio ${JSON.stringify(fila)}`,
  );
  await capturar('fila-da-escola');
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 5. a vila trabalha ate a serraria DESBLOQUEAR ------------------------
  let ticks = 0;
  while (ticks < TETO_ATE_DESBLOQUEAR && !(await liberadoNoMenu('sawmill'))) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
  }
  afirmar(
    await liberadoNoMenu('sawmill'),
    `a serraria deveria ter liberado no menu em ate ${TETO_ATE_DESBLOQUEAR} ticks, `
      + 'depois do primeiro Woodcutter ficar pronto',
  );
  const lenhadorPronto = Object.values(await prediosDoEstado())
    .filter((p) => p.tipo === 'woodcutters' && p.estado === 'completo');
  afirmar(
    lenhadorPronto.length > 0,
    'o menu so pode ter liberado a serraria porque um Woodcutter ficou COMPLETO no estado',
  );
  await capturar('serraria-desbloqueada');

  // ---- 6. a serraria -------------------------------------------------------
  const serraria = plantas[plantas.length - 1];
  await page.click(`[data-predio="${serraria.tipo}"]`);
  await esperarFrame();
  await clicarNoTile(serraria.gx, serraria.gy);
  await avancar(1);
  await page.keyboard.press('Escape');
  await esperarFrame();
  const postaSerraria = await predioNoCanto(serraria.gx, serraria.gy);
  afirmar(
    postaSerraria !== null && postaSerraria.tipo === 'sawmill',
    `a serraria deveria ter sido posta em (${serraria.gx},${serraria.gy}), veio ${JSON.stringify(postaSerraria)}`,
  );

  // ---- 7. ACEITE: os quatro completos e ocupados, e o timber acima do inicial
  const daAberturaAgora = async () => {
    const todos = await prediosDoEstado();
    return plantas.map((p) => Object.values(todos).find((b) => b.gx === p.gx && b.gy === p.gy));
  };
  const criterioFechado = async () => {
    const quatro = await daAberturaAgora();
    const prontos = quatro.every((b) => b !== undefined && b.estado === 'completo' && b.ocupante !== null);
    return prontos && (await noHud('timber')) > timberInicial;
  };
  while (ticks < TETO_ATE_O_CRITERIO && !(await criterioFechado())) {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
  }
  await esperarFrame();

  const daAbertura = await daAberturaAgora();
  daAbertura.forEach((b, i) => {
    afirmar(
      b !== undefined && b.tipo === plantas[i].tipo,
      `deveria haver um ${plantas[i].tipo} em (${plantas[i].gx},${plantas[i].gy}), veio ${JSON.stringify(b)}`,
    );
    afirmar(
      b.estado === 'completo',
      `em ${ticks} ticks o ${b.tipo} de (${b.gx},${b.gy}) deveria estar completo, veio ${b.estado}`,
    );
    afirmar(
      b.ocupante !== null,
      `em ${ticks} ticks o ${b.tipo} de (${b.gx},${b.gy}) deveria estar ocupado, veio vago`,
    );
  });
  const porTipo = {};
  for (const b of daAbertura) porTipo[b.tipo] = (porTipo[b.tipo] ?? 0) + 1;
  afirmar(
    JSON.stringify(porTipo) === JSON.stringify({ woodcutters: 2, quarry: 1, sawmill: 1 }),
    `o criterio pede 2 Woodcutters, 1 Quarry e 1 Sawmill, veio ${JSON.stringify(porTipo)}`,
  );
  const timberFinal = await noHud('timber');
  afirmar(
    timberFinal > timberInicial,
    `o HUD deveria mostrar timber acima dos ${timberInicial} iniciais em ate `
      + `${TETO_ATE_O_CRITERIO} ticks, veio ${timberFinal}`,
  );
  afirmar(
    (await estado()).estradasRenderizadas === tilesDaRua,
    'a rua que liga tudo deveria continuar inteira no fim',
  );

  // A foto do aceite: a fila das quatro casas de pe, com a rua na frente delas.
  // Centrada no meio da fila — a vila tem 21 tiles e o canvas mostra ~15.
  await centrarEm(Math.floor((plantas[0].gx + armazem.gx) / 2), yRua - 1);
  await esperarFrame();
  await capturar('final');

  // o painel de uma delas, para a foto mostrar tambem QUEM esta la dentro
  await clicarNoTile(serraria.gx + 1, serraria.gy);
  afirmar(
    (await page.textContent('#painel-predio h2')) === tema.predios.sawmill.nome,
    'o painel deveria abrir na serraria, pelo nome do sertao',
  );
  await capturar('serraria-ocupada');
}

module.exports = { roteiro };
