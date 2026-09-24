'use strict';
// Roteiro da F-TP — A PLANTA FANTASMA DIZ O QUE A PEDREIRA VAI ACHAR.
//
// O item nasceu de uma medicao: em 85,5 % da area jogavel nao ha um tile de
// rocha ao alcance 6. O jogador planta a pedreira e ela nasce parada, e ate
// agora ele so descobria pelo alerta da F22, depois do fato. O que este roteiro
// mede e o retorno chegando ANTES do clique — e, junto, que ele nao virou
// recusa: plantar longe continua valendo.
//
// Nenhuma coordenada digitada aqui. A jazida e o tile mais LONGE de qualquer
// rocha saem de `data/maps/sertao-128.json`, o mesmo arquivo que alimenta a sim;
// os ids de predio saem de `data/production.json` pela presenca de `colheita`,
// que e a regra da classe escrita no item. Trocar o mapa move os alvos, nao
// quebra o roteiro.
//
// CLAUDE.md §8: este roteiro clica em `#menu-build`, entao o gesto da ferramenta
// acontece DESPAUSADO, com `mouse.down` / `waitForTimeout(150)` / `mouse.up` —
// nunca `page.click()`, que aperta e solta no mesmo instante e deixa passar
// redesenho que destroi o no sob o dedo.
const { retanguloDoCanvas, pontoDoTileNaTela } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const mapa = require('../../data/maps/sertao-128.json');
const predios = require('../../data/buildings.json');
const producao = require('../../data/production.json');

const TILE_PX = terreno.tile_px;
const ROCHA = new Set(mapa.recursos.rock.map(([gx, gy]) => `${gx},${gy}`));

/** O primeiro predio cuja RECEITA tem `colheita`. Nao e 'quarry' digitado: e a
 *  regra da classe do item — hoje so a pedreira, amanha o lenhador e o roceiro. */
function predioQueColhe() {
  for (const [id, receita] of Object.entries(producao.predios)) {
    if (receita.colheita) return { id, colheita: receita.colheita };
  }
  throw new Error('F-TP: nenhuma receita em production.json tem `colheita`');
}

/** Um predio que NAO colhe e que o jogador pode pegar AGORA, para a perna (c):
 *  quem nao tira nada do mapa nao ganha moldura nenhuma. A escolha e do menu
 *  vivo, nao da lista do arquivo — `buildings.json` traz tipo ainda bloqueado
 *  (`aria-disabled`), e pegar um deles nao trocaria a ferramenta. */
async function predioQueNaoColhe(page, excluir) {
  const ids = await page.$$eval('[data-predio]', (nos) => nos.map((n) => ({
    id: n.dataset.predio, bloqueado: n.getAttribute('aria-disabled') === 'true',
  })));
  for (const item of ids) {
    if (item.id === excluir || item.bloqueado) continue;
    if (!producao.predios[item.id] || !producao.predios[item.id].colheita) return item.id;
  }
  throw new Error(`F-TP: nenhum predio liberado no menu deixa de colher (${JSON.stringify(ids)})`);
}

function tamanhoDe(id) {
  const def = predios.predios.find((p) => p.id === id);
  if (!def) throw new Error(`F-TP: '${id}' nao esta em buildings.json`);
  return { largura: def.tamanho[0], altura: def.tamanho[1] };
}

/** Ha rocha na caixa do predio posto em (gx,gy), expandida pelo alcance? E a
 *  mesma pergunta de Chebyshev-a-partir-do-footprint que `sim/recursos.ts` faz;
 *  aqui ela serve so para ESCOLHER os alvos do roteiro. */
function rochaAoAlcance(gx, gy, tamanho, alcance) {
  for (let y = gy - alcance; y <= gy + tamanho.altura - 1 + alcance; y += 1) {
    for (let x = gx - alcance; x <= gx + tamanho.largura - 1 + alcance; x += 1) {
      if (ROCHA.has(`${x},${y}`)) return true;
    }
  }
  return false;
}

/** Quantas rochas caem na caixa do predio posto em (gx,gy), expandida pelo
 *  alcance. Mesma pergunta de `rochaAoAlcance`, contando em vez de parar. */
function contarRochaAoAlcance(gx, gy, tamanho, alcance) {
  let total = 0;
  for (let y = gy - alcance; y <= gy + tamanho.altura - 1 + alcance; y += 1) {
    for (let x = gx - alcance; x <= gx + tamanho.largura - 1 + alcance; x += 1) {
      if (ROCHA.has(`${x},${y}`)) total += 1;
    }
  }
  return total;
}

/** O tile ONDE O JOGADOR PLANTARIA a pedreira: o que tem mais rocha ao alcance
 *  entre os que a aceitam. O proprio lajedo nao serve — terreno `rocha` recusa
 *  predio desde a F07, e o alvo aqui e um clique que VALE. */
