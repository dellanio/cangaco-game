'use strict';
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const mapa = require('../../data/maps/sertao-128.json');
const config = require('../../data/agua-peixe.json');

async function roteiro({ page, estado, afirmar, capturar }) {
  const frame = () => page.waitForTimeout(100);
  const avancar = (n) => page.evaluate((ticks) => window.__cangaco.avancar(ticks), n);
  const camera = async (tile) => {
    await page.evaluate((t) => window.__cangaco.fixarCamera({ scrollX: (t.gx + 0.5) * 64 - 640,
      scrollY: (t.gy + 0.5) * 64 - 360, zoom: 1 }), tile);
    await frame();
  };
  const conferir = async () => {
    const s = await estado();
    afirmar(s.poolDosAneis === config.maximoNaVista, 'Pool fixo dos aneis.');
    afirmar(s.aneisDaAgua.length <= config.maximoNaVista, 'Teto dos aneis na vista.');
    for (const a of s.aneisDaAgua) {
      afirmar(mapa.legenda[mapa.linhas[a.gy][a.gx]] === 'agua', 'Todo anel esta na agua.');
      const x = (a.gx + 0.5) * 64;
      const y = (a.gy + 0.5) * 64;
      afirmar(x >= s.camera.scrollX && y >= s.camera.scrollY
        && x < s.camera.scrollX + 1280 / s.camera.zoom && y < s.camera.scrollY + 720 / s.camera.zoom, 'Anel so na vista.');
    }
    await frame();
    afirmar((await estado()).trabalhoDosAneisNoQuadro === 0, 'Pausado e camera parada: zero trabalho.');
    return s;
  };
  const tiles = [];
  for (let gy = 0; gy < mapa.altura; gy += 1) for (let gx = 0; gx < mapa.largura; gx += 1)
    if (mapa.legenda[mapa.linhas[gy][gx]] === 'agua') tiles.push({ gx, gy });
  const tile = tiles[Math.floor(tiles.length / 2)];
  afirmar(Boolean(tile), 'Mapa tem acude.');
  await page.mouse.move(1279, 719);
  await camera(tile);
  let s = await conferir();
  let passos = 0;
  while (!s.aneisDaAgua.some((a) => a.tipo === 'peixe') && passos < 4 * config.intervaloDoPeixeTicks) {
    await avancar(1);
    await frame();
    s = await estado();
    passos += 1;
  }
  afirmar(s.aneisDaAgua.some((a) => a.tipo === 'peixe'), 'Peixe em ate quatro intervalos.');
  // Captura na metade da vida, onde o circulo ja abriu.
  await avancar(Math.floor(config.vidaTicks / 2));
  await frame();
  s = await conferir();
  const tickDoPeixe = s.tick;
  afirmar(s.aneisDaAgua.some((a) => a.tipo === 'peixe'), 'Anel do peixe ainda vivo.');
  const primeira = await capturar('peixe-primeira-corrida');
  const sha = (arquivo) => createHash('sha256').update(fs.readFileSync(arquivo)).digest('hex');
  const hashPrimeira = sha(primeira);
  await page.reload();
  await page.waitForFunction(() => window.__cangaco?.pronto);
  await camera(tile);
  await avancar(tickDoPeixe);
  await frame();
  await conferir();
  const segunda = await capturar('peixe-segunda-corrida');
  afirmar(sha(segunda) === hashPrimeira, 'Sha256 igual nas duas corridas do peixe.');

  const texto = fs.readFileSync('test-output/D-TELA-AGUA-PEIXE.save.txt', 'utf8');
  const partida = JSON.parse(texto).estado;
  const u = partida.unidades.porId.pescador;
  const alvo = partida.jobs.tarefas.porId[u.fsmData.tarefa].origemTile;
  await page.evaluate((save) => window.localStorage.setItem('cangaco:partida', save), texto);
  await page.keyboard.press('h');
  await frame();
  await page.click('#ajuda [data-acao="carregar"]');
  await frame();
  await page.keyboard.press('Escape');
  await camera(alvo);
  s = await conferir();
  afirmar(s.aneisDaAgua.some((a) => a.tipo === 'pescador' && a.gx === alvo.gx && a.gy === alvo.gy), 'Pescador abre anel no origemTile da tarefa.');
  await avancar(2);
  await frame();
  await capturar('pescador-mexendo-a-agua');
  await page.keyboard.press('p');
  await page.waitForTimeout(150);
  await page.keyboard.press('p');
  await frame();
  afirmar((await conferir()).pausado, 'Passo despausado volta a pausar.');
  console.log(`peixe tick ${tickDoPeixe}; sha256 ${hashPrimeira}; pool ${config.maximoNaVista}; trabalho pausado 0; pescador alvo ${alvo.gx},${alvo.gy}`);
}

module.exports = { roteiro };
