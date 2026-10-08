'use strict';
const { writeFileSync } = require('node:fs');
const { Buffer } = require('node:buffer');
const { pares } = require('../../data/caatinga-arte.json');
const manifesto = require('../../assets/manifest.json');
async function roteiro({ page, capturar, afirmar }) {
  const lista = pares.map(p => ({ id: p.id, inverno: p.inverno, seca: manifesto.assets.find(a => a.tipo === 'vegetacao' && a.id === p.entrada).estados[p.estado === 'presente' ? 'seca' : `seca:${p.estado}`] }));
  for (const z of [0.5, 1, 2]) {
    const png = await page.evaluate(async ({ lista, z, solo }) => {
      const carregar = src => new Promise((ok, erro) => { const i = new window.Image(); i.onload = () => ok(i); i.onerror = erro; i.src = '/assets/' + src; });
      const fundo = await carregar(solo), imagens = await Promise.all(lista.map(async p => [await carregar(p.inverno), await carregar(p.seca)]));
      const c = window.document.createElement('canvas'), celula = 192 * z + 18, linha = 256 * z + 35;
      c.width = celula * lista.length; c.height = linha * 4 + 40;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      for (let y = 0; y < c.height; y += 64) for (let x = 0; x < c.width; x += 64) ctx.drawImage(fundo, x, y, 64, 64);
      ctx.fillStyle = '#21180f'; ctx.font = '18px serif'; ctx.fillText(`Inverno / seca — normal e RGB x 0,8 — zoom ${z}`, 10, 24);
      imagens.forEach((par, col) => {
        for (let r = 0; r < 4; r++) {
          const s = window.document.createElement('canvas'), original = par[r % 2]; s.width = original.width; s.height = original.height;
          const sc = s.getContext('2d'); sc.drawImage(original, 0, 0);
          if (r >= 2) { const d = sc.getImageData(0, 0, s.width, s.height); for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] *= 0.8; sc.putImageData(d, 0, 0); }
          ctx.drawImage(s, col * celula + 9, 40 + r * linha, s.width * z, s.height * z);
          ctx.fillText(lista[col].id + (r % 2 ? ' seca' : ' inverno'), col * celula + 9, 40 + r * linha + s.height * z + 21);
        }
      });
      return c.toDataURL('image/png');
    }, { lista, z, solo: manifesto.assets.find(a => a.tipo === 'terreno' && a.id === 'grama').estados.padrao });
    afirmar(png.startsWith('data:image/png;base64,'), 'prancha exportada pelo canvas com os seis pares');
    const nome = `screenshots/I-ARTE-CAATINGA-NA-SECA-prancha-zoom-${z}.png`;
    writeFileSync(nome, Buffer.from(png.split(',')[1], 'base64'));
    await page.evaluate(png => {
      window.document.getElementById('prancha-caatinga')?.remove();
      const i = new window.Image(); i.id = 'prancha-caatinga'; i.src = png; i.style.cssText = 'position:fixed;left:270px;top:20px;width:980px;max-height:660px;object-fit:contain;z-index:9999'; window.document.body.append(i);
    }, png);
    await capturar(`seis-pares-zoom-${z}`);
  }
  await page.evaluate(() => window.document.getElementById('prancha-caatinga').remove());
}
module.exports = { roteiro };
