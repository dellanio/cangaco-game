'use strict';

// Roteiro da F06. Afirma ESTADO e MEDICAO, nao pixel: o que a cena publica em
// window.__cangaco e onde cada retangulo esta na pagina. Todo dado esperado
// vem dos JSON — nada digitado aqui que o jogo tambem saiba.

const { retanguloDe, retanguloDoCanvas } = require('./_canvas');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');
const tema = require('../../data/theme-sertao.json');

const TILE_PX = 64;

const defDe = (id) => predios.find((p) => p.id === id);
const nomeNoTema = (id) => tema.predios[id].nome;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;

  // 1. o layout nao sobrepoe: o canvas fica abaixo do HUD e a esquerda do painel.
  //    E isto — e nao "ignorar y < 38" — que impede o ponteiro sobre a UI de
  //    chegar ao Phaser.
  const hud = await retanguloDe(page, '#hud');
  const painel = await retanguloDe(page, '#menu-build');
  const canvas = await retanguloDoCanvas(page);
  afirmar(canvas.top >= hud.bottom - 0.5, `canvas.top (${canvas.top}) deveria ser >= hud.bottom (${hud.bottom})`);
  afirmar(canvas.right <= painel.left + 0.5, `canvas.right (${canvas.right}) deveria ser <= painel.left (${painel.left})`);
  // Layout 2 (estilo-ui): o balcao e uma LINHA da grade no rodape, nunca
  // sobreposicao — a afirmacao equivalente a de cima, pedida pelo operador.
  const balcao = await retanguloDe(page, '#balcao');
  afirmar(canvas.bottom <= balcao.top + 0.5, `canvas.bottom (${canvas.bottom}) deveria ser <= balcao.top (${balcao.top})`);

  // 1b. a prancha RETRAI: a coluna some, o canvas cresce ate a borda direita e
  //     o botao flutuante da barra e o que a traz de volta. O Phaser em
  //     Scale.RESIZE confere o pai a cada 500 ms, dai a espera. Aberta ou
  //     fechada, nada fica por baixo do canvas.
  const esperarOCanvasSeguirAGrade = () => page.waitForTimeout(900);
  const flutuante = '#hud [data-abrir="prancha"]';
  afirmar(
    await page.isVisible(flutuante) && (await page.getAttribute(flutuante, 'aria-pressed')) === 'true',
    'o botao flutuante deveria estar na barra, apertado enquanto a prancha esta aberta',
  );
  await page.click('[data-fechar="prancha"]');
  await esperarOCanvasSeguirAGrade();
  const canvasLargo = await retanguloDoCanvas(page);
  afirmar(
    await page.isHidden('#menu-build') && await page.isHidden('[data-predio="quarry"]'),
    'fechada, a prancha some inteira — nenhum item do menu fica na tela',
  );
  afirmar(
    canvasLargo.width > canvas.width && canvasLargo.right <= hud.right + 0.5,
    `com a prancha fechada o canvas deveria ir ate a borda direita, veio ${JSON.stringify(canvasLargo)} contra hud.right ${hud.right}`,
  );
  afirmar(
    (await page.getAttribute(flutuante, 'aria-pressed')) === 'false',
    'fechada a prancha, o botao flutuante deveria ficar solto',
  );
  await capturar('prancha-recolhida');
  await page.click(flutuante);
  await esperarOCanvasSeguirAGrade();
  const canvasDeVolta = await retanguloDoCanvas(page);
  afirmar(
    Math.abs(canvasDeVolta.width - canvas.width) < 0.5 && await page.isVisible('[data-predio="quarry"]'),
    `reaberta pelo flutuante, a prancha deveria devolver o canvas a largura inicial (${canvas.width}), veio ${canvasDeVolta.width}`,
  );
  afirmar(
    (await page.getAttribute(flutuante, 'aria-pressed')) === 'true',
    'reaberta, o botao flutuante volta a apertado',
  );

  // 2. bloqueado: cinza, com "requer <nome do tema do pai>", e clicar nao ativa.
  const serraria = defDe('sawmill');
  const seletorSerraria = '[data-predio="sawmill"]';
  afirmar(
    await page.getAttribute(seletorSerraria, 'aria-disabled') === 'true',
    'sawmill deveria estar aria-disabled no estado inicial',
  );
  // Layout 2 (estilo-ui): o item e um ICONE sem texto; nome, custo e requisito
  // moram no cartao fixo `[data-planta]`, que mostra o que esta sob o mouse.
  const cartao = async (id) => {
    await page.hover(`[data-predio="${id}"]`);
    await page.waitForTimeout(100);
    afirmar(
      (await page.getAttribute('#menu-build [data-planta]', 'data-planta')) === id,
      `com o mouse sobre '${id}' o cartao deveria mostrar '${id}'`,
    );
    return page.textContent('#menu-build [data-planta]');
  };
  const textoSerraria = await cartao('sawmill');
  afirmar(
    textoSerraria.includes(`${tema.menuBuild.requer} ${nomeNoTema(serraria.desbloqueadoPor)}`),
    `o cartao do item bloqueado deveria dizer "requer ${nomeNoTema(serraria.desbloqueadoPor)}" (nome do tema), veio: ${textoSerraria}`,
  );
  afirmar(
    !textoSerraria.includes(serraria.desbloqueadoPor),
    `o cartao nao deveria mostrar o id neutro '${serraria.desbloqueadoPor}', veio: ${textoSerraria}`,
  );
  afirmar(
    textoSerraria.includes(nomeNoTema('sawmill')),
    `o cartao deveria trazer o nome tematico do proprio item, veio: ${textoSerraria}`,
  );
  // O placeholder de icone e a miniatura do FOOTPRINT, do tamanho do dado.
  const [largSerraria, altSerraria] = serraria.tamanho;
  const miniatura = await page.$eval(
    `${seletorSerraria} .footprint`,
    (n) => ({ largura: n.dataset.largura, altura: n.dataset.altura, celulas: n.children.length }),
  );
  afirmar(
    miniatura.largura === String(largSerraria) && miniatura.altura === String(altSerraria)
      && miniatura.celulas === largSerraria * altSerraria,
    `a miniatura da serraria deveria ser ${largSerraria}x${altSerraria}, veio ${JSON.stringify(miniatura)}`,
  );
  // O texto neutro `semRequisito` ("ainda nao disponivel") era provado aqui pelo
  // armazem, unico predio sem pai na arvore. Desde a correcao do BUG-002 nao ha
  // mais nenhum: o armazem ADICIONAL exige Serraria (GDD 5.2). Entao o que se
  // afirma agora e a consequencia, que vale mais para o jogador: NENHUM item do
  // menu fica cinza sem dizer do que depende. O rotulo neutro continua no tema
  // para a permissao por fase da campanha (GDD 5.3), e la volta a ter dono.
  const semPai = predios.find((p) => p.desbloqueadoPor === null && !economia.estadoInicial.menuBuildInicial.includes(p.id));
  afirmar(
    semPai === undefined,
    `a arvore nao deveria ter raiz sem pai; '${semPai && semPai.id}' tem desbloqueadoPor null`,
  );
  for (const p of predios) {
    const item = await page.$(`[data-predio="${p.id}"]`);
    if (!item) continue; // nem todo predio cabe no menu do cenario
    if (await item.getAttribute('aria-disabled') !== 'true') continue;
    const texto = await cartao(p.id);
    afirmar(
      !texto.includes(tema.menuBuild.semRequisito),
      `'${p.id}' aparece no menu sem dizer do que depende ("${tema.menuBuild.semRequisito}"), veio: ${texto}`,
    );
  }
  // Icones: predio com icone no manifesto mostra o RETRATO; sem icone, a
  // miniatura do footprint (placeholder e comportamento normal, §9). Os dois
  // conjuntos vem do manifesto, nunca de uma lista digitada aqui.
  const iconesDoManifesto = require('../../assets/manifest.json').icones.predios;
  for (const p of predios) {
    const temIcone = Boolean(iconesDoManifesto[p.id]);
    const temRetrato = (await page.$(`[data-predio="${p.id}"] img.retrato`)) !== null;
    const temFootprint = (await page.$(`[data-predio="${p.id}"] .footprint`)) !== null;
    afirmar(
      temRetrato === temIcone && temFootprint === !temIcone,
      `'${p.id}' deveria mostrar ${temIcone ? 'o retrato' : 'o footprint'}, veio retrato=${temRetrato} footprint=${temFootprint}`,
    );
  }
  afirmar(
    Object.keys(iconesDoManifesto).length > 0
      && await page.$$eval('#menu-build img.retrato', (ns) => ns.every((n) => n.complete && n.naturalWidth > 0)),
    'todo retrato deveria ter carregado (URL resolvida pelo bundler, sem 404)',
  );
  // O glifo de cada recurso do HUD e um `::before` com imagem de fundo SVG. O
  // Vite embute SVG pequeno como data URI, entao o nome do arquivo nao aparece
  // no estilo computado: o que se afirma e que os cinco tem imagem, que e SVG,
  // e que sao cinco imagens DIFERENTES (um glifo por recurso, nao um so).
  const glifos = await page.$$eval('#hud .campo[data-recurso]', (ns) => ns.map((n) => ({
    recurso: n.dataset.recurso, fundo: getComputedStyle(n, '::before').backgroundImage,
  })));
  afirmar(
    glifos.length === 5 && glifos.every((g) => g.fundo.startsWith('url(') && g.fundo.includes('svg'))
      && new Set(glifos.map((g) => g.fundo)).size === 5,
    `cada campo do HUD deveria ter o seu glifo SVG, veio ${JSON.stringify(glifos.map((g) => [g.recurso, g.fundo.slice(0, 40)]))}`,
  );
  // Todos os 28 estao na grade, em faixas por grupo (data/menu-build.json), e a
  // grade nao rola: e a razao de ser do Layout 2 — o relogio nao espera.
  const gruposDoDado = require('../../data/menu-build.json').grupos;
  for (const g of gruposDoDado) {
    const naFaixa = await page.$$eval(
      `#menu-build .grade[data-grupo="${g.id}"] [data-predio]`, (ns) => ns.map((n) => n.dataset.predio),
    );
    afirmar(
      JSON.stringify(naFaixa) === JSON.stringify(g.predios),
      `a faixa '${g.id}' deveria ter ${JSON.stringify(g.predios)}, veio ${JSON.stringify(naFaixa)}`,
    );
    afirmar(
      (await page.textContent(`#menu-build .regua[data-grupo="${g.id}"]`)) === tema.menuBuild.grupos[g.id],
      `a regua da faixa '${g.id}' deveria ter o rotulo do tema`,
    );
  }
  afirmar(
    (await page.$$('#menu-build [data-predio]')).length === predios.length,
    `a grade deveria ter os ${predios.length} predios`,
  );
  afirmar(
    await page.$eval('#menu-build', (n) => n.scrollHeight <= n.clientHeight + 0.5),
    'a prancha inteira deveria caber sem rolagem a 1280x720',
  );
  await page.mouse.move(hud.left + 100, hud.top + hud.height / 2); // tira o mouse da grade
  await page.waitForTimeout(100);
  // force: o Playwright recusa clicar em aria-disabled; o que se prova aqui e
  // exatamente que um clique que CHEGA no item bloqueado nao ativa nada.
  await page.click(seletorSerraria, { force: true });
  // window.__cangaco e publicado no POST_RENDER: espera o frame, como nos outros passos.
  await page.waitForTimeout(200);
  afirmar((await estado()).ferramentaAtiva === null, 'clicar num item bloqueado nao deveria ativar a ferramenta');

  // 3. liberado: clicar ativa a ferramenta e marca o item.
  // liberado pela ARVORE (menuBuildInicial esta vazio): um filho de predio que ja
  // existe no cenario. quarry cabe folgado no canvas; o pai vem do JSON.
  const idLiberado = 'quarry';
  afirmar(
    economia.estadoInicial.predios.some((p) => p.id === defDe(idLiberado).desbloqueadoPor),
    `${idLiberado} deveria ser filho de um predio do cenario inicial (a arvore o libera)`,
  );
  await page.click(`[data-predio="${idLiberado}"]`);
  await page.waitForTimeout(200);
  afirmar((await estado()).ferramentaAtiva === idLiberado, `clicar em ${idLiberado} deveria ativar a ferramenta`);
  afirmar(
    await page.getAttribute(`[data-predio="${idLiberado}"]`, 'aria-pressed') === 'true',
    `${idLiberado} deveria ficar marcado como ativo no painel`,
  );

  // 3b. BUG-A, parte 3 — o destaque do item ativo, MEDIDO. O operador nao
  // percebeu qual item estava selecionado, e "agora esta melhor" nao e
  // evidencia: o que se afirma aqui e a DISTANCIA entre o item ativo e um item
  // inativo, lida do estilo computado. O numero pode mudar quando a paleta
  // mudar; o que nao pode e a distancia encolher de volta.
  const estiloDoItem = (id) => page.$eval(
    `[data-predio="${id}"]`,
    (n) => {
      const e = getComputedStyle(n);
      return { fundo: e.backgroundColor, borda: e.borderTopColor, texto: e.color, sombra: e.boxShadow };
    },
  );
  /** Soma das diferencas por canal entre duas cores `rgb(...)`. 0 = identicas. */
  const distancia = (a, b) => {
    const canais = (c) => (c.match(/\d+/g) ?? []).slice(0, 3).map(Number);
    const [x, y] = [canais(a), canais(b)];
    return x.reduce((soma, v, i) => soma + Math.abs(v - (y[i] ?? 0)), 0);
  };
  const idInativo = 'woodcutters';
  const ativo = await estiloDoItem(idLiberado);
  const inativo = await estiloDoItem(idInativo);
  // 60 sobre 765 possiveis e baixo de proposito: e o piso do "da para ver de
  // relance", nao a medida do gosto de ninguem. O destaque anterior ao BUG-A
  // dava 32 no fundo, e foi o que passou despercebido.
  afirmar(
    distancia(ativo.fundo, inativo.fundo) >= 60,
    `o fundo do item ativo deveria destacar do inativo, veio ${ativo.fundo} contra ${inativo.fundo}`,
  );
  afirmar(
    distancia(ativo.borda, inativo.borda) >= 60,
    `a borda do item ativo deveria destacar da inativa, veio ${ativo.borda} contra ${inativo.borda}`,
  );
  // A barra lateral: quem varre a lista com o olho a acha antes de comparar tom.
  afirmar(
    ativo.sombra !== 'none' && inativo.sombra === 'none',
    `so o item ativo deveria ter a barra lateral, veio ${ativo.sombra} contra ${inativo.sombra}`,
  );
  await capturar('item-ativo-destacado');

  // 3c. BUG-A, parte 1 — clicar de novo no item JA ativo larga a ferramenta.
  // Era o primeiro gesto que o jogador tentava, e nao fazia nada: a unica saida
  // era o `Esc`, que nada na tela anuncia.
  await page.click(`[data-predio="${idLiberado}"]`);
  await page.waitForTimeout(200);
  afirmar(
    (await estado()).ferramentaAtiva === null,
    'clicar de novo no item ativo deveria largar a ferramenta',
  );
  afirmar(
    await page.getAttribute(`[data-predio="${idLiberado}"]`, 'aria-pressed') === 'false',
    'largada a ferramenta, o item nao deveria continuar marcado',
  );
  // E a ferramenta do menu lateral (estrada) alterna pelo mesmo gesto. Aqui a
  // afirmacao e o `aria-pressed`, e nao `ferramentaAtiva`: a cena so publica o
  // PREDIO ativo (`WorldScene`: `ferramenta.predioAtivo`), entao no modo estrada
  // esse campo e null nos dois lados e nao distinguiria nada. O `aria-pressed` e
  // o que o jogador ve, que e o que este passo existe para guardar.
  const marcado = (seletor) => page.getAttribute(seletor, 'aria-pressed');
  await page.click('[data-ferramenta="estrada"]');
  await page.waitForTimeout(200);
  afirmar(await marcado('[data-ferramenta="estrada"]') === 'true', 'a estrada deveria ativar');
  await page.click('[data-ferramenta="estrada"]');
  await page.waitForTimeout(200);
  afirmar(await marcado('[data-ferramenta="estrada"]') === 'false', 'clicar de novo na estrada deveria larga-la');

  // volta ao estado que os passos 4-7 assumem
  await page.click(`[data-predio="${idLiberado}"]`);
  await page.waitForTimeout(200);
  afirmar((await estado()).ferramentaAtiva === idLiberado, 'a ferramenta deveria voltar para os passos seguintes');

  // ponto de pagina no centro de um tile, dada a camera atual
  async function pontoDoTile(gx, gy) {
    const { camera } = await estado();
    const x = canvas.left + gx * TILE_PX + TILE_PX / 2 - camera.scrollX;
    const y = canvas.top + gy * TILE_PX + TILE_PX / 2 - camera.scrollY;
    afirmar(
      x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom,
      `o tile (${gx},${gy}) deveria estar visivel no canvas, cairia em (${x},${y})`,
    );
    return { x, y };
  }

  // 4. planta VERDE: um tile livre logo abaixo do armazem do cenario.
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [, armazemAltura] = defDe('storehouse').tamanho;
  const livre = { gx: armazem.gx, gy: armazem.gy + armazemAltura + 1 };
  const pontoLivre = await pontoDoTile(livre.gx, livre.gy);
  await page.mouse.move(pontoLivre.x, pontoLivre.y);
  await page.waitForTimeout(200);
  const verde = (await estado()).plantaFantasma;
  afirmar(
    verde !== null && verde.tipo === idLiberado && verde.gx === livre.gx && verde.gy === livre.gy
      && verde.valida === true && verde.motivo === null,
    `sobre um tile livre a planta deveria ser valida em (${livre.gx},${livre.gy}), veio ${JSON.stringify(verde)}`,
  );
  await capturar('planta-verde');

  // 5. planta VERMELHA: um tile de dentro do armazem.
  const dentro = { gx: armazem.gx + 1, gy: armazem.gy + 1 };
  const pontoDentro = await pontoDoTile(dentro.gx, dentro.gy);
  await page.mouse.move(pontoDentro.x, pontoDentro.y);
  await page.waitForTimeout(200);
  const vermelha = (await estado()).plantaFantasma;
  afirmar(
    vermelha !== null && vermelha.valida === false && vermelha.motivo === 'sobreposicao'
      && vermelha.gx === dentro.gx && vermelha.gy === dentro.gy,
    `sobre o armazem a planta deveria recusar por sobreposicao em (${dentro.gx},${dentro.gy}), veio ${JSON.stringify(vermelha)}`,
  );
  await capturar('planta-vermelha');

  // 6. o ponteiro sobre a UI nao chega a cena: nem tile, nem planta.
  await page.mouse.move(hud.left + 100, hud.top + hud.height / 2);
  await page.waitForTimeout(200);
  let s = await estado();
  afirmar(s.tileSobMouse === null, `sobre o HUD tileSobMouse deveria ser null, veio ${JSON.stringify(s.tileSobMouse)}`);
  afirmar(s.plantaFantasma === null, `sobre o HUD a planta deveria estar escondida, veio ${JSON.stringify(s.plantaFantasma)}`);

  await page.mouse.move(pontoLivre.x, pontoLivre.y);
  await page.waitForTimeout(200);
  afirmar((await estado()).plantaFantasma !== null, 'de volta ao mapa a planta deveria reaparecer');
  await page.mouse.move(painel.left + painel.width / 2, painel.top + 200);
  await page.waitForTimeout(200);
  s = await estado();
  afirmar(s.tileSobMouse === null, `sobre o painel tileSobMouse deveria ser null, veio ${JSON.stringify(s.tileSobMouse)}`);
  afirmar(s.plantaFantasma === null, `sobre o painel a planta deveria estar escondida, veio ${JSON.stringify(s.plantaFantasma)}`);

  // 7. Esc cancela: a ferramenta volta a null, a planta some, o painel desmarca.
  await page.mouse.move(pontoLivre.x, pontoLivre.y);
  await page.waitForTimeout(200);
  afirmar((await estado()).plantaFantasma !== null, 'antes do Esc a planta deveria estar visivel');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  s = await estado();
  afirmar(s.ferramentaAtiva === null, `depois do Esc a ferramenta deveria ser null, veio ${s.ferramentaAtiva}`);
  afirmar(s.plantaFantasma === null, 'depois do Esc a planta deveria sumir');
  afirmar(
    await page.getAttribute(`[data-predio="${idLiberado}"]`, 'aria-pressed') === 'false',
    `depois do Esc ${idLiberado} deveria sair de marcado`,
  );
  await capturar('apos-esc');

  // 8. BUG-A, parte 2 — o botao direito no mapa, e a precedencia do GDD §2.1.
  // COM ferramenta na mao ele larga a ferramenta e NAO planta nada. DE MAO VAZIA
  // ele nao faz nada aqui: essa fatia fica inteira para a ordem militar da F26,
  // e e por isso que este passo mede a contagem de predios nos dois casos.
  const quantosPredios = async () => Object.keys((await estado()).prediosDoEstado).length;
  const antesDoDireito = await quantosPredios();

  await page.click(`[data-predio="${idLiberado}"]`);
  await page.waitForTimeout(200);
  afirmar((await estado()).ferramentaAtiva === idLiberado, 'a ferramenta deveria estar ativa antes do clique direito');
  await page.mouse.move(pontoLivre.x, pontoLivre.y);
  await page.mouse.click(pontoLivre.x, pontoLivre.y, { button: 'right' });
  await page.waitForTimeout(200);
  s = await estado();
  afirmar(s.ferramentaAtiva === null, `o clique direito deveria largar a ferramenta, veio ${s.ferramentaAtiva}`);
  afirmar(s.plantaFantasma === null, 'largada a ferramenta, a planta fantasma deveria sumir');
  afirmar(
    await quantosPredios() === antesDoDireito,
    'o clique direito nao pode plantar nada: ele cancela, nao confirma',
  );

  // de mao vazia: o gesto passa adiante intocado e nada acontece no mapa
  await page.mouse.click(pontoLivre.x, pontoLivre.y, { button: 'right' });
  await page.waitForTimeout(200);
  afirmar(
    (await estado()).ferramentaAtiva === null && await quantosPredios() === antesDoDireito,
    'o clique direito de mao vazia nao deveria mudar nada hoje (a fatia e da F26)',
  );
}

module.exports = { roteiro };
