'use strict';
const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
async function roteiro({ page, estado, afirmar, capturar }) {
  execFileSync(process.execPath, ['tools/preparar-fontes-volume.mjs'], { cwd: process.cwd(), stdio: 'pipe', timeout: 120000 });
  const fases = JSON.parse(readFileSync('test-output/fontes-volume/medidas.json', 'utf8'));
  const canvas = await retanguloDoCanvas(page), medidas = [];
  for (const fase of fases) {
    const texto = readFileSync(fase.path, 'utf8');
    await page.evaluate(texto => window.localStorage.setItem('cangaco:partida', texto), texto);
    await page.keyboard.press('h'); await page.waitForTimeout(100);
    await page.click('#ajuda [data-acao="carregar"]'); await page.waitForTimeout(150);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    let s = await estado();
    afirmar(s.tick === fase.tick, `save ${fase.tipo}/${fase.estado} carregado no tick ${fase.tick}`);
    const [gx, gy] = fase.chave.split(',').map(Number);
    await page.evaluate(c => window.__cangaco.fixarCamera(c), {
      scrollX: (gx + 0.5) * terreno.tile_px - canvas.width / (2 * s.camera.zoom),
      scrollY: (gy + 0.5) * terreno.tile_px - canvas.height / (2 * s.camera.zoom),
    });
    await page.waitForTimeout(150); s = await estado();
    const fonte = s.fontesNaturais.tiles[fase.chave];
    if (fase.estado === 'zero') afirmar(fonte === undefined, 'tile esgotado remove sprite');
    else {
      afirmar(fonte.estado === fase.estado, 'estado deriva da quantidade restante');
      afirmar(fonte.textura === `recurso:${fase.tipo}:${fase.estado}`, `textura realmente desenhada: ${fonte.textura}`);
    }
    afirmar(Object.entries(s.fontesNaturais.tiles).some(([k, f]) => k !== fase.chave && f.tipo === fase.tipo && f.estado === 'presente'), 'outros depositos permanecem inteiros');
    medidas.push({ ...fase, fonte, recalculos: s.fontesNaturais.recalculos, repinturas: s.fontesNaturais.repinturas });
    await capturar(`${fase.tipo}-${fase.estado}`);
    await page.waitForTimeout(150); const parado = await estado();
    afirmar(parado.fontesNaturais.recalculos === s.fontesNaturais.recalculos && parado.fontesNaturais.repinturas === s.fontesNaturais.repinturas, 'quadros pausados nao recalculam nem repintam fontes');
  }
  writeFileSync('test-output/I-TELA-FONTES-NATURAIS-PELO-VOLUME-medidas.json', JSON.stringify(medidas, null, 2));
}
module.exports = { roteiro };
