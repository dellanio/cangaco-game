'use strict';
// I-TELA-MENU-DA-PROPOSTA: o menu lateral no estilo da proposta do operador. No navegador de verdade:
// as quatro sub-abas com o icone (o `::before` com imagem) e o rotulo; a secao das ruas e rocados
// com titulo e o nome de cada ferramenta; a secao de construcoes da sub-aba com titulo; cada
// construcao num cartao com o nome; nenhum rotulo cortado e nenhum cartao fora da barra. O gesto de
// cada sub-aba e o do jogador, com o jogo ANDANDO e segurando 150 ms (CLAUDE.md §8). No fim, rola ate
// o pe: a cidade e o rodape estao desenhados.
const grupos = require('../../data/menu-build.json').grupos;

async function roteiro({ page, capturar, estado, afirmar }) {
  const esperar = () => page.waitForTimeout(150);
  // o que se mede no DOM, numa chamada so
  const medir = () => page.evaluate(() => {
    const doc = window.document;
    const barra = doc.getElementById('barra').getBoundingClientRect();
    const cortado = (n) => n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1;
    const subabas = [...doc.querySelectorAll('#menu-build .subaba')].map((s) => ({
      grupo: s.dataset.grupo,
      icone: window.getComputedStyle(s, '::before').backgroundImage,
      rotulo: s.querySelector('.rotulo')?.textContent ?? '',
      cortado: cortado(s),
      selecionada: s.getAttribute('aria-selected') === 'true',
    }));
    const ferramentas = [...doc.querySelectorAll('#menu-build [data-ferramenta]')].map((b) => ({
      id: b.dataset.ferramenta, nome: b.querySelector('.nome')?.textContent ?? '', cortado: b.querySelector('.nome') ? cortado(b.querySelector('.nome')) : true,
    }));
    const titulos = [...doc.querySelectorAll('#menu-build .titulo-secao')].filter((t) => !t.hidden)
      .map((t) => ({ secao: t.dataset.secao, titulo: t.querySelector('h3')?.textContent ?? '', sub: t.querySelector('p')?.textContent ?? '' }));
    const grade = doc.querySelector('#menu-build .grade[data-grupo]:not([hidden])');
    const cartoes = grade ? [...grade.querySelectorAll('[data-predio]')].map((b) => {
      const r = b.getBoundingClientRect();
      const nome = b.querySelector('.nome');
      return { id: b.dataset.predio, nome: nome?.textContent ?? '', cortado: nome ? cortado(nome) : true, fora: r.left < barra.left || r.right > barra.right };
    }) : [];
    const estrada = window.getComputedStyle(doc.querySelector('#menu-build .glifo-estrada'), '::before').backgroundImage;
    return { subabas, ferramentas, titulos, grade: grade?.dataset.grupo ?? null, cartoes, estrada };
  });

  // abre o Construir (a aba ja nasce nele; o clique garante)
  await page.click('#abas [data-aba="construir"]');
  await esperar();
  const m0 = await medir();
  afirmar(m0.subabas.length === grupos.length && m0.subabas.every((s) => s.icone.includes('subaba-') && s.rotulo !== '' && !s.cortado),
    `as sub-abas deveriam ter icone e rotulo inteiros: ${JSON.stringify(m0.subabas)}`);
  afirmar(m0.ferramentas.length >= 5 && m0.ferramentas.every((f) => f.nome !== '' && !f.cortado),
    `cada ferramenta deveria ter o nome inteiro embaixo: ${JSON.stringify(m0.ferramentas)}`);
  afirmar(m0.estrada.includes('ferramenta-rua.png'), `a rua deveria ser o calcamento de pedra: ${m0.estrada}`);

  // o gesto de cada sub-aba, com o jogo andando
  await page.keyboard.press('p');
  await esperar();
  afirmar((await estado()).pausado === false, 'o gesto das sub-abas vale com o laco ANDANDO');
  for (const g of grupos) {
    const seletor = `#menu-build .subaba[data-grupo="${g.id}"]`;
    await page.locator(seletor).scrollIntoViewIfNeeded();
    const r = await page.$eval(seletor, (n) => { const b = n.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(r.x, r.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await esperar();
    const m = await medir();
    afirmar(m.grade === g.id && m.subabas.find((s) => s.grupo === g.id)?.selecionada, `a sub-aba ${g.id} deveria ficar escolhida: ${JSON.stringify(m.grade)}`);
    const secoes = m.titulos.map((t) => t.secao);
    afirmar(JSON.stringify(secoes) === JSON.stringify(['ferramentas', g.id]) && m.titulos.every((t) => t.titulo && t.sub),
      `com a sub-aba ${g.id}, os titulos deveriam ser o das ruas e o dela: ${JSON.stringify(m.titulos)}`);
    afirmar(m.cartoes.length > 0 && m.cartoes.every((c) => c.nome !== '' && !c.cortado && !c.fora),
      `os cartoes de ${g.id} deveriam ter o nome inteiro e caber na barra: ${JSON.stringify(m.cartoes.filter((c) => !c.nome || c.cortado || c.fora))}`);
  }
  await page.keyboard.press('p');
  await esperar();
  afirmar((await estado()).pausado === true, 'o roteiro segue pausado depois do passo despausado');

  // a captura do alto, na Vila (como a proposta)
  await page.locator('#menu-build .subaba[data-grupo="vila"]').click();
  await page.evaluate(() => { window.document.getElementById('corpo-aba').scrollTop = 0; });
  await esperar();
  await capturar('menu-alto');

  // o pe: a cidade e o rodape
  await page.evaluate(() => { const c = window.document.getElementById('corpo-aba'); c.scrollTop = c.scrollHeight; });
  await esperar();
  const pe = await page.evaluate(() => {
    const doc = window.document;
    const cidade = doc.querySelector('#menu-build .cidade');
    const corpo = doc.getElementById('corpo-aba').getBoundingClientRect();
    const rc = cidade.getBoundingClientRect();
    const marca = doc.getElementById('marca');
    return {
      cidade: window.getComputedStyle(cidade).backgroundImage, cidadeNaVista: rc.top >= corpo.top - 1 && rc.bottom <= corpo.bottom + 1 && rc.height > 0,
      rodape: window.getComputedStyle(marca).backgroundImage, rodapeAltura: marca.getBoundingClientRect().height,
    };
  });
  afirmar(pe.cidade.includes('cidade.png') && pe.cidadeNaVista, `a cidade deveria estar no pe do menu: ${JSON.stringify(pe)}`);
  afirmar(pe.rodape.includes('rodape-sol.png') && pe.rodapeAltura > 0, `o rodape do sol deveria estar desenhado: ${JSON.stringify(pe)}`);
  console.log(`I-TELA-MENU-DA-PROPOSTA — sub-abas ${m0.subabas.map((s) => s.rotulo).join(', ')}; ferramentas ${m0.ferramentas.map((f) => f.nome).join(', ')}`);
  await capturar('menu-pe');
}
module.exports = { roteiro };
