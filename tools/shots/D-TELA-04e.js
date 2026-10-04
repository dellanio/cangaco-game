'use strict';
const { URL } = require('node:url');
const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const manifesto = require('../../assets/manifest.json');

/** BUG-ROTEIRO-04E-DELTA-DO-ATLAS — o atlas que a cena NORMAL carrega para o serf, pelo manifesto
 *  (o `atlas` do asset e o `meta.image` do json dele). Com `?depuracao` o atlas de depuracao entra
 *  na fila primeiro com a MESMA chave (`unidade:serf:atlas`), e `render/sprites.ts` pula o normal:
 *  ele SUBSTITUI o do serf, nao se soma. Medido em 2026-10-04: no `3e08253` o normal tinha
 *  512 x 576, e 2 211 840 - 1 179 648 = 1 032 192, o delta que o roteiro antigo recusava. */
function bytesDoAtlasNormal(id) {
  const asset = manifesto.assets.find((a) => a.id === id);
  const json = path.join('assets', asset.atlas);
  const imagem = path.join(path.dirname(json), JSON.parse(readFileSync(json, 'utf8')).meta.image);
  const png = readFileSync(imagem);
  return { arquivo: imagem.split(path.sep).join('/'), largura: png.readUInt32BE(16), altura: png.readUInt32BE(20), bytes: png.readUInt32BE(16) * png.readUInt32BE(20) * 4 };
}

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
  const normal = bytesDoAtlasNormal('serf');
  const deltaEsperado = bytesDoAtlas - normal.bytes;
  afirmar(respostasDoPng.length === 1, 'depuração deve carregar o PNG do atlas uma vez');
  afirmar(
    comAtlas - semAtlas === deltaEsperado,
    `delta ${comAtlas - semAtlas} deve ser ${deltaEsperado}: o atlas de depuracao (${bytesDoAtlas}) no lugar do normal ${normal.arquivo} (${normal.bytes})`,
  );
  await page.evaluate(() => window.__cangaco.avancar(1));
  await page.waitForTimeout(100);
  afirmar((await estado()).memoriaDeTexturas === comAtlas, 'mudar quadro não deve alocar textura');
  await page.keyboard.press('p'); await page.waitForTimeout(150); await page.keyboard.press('p');
  await page.waitForTimeout(100);
  afirmar((await estado()).animacoesDeUnidadeTrabalhadas === 0, 'pausa e câmera parada: zero trabalho');
  writeFileSync('test-output/D-TELA-04e.json', JSON.stringify({
    semAtlas, comAtlas, delta: comAtlas - semAtlas, largura, altura, bytesDoAtlas, atlasNormalSubstituido: normal, deltaEsperado,
    requisicoesDoAtlas, respostasDoPng,
    unidade: 'bytes RGBA8 das fontes carregadas; não memória real de GPU',
    quadrosFisicos: 90, quadrosComEspelho: 144,
    bytesDos90QuadrosSemTrim: 90 * 64 * 96 * 4,
    bytesDos144QuadrosSemTrim: 144 * 64 * 96 * 4,
    nota: 'O atlas de formas usa slots fixos; trim prova a origem, sem economia de bytes neste empacotamento.',
  }, null, 2));
}
module.exports = { roteiro };
