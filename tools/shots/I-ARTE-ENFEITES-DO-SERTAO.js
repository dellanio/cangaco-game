const { readFileSync } = require('node:fs');
const manifesto = require('../../assets/manifest.json');
const uri = rel => `data:image/png;base64,${readFileSync(`assets/${rel}`).toString('base64')}`;
async function roteiro({ page, capturar, afirmar }) {
  // a prancha e dos oito enfeites 1x1; a tapera (2x2, I-TELA-ENFEITES-EM-SITIOS) tem a prova propria em base/props/tapera
  const enfeites = manifesto.assets.filter(e => e.tipo === 'enfeite' && e.id !== 'tapera');
  afirmar(enfeites.length === 8, 'oito enfeites na prancha');
  const solo = manifesto.assets.find(e => e.tipo === 'terreno' && e.id === 'grama');
  const dados = { solo: uri(Object.values(solo.estados)[0]), sprites: enfeites.map(e => ({ id: e.id, uri: uri(e.estados.normal) })) };
  await page.evaluate(async ({ solo, sprites }) => {
    const img = async uri => { const i = new window.Image(); i.src = uri; await i.decode(); return i; };
    const chao = await img(solo);
    const imagens = await Promise.all(sprites.map(s => img(s.uri)));
    const canvas = window.document.createElement('canvas');
    canvas.width = 1280; canvas.height = 640;
    canvas.style.cssText = 'position:fixed;inset:0;margin:auto;z-index:99999;max-width:100%;max-height:100%;background:#282219';
    window.document.body.append(canvas);
    const ctx = canvas.getContext('2d');
    for (const [r, zoom] of [0.5, 1, 2].entries()) {
      for (let y = r*200; y < r*200+184; y+=64) for (let x=0;x<1280;x+=64) ctx.drawImage(chao,x,y,64,64);
      ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.fillText(`zoom ${zoom} — oito enfeites / homologação do operador`, 12, r*200+18);
      imagens.forEach((i,k) => { ctx.drawImage(i, k*160+80-32*zoom,r*200+168-64*zoom,64*zoom,64*zoom); ctx.fillText(sprites[k].id,k*160+8,r*200+184); });
    }
  }, dados);
  await capturar('prancha-oito-no-solo');
}
module.exports = { roteiro };
