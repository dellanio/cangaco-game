'use strict';
// Roteiro da F18 — A TERRA ARADA VIROU TILE NA TELA.
//
// Ate aqui `campoArado` so existia na matriz de custo do A*: o jogador via uma
// mancha de outra cor no chao e nada mais acontecia ali. Com a F18 cada tile
// daquele terreno passa a ser um tile de RECURSO no estado, e e isso que este
// roteiro mede — a camada de milho desenhada sobre o bloco aravel, em pousio,
// que e como todo campo do mapa nasce.
//
// Nenhuma coordenada digitada. O bloco aravel sai de `data/maps/sertao-128.json`
// pela legenda, e o terreno que carrega milho sai de `data/resources.json`
// (`tipos.corn.terreno`) — a mesma fonte que a sim usa para derivar a camada.
// Trocar o mapa move a camera, nao quebra o roteiro.
//
// O QUE ESTE ROTEIRO NAO MOSTRA, e por que:
//   - o campo SEMEADO. Semear e trabalho de fazenda, e `farm` so entra no menu
//     depois de uma Sawmill completa (`buildings.json: desbloqueadoPor`). O
//     harness de screenshot nao constroi predio — ele joga o jogo a partir da
//     abertura —, entao o campo maduro so aparece em sessao de jogo de verdade.
//     A prova de que ele enche esta em `test-output/F18.json` e no teste do
//     ciclo, tick a tick.
//   - a previa da F-TP sobre a fazenda, pelo mesmo motivo: a ferramenta `farm`
//     nao pode ser pega na abertura. A previa da CLASSE esta provada em
//     `tools/shots/F-TP.js` com a pedreira, e a fazenda entra na mesma regra
//     sem linha de codigo nova.
const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const recursos = require('../../data/resources.json');

const TILE_PX = terreno.tile_px;

/** O terreno que carrega campo, lido do DADO: e `tipos.<t>.terreno` que diz onde
 *  a camada nasce, e e ele que o carregador da sim le. */
function terrenoDoCampo() {
  for (const [id, def] of Object.entries(recursos.tipos)) {
    if (def.terreno) return { id, terreno: def.terreno };
  }
  throw new Error('F18: nenhum tipo em resources.json declara `terreno`');
}

/** A letra da legenda daquele terreno. */
function letraDe(nomeDoTerreno) {
  for (const [letra, nome] of Object.entries(mapa.legenda)) {
    if (nome === nomeDoTerreno) return letra;
  }
  throw new Error(`F18: a legenda do mapa nao tem '${nomeDoTerreno}'`);
}

/** Todo tile daquele terreno, na ordem de varredura do mapa. */
function tilesDoTerreno(letra) {
  const tiles = [];
  for (let gy = 0; gy < mapa.altura; gy += 1) {
    for (let gx = 0; gx < mapa.largura; gx += 1) {
      if (mapa.linhas[gy][gx] === letra) tiles.push({ gx, gy });
    }
  }
  return tiles;
}

/** O CENTRO do maior aglomerado, em Chebyshev: a camera vai para onde ha mais
 *  campo junto, e nao para o primeiro tile solto da varredura. Aglomerado aqui e
 *  so "tiles vizinhos", calculado por inundacao — barato para 130 tiles. */
function centroDoMaiorBloco(tiles) {
  const chave = (t) => `${t.gx},${t.gy}`;
  const restantes = new Map(tiles.map((t) => [chave(t), t]));
  let maior = [];
  while (restantes.size > 0) {
    const [primeiraChave] = restantes.keys();
    const fila = [restantes.get(primeiraChave)];
    restantes.delete(primeiraChave);
    const bloco = [];
    while (fila.length > 0) {
      const t = fila.pop();
      bloco.push(t);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const k = `${t.gx + dx},${t.gy + dy}`;
          if (!restantes.has(k)) continue;
          fila.push(restantes.get(k));
          restantes.delete(k);
        }
      }
    }
    if (bloco.length > maior.length) maior = bloco;
  }
  const soma = maior.reduce((a, t) => ({ gx: a.gx + t.gx, gy: a.gy + t.gy }), { gx: 0, gy: 0 });
  return {
    centro: { gx: Math.round(soma.gx / maior.length), gy: Math.round(soma.gy / maior.length) },
    tamanho: maior.length,
  };
}

