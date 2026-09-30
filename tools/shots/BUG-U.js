'use strict';
// Roteiro do BUG-U, causa A (o quartel sem estrada ate o armazem avisa).
//
// Carrega a partida que `tests/BUG-U-quartel-sem-estrada.test.ts` grava: a vila inicial com
// um Quartel pronto, sem estrada ate o armazem, e machados no armazem. A arma so vem pela
// estrada (`arma-para-quartel`, modo `estrada`); o aviso tem de dizer isso ao jogador.
//   1. o jogo ANDA alguns passos (§8) e o `#alertas` mostra "Sem estrada ate o armazem",
//      com o Quartel contado;
//   2. o Quartel e o unico predio da partida nessa causa: a contagem e 1;
//   3. a camera centra no Quartel e a captura o mostra ao lado do aviso (limpeza do
//      avaliador, 2026-10-01: a captura antiga era a abertura da vila, sem o Quartel).
const { readFileSync, existsSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const tema = require('../../data/theme-sertao.json');
const terreno = require('../../data/terrain.json');
const predios = require('../../data/buildings.json');

const TILE_PX = terreno.tile_px;

const CHAVE_DO_SAVE = 'cangaco:partida';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const canvas = await retanguloDoCanvas(page);

  async function centrarNoEixo(alvoEmTiles, eixo) {
    const vao = eixo === 'x' ? canvas.width : canvas.height;
    for (let i = 0; i < 120; i += 1) {
      const { camera } = await estado();
      const alvo = alvoEmTiles * TILE_PX - vao / 2;
      const delta = alvo - (eixo === 'x' ? camera.scrollX : camera.scrollY);
      if (Math.abs(delta) < TILE_PX / 2) return;
      const [mais, menos] = eixo === 'x' ? ['ArrowRight', 'ArrowLeft'] : ['ArrowDown', 'ArrowUp'];
      await page.keyboard.down(delta > 0 ? mais : menos);
      await page.waitForTimeout(Math.abs(delta) > 8 * TILE_PX ? 400 : 60);
      await page.keyboard.up(delta > 0 ? mais : menos);
      await esperarFrame();
    }
  }

  const arquivo = 'test-output/BUG-U.save.txt';
  afirmar(existsSync(arquivo), `${arquivo} nao existe: rode \`npm run test\` antes`);
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CHAVE_DO_SAVE, readFileSync(arquivo, 'utf8')]);
  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="carregar"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const s = await estado();
  const quartel = s.prediosDoEstado['quartel'];
  afirmar(quartel !== undefined && quartel.tipo === 'barracks', 'a partida deveria ter o Quartel');

  // 1. o jogo andando: o aviso nasce do estado corrente, nao do que veio no save
  await page.keyboard.press('p');
  await page.waitForTimeout(600);
  await page.keyboard.press('p');
  await esperarFrame();

  const avisos = await page.$$eval('#alertas .alerta', (ns) => ns
    .filter((n) => !n.hasAttribute('hidden'))
    .map((n) => ({
      causa: n.dataset.causa,
      rotulo: n.querySelector('.rotulo').textContent,
      contagem: n.querySelector('.contagem').textContent,
    })));
  afirmar(await page.isVisible('#alertas'), 'o aviso deveria estar na tela');
  const semEstrada = avisos.find((a) => a.causa === 'sem-estrada');
  afirmar(semEstrada !== undefined, `deveria haver a linha sem-estrada: ${JSON.stringify(avisos)}`);
  afirmar(semEstrada.rotulo === tema.alertas.causas['sem-estrada'], `o rotulo deveria vir do tema: ${JSON.stringify(semEstrada)}`);
  // 2. so o Quartel
  afirmar(semEstrada.contagem === '1', `a contagem deveria ser 1 (o Quartel): ${JSON.stringify(semEstrada)}`);

  // 3. o Quartel no quadro, medido pela camera, nao pelo olho
  const def = predios.predios.find((p) => p.id === 'barracks');
  const [larg, alt] = def.tamanho;
  await centrarNoEixo(quartel.gx + larg / 2, 'x');
  await centrarNoEixo(quartel.gy + alt / 2, 'y');
  const { camera } = await estado();
  const vista = { x0: camera.scrollX, y0: camera.scrollY, x1: camera.scrollX + canvas.width / camera.zoom, y1: camera.scrollY + canvas.height / camera.zoom };
  afirmar(
    quartel.gx * TILE_PX >= vista.x0 && (quartel.gx + larg) * TILE_PX <= vista.x1
      && quartel.gy * TILE_PX >= vista.y0 && (quartel.gy + alt) * TILE_PX <= vista.y1,
    `o Quartel (${quartel.gx},${quartel.gy}) deveria caber na vista ${JSON.stringify(vista)}`,
  );
  await capturar('aviso');
  console.log(`BUG-U: avisos ${JSON.stringify(avisos)}`);
}

module.exports = { roteiro };
