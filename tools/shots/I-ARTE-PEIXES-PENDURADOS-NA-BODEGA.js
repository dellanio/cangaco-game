'use strict';
const { readFileSync } = require('node:fs');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
async function roteiro({ page, capturar, estado, afirmar }) {
  const original = JSON.parse(readFileSync('saves/teste-operador-vila-pronta.txt', 'utf8'));
  const id = original.estado.predios.ordem.find(id => original.estado.predios.porId[id].tipo === 'inn' && original.estado.predios.porId[id].lado === 0);
  afirmar(id !== undefined, 'fixture contem Bodega');
  const canvas = await retanguloDoCanvas(page);
  for (const n of [0, 1, 2, 5, 6, 12]) {
    const salvo = JSON.parse(JSON.stringify(original)), p = salvo.estado.predios.porId[id];
    p.estoque.entrada.fish = n; p.estoque.entrada.loaves = 5;
    await page.evaluate(s => window.localStorage.setItem('cangaco:partida', s), JSON.stringify(salvo));
    await page.keyboard.press('h'); await page.click('#ajuda [data-acao="carregar"]'); await page.keyboard.press('Escape');
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 10 && (await estado()).camera.zoom !== 2; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(200); }
    await page.evaluate(s => window.__cangaco.fixarCamera(s), { scrollX: Math.round((p.gx + 2) * terreno.tile_px - canvas.width / 2), scrollY: Math.round((p.gy + 1) * terreno.tile_px - canvas.height / 2) });
    await page.waitForTimeout(200);
    const pilhas = (await estado()).pilhasDesenhadas[id] ?? [], peixe = pilhas.find(x => x.mercadoria === 'fish');
    afirmar((peixe?.n ?? 0) === Math.min(n, 6), 'peixes representam estoque real limitado a seis');
    if (n > 0) afirmar(peixe.fonte === 'pilha', 'PNG original do peixe carregado');
    afirmar(pilhas.find(x => x.mercadoria === 'loaves')?.n === 5, 'paes continuam nas mesas');
    await capturar(`${n}-peixes-no-estoque`);
  }
  const manifesto = require('../../assets/manifest.json');
  const peixe = manifesto.assets.find(a => a.tipo === 'pilha' && a.id === 'fish').estados.unidade;
  const solo = manifesto.assets.find(a => a.tipo === 'terreno' && a.id === 'grama').estados.padrao;
  await page.evaluate(async ([peixe, solo]) => {
    const carregar = src => new Promise((ok, erro) => { const i = new window.Image(); i.onload = () => ok(i); i.onerror = erro; i.src = '/assets/' + src; });
    const [sprite, chao] = await Promise.all([carregar(peixe), carregar(solo)]);
    const c = window.document.createElement('canvas'); c.id = 'prancha-peixe'; c.width = 700; c.height = 420;
    c.style.cssText = 'position:fixed;z-index:9999;left:270px;top:40px'; window.document.body.append(c);
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < c.height; y += 64) for (let x = 0; x < c.width; x += 64) ctx.drawImage(chao, x, y, 64, 64);
    ctx.fillStyle = '#24190e'; ctx.font = '17px serif'; ctx.fillText('Peixe — normal / RGB x 0,8 — zoom 0,5 / 1 / 2', 12, 24);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
      const z = [0.5, 1, 2][i], s = window.document.createElement('canvas'); s.width = sprite.width; s.height = sprite.height;
      const sc = s.getContext('2d'); sc.drawImage(sprite, 0, 0);
      if (r) { const d = sc.getImageData(0, 0, s.width, s.height); for (let p = 0; p < d.data.length; p += 4) for (let k = 0; k < 3; k++) d.data[p + k] *= 0.8; sc.putImageData(d, 0, 0); }
      const x = 115 + i * 230, y = 190 + r * 195;
      ctx.drawImage(s, x - s.width * z / 2, y - s.height * z, s.width * z, s.height * z);
      ctx.fillText(String(z), x - 10, y + 20);
    }
  }, [peixe, solo]);
  await capturar('prancha-peixe-no-solo');
  await page.evaluate(() => window.document.getElementById('prancha-peixe').remove());
}
module.exports = { roteiro };
