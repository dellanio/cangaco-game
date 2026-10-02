'use strict';
const { URL } = require('node:url');
const { readFileSync, writeFileSync } = require('node:fs');

async function roteiro({ page, estado, afirmar }) {
  await page.waitForTimeout(150);
  const semAtlas = (await estado()).memoriaDeTexturas;
  afirmar(Number.isInteger(semAtlas) && semAtlas > 0, 'TextureManager deve publicar bytes carregados');
  const requisicoesDoAtlas = [];
  const respostasDoPng = [];
  page.on('request', (req) => {
    if (req.url().includes('/depuracao/serf/serf.png')) requisicoesDoAtlas.push({ url: req.url(), tipo: req.resourceType() });
  });
  page.on('response', (res) => {
    if (res.url().includes('/depuracao/serf/serf.png') && /^image\/png/.test(res.headers()['content-type'] ?? '')) {
      respostasDoPng.push(res.url());
    }
  });
  await page.goto(new URL('/?pausado', page.url()).href);
  await page.waitForFunction(() => window.__cangaco?.pronto);
  await page.waitForTimeout(150);
  afirmar(requisicoesDoAtlas.length === 0, 'jogo normal não deve requisitar atlas de depuração');
  afirmar((await estado()).memoriaDeTexturas === semAtlas, 'recarga normal deve manter a mesma soma');
  await page.goto(new URL('/?pausado&depuracao', page.url()).href);
  await page.waitForFunction(() => window.__cangaco?.pronto);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.__cangaco.fixarCamera({ scrollX: window.__cangaco.camera.scrollX, scrollY: window.__cangaco.camera.scrollY }));
  const comAtlas = (await estado()).memoriaDeTexturas;
  const png = readFileSync('assets/depuracao/serf/serf.png');
  const largura = png.readUInt32BE(16), altura = png.readUInt32BE(20);
  const bytesDoAtlas = largura * altura * 4;
  afirmar(respostasDoPng.length === 1, 'depuração deve carregar o PNG do atlas uma vez');
  afirmar(comAtlas - semAtlas === bytesDoAtlas, `delta ${comAtlas - semAtlas} deve ser ${bytesDoAtlas}`);
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.waitForTimeout(100);
  afirmar((await estado()).memoriaDeTexturas === comAtlas, 'mudar quadro não deve alocar textura');
  await page.keyboard.press('p'); await page.waitForTimeout(150); await page.keyboard.press('p');
  await page.waitForTimeout(100);
  afirmar((await estado()).animacoesDeUnidadeTrabalhadas === 0, 'pausa e câmera parada: zero trabalho');
  writeFileSync('test-output/D-TELA-04e.json', JSON.stringify({
    semAtlas, comAtlas, delta: comAtlas - semAtlas, largura, altura, bytesDoAtlas, requisicoesDoAtlas, respostasDoPng,
    unidade: 'bytes RGBA8 das fontes carregadas; não memória real de GPU',
    quadrosFisicos: 90, quadrosComEspelho: 144,
    bytesDos90QuadrosSemTrim: 90 * 64 * 96 * 4,
    bytesDos144QuadrosSemTrim: 144 * 64 * 96 * 4,
    nota: 'O atlas de formas usa slots fixos; trim prova a origem, sem economia de bytes neste empacotamento.',
  }, null, 2));
}
module.exports = { roteiro };
