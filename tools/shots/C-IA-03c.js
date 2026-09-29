'use strict';
// Roteiro da C-IA-03c — JOGAR A ESCARAMUCA PELA TELA (o aceite do operador: "partindo do
// cenario, eu acho a vila inimiga, ataco, destruo os tres predios e vejo a vitoria").
//
// Tudo pelo mouse e pelo teclado, como o jogador:
//   1. H -> "Nova escaramuca": a partida nasce com as duas vilas e o contador da paz;
//   2. caixa em volta dos 18 cabras do jogador; botao direito EM PAZ: a tropa marcha
//      (C-COMBATE-02b tirou a cerca da paz) e a tela nao da aviso;
//   3. o relogio corre ate a paz acabar (avancar, pausado) e o contador some;
//   4. a camera vai a vila inimiga: rotulos azuis, bandeira azul nos tres predios;
//   5. a cada rodada, botao direito no bodoqueiro inimigo mais perto (senao no cabra): e
//      MARCHA pela tela, e a luta nasce do revide (C6); sem tropa inimiga, botao direito em
//      cada predio: ataque;
//   6. a vitoria da F34 aparece na tela.
// A primeira marcha depois da paz roda DESPAUSADA com mouse.down / 150 ms / mouse.up (§8);
// o resto usa `avancar` pausado para a corrida ser a mesma a cada vez.
// O px sai do debug (`unidadesRenderizadas`, `prediosDoEstado`), nunca de pixel da captura.
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');

