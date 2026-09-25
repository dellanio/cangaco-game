'use strict';

// F-D4 — a unidade diz o oficio, nao o id.
//
// Antes, o quadrado de cada unidade trazia `u3`, `u7`: identificador interno, que nao diz
// nada a quem joga. Agora traz o nome do oficio, vindo de data/theme-sertao.json pelo tipo
// NEUTRO da unidade — e o roteiro compara o texto DESENHADO com o do arquivo de tema, para
// que "veio do tema" seja medida e nao promessa.
//
// A segunda coisa que ele mede e o ENCAIXE, que foi a pergunta do operador: o quadrado tem
// meio tile (32 px) e "Cabra da Pedreira" nao cabe dentro dele. A largura desenhada de cada
// rotulo chega pela ponte (`larguraDoRotuloPx`), e e por isso que o texto foi para FORA do
// quadrado, logo abaixo, em vez de virar apelido curto no tema.

const {
  retanguloDe, retanguloDoCanvas, pontoDoTileNaTela, arrastarDentroDoCanvas,
} = require('./_canvas');
const tema = require('../../data/theme-sertao.json');
const economia = require('../../data/economy.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = 64;
const ESCALA_DO_MUNDO = 1; // render/grid.ts
const LADO_DO_TILE = TILE_PX * ESCALA_DO_MUNDO;
const LADO_DA_UNIDADE = LADO_DO_TILE * 0.5; // LADO_DA_UNIDADE_EM_TILES de render/grid.ts
const GRUPOS = ['civis', 'militares', 'mercenarios'];
const PASSOS_DE_ZOOM = 5;
const TETO = 600;
const BLOCO = 10;

/** O nome do tema para um tipo neutro, lido AQUI do arquivo — nao do que a tela desenhou. */
function nomeNoTema(tipo) {
  for (const grupo of GRUPOS) {
    const entrada = tema[grupo] && tema[grupo][tipo];
    if (entrada && typeof entrada.nome === 'string') return entrada.nome;
  }
  return null;
}

const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);
const defDe = (id) => predios.find((p) => p.id === id);

