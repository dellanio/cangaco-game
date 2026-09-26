'use strict';
// Roteiro da F17g — A OBRA REVELADA PELO HP: MADEIRA E PEDRA.
//
// So o armazem tem o PAR no manifesto (`madeira` + `completo`), e o armazem so
// libera depois de uma serraria completa, que so libera depois de um lenhador
// completo. Nao ha ponte para injetar obra (de proposito), entao este roteiro
// faz a abertura da F17 com o mouse ate a serraria ficar de pe, estica a rua
// tres tiles para leste e planta o armazem com a porta nela.
//
// Tres fotos: meia madeira, a virada (madeira inteira) e meia pedra. Em cada
// uma, a fracao que a CENA publicou (`revelacaoDasObras`, a mesma que foi para
// o recorte) e comparada com a conta refeita AQUI, do `hp` cru e do custo de
// `data/buildings.json` — uma segunda implementacao de proposito: o oraculo nao
// pode ser o proprio codigo sob teste. Comparacao por produto cruzado, sem float.
//
// Sonda headless da sessao (2026-09-26, apagada): a serraria completa no tick
// 2046 e o armazem, plantado ali, cruza meia madeira no 2347, a virada no 2422,
// meia pedra no 2685 e completa no 3148. Os tetos abaixo sao esses numeros com
// folga; o roteiro PARA no marco, nao no teto.
const { retanguloDoCanvas, arrastarDentroDoCanvas, pontoParaApertar } = require('./_canvas');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');
const { bloqueiaConstrucao, temRecurso, arrastosDaRede } = require('./_recursos');
const terreno = require('../../data/terrain.json');
const producao = require('../../data/production.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

const TETO_ATE_A_SERRARIA = 3500;
const TETO_DA_OBRA = 2000;
const PASSO_DE_AVANCO = 50; // um avancar seco e grande estoura o frame (F16b)
const PASSO_NA_OBRA = 10; // perto dos marcos: a virada dura poucos passos de 50

/** A revelacao refeita do dado: {madeira:[n,d], pedra:[n,d]} (oraculo do roteiro). */
function revelacaoEsperada(hp, def) {
  const { hp: total, timber, stone } = def;
  if (hp <= 0) return { madeira: [0, 1], pedra: [0, 1] };
  if (hp >= total) return { madeira: [1, 1], pedra: [1, 1] };
  const virada = total * timber / (timber + stone);
  if (hp <= virada) return { madeira: [hp, virada], pedra: [0, 1] };
  return { madeira: [1, 1], pedra: [hp - virada, total - virada] };
}
const mesmaFracao = ([a, b], [c, d]) => Math.abs(a * d - c * b) <= 1e-9 * Math.abs(b * d);
const aoMenos = ([a, b], [c, d]) => a * d >= c * b;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const margem = TILE_PX;

  const pontoDoTile = (gx, gy, camera) => ({
    x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
    y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
  });

  /** O mesmo `centrarEm` da F17: arrasto com o botao do meio, em passos no canvas. */
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
      if (depois.camera.scrollX === camera.scrollX && depois.camera.scrollY === camera.scrollY) return;
    }
  }

  async function clicarNoTile(gx, gy) {
    await centrarEm(gx, gy);
    const { camera } = await estado();
    const p = pontoDoTile(gx, gy, camera);
    afirmar(
      p.x > canvas.left + margem && p.x < canvas.right - margem
        && p.y > canvas.top + margem && p.y < canvas.bottom - margem,
      `o tile (${gx},${gy}) deveria estar visivel depois de andar a camera, caiu em (${p.x},${p.y})`,
    );
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  async function arrastarRua(trechos) {
    await page.click('[data-ferramenta="estrada"]');
    await esperarFrame();
    for (const { de, ate } of trechos) {
      await centrarEm(Math.floor((de.gx + ate.gx) / 2), Math.floor((de.gy + ate.gy) / 2));
      const { camera } = await estado();
      await arrastarDentroDoCanvas(page, canvas, [
        pontoDoTile(de.gx, de.gy, camera), pontoDoTile(ate.gx, ate.gy, camera),
      ]);
      await avancar(1);
      await esperarFrame();
    }
    await page.keyboard.press('Escape');
    await esperarFrame();
  }

  async function predioNoCanto(gx, gy) {
    const todos = (await estado()).prediosDoEstado;
    const achado = Object.entries(todos).find(([, p]) => p.gx === gx && p.gy === gy);
    return achado === undefined ? null : { id: achado[0], ...achado[1] };
  }

  async function plantar(tipo, gx, gy) {
    await page.click(`[data-predio="${tipo}"]`);
    await esperarFrame();
    await clicarNoTile(gx, gy);
    await avancar(1);
    await page.keyboard.press('Escape');
    await esperarFrame();
    const posta = await predioNoCanto(gx, gy);
    afirmar(
      posta !== null && posta.tipo === tipo && posta.estado === 'obra',
      `o clique deveria ter posto uma obra de ${tipo} em (${gx},${gy}), veio ${JSON.stringify(posta)}`,
    );
    return posta;
  }

  async function liberadoNoMenu(tipo) {
    const item = await page.$(`[data-predio="${tipo}"]`);
    afirmar(item !== null, `o menu Build deveria listar ${tipo}, bloqueado ou nao`);
    return (await item.getAttribute('aria-disabled')) !== 'true';
  }

  // ---- geometria da abertura, a MESMA da F17 e do headless -----------------
  const { geometriaDaAbertura } = await import('../geometria-da-abertura.mjs');
  const escola = noDado('schoolhouse');
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const tamanhoDe = (tipo) => {
    const [largura, altura] = defDe(tipo).tamanho;
    return { largura, altura };
  };
  const caixaDe = (id) => ({ gx: noDado(id).gx, gy: noDado(id).gy, ...tamanhoDe(id) });
  const colheitaDoLenhador = producao.predios.woodcutters.colheita;
  const geo = geometriaDaAbertura({
    armazem: caixaDe('storehouse'),
    escola: caixaDe('schoolhouse'),
    tamanhoDe,
    bloqueia: bloqueiaConstrucao,
    temArvore: (gx, gy) => temRecurso(colheitaDoLenhador.recurso, gx, gy),
    alcanceDaMata: colheitaDoLenhador.alcance_tiles,
    stoneDe: (tipo) => defDe(tipo).stone,
    estoqueInicialDeStone: economia.estadoInicial.estoque.stone,
    custoStonePorTile: terreno.estrada.custoStonePorTile,
  });
  const plantas = geo.plantas.map((p) => ({ ...p, civil: defDe(p.tipo).trabalhador }));
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  // O armazem novo: porta (borda sul, a linha abaixo do footprint) na rua esticada
  // tres tiles para leste do fim do trecho principal. Medido na sonda: e o
  // primeiro lugar livre com porta na rede sem mexer na abertura.
  const fimDaRua = Math.max(...geo.rua.filter((t) => t.gy === geo.yRua).map((t) => t.gx));
  const [, altArm] = defDe('storehouse').tamanho;
  const novoArmazem = { gx: fimDaRua + 3, gy: geo.yRua - altArm };

  // ---- 1. a abertura da F17 ate a serraria ficar de pe ----------------------
  afirmar(!(await liberadoNoMenu('storehouse')), 'o armazem deveria nascer BLOQUEADO: depende da serraria');
  await arrastarRua(arrastosDaRede(geo.rua));
  for (const planta of plantas.filter((p) => p.tipo !== 'sawmill')) {
    await plantar(planta.tipo, planta.gx, planta.gy);
  }
  // a escola: o primeiro pedido com o laco ANDANDO e a mao segurando (§8)
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o pedido de treino so vale com o laco ANDANDO');
  // UI-barra-a: o engajar rola no corpo da barra; o aperto cru nao rola sozinho.
  const botao = await pontoParaApertar(page, `#painel-predio [data-treinar="${plantas[0].civil}"]`);
  await page.mouse.move(botao.x, botao.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro segue pausado depois do passo despausado');
  for (const planta of plantas.slice(1)) {
    await page.click(`#painel-predio [data-treinar="${planta.civil}"]`);
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await esperarFrame();

  let ticks = 0;
  const serraria = plantas.find((p) => p.tipo === 'sawmill');
  let serrariaPlantada = false;
  while (ticks < TETO_ATE_A_SERRARIA && !(await liberadoNoMenu('storehouse'))) {
    if (!serrariaPlantada && (await liberadoNoMenu('sawmill'))) {
      await plantar(serraria.tipo, serraria.gx, serraria.gy);
      serrariaPlantada = true;
    }
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
  }
  afirmar(
    await liberadoNoMenu('storehouse'),
    `o armazem deveria ter liberado em ate ${TETO_ATE_A_SERRARIA} ticks, com a serraria completa`,
  );

  // ---- 2. a rua esticada e o armazem ----------------------------------------
  await arrastarRua([{ de: { gx: fimDaRua + 1, gy: geo.yRua }, ate: { gx: fimDaRua + 3, gy: geo.yRua } }]);
  const obra = await plantar('storehouse', novoArmazem.gx, novoArmazem.gy);
  const def = defDe('storehouse');

  /** Le a obra e confere a cena contra o oraculo. Devolve a revelacao lida. */
  async function conferir(marco) {
    const s = await estado();
    const p = s.prediosDoEstado[obra.id];
    afirmar(p !== undefined && p.estado === 'obra', `${marco}: o armazem deveria seguir em obra, veio ${JSON.stringify(p)}`);
    const naTela = s.revelacaoDasObras[obra.id];
    afirmar(naTela !== undefined, `${marco}: a obra com o par deveria estar em revelacaoDasObras`);
    const esperada = revelacaoEsperada(p.hp, def);
    afirmar(
      mesmaFracao(naTela.madeira, esperada.madeira) && mesmaFracao(naTela.pedra, esperada.pedra),
      `${marco}: hp ${p.hp}, a tela revelou ${JSON.stringify(naTela)}, a conta do dado da ${JSON.stringify(esperada)}`,
    );
    afirmar(
      Object.values(s.estagiosDeObraRenderizados).reduce((a, n) => a + n, 0) === Object.keys(s.prediosDoEstado).length - 1,
      `${marco}: a obra revelada nao pode contar nos seis estagios do fallback`,
    );
    afirmar(
      s.spritesDePredio[obra.id] !== null,
      `${marco}: a obra revelada deveria estar desenhada por sprite, nao por retangulo`,
    );
    return { hp: p.hp, ...naTela };
  }

  const marcos = [
    { nome: 'meia-madeira', vale: (r) => aoMenos(r.madeira, [1, 2]) },
    { nome: 'virada', vale: (r) => aoMenos(r.madeira, [1, 1]) },
    { nome: 'meia-pedra', vale: (r) => aoMenos(r.pedra, [1, 2]) },
  ];
  const lidos = [];
  let naObra = 0;
  for (const marco of marcos) {
    let r = await conferir(marco.nome);
    while (!marco.vale(r) && naObra < TETO_DA_OBRA) {
      await avancar(PASSO_NA_OBRA);
      naObra += PASSO_NA_OBRA;
      await esperarFrame();
      r = await conferir(marco.nome);
    }
    afirmar(marco.vale(r), `o marco ${marco.nome} nao chegou em ${TETO_DA_OBRA} ticks de obra, veio ${JSON.stringify(r)}`);
    if (marco.nome === 'meia-madeira') {
      afirmar(r.pedra[0] === 0, `na meia madeira a pedra ainda nao pode ter aparecido, veio ${JSON.stringify(r)}`);
    }
    lidos.push({ marco: marco.nome, tick: ticks + naObra, ...r });
    await centrarEm(novoArmazem.gx + 1, novoArmazem.gy + 1);
    await esperarFrame();
    await capturar(marco.nome);
  }
  // monotonia do que foi lido: nada desce entre as tres fotos
  for (let i = 1; i < lidos.length; i += 1) {
    afirmar(
      aoMenos(lidos[i].madeira, lidos[i - 1].madeira) && aoMenos(lidos[i].pedra, lidos[i - 1].pedra),
      `a revelacao desceu entre ${lidos[i - 1].marco} e ${lidos[i].marco}: ${JSON.stringify(lidos)}`,
    );
  }
  console.log(`F17g — marcos lidos: ${JSON.stringify(lidos)}`);
}

module.exports = { roteiro };
