'use strict';

// Roteiro da UI-barra-a — a barra lateral unica, a esquerda, na altura inteira.
//
// Afirma geometria e DOM, nunca pixel. O que este roteiro existe para provar:
//  - o canvas mede (W - 260) x H e a area NAO muda com a selecao, a 1280x720 e a
//    1920x1080; nenhuma faixa da coluna x = barra.right + 1 cai em outra coisa;
//  - so o corpo da aba rola: a barra inteira cabe na altura da janela;
//  - a dica do H fica no TOPO, entre a logo e o minimapa (decisao do operador);
//  - escolher troca a grade pelo painel; Esc e a aba Construir voltam a grade;
//  - a escola mostra engajar em 2 colunas, rotulo curto, sem estouro;
//  - a faixa de alertas tem altura fixa: aviso que aparece nao empurra a grade.
//
// O clique na aba Construir e feito DESPAUSADO e segurado 150 ms (CLAUDE.md §8):
// um redesenho entre o mousedown e o mouseup e a classe de defeito do BUG-B.

const { retanguloDe, retanguloDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const LARGURA_BARRA = 260;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const corpo = () => page.getAttribute('body', 'data-corpo');
  const medidas = {};

  /** Canvas, barra e a coluna logo a direita da barra, amostrada de 8 em 8 px. */
  async function geometria(rotulo) {
    const { width: W, height: H } = page.viewportSize();
    const canvas = await retanguloDoCanvas(page);
    const barra = await retanguloDe(page, '#barra');
    afirmar(
      Math.round(canvas.width) === W - LARGURA_BARRA && Math.round(canvas.height) === H,
      `${rotulo}: o canvas deveria medir ${W - LARGURA_BARRA}x${H}, mede ${canvas.width}x${canvas.height}`,
    );
    afirmar(canvas.left >= barra.right, `${rotulo}: o canvas (left ${canvas.left}) invade a barra (right ${barra.right})`);
    const foraDoCanvas = await page.evaluate(({ x, H: altura }) => {
      const erros = [];
      for (let y = 1; y < altura; y += 8) {
        const el = window.document.elementFromPoint(x, y);
        if (!el || el.tagName !== 'CANVAS') erros.push(`${y}:${el ? el.id || el.tagName : 'nada'}`);
      }
      return erros;
    }, { x: barra.right + 1, H });
    afirmar(foraDoCanvas.length === 0, `${rotulo}: a coluna a direita da barra deveria ser so canvas: ${foraDoCanvas.join(', ')}`);
    const rolagem = await page.evaluate(() => {
      const b = window.document.getElementById('barra');
      return { scroll: b.scrollHeight, client: b.clientHeight };
    });
    afirmar(barra.height <= H, `${rotulo}: a barra (${barra.height}) passa da janela (${H})`);
    afirmar(rolagem.scroll === rolagem.client, `${rotulo}: a barra rola (${rolagem.scroll} > ${rolagem.client}); so o corpo da aba pode rolar`);
    return { canvas, barra };
  }

  async function pontoDoTile(gx, gy) {
    const canvas = await retanguloDoCanvas(page);
    const { camera } = await estado();
    const x = canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  const escola = noDado('schoolhouse');
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const meioDaEscola = { gx: escola.gx + Math.floor(largEs / 2), gy: escola.gy + Math.floor(altEs / 2) };
  async function escolherEscola() {
    const p = await pontoDoTile(meioDaEscola.gx, meioDaEscola.gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  // ---- 1. a moldura, a 1280x720, nada escolhido -----------------------------
  await esperarFrame();
  afirmar((await corpo()) === 'grade', `o corpo deveria nascer na grade, esta em ${await corpo()}`);
  const semSelecao = await geometria('720, sem selecao');

  const logo = await retanguloDe(page, '#logo');
  const dica = await retanguloDe(page, '#dica-ajuda');
  const minimapa = await retanguloDe(page, '#minimapa');
  afirmar(
    dica.top >= logo.bottom && dica.bottom <= minimapa.top && dica.height > 0,
    `a dica do H deveria ficar entre a logo (${logo.bottom}) e o minimapa (${minimapa.top}), esta em ${dica.top}-${dica.bottom}`,
  );

  const abasEstouradas = await page.$$eval('#abas [data-aba]', (bs) => bs
    .filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent));
  afirmar(abasEstouradas.length === 0, `aba com rotulo cortado: ${abasEstouradas.join(', ')}`);
  const textosDasAbas = await page.$$eval('#abas [data-aba]', (bs) => bs.map((b) => b.textContent));
  afirmar(
    JSON.stringify(textosDasAbas) === JSON.stringify(Object.values(tema.barra.abas)),
    `as abas deveriam ser ${Object.values(tema.barra.abas).join('/')}, sao ${textosDasAbas.join('/')}`,
  );

  // aba trancada: o clique chega e nao troca nada
  // pelo mouse cru: o `page.click` do Playwright recusa `aria-disabled` e nunca
  // chegaria a entregar o clique que o modulo tem de ignorar
  const trancada = await retanguloDe(page, '#abas [data-aba="distribuicao"]');
  await page.mouse.click(trancada.left + trancada.width / 2, trancada.top + trancada.height / 2);
  afirmar((await corpo()) === 'grade', 'clicar na aba trancada nao deveria trocar o corpo');
  afirmar(
    (await page.getAttribute('#abas [data-aba="construir"]', 'aria-pressed')) === 'true',
    'Construir deveria continuar apertada depois do clique na trancada',
  );

  // ---- 2. faixa de alertas de altura fixa ----------------------------------
  // So o layout: os alertas de verdade sao da F22. Mostrar o #alertas a mao com
  // uma linha dentro nao pode mover o topo do corpo da aba.
  const faixa = await retanguloDe(page, '#faixa-alertas');
  const topoDoCorpo = (await retanguloDe(page, '#corpo-aba')).top;
  await page.evaluate(() => {
    const a = window.document.getElementById('alertas');
    a.hidden = false;
    const linha = window.document.createElement('div');
    linha.className = 'alerta';
    linha.dataset.sonda = 'sim';
    linha.textContent = 'sonda';
    a.append(linha);
  });
  const faixaComAlerta = await retanguloDe(page, '#faixa-alertas');
  const topoComAlerta = (await retanguloDe(page, '#corpo-aba')).top;
  await page.evaluate(() => {
    const a = window.document.getElementById('alertas');
    a.querySelector('[data-sonda]').remove();
    a.hidden = true;
  });
  afirmar(
    faixa.height === faixaComAlerta.height && topoDoCorpo === topoComAlerta,
    `aviso aparecendo empurrou a grade: faixa ${faixa.height}->${faixaComAlerta.height}, corpo ${topoDoCorpo}->${topoComAlerta}`,
  );

  // ---- 3. escolher troca a grade pelo painel; Esc volta ---------------------
  await escolherEscola();
  afirmar((await corpo()) === 'painel', `escolher a escola deveria por o painel no corpo, esta em ${await corpo()}`);
  afirmar(await page.isHidden('#menu-build'), 'com predio escolhido a grade deveria sumir');
  afirmar(await page.isVisible('#painel-predio'), 'com predio escolhido o painel deveria aparecer');
  const comSelecao = await geometria('720, com a escola');
  afirmar(
    comSelecao.canvas.width === semSelecao.canvas.width && comSelecao.canvas.height === semSelecao.canvas.height,
    'a area do canvas mudou com a selecao',
  );

  // engajar: 2 colunas, rotulo curto, nada cortado
  const tipos = await page.evaluate(() => {
    const grade = window.document.querySelector('#painel-predio .tipos');
    const botoes = [...grade.querySelectorAll('button')];
    return {
      colunas: window.getComputedStyle(grade).gridTemplateColumns.split(' ').length,
      cortados: botoes.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent),
      pedreiro: botoes.map((b) => ({ texto: b.textContent, title: b.title }))
        .find((b) => b.title.includes('Pedreir') || b.texto === 'Pedreiro') ?? null,
    };
  });
  afirmar(tipos.colunas === 2, `engajar deveria ter 2 colunas, tem ${tipos.colunas}`);
  afirmar(tipos.cortados.length === 0, `botao de engajar cortado: ${tipos.cortados.join(', ')}`);
  afirmar(
    tipos.pedreiro !== null && tipos.pedreiro.texto === tema.civis.stonemason.curto
      && tipos.pedreiro.title.includes(tema.civis.stonemason.nome),
    `o botao do pedreiro deveria dizer "${tema.civis.stonemason.curto}" com o nome longo no title: ${JSON.stringify(tipos.pedreiro)}`,
  );
  medidas.corpoDaAba720 = (await retanguloDe(page, '#corpo-aba')).height;
  await capturar('escola');

  await page.keyboard.press('Escape');
  await esperarFrame();
  afirmar((await corpo()) === 'grade', `Esc deveria voltar a grade, esta em ${await corpo()}`);
  afirmar(await page.isVisible('#menu-build'), 'depois do Esc a grade deveria voltar');

  // ---- 4. aba Construir volta a grade, DESPAUSADO e segurado (§8) -----------
  await escolherEscola();
  afirmar((await corpo()) === 'painel', 'a segunda escolha deveria abrir o painel');
  const aba = await retanguloDe(page, '#abas [data-aba="construir"]');
  await page.keyboard.press('p');
  afirmar((await estado()).pausado === false, 'o passo da aba deveria rodar despausado');
  await page.mouse.move(aba.left + aba.width / 2, aba.top + aba.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await esperarFrame();
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro deveria voltar a pausar');
  afirmar((await corpo()) === 'grade', `a aba Construir deveria voltar a grade, esta em ${await corpo()}`);

  // ---- 5. aba Opcoes: o corpo troca e o botao abre a ajuda -----------------
  await page.click('#abas [data-aba="opcoes"]');
  afirmar((await corpo()) === 'opcoes', `a aba Opcoes deveria por as opcoes no corpo, esta em ${await corpo()}`);
  afirmar(await page.isVisible('#opcoes'), 'o corpo de Opcoes deveria aparecer');
  await page.click('#opcoes [data-abrir="ajuda"]');
  afirmar(await page.isVisible('#ajuda'), 'o botao de Opcoes deveria abrir a ajuda');
  await page.keyboard.press('Escape');
  await page.click('#abas [data-aba="construir"]');
  afirmar((await corpo()) === 'grade', 'voltar a Construir deveria mostrar a grade');

  // ---- 6. a 1920x1080 ------------------------------------------------------
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  const grande = await geometria('1080, sem selecao');
  await escolherEscola();
  const grandeComSelecao = await geometria('1080, com a escola');
  afirmar(
    grande.canvas.width === grandeComSelecao.canvas.width && grande.canvas.height === grandeComSelecao.canvas.height,
    'a 1080 a area do canvas mudou com a selecao',
  );
  medidas.corpoDaAba1080 = (await retanguloDe(page, '#corpo-aba')).height;
  afirmar(
    medidas.corpoDaAba1080 > medidas.corpoDaAba720,
    `o corpo da aba deveria crescer com a janela: 720 -> ${medidas.corpoDaAba720}, 1080 -> ${medidas.corpoDaAba1080}`,
  );
  afirmar(true, `medida: altura do corpo da aba, 720 = ${medidas.corpoDaAba720} px, 1080 = ${medidas.corpoDaAba1080} px`);
}

module.exports = { roteiro };
