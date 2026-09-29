'use strict';
// Roteiro da D-TELA-01 — A ABA DE ESTATISTICAS.
//   1. H -> "Nova escaramuca". DESPAUSADO e com o botao seguro 150 ms (§8), o clique na aba
//      Estatisticas troca o corpo para `estatisticas`;
//   2. as linhas de predio batem, por tipo, com os predios do jogador no estado;
//   3. a soma das linhas de gente bate com o civil da barra (`#hud [data-campo="populacao"]`);
//   4. a linha com parados (`data-ociosos` > 0) tem a classe `ocioso`, e nenhuma outra a tem;
//   5. a captura mostra a aba.
const LADO_DO_JOGADOR = 0;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  // 1. a aba, despausado e com o botao seguro
  const aba = await page.$eval('#abas [data-aba="estatisticas"]', (b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.keyboard.press('p');
  await page.mouse.move(aba.x, aba.y);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.keyboard.press('p');
  await esperarFrame();
  const corpo = await page.evaluate(() => window.document.body.dataset.corpo);
  afirmar(corpo === 'estatisticas', `o corpo deveria ser 'estatisticas', e '${corpo}'`);

  // 2. predios por tipo
  const s = await estado();
  const esperado = {};
  for (const p of Object.values(s.prediosDoEstado)) {
    if (p.lado === LADO_DO_JOGADOR) esperado[p.tipo] = (esperado[p.tipo] ?? 0) + 1;
  }
  const lido = await page.evaluate(() => {
    const linhas = (lista) => [...window.document.querySelectorAll(`#estatisticas [data-lista="${lista}"] li`)].map((li) => ({
      tipo: li.dataset.tipo,
      nome: li.querySelector('.nome').textContent,
      numero: Number(li.querySelector('.numero').textContent),
      detalhe: li.querySelector('.detalhe').textContent,
      ociosos: li.dataset.ociosos === undefined ? null : Number(li.dataset.ociosos),
      classeOcioso: li.classList.contains('ocioso'),
      visivel: li.getBoundingClientRect().height > 0,
    }));
    return {
      predios: linhas('predios'), gente: linhas('gente'),
      populacao: window.document.querySelector('#hud [data-campo="populacao"]').textContent,
    };
  });
  const naTela = {};
  for (const l of lido.predios) naTela[l.tipo] = l.numero + (Number((l.detalhe.match(/\d+/) ?? ['0'])[0]));
  afirmar(JSON.stringify(Object.keys(naTela).sort()) === JSON.stringify(Object.keys(esperado).sort()),
    `os tipos de predio na tela (${Object.keys(naTela)}) deveriam ser os do estado (${Object.keys(esperado)})`);
  for (const [tipo, n] of Object.entries(esperado)) afirmar(naTela[tipo] === n, `${tipo}: a tela diz ${naTela[tipo]}, o estado tem ${n}`);
  afirmar(lido.predios.every((l) => l.visivel && l.nome !== l.tipo), 'toda linha de predio deveria estar visivel e com o nome do tema');

  // 3. a gente soma o civil da barra
  const civil = Number(lido.populacao.split('/')[0]);
  const soma = lido.gente.reduce((n, l) => n + l.numero, 0);
  afirmar(soma === civil, `a gente deveria somar ${civil} (barra), soma ${soma}`);

  // 4. o destaque so em quem tem parado
  const comParados = lido.gente.filter((l) => l.ociosos !== null && l.ociosos > 0);
  afirmar(comParados.length > 0, 'a escaramuca no inicio deveria ter gente parada');
  afirmar(lido.gente.every((l) => l.classeOcioso === (l.ociosos !== null && l.ociosos > 0)), 'a classe ocioso deveria acender so em quem tem parados');
  afirmar(comParados.every((l) => l.detalhe.includes(String(l.ociosos))), 'a linha com parados deveria dizer quantos');

  await capturar('aba-de-estatisticas');
  console.log(`D-TELA-01: ${JSON.stringify({ corpo, esperado, predios: lido.predios, gente: lido.gente, populacao: lido.populacao })}`);
}

module.exports = { roteiro };
