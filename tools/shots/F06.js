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

  // 2. bloqueado: cinza, com "requer <nome do tema do pai>", e clicar nao ativa.
  const serraria = defDe('sawmill');
  const seletorSerraria = '[data-predio="sawmill"]';
  afirmar(
    await page.getAttribute(seletorSerraria, 'aria-disabled') === 'true',
    'sawmill deveria estar aria-disabled no estado inicial',
  );
  const textoSerraria = await page.textContent(seletorSerraria);
  afirmar(
    textoSerraria.includes(`${tema.menuBuild.requer} ${nomeNoTema(serraria.desbloqueadoPor)}`),
    `o texto do item bloqueado deveria dizer "requer ${nomeNoTema(serraria.desbloqueadoPor)}" (nome do tema), veio: ${textoSerraria}`,
  );
  afirmar(
    !textoSerraria.includes(serraria.desbloqueadoPor),
    `o texto nao deveria mostrar o id neutro '${serraria.desbloqueadoPor}', veio: ${textoSerraria}`,
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
    const texto = await item.textContent();
    afirmar(
      !texto.includes(tema.menuBuild.semRequisito),
      `'${p.id}' aparece no menu sem dizer do que depende ("${tema.menuBuild.semRequisito}"), veio: ${texto}`,
    );
  }
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
}

module.exports = { roteiro };
