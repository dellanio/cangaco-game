'use strict';
const { readFileSync, writeFileSync } = require('node:fs');
const { Buffer } = require('node:buffer');
const { URL } = require('node:url');
const config = require('../../data/piloto-conjunto.json');
const terreno = require('../../data/terrain.json');
const { retanguloDoCanvas } = require('./_canvas');
async function roteiro({ page, estado, afirmar, capturar }) {
  const dados = JSON.parse(readFileSync('test-output/I-ARTE-PILOTO-DE-CONJUNTO.json', 'utf8'));
  const url = new URL(page.url()); url.searchParams.set('semNevoa', '');
  await page.goto(url.toString()); await page.waitForFunction(() => window.__cangaco?.pronto);
  const canvas = await retanguloDoCanvas(page);
  await page.waitForTimeout(250);
  const s = await estado();
  const armazem = Object.entries(s.prediosDoEstado).map(([id, p]) => ({ ...p, id })).find(p => p.tipo === 'storehouse' && p.lado === 0);
  afirmar(armazem !== undefined, 'Armazém inicial existe');
  afirmar(s.spritesDePredio[armazem.id] === 'predio:storehouse:completo', `Armazém usa a arte real: ${s.spritesDePredio[armazem.id]}`);
  afirmar(s.unidadesRenderizadas.some(u => u.tipo === 'serf' && u.sprite), 'Carregador usa sprite real na vila');
  afirmar(s.arteDasCamadas.vegetacao.includes('tree'), 'árvore presente no loader real');
  for (const z of config.zooms) {
    await page.mouse.move(canvas.left + canvas.width / 2, canvas.top + canvas.height / 2);
    for (let i = 0; i < 10 && (await estado()).camera.zoom !== z; i++) {
      await page.mouse.wheel(0, (await estado()).camera.zoom > z ? 200 : -200); await page.waitForTimeout(100);
    }
    afirmar((await estado()).camera.zoom === z, `zoom ${z}`);
    await page.evaluate(c => window.__cangaco.fixarCamera(c), { scrollX: (armazem.gx + 1.5) * terreno.tile_px - canvas.width / 2, scrollY: (armazem.gy + 1.5) * terreno.tile_px - canvas.height / 2 });
    await page.mouse.move(20, 20); await page.waitForTimeout(200); await capturar(`vila-zoom-${z}`);
    const png = await page.evaluate(async ({ dados, config, z }) => {
      const load = src => new Promise((ok, erro) => { const im = new window.Image(); im.onload = () => ok(im); im.onerror = erro; im.src = '/assets/' + src; });
      const sprites = await Promise.all(dados.elementos.map(async e => {
        const im = await load(e.arquivo), c = window.document.createElement('canvas'); c.width = e.recorte.w; c.height = e.recorte.h;
        c.getContext('2d').drawImage(im, e.recorte.x, e.recorte.y, e.recorte.w, e.recorte.h, 0, 0, c.width, c.height); return c;
      }));
      const solos = await Promise.all(dados.solos.map(e => load(e.arquivo)));
      const l = config.prancha, w = l.larguraCelula * z + l.margem * 2, h = l.alturaCelula * z + l.rodape;
      const c = window.document.createElement('canvas'); c.width = w * solos.length; c.height = h * config.fatoresRGB.length;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = true;
      config.fatoresRGB.forEach((fator, row) => solos.forEach((solo, col) => {
        const painel = window.document.createElement('canvas'); painel.width = w; painel.height = h - l.rodape;
        const p = painel.getContext('2d');
        for (let y = 0; y < painel.height; y += solo.height * z) for (let x = 0; x < w; x += solo.width * z) p.drawImage(solo, x, y, solo.width * z, solo.height * z);
        let x = l.margem;
        sprites.forEach((im, i) => { const e = dados.elementos[i], ew = im.width * e.escala * z, eh = im.height * e.escala * z; p.drawImage(im, x, painel.height - l.margem - eh, ew, eh); x += ew + l.margem; });
        if (fator !== 1) { const d = p.getImageData(0, 0, painel.width, painel.height); for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(d.data[i + k] * fator); p.putImageData(d, 0, 0); }
        ctx.drawImage(painel, col * w, row * h); ctx.fillStyle = '#f0e4cf'; ctx.fillRect(col * w, row * h + painel.height, w, l.rodape);
        ctx.fillStyle = '#21180f'; ctx.font = '16px serif'; ctx.fillText(`${dados.solos[col].id} | zoom ${z} | RGB x ${fator}`, col * w + 8, row * h + painel.height + 24);
      })); return c.toDataURL('image/png');
    }, { dados, config, z });
    afirmar(png.startsWith('data:image/png;base64,'), 'prancha usa os PNGs reais');
    writeFileSync(`screenshots/I-ARTE-PILOTO-DE-CONJUNTO-prancha-zoom-${z}.png`, Buffer.from(png.split(',')[1], 'base64'));
  }
}
module.exports = { roteiro };
