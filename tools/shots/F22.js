'use strict';

// Roteiro da F22 — O AVISO DE PREDIO PARADO, NA TELA.
//
// O teste headless prova a DERIVACAO: dado um estado, quais alertas saem. Ele
// nao prova nada do que esta feature existe para resolver, que e o jogador
// DESCOBRIR que uma pedreira parou sem clicar nela. Isso e o que se mede aqui:
//
//  - o jogo abre SEM aviso nenhum (a vila inicial so tem prédios que nao pedem
//    trabalhador) e o aviso continua ausente enquanto a pedreira e obra;
//  - a pedreira fica pronta sem cabra treinado e o aviso APARECE sozinho, com o
//    texto do tema e a contagem;
//  - PAUSAR pelo painel apaga o aviso — a prova da Nota da F16c, e a unica das
//    tres que so se ve na tela: no headless "sumiu" e uma lista vazia;
//  - cortar a estrada acrescenta o segundo aviso, sem tirar o primeiro.
//
// O layout e MEDIDO, nao descrito (§8): o passo 0 pega os retangulos de
// `#alertas`, `#painel-predio` e do canvas e afirma que o aviso cabe na celula
// do canvas e nao intersecta o painel. "Esta atras do painel" ja errou duas
// vezes nesta base, nas duas por descricao em vez de medida.
//
// Texto afirmado vem de `data/theme-sertao.json`, nunca digitado aqui; a
// geometria vem de `economy.json` e `buildings.json`, como no F16b.

const { retanguloDe, retanguloDoCanvas, arrastarDentroDoCanvas } = require('./_canvas');
const { erguerRua } = require('./_estradas');
const { caixaLivre, ruaComDesvio, arrastosDaRua } = require('./_recursos');
const economia = require('../../data/economy.json');
const tema = require('../../data/theme-sertao.json');
const { predios } = require('../../data/buildings.json');
const producao = require('../../data/production.json');
const mapa = require('../../data/maps/sertao-128.json');

const TILE_PX = 64;
const defDe = (id) => predios.find((p) => p.id === id);
const noDado = (id) => economia.estadoInicial.predios.find((p) => p.id === id);

/** Medido no F16b, mesma geometria: a obra da pedreira fecha no tick 220. O teto
 *  e aquele numero com folga — e o roteiro PARA no marco, nao no teto. */
const TETO_ATE_COMPLETAR = 600;
const PASSO_DE_AVANCO = 50; // um `avancar` seco e grande estoura o frame (F16b)