const TILE_PX = terreno.tile_px;
const LADO_DO_JOGADOR = 0;
const LADO_DA_IA = 1;
const RODADA = 100; // ticks entre ordens: a cadencia da sonda headless que venceu (36 rodadas)

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = async (n) => {
    await page.evaluate((k) => window.__cangaco.avancar(k), n);
    await esperarFrame();
  };
  const texto = (seletor) => page.$eval(seletor, (n) => (n.hidden ? null : n.textContent));
  const fimNaTela = () => page.$eval('#fim-de-partida', (n) => (n.hidden ? null : n.dataset.fim));

  // 1. comecar a escaramuca pelo painel H
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  let s = await estado();
  const daIA = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA);
  const minha = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
  afirmar(s.tick === 0, `a escaramuca deveria nascer no tick 0, veio ${s.tick}`);
  afirmar(minha.length === 18, `o jogador deveria nascer com 18 cabras, veio ${minha.length}`);
  afirmar(daIA.length > 0 || Object.values(s.prediosDoEstado).some((p) => p.lado === LADO_DA_IA), 'a IA deveria existir');
  const contadorNoInicio = await texto('#minimapa [data-campo="paz"]');
  afirmar(contadorNoInicio !== null && /Paz: 10:00/.test(contadorNoInicio), `o contador deveria mostrar 10:00, veio ${contadorNoInicio}`);
  afirmar(minha.every((u) => u.corDoBando === '#D64B3F'), 'os cabras do jogador deveriam ter o rotulo vermelho do bando');

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    const alvo = alvoEmTiles * TILE_PX - vao / 2;
    const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX) return;
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 300 : 80);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }
  const centrar = async (t) => {
    await centrarNoEixo(t.gx, 'x');
    await centrarNoEixo(t.gy, 'y');
  };
  const pontoDoTile = (gx, gy, camera) => ({
    x: canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX,
    y: canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY,
  });
  async function direito(p) {
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button: 'right' });
    await page.waitForTimeout(150);
    await page.mouse.up({ button: 'right' });
    await esperarFrame();
  }

  // a tropa do jogador, na tela
  // o centro da tropa (media), para as duas fileiras caberem inteiras na tela
  const meio = {
    gx: Math.round(minha.reduce((n, u) => n + u.gx, 0) / minha.length),
    gy: Math.round(minha.reduce((n, u) => n + u.gy, 0) / minha.length),
  };
  await centrar(meio);
  await capturar('inicio-em-paz');

  // 2. caixa em volta dos 18
  s = await estado();
  const pontos = minha.map((u) => pontoDoTile(u.gx, u.gy, s.camera));
  await page.mouse.move(Math.min(...pontos.map((p) => p.x)) - TILE_PX / 2, Math.min(...pontos.map((p) => p.y)) - TILE_PX / 2);
  await page.mouse.down();
  await page.mouse.move(Math.max(...pontos.map((p) => p.x)) + TILE_PX / 2, Math.max(...pontos.map((p) => p.y)) + TILE_PX / 2, { steps: 8 });
  await page.mouse.up();
  await esperarFrame();
  s = await estado();
  afirmar(s.selecaoMilitar.length === 18, `a caixa deveria pegar os 18, veio ${s.selecaoMilitar.length}`);

  // em paz, o botao direito LONGE da vila move a tropa (C-COMBATE-02b: a cerca saiu)
  const LONGE_TILES = 16;
  const longe = { gx: meio.gx, gy: meio.gy + LONGE_TILES };
  await centrar(longe);
  s = await estado();
  await direito(pontoDoTile(longe.gx, longe.gy, s.camera));
  await avancar(20);
  s = await estado();
  const moveram = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia' && u.fsm !== 'ocioso');
  afirmar(moveram.length > 0, 'em paz, longe da vila, a tropa deveria marchar');
  const recusa = await page.$eval('#aviso-de-ordem', (n) => (n.hidden ? null : n.textContent));
  afirmar(recusa === null, `a marcha em paz nao deveria ter aviso, veio ${recusa}`);

  // 3. o relogio corre ate a paz acabar
  for (let i = 0; i < 20 && (await texto('#minimapa [data-campo="paz"]')) !== null; i += 1) await avancar(500);
  const contadorDepois = await texto('#minimapa [data-campo="paz"]');
  afirmar(contadorDepois === null, `o contador deveria sumir com a paz, veio ${contadorDepois}`);
  s = await estado();
  const tickDoFimDaPaz = s.tick;

  // 4. achar a vila inimiga
  const prediosDaIA = () => Object.entries(s.prediosDoEstado).filter(([, p]) => p.lado === LADO_DA_IA);
  const [, armazemDaIA] = prediosDaIA().find(([, p]) => p.tipo === 'storehouse');
  await centrar({ gx: armazemDaIA.gx, gy: armazemDaIA.gy - 3 });
  s = await estado();
  afirmar(prediosDaIA().length === 3 && prediosDaIA().every(([, p]) => p.corDoBando === '#3F72D6'), 'os tres predios da IA deveriam ter a bandeira azul');
  afirmar(s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA).every((u) => u.corDoBando === '#3F72D6'), 'a tropa da IA deveria ter o rotulo azul');
  await capturar('vila-inimiga');

  // 5. o ataque. A primeira ordem DESPAUSADA, com o laco redesenhando (§8)
  // C-TELA-04: o botao direito sobre o inimigo passou a ser `AttackUnit` (antes era marcha ao
  // tile dele). Mirar o ARQUEIRO atras da linha agora manda os 18 perseguirem um so alvo
  // atraves da frente e da chuva de flecha, e a tropa morre inteira (medido). O roteiro joga
  // como o jogador: o inimigo MAIS PERTO da tropa.
  const alvoDaRodada = () => {
    const inimigos = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA);
    const meus = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
    if (meus.length === 0) return inimigos[0] ?? null;
    const cx = meus.reduce((n, u) => n + u.gx, 0) / meus.length;
    const cy = meus.reduce((n, u) => n + u.gy, 0) / meus.length;
    const d = (u) => Math.hypot(u.gx - cx, u.gy - cy);
    return [...inimigos].sort((a, b) => d(a) - d(b))[0] ?? null;
  };
  let primeira = true;
  let capturouCombate = false;
  let rodadas = 0;
  const rodadasIndoAtacar = {};
  for (; rodadas < 200; rodadas += 1) {
    s = await estado();
    if ((await fimNaTela()) !== null) break;
    const alvo = alvoDaRodada();
    if (alvo !== null) {
      await centrar({ gx: Math.round(alvo.gx), gy: Math.round(alvo.gy) });
      s = await estado();
      const agora = s.unidadesRenderizadas.find((u) => u.id === alvo.id) ?? alvo;
      if (primeira) await page.keyboard.press('p');
      await direito(pontoDoTile(Math.round(agora.gx), Math.round(agora.gy), s.camera));
      if (primeira) {
        await page.waitForTimeout(300);
        await page.keyboard.press('p');
        await esperarFrame();
        primeira = false;
      }
    } else {
      const predios = prediosDaIA();
      if (predios.length === 0) {
        await avancar(RODADA);
        continue;
      }
      const [, p] = predios[0];
      await centrar({ gx: p.gx + 1, gy: p.gy + 1 });
      s = await estado();
      await direito(pontoDoTile(p.gx + 1, p.gy + 1, s.camera));
    }
    await avancar(RODADA);
    s = await estado();
    if (rodadas % 10 === 0 || process.env.CANGACO_SHOT_LOG) {
      const meus = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia');
      const fsms = {};
      for (const u of meus) fsms[u.fsm] = (fsms[u.fsm] ?? 0) + 1;
      console.log(`rodada ${rodadas} tick ${s.tick}: alvo ${alvo ? `${alvo.tipo}@${Math.round(alvo.gx)},${Math.round(alvo.gy)}` : 'predio'} meus ${meus.length} ${JSON.stringify(fsms)} IA ${s.unidadesRenderizadas.filter((u) => u.lado === LADO_DA_IA).length} predios ${prediosDaIA().map(([id, p]) => `${id}:${p.hp}`).join(',')} sel ${s.selecaoMilitar.length}`);
    }
    // BUG-Q: o log desta corrida mostrou {"indo_atacar":10,"atacando":2} por 2000 ticks e
    // ninguem leu. Agora e asserção: soldado que passa 10 rodadas SEGUIDAS a caminho do
    // predio, sem chegar a golpear, reprova o roteiro.
    for (const u of s.unidadesRenderizadas.filter((x) => x.lado === LADO_DO_JOGADOR && x.tipo === 'militia')) {
      rodadasIndoAtacar[u.id] = u.fsm === 'indo_atacar' ? (rodadasIndoAtacar[u.id] ?? 0) + 1 : 0;
      afirmar(rodadasIndoAtacar[u.id] <= 10, `${u.id} ficou ${rodadasIndoAtacar[u.id]} rodadas em indo_atacar sem golpear (BUG-Q)`);
    }
    const lutando = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.fsm === 'lutando').length;
    if (!capturouCombate && lutando >= 3) {
      await capturar('combate');
      capturouCombate = true;
    }
  }

  // 6. a vitoria
  s = await estado();
  const fim = await fimNaTela();
  const titulo = fim === null ? null : await page.$eval('#fim-de-partida h2', (n) => n.textContent);
  afirmar(prediosDaIA().length === 0, `os tres predios da IA deveriam cair, sobraram ${prediosDaIA().length}`);
  afirmar(fim === 'vitoria', `a vitoria deveria aparecer na tela, veio ${fim} (${titulo})`);
  const vivos = s.unidadesRenderizadas.filter((u) => u.lado === LADO_DO_JOGADOR && u.tipo === 'militia').length;
  await capturar('vitoria');
  console.log(`C-IA-03c: "${titulo}"; paz ate o tick ${tickDoFimDaPaz}, vitoria no tick ${s.tick}, ${rodadas} rodadas, ${vivos} de 18 cabras vivos, combate capturado: ${capturouCombate}`);
}

module.exports = { roteiro };
