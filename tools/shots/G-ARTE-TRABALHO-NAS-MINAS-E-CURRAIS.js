'use strict';
// G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS (aceite 2): o mineiro na boca da mina e o criador na porta do chiqueiro. Carrega
// pela gaveta os saves que o teste grava (a cadeia do ouro e a da carne, andadas ate o predio trabalhar), anda a sim ate
// a cena publicar um quadro da arte nova (`quadrosDeTrabalho`, com `sprite`) e captura o predio.
const { existsSync, readFileSync } = require('node:fs');
const { carregarGaveta } = require('./_partida');
const { retanguloDoCanvas } = require('./_canvas');
const terreno = require('../../data/terrain.json');
const { predios: defs } = require('../../data/buildings.json');

const TETO_TICKS = 2000;
const PASSO = 10;

async function roteiro({ page, capturar, estado, afirmar }) {
  const canvas = await retanguloDoCanvas(page);
  const vistos = {};
  for (const tipo of ['gold_mine', 'swine_farm']) {
    const arquivo = `test-output/G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS-${tipo}.save.txt`;
    afirmar(existsSync(arquivo), `${arquivo} nao existe: rode o teste antes`);
    const texto = readFileSync(arquivo, 'utf8');
    const salvo = JSON.parse(texto).estado;
    const doTipo = new Set(salvo.predios.ordem.filter((pid) => salvo.predios.porId[pid].tipo === tipo));
    await page.evaluate((v) => window.localStorage.setItem('cangaco:partida', v), texto);
    await carregarGaveta(page);
    await page.waitForTimeout(250);
    let achado = null;
    for (let t = 0; t < TETO_TICKS && achado === null; t += PASSO) {
      const s = await estado();
      for (const [pid, q] of Object.entries(s.quadrosDeTrabalho)) {
        if (doTipo.has(pid) && q.sprite === true) achado = { pid, q };
      }
      if (achado === null) { await page.evaluate((k) => window.__cangaco.avancar(k), PASSO); await page.waitForTimeout(80); }
    }
    afirmar(achado !== null, `${tipo}: nenhum quadro da arte nova em ${TETO_TICKS} ticks`);
    const pos = salvo.predios.porId[achado.pid];
    const [w, h] = defs.find((d) => d.id === tipo).tamanho;
    await page.evaluate((cam) => window.__cangaco.fixarCamera(cam), {
      scrollX: Math.round((pos.gx + w / 2) * terreno.tile_px - canvas.width / 2),
      scrollY: Math.round((pos.gy + h / 2 - 1) * terreno.tile_px - canvas.height / 2),
    });
    await page.waitForTimeout(250);
    await capturar(`${tipo}-${achado.q.laco}_${achado.q.n}`);
    vistos[tipo] = achado.q;
  }
  // um passo despausado (§8): o laco anda com o relogio correndo
  await page.keyboard.press('p'); await page.waitForTimeout(400); await page.keyboard.press('p');
  console.log(`G-ARTE-TRABALHO-NAS-MINAS-E-CURRAIS — ${JSON.stringify(vistos)}`);
}
module.exports = { roteiro };