async function roteiro(ctx) {
  const { page, estado, afirmar, capturar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(100);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

  const abertura = await estado();
  const unidades = abertura.unidadesRenderizadas;
  afirmar(unidades.length > 0, 'a abertura precisa ter unidade na tela para haver rotulo');

  // ---- 1. o texto desenhado E o do tema, pelo tipo neutro --------------------
  const erradas = unidades
    .filter((u) => u.nome !== nomeNoTema(u.tipo))
    .map((u) => `${u.id}(${u.tipo}) desenhou "${u.nome}", o tema diz "${nomeNoTema(u.tipo)}"`);
  afirmar(
    erradas.length === 0,
    `todo rotulo tem de ser o nome do tema para o tipo da unidade; divergiram ${JSON.stringify(erradas)}`,
  );

  const tiposNaTela = [...new Set(unidades.map((u) => u.tipo))];
  afirmar(
    tiposNaTela.every((t) => nomeNoTema(t) !== null),
    `todo tipo na tela tem de ter verbete no tema; vieram ${JSON.stringify(tiposNaTela)}`,
  );

  // ---- 2. e nao e mais o id ---------------------------------------------------
  const comId = unidades.filter((u) => u.nome.includes(u.id)).map((u) => u.id);
  afirmar(
    comId.length === 0,
    `nenhum rotulo pode trazer o id da unidade; trouxeram ${JSON.stringify(comId)}`,
  );

  // ---- 3. o encaixe, medido ---------------------------------------------------
  // A decisao registrada no BUILD_PLAN precisa do numero: se o rotulo mais largo coubesse
  // nos 32 px do quadrado, po-lo fora seria capricho.
  const larguras = unidades.map((u) => ({ nome: u.nome, px: u.larguraDoRotuloPx }));
  const maior = larguras.reduce((a, b) => (b.px > a.px ? b : a));
  afirmar(
    larguras.every((l) => l.px > 0),
    `toda largura desenhada tem de ser positiva; vieram ${JSON.stringify(larguras)}`,
  );
  afirmar(
    maior.px > LADO_DA_UNIDADE,
    `o rotulo mais largo desta cena ("${maior.nome}", ${maior.px.toFixed(1)} px) NAO cabe no `
      + `quadrado de ${LADO_DA_UNIDADE} px — e por isso que ele fica fora, sob a unidade. `
      + `Medidas: ${JSON.stringify([...new Map(larguras.map((l) => [l.nome, Math.round(l.px)]))])}`,
  );

  await capturar('vila-com-oficios');

  // ---- 4. rua e pedreira, para haver o que carregar ---------------------------
  // A vila da abertura fica parada: sem obra nao ha tarefa, e foto de unidade parada nao
  // mostra que o rotulo acompanha quem anda. A rua vem antes da planta porque sem estrada
  // ligando a obra ao armazem a tarefa de material nao nasce (F18d) — a vila ficaria parada
  // por REGRA, e o roteiro estaria medindo a coisa errada.
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu, altQu] = defDe('quarry').tamanho;
  const [, altAr] = defDe('storehouse').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'armazem e escola deveriam ter a porta na mesma linha');
  const pedreira = { gx: escola.gx + largEs + 1, gy: yRua - altQu };
  const pontoDoTile = async (gx, gy) => {
    const s = await estado();
    return pontoDoTileNaTela(canvas, { gx, gy }, s.camera, TILE_PX);
  };

  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  await arrastarDentroDoCanvas(page, canvas, [
    await pontoDoTile(armazem.gx, yRua),
    await pontoDoTile(pedreira.gx + largQu - 1, yRua),
  ]);
  await avancar(1);
  await page.keyboard.press('Escape');
  await esperarFrame();

  // O aperto do botao do menu segue a §8 — laco DESPAUSADO, com `mousedown` e `mouseup`
  // separados por 150 ms, porque `page.click()` com o jogo pausado aperta e solta sem o
  // laco redesenhar entre os dois, e uma classe inteira de defeito passaria por construcao.
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === false, 'o aperto do menu so vale com o laco ANDANDO');
  const botao = await retanguloDe(page, '[data-predio="quarry"]');
  await page.mouse.move(botao.left + botao.width / 2, botao.top + botao.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150); // o tempo de uma mao, e varios ticks do laco
  await page.mouse.up();
  await esperarFrame();
  afirmar(
    (await estado()).ferramentaAtiva === 'quarry',
    `apertar a pedreira no menu deveria armar a ferramenta, veio ${(await estado()).ferramentaAtiva}`,
  );
  await page.keyboard.press('p');
  await esperarFrame();
  afirmar((await estado()).pausado === true, 'o roteiro volta a pausar antes de medir posicao');

  const alvo = await pontoDoTile(pedreira.gx, pedreira.gy);
  await page.mouse.move(alvo.x, alvo.y);
  await esperarFrame();
  const previa = (await estado()).plantaFantasma;
  afirmar(
    previa !== null && previa.valida,
    `a pedreira precisa caber em (${pedreira.gx},${pedreira.gy}) para o resto do roteiro valer; `
      + `a previa disse ${JSON.stringify(previa)}`,
  );
  await page.mouse.click(alvo.x, alvo.y);
  await avancar(1);
  await page.keyboard.press('Escape');
  await esperarFrame();

  // ---- 5. o rotulo acompanha a unidade que anda -------------------------------
  // O texto e filho do container: se tivesse sido desenhado solto, andar quebraria o par.
  const antes = new Map(unidades.map((u) => [u.id, u.nome]));
  const posicaoInicial = new Map(unidades.map((u) => [u.id, `${u.gx},${u.gy}`]));
  const alguemAndou = (s) => s.unidadesRenderizadas.some(
    (u) => posicaoInicial.has(u.id) && posicaoInicial.get(u.id) !== `${u.gx},${u.gy}`,
  );
  // Espera POR CONDICAO: quantos ticks ate a primeira tarefa sair depende da fila, e um
  // numero chutado aqui seria a parte fragil do roteiro.
  let depois = await estado();
  for (let t = 0; t < TETO && !alguemAndou(depois); t += BLOCO) {
    await avancar(BLOCO);
    await esperarFrame();
    depois = await estado();
  }
  afirmar(
    alguemAndou(depois),
    `alguma unidade deveria ter mudado de tile em ate ${TETO} ticks, para a foto do movimento valer de algo`,
  );
  const trocaram = depois.unidadesRenderizadas
    .filter((u) => antes.has(u.id) && antes.get(u.id) !== u.nome)
    .map((u) => u.id);
  afirmar(
    trocaram.length === 0,
    `o oficio nao muda com o tempo nem com o caminho; trocaram ${JSON.stringify(trocaram)}`,
  );
  await capturar('oficio-em-movimento');

  // ---- 6. de perto, que e onde se le o rotulo ---------------------------------
  const emMovimento = depois.unidadesRenderizadas.find(
    (u) => posicaoInicial.has(u.id) && posicaoInicial.get(u.id) !== `${u.gx},${u.gy}`,
  );
  const ondeEsta = async () => {
    const s = await estado();
    const atual = s.unidadesRenderizadas.find((u) => u.id === emMovimento.id) ?? emMovimento;
    return pontoDoTileNaTela(canvas, { gx: atual.gxDesenhado, gy: atual.gyDesenhado }, s.camera, TILE_PX);
  };
  const ponto = await ondeEsta();
  await page.mouse.move(ponto.x, ponto.y);
  for (let i = 0; i < PASSOS_DE_ZOOM; i += 1) {
    await page.mouse.wheel(0, -120);
    await esperarFrame();
  }
  const comZoom = await estado();
  afirmar(comZoom.camera.zoom > 1, `o zoom deveria ter subido para a foto de perto, veio ${comZoom.camera.zoom}`);
  const dePerto = await ondeEsta();
  afirmar(
    dePerto.x > canvas.left && dePerto.x < canvas.right
      && dePerto.y > canvas.top && dePerto.y < canvas.bottom,
    `a unidade fotografada de perto deveria estar no quadro, cairia em `
      + `(${Math.round(dePerto.x)},${Math.round(dePerto.y)})`,
  );
  await capturar('oficio-de-perto');
}

module.exports = { roteiro };
