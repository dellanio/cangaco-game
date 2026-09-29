'use strict';
// Roteiro da D-TRANSPORTE-01b — O PAINEL DO ARMAZEM: o que ele recebe.
//   1. clicar no armazem abre o painel com as 28 mercadorias, na ordem de economy.json, todas
//      aceitas, e a quantidade de cada uma bate com a gaveta que o painel ja mostra;
//   2. DESPAUSADO e com o botao seguro 150 ms (§8), o botao da madeira passa a "nao recebe":
//      `data-aceita` vem do seletor `painelDoPredio`, que le o `naoAceita` do estado — e o
//      estado que mudou, nao o botao;
//   3. a captura mostra a linha bloqueada;
//   4. o mesmo gesto devolve a madeira, e nenhuma outra linha mexeu.
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');
const { retanguloDoCanvas } = require('./_canvas');

const TILE_PX = 64;
const MERCADORIA = 'timber';

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);

  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [larg, alt] = predios.find((p) => p.id === 'storehouse').tamanho;
  const { camera } = await estado();
  const x = canvas.left + (armazem.gx + Math.floor(larg / 2)) * TILE_PX + TILE_PX / 2 - camera.scrollX;
  const y = canvas.top + (armazem.gy + Math.floor(alt / 2)) * TILE_PX + TILE_PX / 2 - camera.scrollY;
  afirmar(x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom, `o armazem deveria estar visivel, cairia em (${x},${y})`);
  await page.mouse.click(x, y);
  await esperarFrame();
  afirmar(await page.isVisible('#painel-predio'), 'clicar no armazem deveria abrir o painel');

  const linhas = () => page.$$eval('#painel-predio [data-aceite]', (ns) => ns.map((n) => ({
    mercadoria: n.dataset.aceite,
    aceita: n.dataset.aceita === 'true',
    quantidade: Number(n.dataset.quantidade),
    bloqueada: n.classList.contains('bloqueada'),
    nome: n.querySelector('.nome').textContent,
    visivel: n.getBoundingClientRect().height > 0,
  })));

  // 1. as 28, na ordem do dado, todas aceitas, com o nome do tema e visiveis
  const antes = await linhas();
  afirmar(JSON.stringify(antes.map((l) => l.mercadoria)) === JSON.stringify(economia.mercadorias),
    `as linhas deveriam ser as de economia.mercadorias, na ordem; vieram ${JSON.stringify(antes.map((l) => l.mercadoria))}`);
  afirmar(antes.every((l) => l.aceita && !l.bloqueada), 'no inicio o armazem deveria aceitar tudo');
  afirmar(antes.every((l) => l.visivel && l.nome === (tema.mercadorias[l.mercadoria] ?? l.mercadoria)), 'toda linha visivel e com o nome do tema');
  const naGaveta = await page.$$eval('#painel-predio [data-gaveta] .item', (ns) => ns.map((n) => ({
    mercadoria: n.dataset.mercadoria, quantidade: Number(n.textContent.trim().split(' ').pop()),
  })));
  const somaDaGaveta = {};
  for (const g of naGaveta) somaDaGaveta[g.mercadoria] = (somaDaGaveta[g.mercadoria] ?? 0) + g.quantidade;
  afirmar(antes.every((l) => l.quantidade === (somaDaGaveta[l.mercadoria] ?? 0)),
    `a quantidade de cada linha deveria bater com as gavetas (${JSON.stringify(somaDaGaveta)})`);

  /** Despausa, segura o botao 150 ms, solta, espera o tick e pausa (§8). */
  async function apertar(mercadoria) {
    const alvo = await page.$eval(`#painel-predio [data-aceite="${mercadoria}"]`, (b) => {
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.keyboard.press('p');
    await page.mouse.move(alvo.x, alvo.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.keyboard.press('p');
    await esperarFrame();
  }

  // 2. bloquear a madeira
  await apertar(MERCADORIA);
  const bloqueado = await linhas();
  const madeira = bloqueado.find((l) => l.mercadoria === MERCADORIA);
  afirmar(madeira !== undefined && !madeira.aceita && madeira.bloqueada, `a madeira deveria ficar bloqueada, veio ${JSON.stringify(madeira)}`);
  afirmar(bloqueado.filter((l) => l.mercadoria !== MERCADORIA).every((l) => l.aceita), 'so a madeira deveria mudar');

  // 3. a evidencia
  await capturar('madeira-bloqueada');

  // 4. liberar de novo
  await apertar(MERCADORIA);
  const depois = await linhas();
  afirmar(depois.every((l) => l.aceita && !l.bloqueada), 'o segundo aperto deveria devolver a madeira');
  console.log(`D-TRANSPORTE-01: ${JSON.stringify({ linhas: antes.length, madeira, somaDaGaveta })}`);
}

module.exports = { roteiro };