/** Quem mais pode aparecer como "esgotado" na tela? O contador da cena soma num
 *  numero so todo tile de quantidade zero — tile cortado e tile em pousio tem o
 *  mesmo codigo hoje (ver `render/mapa.ts`), e por isso a conta precisa saber
 *  quem mais pode estar em zero.
 *
 *  Na ABERTURA a resposta e "so cultura arada": todo tipo sem `aradura` nasce
 *  cheio (`quantidadeInicial` ausente = `rendimentoPorTile`), e so predio
 *  trabalhando zera tile. Como o roteiro nao constroi nada, esgotado na tela so
 *  pode ser partido em pousio — o milho do terreno ou a cana da mancha da vila
 *  (F-CANA-b: mancha e terreno, nao estoque, e a cana nasce em 0 como o milho).
 *  A pergunta e feita ao DADO, e nao assumida. */
function tiposQueNascemVazios() {
  const vazios = [];
  for (const [id, def] of Object.entries(recursos.tipos)) {
    const inicial = def.quantidadeInicial === undefined ? def.rendimentoPorTile : def.quantidadeInicial;
    if (inicial === 0) vazios.push(id);
  }
  return vazios;
}

/** As culturas que o jogador ara: a presenca do bloco `aradura`, o mesmo que
 *  `culturasAraveis` (sim/campos.ts) le no runtime. */