const ROTULO = tema.alertas.causas;

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const canvas = await retanguloDoCanvas(page);
  const esperarFrame = () => page.waitForTimeout(200);
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);

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

  /** Clica no mapa de mao vazia. Sempre com o painel FECHADO: ele e sobreposicao
   *  no canto do canvas, e o que esta debaixo dele nao recebe mouse (F16b). */
  async function clicarNoTile(gx, gy) {
    const p = await pontoDoTile(gx, gy);
    await page.mouse.click(p.x, p.y);
    await esperarFrame();
  }

  /** Anda a camera com as setas ate a coluna `gx` cair no meio do quadro. Por laco
   *  e nao por tempo fixo, porque a tecla ACELERA enquanto segurada. Precisou
   *  existir quando o BUG-F recuou a pedreira: com ela em x=19 e a escola em 36, a
   *  rua nao cabe mais num quadro so. */
  async function centrarEm(gx) {
    { // D-TELA-CAPTURA-DETERMINISTICA: a camera vai exata pela ponte (harness), e nao por setas no tempo de parede
      const alvo = Math.max(0, gx * TILE_PX - (canvas.right - canvas.left) / 2);
      await page.evaluate(([e, v]) => window.__cangaco.fixarCamera(e === 'x' ? { scrollX: v } : { scrollY: v }), ['x', alvo]);
      await page.waitForTimeout(200); // o quadro seguinte publica a camera nova na ponte
    }
    const alvo = Math.max(0, gx * TILE_PX - (canvas.right - canvas.left) / 2);
    for (let i = 0; i < 30; i += 1) {
      const { camera } = await estado();
      const delta = alvo - camera.scrollX;
      if (Math.abs(delta) < TILE_PX) return;
      const tecla = delta > 0 ? 'ArrowRight' : 'ArrowLeft';
      await page.keyboard.down(tecla);
      await page.waitForTimeout(120);
      await page.keyboard.up(tecla);
      await esperarFrame();
    }
  }

  const predioDoEstado = async (id) => (await estado()).prediosDoEstado[id] ?? null;
  const idAberto = () => page.getAttribute('#painel-predio', 'data-predio-aberto');

  /** O que o aviso mostra AGORA: uma entrada por causa visivel, com a contagem.
   *  Le o DOM, que e o que o jogador ve — nao o seletor, que e o que esta sendo
   *  provado. */
  async function avisosNaTela() {
    return page.$$eval('#alertas .alerta', (ns) => ns
      .filter((n) => !n.hasAttribute('hidden'))
      .map((n) => ({
        causa: n.dataset.causa,
        rotulo: n.querySelector('.rotulo').textContent,
        contagem: n.querySelector('.contagem').textContent,
      })));
  }
  const resumo = async () => JSON.stringify(await avisosNaTela());

  // ---- geometria, tirada dos JSON (a mesma do F16b) -------------------------
  // A pedreira entra a ESQUERDA do armazem, com a borda sul na linha de porta
  // dele: uma rua so serve os tres.
  //
  // BUG-C (corrigido em 2026-09-24): ela ficava a DIREITA da escola, e ali nao
  // ha pedra nenhuma — o `rock` mais proximo estava a 12 tiles, o dobro do
  // alcance. Isso passou despercebido por tres sessoes porque a geometria foi
  // escrita na F15a, quando o veio morava DENTRO do predio (`veio: 200`) e o
  // lugar nao importava; desde a F-T2a o veio esta no chao. A oeste do armazem
  // fica o lajedo da vila, e de la a pedreira alcanca os 13 tiles dele.
  //
  // A folga de um tile entre a pedreira e o armazem nao e estetica: e ela que
  // da ao corte da rua, no passo 6, um tile onde cair sem encostar em porta.
  const armazem = noDado('storehouse');
  const escola = noDado('schoolhouse');
  const [, altAr] = defDe('storehouse').tamanho;
  const [largEs, altEs] = defDe('schoolhouse').tamanho;
  const [largQu, altQu] = defDe('quarry').tamanho;
  const yRua = armazem.gy + altAr;
  afirmar(escola.gy + altEs === yRua, 'este roteiro assume armazem e escola na mesma linha de porta');
  // BUG-F (2026-09-24): a pedreira ao lado do lajedo, nunca EM CIMA dele. A
  // geometria antiga (`armazem.gx - largQu - 1`) punha o footprint sobre a rocha —
  // era o proprio defeito do BUG-F, a pedreira lavrando debaixo das paredes —, e
  // desde a correcao `canPlace` recusa ali. Recua de um em um ate a caixa ficar
  // livre; o alcance de 6 tiles continua cobrindo o lajedo, e a afirmacao de rocha
  // ao alcance, mais abaixo, e que garante isso.
  let gxDaPedreira = armazem.gx - largQu - 1;
  while (gxDaPedreira > 0 && !caixaLivre(gxDaPedreira, yRua - altQu, largQu, altQu)) gxDaPedreira -= 1;
  const pedreira = { gx: gxDaPedreira, gy: yRua - altQu };
  const meioDaPedreira = { gx: pedreira.gx + Math.floor(largQu / 2), gy: pedreira.gy };
  const pontaEsquerda = { gx: pedreira.gx, gy: yRua };
  const pontaDireita = { gx: escola.gx + largEs - 1, gy: yRua };
  // A rua desce um tile onde a reta cai na rocha (24,33 do lajedo): a estrada
  // tambem recusa, e buraco na reta partiria a rede antes de o corte do passo 6
  // ter o que partir.
  const tilesDaRuaLista = ruaComDesvio(pontaEsquerda.gx, pontaDireita.gx, yRua);
  const tilesDaRua = tilesDaRuaLista.length;
  const arrastos = arrastosDaRua(tilesDaRuaLista);
  // O corte fica ENTRE a pedreira e o armazem: parte a rede em dois pedacos, um
  // com o armazem e outro com a pedreira, sem encostar na porta de ninguem.
  const corte = { gx: pedreira.gx + largQu, gy: yRua };
  afirmar(
    corte.gx > pontaEsquerda.gx && corte.gx < armazem.gx && corte.gx >= pedreira.gx + largQu,
    `o corte (${corte.gx}) precisa cair na rua, entre a pedreira e o armazem`,
  );
  // E ele tem de ser um tile da rua DESENHADA, nao o buraco que a rocha deixou na
  // reta: cortar onde nao ha rua deixaria a rede inteira de pe e o passo 6 mediria
  // outra coisa.
  afirmar(
    tilesDaRuaLista.some((t) => t.gx === corte.gx && t.gy === corte.gy),
    `o corte (${corte.gx},${corte.gy}) precisa ser um tile da rua desenhada`,
  );

  // A PRE-CONDICAO do cenario, e e ela que faltava no BUG-C: a pedreira tem
  // pedra ao alcance. Contada do arquivo de mapa com o alcance do dado, sem
  // nenhuma coordenada digitada aqui — se o gerador mudar a geografia de novo,
  // esta afirmacao acusa antes de o roteiro inteiro rodar e culpar o aviso.
  const rochaAoAlcance = () => {
    // `alcance_tiles` e a chave do JSON; `alcance` e o nome depois do carregador.
    const alcance = producao.predios.quarry.colheita.alcance_tiles;
    const x0 = pedreira.gx - alcance;
    const x1 = pedreira.gx + largQu - 1 + alcance;
    const y0 = pedreira.gy - alcance;
    const y1 = pedreira.gy + altQu - 1 + alcance;
    return mapa.recursos.rock.filter(([gx, gy]) => gx >= x0 && gx <= x1 && gy >= y0 && gy <= y1).length;
  };
  const tilesDeRocha = rochaAoAlcance();
  afirmar(
    tilesDeRocha > 0,
    `a pedreira de (${pedreira.gx},${pedreira.gy}) nao tem UM tile de rocha ao alcance: `
      + 'ela nunca vai produzir, e o aviso que este roteiro mede sairia pelo motivo errado '
      + '(era exatamente o BUG-C)',
  );

  // ---- 1. o jogo abre SEM aviso --------------------------------------------
  // A vila inicial e armazem e Casa do Coronel, e `buildings.json` da
  // `trabalhador: null` nos dois. Um jogo que abrisse reclamando seria o
  // defeito que esta feature introduziria.
  afirmar(await page.isHidden('#alertas'), 'o jogo deveria abrir sem aviso nenhum');
  await capturar('abertura-sem-aviso');

  // A camera anda para oeste ate a pedreira caber no quadro (F-D2). Nao e
  // enfeite: a captura e a evidencia que um humano le, e com a pedreira na
  // borda esquerda o cenario inteiro ficava meio fora dela. Por laco e nao por
  // tempo fixo, porque a tecla ACELERA enquanto segurada — 300 ms nao andam
  // sempre a mesma distancia. `pontoDoTile` le a camera viva a cada chamada,
  // entao todo clique daqui para a frente acompanha sozinho.
  const alvoDeScroll = (pedreira.gx - 2) * TILE_PX;
  for (let i = 0; i < 12 && (await estado()).camera.scrollX > alvoDeScroll; i += 1) {
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(120);
    await page.keyboard.up('ArrowLeft');
    await esperarFrame();
  }
  afirmar(
    (await estado()).camera.scrollX <= alvoDeScroll,
    `a camera deveria ter chegado a ${alvoDeScroll} para a pedreira caber no quadro, `
      + `parou em ${(await estado()).camera.scrollX}`,
  );

  // ---- 2. a rua e a planta da pedreira -------------------------------------
  await page.click('[data-ferramenta="estrada"]');
  await esperarFrame();
  for (const { gy, de, ate } of arrastos) {
    await centrarEm(Math.floor((de + ate) / 2));
    const pDe = await pontoDoTile(de, gy);
    const pAte = await pontoDoTile(ate, gy);
    await arrastarDentroDoCanvas(page, canvas, [pDe, pAte]);
    await avancar(1);
    await esperarFrame();
  }
  const desenhada = await estado();
  afirmar(
    desenhada.estradasPlanejadasRenderizadas === tilesDaRua && desenhada.estradasRenderizadas === 0,
    `o arrasto deveria DESENHAR ${tilesDaRua} tiles e erguer 0, veio `
      + `${desenhada.estradasPlanejadasRenderizadas} e ${desenhada.estradasRenderizadas}`,
  );
  // a pedreira so conta como LIGADA por rua de pe, e desde a F18d-1b quem ergue o tile e
  // o laborer: sem esta espera o passo 3 veria `sem-estrada` desde o comeco, e o aviso
  // que esta feature mede apareceria pelo motivo errado.
  await erguerRua(ctx, { tiles: tilesDaRua });
  await page.keyboard.press('Escape');
  await esperarFrame();

  await centrarEm(pedreira.gx + largQu);
  await page.click('[data-predio="quarry"]');
  await esperarFrame();
  await clicarNoTile(pedreira.gx, pedreira.gy);
  await avancar(1);
  await page.keyboard.press('Escape'); // larga a planta fantasma
  await esperarFrame();
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  const ID_PEDREIRA = await idAberto();
  afirmar(ID_PEDREIRA !== null, 'clicar na planta recem-posta deveria abrir o painel da obra');
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).estado === 'obra',
    'o predio aberto deveria estar em obra no ESTADO, nao so no texto do painel',
  );
  await page.keyboard.press('Escape'); // o painel sobrepoe o canto do canvas
  await esperarFrame();
  afirmar(
    await page.isHidden('#alertas'),
    `obra nao alerta: nao ha trabalhador a esperar antes de o predio existir, veio ${await resumo()}`,
  );

  // ---- 3. a pedreira fica pronta, e o aviso aparece SOZINHO -----------------
  // Nenhum cabra foi treinado de proposito: a escola nunca recebeu pedido. E
  // essa a situacao que o jogador nao tinha como perceber sem clicar.
  let ticks = 0;
  while (ticks < TETO_ATE_COMPLETAR && (await predioDoEstado(ID_PEDREIRA)).estado !== 'completo') {
    await avancar(PASSO_DE_AVANCO);
    ticks += PASSO_DE_AVANCO;
    await esperarFrame();
  }
  const pronta = await predioDoEstado(ID_PEDREIRA);
  afirmar(
    pronta.estado === 'completo',
    `a pedreira deveria ficar pronta em ate ${TETO_ATE_COMPLETAR} ticks, veio ${pronta.estado}`,
  );
  afirmar(
    pronta.ocupante === null,
    'o aviso so vale se a pedreira estiver mesmo VAGA no estado; veio com ocupante',
  );
  afirmar(await page.isVisible('#alertas'), `o aviso deveria ter aparecido sozinho em ${ticks} ticks`);
  afirmar(
    (await resumo()) === JSON.stringify([
      { causa: 'sem-trabalhador', rotulo: ROTULO['sem-trabalhador'], contagem: '1' },
    ]),
    `o aviso deveria ser so "sem-trabalhador", com o texto do tema e contagem 1, veio ${await resumo()}`,
  );
  await capturar('sem-trabalhador');

  // ---- 4. o LAYOUT, medido ---------------------------------------------------
  // Com o painel ABERTO, que e o caso em que os dois disputam a celula do canvas.
  await clicarNoTile(meioDaPedreira.gx, meioDaPedreira.gy);
  afirmar((await idAberto()) === ID_PEDREIRA, 'o painel deveria abrir na pedreira');
  const rAviso = await retanguloDe(page, '#alertas');
  const rPainel = await retanguloDe(page, '#painel-predio');
  afirmar(
    rAviso.width > 0 && rAviso.height > 0,
    `o aviso deveria ter area na tela, veio ${JSON.stringify(rAviso)}`,
  );
  // UI-barra-a: o aviso mora na FAIXA de altura fixa da barra lateral, e nao
  // sobreposicao no canto do mapa — o canvas fica inteiro para o jogo.
  const rFaixa = await retanguloDe(page, '#faixa-alertas');
  afirmar(
    rAviso.left >= rFaixa.left - 0.5 && rAviso.right <= rFaixa.right + 0.5
      && rAviso.top >= rFaixa.top - 0.5 && rAviso.bottom <= rFaixa.bottom + 0.5,
    `o aviso deveria caber na faixa de alertas ${JSON.stringify(rFaixa)}, veio ${JSON.stringify(rAviso)}`,
  );
  const rBarra = await retanguloDe(page, '#barra');
  const canvasAgora = await retanguloDoCanvas(page);
  afirmar(
    rAviso.right <= canvasAgora.left + 0.5,
    `o aviso nao pode invadir o canvas: aviso.right ${rAviso.right} contra canvas.left ${canvasAgora.left}`,
  );
  const cruzam = rAviso.left < rPainel.right && rAviso.right > rPainel.left
    && rAviso.top < rPainel.bottom && rAviso.bottom > rPainel.top;
  afirmar(
    !cruzam,
    `aviso e painel nao podem se cobrir: aviso ${JSON.stringify(rAviso)}, painel ${JSON.stringify(rPainel)}`,
  );
  // O canvas nao pode ter encolhido: o aviso e faixa da barra, nao coluna nova —
  // e a invariante que o roteiro da F06 afirma do outro lado.
  afirmar(
    canvasAgora.left >= rBarra.right - 0.5 && canvasAgora.width === canvas.width,
    `o canvas deveria continuar a direita da barra e do mesmo tamanho, veio ${JSON.stringify(canvasAgora)} contra barra.right ${rBarra.right}`,
  );

  // ---- 5. PAUSA DELIBERADA cala o aviso -------------------------------------
  // Prédio que o jogador desligou nao e problema (Nota da F16c). E a unica das
  // tres provas que so se ve aqui: no headless "sumiu" e uma lista vazia.
  afirmar(
    (await page.getAttribute('#painel-predio [data-pausar]', 'data-pausar')) === 'true',
    'trabalhando, o botao deveria mandar pausado=true — e o VALOR que vai no comando',
  );
  await page.click('#painel-predio [data-pausar]');
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).pausado === true,
    'a pausa deveria ter pegado no ESTADO, nao so no texto do painel',
  );
  afirmar(
    await page.isHidden('#alertas'),
    `pausado pelo jogador, o aviso deveria sumir INTEIRO, veio ${await resumo()}`,
  );
  await capturar('pausado-sem-aviso');

  // ---- 6. retomar, e cortar a estrada: o segundo aviso ----------------------
  await page.click('#painel-predio [data-pausar]');
  await avancar(1);
  await esperarFrame();
  afirmar(
    (await predioDoEstado(ID_PEDREIRA)).pausado === false,
    'voltar ao trabalho deveria despausar no estado',
  );
  afirmar(
    await page.isVisible('#alertas'),
    'pausa nao apaga a causa, so cala o aviso: retomando, ele volta',
  );
  await page.keyboard.press('Escape');
  await esperarFrame();

  await page.click('[data-ferramenta="demolir-estrada"]');
  await esperarFrame();
  await centrarEm(corte.gx);
  const pCorte = await pontoDoTile(corte.gx, corte.gy);
  await page.mouse.click(pCorte.x, pCorte.y);
  await avancar(1);
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();
  const cortada = await estado();
  afirmar(
    cortada.estradasRenderizadas === tilesDaRua - 1 && cortada.estradasPlanejadasRenderizadas === 0,
    `a rua deveria ter perdido um tile e nao virar canteiro, veio `
      + `${cortada.estradasRenderizadas} de pe e ${cortada.estradasPlanejadasRenderizadas} planejados`,
  );
  afirmar(
    (await resumo()) === JSON.stringify([
      { causa: 'sem-trabalhador', rotulo: ROTULO['sem-trabalhador'], contagem: '1' },
      { causa: 'sem-estrada', rotulo: ROTULO['sem-estrada'], contagem: '1' },
    ]),
    `cortada a rua, os DOIS avisos deveriam aparecer, nesta ordem, veio ${await resumo()}`,
  );
  await capturar('sem-trabalhador-e-sem-estrada');
}

module.exports = { roteiro };
