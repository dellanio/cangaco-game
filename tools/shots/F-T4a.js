'use strict';

// Roteiro da F-T4a — O PESCADOR NA MARGEM, E O ACUDE BAIXANDO.
//
// O teste headless (`tests/F-T4-pescador.test.ts`) prova o ciclo na simulacao.
// O que so a tela prova e o que a F-T3 abriu e a F-T4a estreita: a unidade que a
// simulacao poe no campo e DESENHADA no campo — e, aqui, num campo que ela nunca
// pode pisar.
//
// Sao tres afirmacoes que nenhum teste de sim alcanca:
//
//   1. no tick em que ele PESCA, o tile desenhado esta fora do footprint da
//      cabana, em chao pisavel, e encostado num tile de cardume;
//   2. todo cardume encostado nele e AGUA — o peixe e o primeiro recurso que o
//      oficio nao alcanca por dentro, e a margem nao e detalhe de caminho, e a
//      unica posicao de trabalho que existe;
//   3. com ele fora, o painel continua dizendo quem trabalha ali, pelo nome do
//      sertao. "Ocupado, mas fora" tem de valer na tela, ou o jogador le abandono
//      onde ha trabalho.
//
// E a quarta, que fecha o ciclo: depois de uma volta a linha "quanto resta ao
// alcance" (F-TA) BAIXOU, com a contagem de tiles intacta — um ciclo tira peixe
// do acude, nao o acude inteiro.
//
// Tambem se prova aqui a arvore de desbloqueio na tela: a Casa do Pescador NAO
// esta no menu na abertura, e so aparece depois que a casa do lenhador e a
// serraria ficam de pe (`desbloqueadoPor` em cadeia).
//
// Geometria nunca digitada: a cabana sai do MESMO cardume que a sim le, recuando
// pelo que o chao e o recurso permitem; a rua sai de `_recursos`/`_estradas`.
// Numero esperado sai dos mesmos JSON que a sim le.
//
// O passo do aceite roda DESPAUSADO, com aperto de 150 ms (CLAUDE.md §8): este
// roteiro clica em `#menu-build` e em `#painel-predio`, e clique instantaneo em
// painel que se redesenha a cada tick passa mesmo quando o evento nunca chega
// (BUG-B).

const { retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { caixaLivre, ruaComDesvio, arrastosDaRua } = require('./_recursos');
const { erguerRua } = require('./_estradas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');
const producao = require('../../data/production.json');
const recursos = require('../../data/resources.json');
const mapa = require('../../data/maps/sertao-128.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Tetos de ESPERA, nao afirmacoes de desempenho (CLAUDE.md §8): existem para o
 *  roteiro falhar dizendo o tick em que travou, em vez de pendurar. */
const TETO_ATE_COMPLETAR = 900;
const TETO_ATE_OCUPAR = 600;
const TETO_ATE_PESCAR = 400;
const TETO_ATE_VOLTAR = 600;
const PASSO_DE_AVANCO = 10;
/** A saida e a volta se amostram fino: `colhendo` e `voltando` duram poucos
 *  ticks, e o roteiro precisa VER a passagem, nao so o resultado dela. */
const PASSO_FINO = 2;

// ---- o chao, lido do mesmo mapa que a sim le ------------------------------
// A regra de "onde nao se pisa" nao e repetida aqui: e a lista de
// `terrain.json`, aplicada ao caractere do mapa pela legenda dele. Virar um tipo
// de terreno no JSON muda o roteiro junto com a simulacao.
const INTRANSPONIVEL = new Set(terreno.intransponivel);
const terrenoDe = (gx, gy) => mapa.legenda[mapa.linhas[gy][gx]];
const pisavel = (gx, gy) => !INTRANSPONIVEL.has(terrenoDe(gx, gy));

/** Os tiles que os predios da abertura ja ocupam. */
const OCUPADO = new Set(economia.estadoInicial.predios.flatMap((p) => {
  const [larg, alt] = defDe(p.id).tamanho;
  const celulas = [];
  for (let gy = p.gy; gy < p.gy + alt; gy += 1) {
    for (let gx = p.gx; gx < p.gx + larg; gx += 1) celulas.push(`${gx},${gy}`);
  }
  return celulas;
}));
const ocupado = (gx, gy) => OCUPADO.has(`${gx},${gy}`);

/** Chao pisavel, livre de predio e de recurso que bloqueia obra (BUG-F). */
const livreParaObra = (gx, gy) => pisavel(gx, gy) && !ocupado(gx, gy) && caixaLivre(gx, gy, 1, 1);

/**
 * Este retangulo aceita uma planta, e a porta dele tem saida?
 * E a leitura, em dado, das mesmas recusas de `sim/placement.ts`: terreno,
 * recurso, sobreposicao e porta-sem-saida. A rua ainda nao existe quando isto
 * roda, entao o motivo `estrada` nao entra.
 */
function podeErguer(gx0, gy0, largura, altura) {
  for (let gy = gy0; gy < gy0 + altura; gy += 1) {
    for (let gx = gx0; gx < gx0 + largura; gx += 1) {
      if (!livreParaObra(gx, gy)) return false;
    }
  }
  for (let gx = gx0; gx < gx0 + largura; gx += 1) {
    if (!pisavel(gx, gy0 + altura) || ocupado(gx, gy0 + altura)) return false;
  }
  return true;
}

const chebyshev = (a, b) => Math.max(Math.abs(a.gx - b.gx), Math.abs(a.gy - b.gy));

/** As manchas 8-conectadas de um tipo de recurso, do maior para o menor. */
function manchasDe(tipo) {
  const tiles = (mapa.recursos[tipo] ?? []).map(([gx, gy]) => ({ gx, gy }));
  const restantes = new Map(tiles.map((t) => [`${t.gx},${t.gy}`, t]));
  const manchas = [];
  for (const semente of tiles) {
    const chave = `${semente.gx},${semente.gy}`;
    if (!restantes.has(chave)) continue;
    const pilha = [semente];
    restantes.delete(chave);
    const mancha = [];
    while (pilha.length > 0) {
      const t = pilha.pop();
      mancha.push(t);
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const k = `${t.gx + dx},${t.gy + dy}`;
          const v = restantes.get(k);
          if (v !== undefined) { restantes.delete(k); pilha.push(v); }
        }
      }
    }
    manchas.push(mancha);
  }
  return manchas;
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200); // __cangaco sai no POST_RENDER
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    const x = canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  /**
   * Anda a camera com as setas ate a coluna (ou a linha) cair no meio do quadro.
   *
   * O molde vem do F-T3, com o eixo Y que aquele roteiro nao precisava: a
   * pedreira trabalhava na mesma faixa de linhas da vila, e a cabana nao. O
   * pescador sobe para a margem NORTE do acude quando e de la que vem o tile
   * escolhido, e um quadro que nao o contem prova a afirmacao no debug e mostra
   * chao vazio ao jogador — o contrario do que a §8 pede da captura.
   */
  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.right - canvas.left : canvas.bottom - canvas.top;
    const alvo = Math.max(0, alvoEmTiles * TILE_PX - vao / 2);
    const teclas = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 30; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      const tecla = delta > 0 ? teclas[0] : teclas[1];
      await page.keyboard.down(tecla);
      await page.waitForTimeout(120);
      await page.keyboard.up(tecla);
      await esperarFrame();
    }
  }

  const centrarEm = (gx) => centrarNoEixo(gx, 'x');

  /** Enquadra os dois tiles: a captura tem de conter os dois lados da afirmacao. */
  async function enquadrar(a, b) {
    await centrarNoEixo((a.gx + b.gx) / 2, 'x');
    await centrarNoEixo((a.gy + b.gy) / 2, 'y');
  }

  const predioDoEstado = async (id) => (await estado()).prediosDoEstado[id] ?? null;
  const idAberto = () => page.getAttribute('#painel-predio', 'data-predio-aberto');
  const temNoPainel = async (seletor) => (await page.$$(`#painel-predio ${seletor}`)).length > 0;
  /**
   * O botao do tipo esta LIBERADO no menu?
   *
   * Nao e "existe o botao": desde a F12 o item bloqueado continua na lista, com
   * `aria-disabled` e a linha do requisito, justamente para o jogador ver o que
   * falta. Quem responde pela arvore e o atributo, e e ele que este roteiro le.
   */
  async function liberadoNoMenu(tipo) {
    const botao = await page.$(`[data-predio="${tipo}"]`);
    afirmar(botao !== null, `o menu deveria listar '${tipo}', bloqueado ou nao`);
    return (await botao.getAttribute('aria-disabled')) === 'false';
  }

  /** A linha do alcance como o jogador ve (F-TA): numero em `data-`, nunca texto recortado. */
  async function linhaDoAlcance() {
    const n = await page.$('#painel-predio [data-colheita]');
    if (n === null) return null;
    return n.evaluate((el) => ({
      recurso: el.dataset.colheita,
      tiles: Number(el.dataset.tiles),
      unidades: Number(el.dataset.unidades),
    }));
  }

  /** O que a CAMADA desenhou desta unidade neste quadro, ou null. */
  async function desenhada(id) {
    return (await estado()).unidadesRenderizadas.find((u) => u.id === id) ?? null;
  }

  /**
   * Avanca em blocos ate a condicao valer, com o jogo pausado. Devolve os ticks
   * gastos; reprova com o tick e o ultimo estado lido quando o teto estoura —
   * que e o que distingue lentidao de travamento.
   */
  async function esperarAte(condicao, teto, oQue, bloco = PASSO_DE_AVANCO) {
    let gastos = 0;
    while (gastos < teto) {
      if (await condicao()) return gastos;
      await avancar(bloco);
      gastos += bloco;
      await esperarFrame();
    }
    afirmar(await condicao(), `${oQue}: nao aconteceu em ${teto} ticks (tick ${(await estado()).tick})`);
    return gastos;
  }

  /** Ergue uma planta ja desbloqueada e espera a obra fechar. Devolve o id dela. */
  async function erguerPredio(tipo, gx, gy) {
    await centrarEm(gx + 1);
    afirmar(await liberadoNoMenu(tipo), `o menu deveria oferecer '${tipo}' neste ponto da arvore`);
    await page.click(`[data-predio="${tipo}"]`);
    await esperarFrame();
    await clicarNoTile(gx, gy);
    await avancar(1);
    await esperarFrame();
    await page.keyboard.press('Escape'); // larga a planta fantasma
    await esperarFrame();

    await clicarNoTile(gx + 1, gy);
    const id = await idAberto();
    afirmar(id !== null, `clicar na planta de '${tipo}' em (${gx},${gy}) deveria abrir o painel da obra`);
    await page.keyboard.press('Escape');
    await esperarFrame();
    await esperarAte(
      async () => (await predioDoEstado(id))?.estado === 'completo',
      TETO_ATE_COMPLETAR,
      `a obra de '${tipo}' ficar pronta`,
    );
    return id;
  }

  // ---- geometria, tirada dos JSON -----------------------------------------
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largAr, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largCa, altCa] = defDe('fishermans').tamanho;
  const [largLe, altLe] = defDe('woodcutters').tamanho;
  const [largSe, altSe] = defDe('sawmill').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');

  const alcance = producao.predios.fishermans.colheita.alcance_tiles;
  const centroDoArmazem = { gx: armazem.gx + 1, gy: armazem.gy + 1 };

  // O acude da vila: a mancha de cardume mais PERTO do armazem, e nao uma
  // coordenada digitada. Se o gerador mudar de semente, a cabana anda junto.
  const manchas = manchasDe('fish');
  afirmar(manchas.length > 0, 'o mapa precisa ter cardume para este roteiro existir');
  const acude = manchas
    .map((m) => ({ m, perto: Math.min(...m.map((t) => chebyshev(centroDoArmazem, t))) }))
    .sort((a, b) => a.perto - b.perto)[0].m;
  const ySul = Math.max(...acude.map((t) => t.gy));
  const xDe = Math.min(...acude.map((t) => t.gx));
  const xAte = Math.max(...acude.map((t) => t.gx));

  // A cabana fica na MARGEM SUL do acude — entre a agua e a vila —, no ponto que
  // ve mais cardume. Empate se resolve pelo mais perto do armazem e depois pelo
  // gx, para a escolha nao depender da ordem de varredura.
  const peixeNaCaixa = (gx, gy) => mapa.recursos.fish.filter(([fx, fy]) => (
    fx >= gx - alcance && fx <= gx + largCa - 1 + alcance
    && fy >= gy - alcance && fy <= gy + altCa - 1 + alcance
  ));
  const candidatos = [];
  for (let gy = ySul + 1; gy <= ySul + 2; gy += 1) {
    for (let gx = xDe - 1; gx <= xAte + 1; gx += 1) {
      if (!podeErguer(gx, gy, largCa, altCa)) continue;
      candidatos.push({ gx, gy, peixe: peixeNaCaixa(gx, gy).length, perto: chebyshev(centroDoArmazem, { gx, gy }) });
    }
  }
  candidatos.sort((a, b) => (b.peixe - a.peixe) || (a.perto - b.perto) || (a.gx - b.gx));
  afirmar(candidatos.length > 0, 'nao ha margem sul onde erguer a cabana; o roteiro nao teria o que mostrar');
  const cabana = { gx: candidatos[0].gx, gy: candidatos[0].gy };
  const meioDaCabana = { gx: cabana.gx + Math.floor(largCa / 2), gy: cabana.gy };
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };

  // Cardume ao alcance contado do mapa: zero seria um roteiro que passa pelo
  // motivo errado (era o BUG-C).
  const peixeAoAlcance = peixeNaCaixa(cabana.gx, cabana.gy);
  afirmar(
    peixeAoAlcance.length > 0,
    `a cabana de (${cabana.gx},${cabana.gy}) nao tem cardume ao alcance: o pescador nao teria `
      + 'aonde ir, e o roteiro passaria sem exercitar a feature',
  );
  const RENDIMENTO = recursos.tipos.fish.rendimentoPorTile;
  const UNIDADES_NO_COMECO = peixeAoAlcance.length * RENDIMENTO;

  // E a afirmacao que da sentido a todas as outras: o cardume ao alcance e AGUA,
  // e agua nao se pisa. O pescador nao tem como trabalhar de cima do peixe.
  afirmar(
    peixeAoAlcance.every(([fx, fy]) => !pisavel(fx, fy)),
    'o cardume ao alcance deveria estar todo em tile que nao se pisa; sem isso a margem '
      + 'nao e a unica posicao de trabalho e o roteiro nao mede o que diz medir',
  );

  // A rua: a coluna da porta da cabana descendo ate a linha de porta da vila, e a
  // linha ligando armazem e escola. A escola precisa dela tanto quanto a cabana —
  // e por ela que o ouro do treino anda.
  const colunas = [];
  for (let gx = cabana.gx; gx < cabana.gx + largCa; gx += 1) {
    let livre = true;
    for (let gy = cabana.gy + altCa; gy <= yRua; gy += 1) if (!livreParaObra(gx, gy)) livre = false;
    if (livre) colunas.push(gx);
  }
  afirmar(colunas.length > 0, 'nenhuma coluna da porta da cabana desce livre ate a linha de porta da vila');
  const colunaDaRua = colunas.sort((a, b) => (
    Math.abs(a - (armazem.gx + largAr - 1)) - Math.abs(b - (armazem.gx + largAr - 1))
  ))[0];
  const descida = [];
  for (let gy = cabana.gy + altCa; gy < yRua; gy += 1) descida.push({ gx: colunaDaRua, gy });
  const linhaDaVila = ruaComDesvio(
    Math.min(colunaDaRua, armazem.gx), Math.max(colunaDaRua, escola.gx + largEs - 1), yRua,
  );
  const tilesDaRua = descida.length + linhaDaVila.length;

  // As casas que a arvore exige, a leste da escola, longe da rua e do acude.
  const aLesteDe = (gx0, larg, alt) => {
    let gx = gx0;
    while (gx < mapa.largura - larg && !podeErguer(gx, yRua - alt, larg, alt)) gx += 1;
    return { gx, gy: yRua - alt };
  };
  const lenhador = aLesteDe(escola.gx + largEs + 1, largLe, altLe);
  const serraria = aLesteDe(lenhador.gx + largLe + 1, largSe, altSe);
  const civilDaCabana = defDe('fishermans').trabalhador;
  afirmar(
    typeof civilDaCabana === 'string',
    'a cabana precisa declarar `trabalhador` no dado; sem isso nao ha ocupante para sair',
  );

  /** Distancia de Chebyshev de um ponto DESENHADO ao footprint da cabana. */
  const distanciaAoPredio = (gx, gy) => Math.max(
    Math.max(cabana.gx - gx, 0, gx - (cabana.gx + largCa - 1)),
    Math.max(cabana.gy - gy, 0, gy - (cabana.gy + altCa - 1)),
  );

  // ---- 1. a arvore de desbloqueio, na tela --------------------------------
  afirmar(
    !(await liberadoNoMenu('fishermans')),
    'na abertura a Casa do Pescador NAO pode estar liberada: ela vem depois da serraria',
  );
  await erguerPredio('woodcutters', lenhador.gx, lenhador.gy);
  afirmar(
    !(await liberadoNoMenu('fishermans')),
    'com so a casa do lenhador de pe a Casa do Pescador ainda nao pode estar liberada',
  );
  await erguerPredio('sawmill', serraria.gx, serraria.gy);
  afirmar(
    await liberadoNoMenu('fishermans'),
    'com a serraria de pe a Casa do Pescador deveria ficar liberada no menu',
  );

  // ---- 2. a rua ------------------------------------------------------------
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await centrarEm(colunaDaRua);
  const pTopo = await pontoDoTile(colunaDaRua, cabana.gy + altCa);
  const pBase = await pontoDoTile(colunaDaRua, yRua - 1);
  await arrastarDentroDoCanvas(page, canvas, [pTopo, pBase]);
  await avancar(1);
  await esperarFrame();
  for (const { gy, de, ate } of arrastosDaRua(linhaDaVila)) {
    await centrarEm(Math.floor((de + ate) / 2));
    const pDe = await pontoDoTile(de, gy);
    const pAte = await pontoDoTile(ate, gy);
    await arrastarDentroDoCanvas(page, canvas, [pDe, pAte]);
    await avancar(1);
    await esperarFrame();
  }
  await page.keyboard.press('Escape');
  await esperarFrame();
  await erguerRua(ctx, { tiles: tilesDaRua });

  // ---- 3. a cabana e o pescador -------------------------------------------
  const ID_CABANA = await erguerPredio('fishermans', cabana.gx, cabana.gy);

  await centrarEm(meioDaEscola.gx);
  await clicarNoTile(meioDaEscola.gx, meioDaEscola.gy);
  afirmar(
    await temNoPainel(`[data-treinar="${civilDaCabana}"]`),
    'a escola deveria oferecer o treino do pescador depois da cabana de pe',
  );
  await page.click(`#painel-predio [data-treinar="${civilDaCabana}"]`);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  await esperarAte(
    async () => (await predioDoEstado(ID_CABANA))?.ocupante !== null,
    TETO_ATE_OCUPAR,
    'o pescador treinado ocupar a cabana',
  );
  const OCUPANTE = (await predioDoEstado(ID_CABANA)).ocupante;

  // ---- 4. o ponto de partida: dentro, e o painel diz quem e ----------------
  await centrarEm(meioDaCabana.gx);
  await clicarNoTile(meioDaCabana.gx, meioDaCabana.gy);
  afirmar((await idAberto()) === ID_CABANA, 'o painel deveria abrir na cabana');
  afirmar(
    (await page.getAttribute('#painel-predio .linha.ocupante', 'data-ocupante')) === OCUPANTE,
    `a linha de ocupante deveria apontar ${OCUPANTE}`,
  );
  const alcanceNoComeco = await linhaDoAlcance();
  afirmar(
    alcanceNoComeco !== null && alcanceNoComeco.unidades === UNIDADES_NO_COMECO,
    `a linha do alcance deveria comecar com ${UNIDADES_NO_COMECO} unidades `
      + `(${peixeAoAlcance.length} tiles x ${RENDIMENTO}), veio ${JSON.stringify(alcanceNoComeco)}`,
  );

  // ---- 5. ele PESCA, da margem --------------------------------------------
  // A espera e pelo tick de `colhendo`: nao "saiu andando", e "esta trabalhando",
  // que e a unica posicao em que a margem precisa valer.
  const ticksAtePescar = await esperarAte(
    async () => (await desenhada(OCUPANTE))?.fsm === 'colhendo',
    TETO_ATE_PESCAR,
    'o pescador chegar a margem e comecar a colher',
    PASSO_FINO,
  );
  const naMargem = await desenhada(OCUPANTE);
  afirmar(
    naMargem.tipo === civilDaCabana,
    `o desenhado deveria ser um ${civilDaCabana}, veio ${naMargem.tipo}`,
  );
  afirmar(
    distanciaAoPredio(naMargem.gx, naMargem.gy) >= 1,
    `pescando ele deveria estar FORA do footprint da cabana, veio em `
      + `(${naMargem.gx},${naMargem.gy}) depois de ${ticksAtePescar} ticks`,
  );
  afirmar(
    pisavel(naMargem.gx, naMargem.gy),
    `ele deveria estar em chao pisavel, veio em '${terrenoDe(naMargem.gx, naMargem.gy)}'`,
  );
  const cardumeEncostado = peixeAoAlcance.filter(
    ([fx, fy]) => chebyshev({ gx: fx, gy: fy }, { gx: naMargem.gx, gy: naMargem.gy }) === 1,
  );
  afirmar(
    cardumeEncostado.length > 0,
    `pescando ele deveria estar encostado num tile de cardume, veio em `
      + `(${naMargem.gx},${naMargem.gy})`,
  );
  // O nucleo da F-T4a na tela: o que ele trabalha esta a UM tile, e nenhum dos
  // tiles de cardume encostados nele se pisa. Ele trabalha da margem porque nao
  // ha outro lugar de onde trabalhar.
  afirmar(
    cardumeEncostado.every(([fx, fy]) => !pisavel(fx, fy)),
    'o cardume encostado nele deveria ser todo agua: '
      + `${JSON.stringify(cardumeEncostado.map(([fx, fy]) => [fx, fy, terrenoDe(fx, fy)]))}`,
  );

  // ---- 6. ACEITE, com o jogo ANDANDO (§8): fora, e ainda ocupante ---------
  // `page.click()` aperta e solta no mesmo instante, e o painel se redesenha a
  // cada tick: so o aperto de 150 ms despausado prova que o evento chega.
  await page.keyboard.press('Escape');
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o passo 6 so vale com o laco ANDANDO');

  // A captura tem de mostrar os dois lados: a cabana apertada e o pescador na
  // margem. Sem isto o quadro sai com o pescador fora da tela.
  await enquadrar(naMargem, meioDaCabana);
  const pAperto = await pontoDoTile(meioDaCabana.gx, meioDaCabana.gy);
  await page.mouse.move(pAperto.x, pAperto.y);
  await page.mouse.down();
  await page.waitForTimeout(150); // o tempo de uma mao, e varios ticks do laco
  await page.mouse.up();
  await esperarFrame();

  afirmar(
    (await idAberto()) === ID_CABANA,
    'com o jogo andando, apertar a cabana deveria abrir o painel dela',
  );
  const andando = await desenhada(OCUPANTE);
  afirmar(
    andando !== null && distanciaAoPredio(andando.gx, andando.gy) >= 1,
    `com o laco andando o pescador deveria continuar fora da cabana, veio ${JSON.stringify(andando)}`,
  );
  afirmar(
    (await page.getAttribute('#painel-predio .linha.ocupante', 'data-ocupante')) === OCUPANTE,
    'com o ocupante na margem o painel deveria continuar apontando ele',
  );
  afirmar(
    (await page.textContent('#painel-predio')).includes(tema.civis[civilDaCabana].nome),
    'o ocupante deveria continuar aparecendo pelo NOME no sertao, mesmo na margem',
  );
  await capturar('pescador-na-margem');

  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro deveria voltar a pausar depois do passo 6');

  // ---- 7. a volta: o acude BAIXOU, e a contagem de tiles nao -------------
  // A espera e pelo VEIO baixar, com o painel aberto o tempo todo. `trabalhando`
  // dura UM tick — ele deposita ao chegar e sai de novo no tick seguinte —,
  // entao esperar por aquele rotulo seria amostrar um alvo de um tick e falhar
  // por sorte. Que ele voltou se afirma pelos estados VISTOS no caminho.
  await clicarNoTile(meioDaCabana.gx, meioDaCabana.gy);
  afirmar((await idAberto()) === ID_CABANA, 'o painel deveria reabrir na MESMA cabana');
  const fsmsVistos = new Set();
  let gastosNaVolta = 0;
  let alcanceNoFim = await linhaDoAlcance();
  while (gastosNaVolta < TETO_ATE_VOLTAR && alcanceNoFim.unidades >= alcanceNoComeco.unidades) {
    await avancar(PASSO_FINO);
    gastosNaVolta += PASSO_FINO;
    await esperarFrame();
    const u = await desenhada(OCUPANTE);
    if (u !== null) fsmsVistos.add(u.fsm);
    alcanceNoFim = await linhaDoAlcance();
  }
  afirmar(
    fsmsVistos.has('voltando'),
    `para depositar ele tem de voltar: os estados vistos foram ${JSON.stringify([...fsmsVistos])}`,
  );
  afirmar(
    alcanceNoFim !== null && alcanceNoFim.unidades < alcanceNoComeco.unidades,
    `depois de uma volta o acude deveria ter baixado de ${alcanceNoComeco.unidades}, veio `
      + `${JSON.stringify(alcanceNoFim)}`,
  );
  afirmar(
    alcanceNoFim.tiles === alcanceNoComeco.tiles,
    `um ciclo nao esgota o cardume inteiro: a contagem de tiles deveria seguir `
      + `${alcanceNoComeco.tiles}, veio ${alcanceNoFim.tiles}`,
  );
  await capturar('acude-baixou');
}

module.exports = { roteiro };