function melhorPontoDeColheita(tamanho, alcance) {
  let melhor = null;
  let maior = -1;
  for (let gy = 0; gy + tamanho.altura <= mapa.altura; gy += 1) {
    for (let gx = 0; gx + tamanho.largura <= mapa.largura; gx += 1) {
      let soGrama = true;
      for (let y = gy; y < gy + tamanho.altura && soGrama; y += 1) {
        for (let x = gx; x < gx + tamanho.largura && soGrama; x += 1) {
          if (mapa.linhas[y][x] !== 'g') soGrama = false;
        }
      }
      if (!soGrama) continue;
      const rochas = contarRochaAoAlcance(gx, gy, tamanho, alcance);
      if (rochas > maior) { maior = rochas; melhor = { gx, gy }; }
    }
  }
  if (melhor === null) throw new Error('F-TP: nenhum tile do mapa aceita o predio');
  return melhor;
}

/** O tile mais PROXIMO da jazida onde o predio cabe em grama e NAO ha uma rocha
 *  sequer ao alcance. Proximo de proposito: a camera faz uma viagem curta. */
function longeDaRocha(jazida, tamanho, alcance) {
  let melhor = null;
  let menor = Infinity;
  for (let gy = 0; gy + tamanho.altura <= mapa.altura; gy += 1) {
    for (let gx = 0; gx + tamanho.largura <= mapa.largura; gx += 1) {
      const d = Math.max(Math.abs(gx - jazida.gx), Math.abs(gy - jazida.gy));
      if (d >= menor) continue;
      let soGrama = true;
      for (let y = gy; y < gy + tamanho.altura && soGrama; y += 1) {
        for (let x = gx; x < gx + tamanho.largura && soGrama; x += 1) {
          if (mapa.linhas[y][x] !== 'g') soGrama = false;
        }
      }
      if (!soGrama) continue;
      if (rochaAoAlcance(gx, gy, tamanho, alcance)) continue;
      menor = d;
      melhor = { gx, gy };
    }
  }
  if (melhor === null) throw new Error('F-TP: nenhum tile do mapa fica sem rocha ao alcance');
  return melhor;
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const meio = { x: canvas.left + canvas.width / 2, y: canvas.top + canvas.height / 2 };

  const COLHE = predioQueColhe();
  const NAO_COLHE = await predioQueNaoColhe(page, COLHE.id);
  const TAMANHO = tamanhoDe(COLHE.id);
  const JAZIDA = melhorPontoDeColheita(TAMANHO, COLHE.colheita.alcance_tiles);
  const LONGE = longeDaRocha(JAZIDA, TAMANHO, COLHE.colheita.alcance_tiles);

  /** A cena so reamostra `plantaFantasma` no pointermove. Dois moves porque o
   *  Phaser ignora move para o mesmo pixel. */
  const reamostrar = async (ponto) => {
    await page.mouse.move(ponto.x + 3, ponto.y + 3);
    await page.mouse.move(ponto.x, ponto.y);
    await esperarFrame();
    return estado();
  };

  /** Leva a camera ate por `alvo` no meio do quadro, em etapas (a distancia e
   *  maior que o canvas). Botao do MEIO: o esquerdo e arrasto de estrada. */
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

  /** O gesto do jogador num botao do menu: aperta, o laco redesenha por baixo
   *  do dedo, solta. E a §8 escrita em codigo. */
  const apertarESoltar = async (seletor) => {
    const caixa = await page.locator(seletor).boundingBox();
    afirmar(caixa !== null, `o botao '${seletor}' deveria existir no menu`);
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await esperarFrame();
  };

  // ---- 0. a vila de abertura, ainda sem ferramenta ------------------------
  let s = await estado();
  afirmar(s.plantaFantasma === null, `sem ferramenta nao ha planta, veio ${JSON.stringify(s.plantaFantasma)}`);
  afirmar(s.pausado === true, 'o roteiro comeca pausado (?pausado), como todo shot');

  // ---- 1. DESPAUSADO: a ferramenta se pega com o laco vivo ----------------
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado === false, `o laco deveria estar rodando, veio ${JSON.stringify(s.pausado)}`);

  await apertarESoltar(`[data-predio="${COLHE.id}"]`);
  s = await estado();
  afirmar(
    s.ferramentaAtiva === COLHE.id,
    `a ferramenta deveria ficar com '${COLHE.id}' depois do aperta-e-solta, veio ${JSON.stringify(s.ferramentaAtiva)}`,
  );

  // ---- 2. sobre o lajedo: a previa diz N > 0, e NAO recusa ----------------
  await irPara(JAZIDA, s);
  // AFASTA a camera dois passos antes de olhar. Com alcance 6 e tile de 64 px a
  // moldura mede 15x14 tiles — mais alta que o quadro em zoom 1, e o contorno
  // dela ficaria fora da tela. `pontoDoTileNaTela` ja converte com zoom, entao
  // daqui em diante a conta continua exata; `irPara` e que so vale em zoom 1, e
  // por isso a viagem veio antes.
  await page.mouse.move(meio.x, meio.y);
  await page.mouse.wheel(0, 120);
  await esperarFrame();
  await page.mouse.wheel(0, 120);
  await esperarFrame();
  s = await estado();
  afirmar(s.camera.zoom < 1, `a camera deveria ter afastado, veio zoom ${s.camera.zoom}`);

  const pontoDaJazida = pontoDoTileNaTela(canvas, JAZIDA, s.camera, TILE_PX);
  s = await reamostrar(pontoDaJazida);
  afirmar(
    s.tileSobMouse !== null && s.tileSobMouse.gx === JAZIDA.gx && s.tileSobMouse.gy === JAZIDA.gy,
    `o ponteiro deveria estar em ${JSON.stringify(JAZIDA)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  afirmar(
    s.plantaFantasma !== null && s.plantaFantasma.alcance !== null,
    `a fantasma sobre a jazida deveria trazer alcance, veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  const sobreRocha = s.plantaFantasma.alcance;
  afirmar(
    sobreRocha.tiles > 0 && sobreRocha.unidades > 0,
    `sobre a jazida a previa deveria contar tiles e unidades, veio ${JSON.stringify(sobreRocha)}`,
  );
  afirmar(
    sobreRocha.recurso === COLHE.colheita.recurso,
    `o recurso da previa deveria ser '${COLHE.colheita.recurso}', veio ${JSON.stringify(sobreRocha.recurso)}`,
  );
  afirmar(
    typeof sobreRocha.rotulo === 'string' && sobreRocha.rotulo.length > 0
    && sobreRocha.rotulo.includes(String(sobreRocha.tiles))
    && !sobreRocha.rotulo.includes(sobreRocha.recurso),
    'o rotulo desenhado deveria trazer a contagem e o nome do TEMA, nunca o id neutro, '
    + `veio ${JSON.stringify(sobreRocha.rotulo)}`,
  );
  // A moldura e a caixa do predio expandida pelo alcance do DADO, dos dois lados.
  const lado = 2 * COLHE.colheita.alcance_tiles + TAMANHO.largura;
  afirmar(
    sobreRocha.moldura.x1 - sobreRocha.moldura.x0 === lado,
    `a moldura deveria medir ${lado} tiles de largura, veio ${JSON.stringify(sobreRocha.moldura)}`,
  );
  afirmar(
    s.plantaFantasma.valida === true,
    `sobre a jazida o clique nao pode ser recusado, veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  await capturar('o-alcance-sobre-o-lajedo');

  // ---- 3. longe da rocha: a previa diz ZERO, e continua NAO recusando -----
  // A perna que prova que a recusa nao entrou (decisao do operador no item):
  // plantar longe e escolha legitima, e a tela so informa.
  // Volta ao zoom neutro para a viagem (`irPara` mede o passo em pixel de tela)
  // e afasta de novo no destino, pelo mesmo motivo do passo anterior.
  await page.mouse.move(meio.x, meio.y);
  await page.mouse.wheel(0, -120);
  await esperarFrame();
  await page.mouse.wheel(0, -120);
  await esperarFrame();
  s = await estado();
  afirmar(s.camera.zoom === 1, `a camera deveria voltar ao neutro, veio ${s.camera.zoom}`);

  await irPara(LONGE, s);
  await page.mouse.move(meio.x, meio.y);
  await page.mouse.wheel(0, 120);
  await esperarFrame();
  await page.mouse.wheel(0, 120);
  await esperarFrame();
  s = await estado();

  const pontoLonge = pontoDoTileNaTela(canvas, LONGE, s.camera, TILE_PX);
  s = await reamostrar(pontoLonge);
  afirmar(
    s.tileSobMouse !== null && s.tileSobMouse.gx === LONGE.gx && s.tileSobMouse.gy === LONGE.gy,
    `o ponteiro deveria estar em ${JSON.stringify(LONGE)}, veio ${JSON.stringify(s.tileSobMouse)}`,
  );
  const longe = s.plantaFantasma && s.plantaFantasma.alcance;
  afirmar(
    longe !== null && longe.tiles === 0 && longe.unidades === 0,
    `longe da rocha a previa deveria dizer zero, veio ${JSON.stringify(longe)}`,
  );
  afirmar(
    s.plantaFantasma.valida === true && s.plantaFantasma.motivo === null,
    'longe da rocha o clique CONTINUA valendo — a previa informa, nao recusa. '
    + `Veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  await capturar('zero-ao-alcance-e-o-clique-continua-valendo');

  // ---- 4. predio que nao colhe nao ganha moldura nenhuma ------------------
  await apertarESoltar(`[data-predio="${NAO_COLHE}"]`);
  s = await reamostrar(pontoLonge);
  afirmar(
    s.ferramentaAtiva === NAO_COLHE,
    `a ferramenta deveria trocar para '${NAO_COLHE}', veio ${JSON.stringify(s.ferramentaAtiva)}`,
  );
  afirmar(
    s.plantaFantasma !== null && s.plantaFantasma.alcance === null,
    `'${NAO_COLHE}' nao tem colheita na receita e nao pode desenhar alcance, `
    + `veio ${JSON.stringify(s.plantaFantasma)}`,
  );
  await capturar('quem-nao-colhe-nao-ganha-moldura');

  // ---- 5. pausa de volta --------------------------------------------------
  await page.keyboard.press('p');
  await esperarFrame();
  s = await estado();
  afirmar(s.pausado === true, 'o roteiro termina pausado, como comecou');
}

module.exports = { roteiro };
