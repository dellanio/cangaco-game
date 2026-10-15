'use strict';
// D-TELA-LUZ-RELEVO, emenda de 2026-10-15 (aceite 3) — o relevo liga por padrao, mas so no mapa dono da altura:
//  - o sertao (a pagina sem parametro de mapa) abre COM a luz do relevo: o campo `relevo` existe na ponte;
//  - a fase 1 da campanha (terreno proprio, 128x128 como o sertao) abre SEM ela, e sem erro de console
//    (o shot.js reprova qualquer um);
//  - `?semRelevo` desliga a luz no sertao.
const { URL } = require('node:url');

const TIMEOUT_PRONTO_MS = 15_000;

async function roteiro({ page, capturar, estado, afirmar }) {
  const base = new URL(page.url());
  const abrir = async (busca) => {
    const url = new URL(base.href);
    url.search = busca;
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.__cangaco && window.__cangaco.pronto), undefined, { timeout: TIMEOUT_PRONTO_MS });
    await page.waitForTimeout(300);
    return estado();
  };

  const sertao = await abrir('?pausado');
  afirmar(sertao.relevo !== undefined && sertao.relevo.ativo === true, `o sertao deveria abrir com o relevo ligado por padrao: ${JSON.stringify(sertao.relevo)}`);
  console.log(`D-TELA-LUZ-RELEVO-PADRAO: sertao com relevo, faixa de luz ${JSON.stringify(sertao.relevo.faixa)}, ${sertao.relevo.pxDeMundoPorDegrau} px por degrau`);
  await capturar('sertao-com-relevo');

  const fase = await abrir('?pausado&campanha=fase-01-pianco');
  afirmar(fase.relevo === undefined, `a fase 1 nao deveria desenhar o relevo do sertao: ${JSON.stringify(fase.relevo)}`);
  console.log('D-TELA-LUZ-RELEVO-PADRAO: fase 1 sem relevo');
  await capturar('fase-1-sem-relevo');

  const liso = await abrir('?pausado&semRelevo');
  afirmar(liso.relevo === undefined, `?semRelevo deveria desligar a luz no sertao: ${JSON.stringify(liso.relevo)}`);
}

module.exports = { roteiro };