function culturasAradas() {
  return Object.entries(recursos.tipos).filter(([, def]) => def && def.aradura != null).map(([id]) => id);
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const meio = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };

  const CAMPO = terrenoDoCampo();
  const LETRA = letraDe(CAMPO.terreno);
  const TILES = tilesDoTerreno(LETRA);
  const { centro: ALVO, tamanho: DO_BLOCO } = centroDoMaiorBloco(TILES);

  /** Leva a camera ate por `alvo` no meio do quadro, em etapas. Botao do MEIO:
   *  o esquerdo e arrasto de estrada. Copiado do roteiro da F-TP, que e onde a
   *  viagem longa apareceu primeiro. */
  const irPara = async (alvo, inicial) => {
    let s = inicial;
    const destino = {
      x: alvo.gx * TILE_PX + TILE_PX / 2 - canvas.width / 2,
      y: alvo.gy * TILE_PX + TILE_PX / 2 - canvas.height / 2,
    };
    const margem = 40;
    for (let tentativa = 0; tentativa < 24; tentativa += 1) {
      const faltaX = destino.x - s.camera.scrollX;
      const faltaY = destino.y - s.camera.scrollY;
      if (Math.abs(faltaX) < 1 && Math.abs(faltaY) < 1) break;
      const passoX = Math.max(Math.min(faltaX, canvas.width / 2 - margem), -(canvas.width / 2 - margem));
      const passoY = Math.max(Math.min(faltaY, canvas.height / 2 - margem), -(canvas.height / 2 - margem));
      await page.mouse.move(meio.x, meio.y);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(meio.x - passoX, meio.y - passoY, { steps: 10 });
      await page.mouse.up({ button: 'middle' });
      await esperarFrame();
      s = await estado();
    }
    return s;
  };

  // ---- 0. a abertura: a vila nao tem campo nenhum a vista -----------------
  let s = await estado();
  afirmar(s.pausado === true, 'o roteiro comeca pausado (?pausado), como todo shot');
  afirmar(
    typeof s.recursosVisiveis === 'object' && s.recursosVisiveis !== null,
    `a cena deveria publicar a contagem de recursos, veio ${JSON.stringify(s.recursosVisiveis)}`,
  );
  // Por VALOR, nunca por `Object.keys`: o contador nasce com todo tipo em zero.
  const naVila = s.recursosVisiveis;
  afirmar(
    (naVila[CAMPO.id] || 0) === 0,
    `sobre a vila nao ha milho maduro a vista, veio ${JSON.stringify(naVila)}`,
  );

  // ---- 1. a camera vai ao bloco aravel ------------------------------------
  afirmar(TILES.length > 0, `o mapa deveria ter tile de '${CAMPO.terreno}', veio ${TILES.length}`);
  s = await irPara(ALVO, s);
  const ponto = pontoDoTileNaTela(canvas, ALVO, s.camera, TILE_PX);
  await page.mouse.move(ponto.x + 3, ponto.y + 3);
  await page.mouse.move(ponto.x, ponto.y);
  await esperarFrame();
  s = await estado();
  afirmar(
    s.tileSobMouse !== null && s.tileSobMouse.gx === ALVO.gx && s.tileSobMouse.gy === ALVO.gy,
    `o ponteiro deveria estar no centro do bloco ${JSON.stringify(ALVO)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );

  // ---- 2. o campo esta DESENHADO, e esta em pousio ------------------------
  // A conta exata: quantos tiles do terreno caem no quadro. `worldView` e o
  // mesmo retangulo que a cena usa para contar, entao os dois numeros tem que
  // bater tile a tile — nao "mais que zero".
  const vista = s.camera;
  const x0 = Math.floor(vista.scrollX / TILE_PX);
  const y0 = Math.floor(vista.scrollY / TILE_PX);
  const x1 = Math.ceil((vista.scrollX + canvas.width / vista.zoom) / TILE_PX);
  const y1 = Math.ceil((vista.scrollY + canvas.height / vista.zoom) / TILE_PX);
  const vazios = tiposQueNascemVazios().sort();
  const arados = culturasAradas().sort();
  afirmar(
    JSON.stringify(vazios) === JSON.stringify(arados) && vazios.includes(CAMPO.id),
    `na abertura so cultura arada nasce vazia (${JSON.stringify(arados)}); se outro tipo nascer em zero, "esgotado" fica ambiguo. Veio ${JSON.stringify(vazios)}`,
  );
  const noVisor = (t) => t.gx >= x0 && t.gx <= x1 && t.gy >= y0 && t.gy <= y1;
  const doCampo = TILES.filter(noVisor).length;
  afirmar(doCampo > 0, `o quadro deveria conter tile de campo, veio ${doCampo}`);
  // As OUTRAS culturas aradas vem da camada esparsa do mapa (a cana da vila):
  // se cairem no quadro, tambem entram no "esgotado", e a conta as soma.
  let dasOutras = 0;
  for (const id of vazios) {
    if (id === CAMPO.id) continue;
    dasOutras += (mapa.recursos[id] || []).filter(([gx, gy]) => noVisor({ gx, gy })).length;
  }
  const noQuadro = doCampo + dasOutras;

  const daArea = s.recursosVisiveis;
  afirmar(
    daArea.esgotado > 0,
    `o campo em pousio deveria estar desenhado, veio ${JSON.stringify(daArea)}`,
  );
  // Tolera a borda: `getTilesWithinWorldXY` e a conta acima arredondam o meio
  // tile da margem para lados diferentes. O que se afirma e a ORDEM de grandeza
  // certa, e nao "algum tile".
  afirmar(
    Math.abs(daArea.esgotado - noQuadro) <= 2 * ((x1 - x0) + (y1 - y0)),
    `esgotado(${daArea.esgotado}) deveria bater com os ${noQuadro} tiles em pousio do quadro (${doCampo} de campo, ${dasOutras} de outras culturas)`,
  );
  afirmar(
    (daArea[CAMPO.id] || 0) === 0,
    `nenhum campo nasce semeado: '${CAMPO.id}' maduro a vista deveria ser 0, veio ${JSON.stringify(daArea)}`,
  );
  await capturar('o-campo-arado-em-pousio');

  // ---- 3. DESPAUSADO: o campo nao se semeia sozinho -----------------------
  // A §8 pede um passo com o laco vivo. Aqui ele prova uma regra da feature: sem
  // fazenda nenhuma ao alcance, nenhum tile enche — cidade nao se expande
  // sozinha, e campo nao brota sozinho.
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  s = await estado();
  afirmar(s.pausado === false, `o laco deveria estar rodando, veio ${JSON.stringify(s.pausado)}`);
  const tickInicial = s.tick;
  await page.waitForTimeout(1500);
  s = await estado();
  afirmar(s.tick > tickInicial, `o relogio deveria ter andado, veio ${tickInicial} -> ${s.tick}`);
  afirmar(
    (s.recursosVisiveis[CAMPO.id] || 0) === 0,
    `sem fazenda o campo continua em pousio, veio ${JSON.stringify(s.recursosVisiveis)}`,
  );
  await capturar('sem-fazenda-o-campo-nao-brota');

  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado === true, 'o roteiro termina pausado, como comecou');

  return { tilesDeCampoNoMapa: TILES.length, noMaiorBloco: DO_BLOCO, alvo: ALVO };
}

module.exports = { roteiro };
