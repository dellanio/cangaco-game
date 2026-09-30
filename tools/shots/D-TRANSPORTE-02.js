'use strict';
// Roteiro da D-TRANSPORTE-02b — A ABA DE DISTRIBUICAO.
// 1. H -> "Nova escaramuca"; o clique na aba Distribuicao troca o corpo para `distribuicao`;
// 2. as secoes sao as quatro mercadorias disputadas, na ordem do dado, e todo par esta no
//    maximo (o padrao), com o `+` desabilitado;
// 3. DESPAUSADO e com o botao seguro 150 ms (§8), dois `−` no par milho/moinho levam o valor
//    a max - 2 — o comando passou pela sim e voltou pelo selector;
// 4. captura; dois `+` devolvem ao maximo e o `+` volta a desabilitar.
const distribuicaoDoDado = require('../../data/delivery.json').distribuicao;

async function roteiro(ctx) {
  const { page, capturar, afirmar } = ctx;
  const esperarFrame = () => page.waitForTimeout(200);
  const maximo = distribuicaoDoDado.maximo;

  await page.keyboard.press('h');
  await esperarFrame();
  await page.click('#ajuda [data-acao="escaramuca"]');
  await esperarFrame();
  await page.keyboard.press('Escape');
  await esperarFrame();

  const centro = (seletor) => page.$eval(seletor, (b) => {
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  // o gesto do jogador: despausa, segura 150 ms, solta, espera o laco, pausa de volta
  const apertar = async (seletor) => {
    const p = await centro(seletor);
    await page.keyboard.press('p');
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.keyboard.press('p');
  };
  const ler = () => page.evaluate(() => [...window.document.querySelectorAll('#distribuicao .mercadoria-disputada')].map((s) => ({
    mercadoria: s.dataset.mercadoria,
    titulo: s.querySelector('h3').textContent,
    pares: [...s.querySelectorAll('li')].map((li) => ({
      par: li.dataset.par,
      nome: li.querySelector('.nome').textContent,
      valor: Number(li.querySelector('.valor').textContent),
      menos: li.querySelector('[data-passo="-1"]').disabled,
      mais: li.querySelector('[data-passo="1"]').disabled,
      visivel: li.getBoundingClientRect().height > 0,
    })),
  })));

  // 1. a aba abre
  await apertar('#abas [data-aba="distribuicao"]');
  const corpo = await page.evaluate(() => window.document.body.dataset.corpo);
  afirmar(corpo === 'distribuicao', `o corpo deveria ser distribuicao, e ${corpo}`);

  // 2. as secoes batem com o dado, todas no maximo
  const antes = await ler();
  const esperado = Object.entries(distribuicaoDoDado.padrao).filter(([m]) => m !== '_doc')
    .map(([m, tipos]) => ({ mercadoria: m, pares: Object.keys(tipos).map((t) => `${m}|${t}`) }));
  afirmar(JSON.stringify(antes.map((s) => ({ mercadoria: s.mercadoria, pares: s.pares.map((p) => p.par) }))) === JSON.stringify(esperado),
    `as secoes deveriam ser ${JSON.stringify(esperado)}, sao ${JSON.stringify(antes)}`);
  const todos = antes.flatMap((s) => s.pares);
  afirmar(todos.every((p) => p.valor === maximo && p.mais && !p.menos && p.visivel), `todo par deveria abrir em ${maximo}, com o + desabilitado: ${JSON.stringify(todos)}`);
  afirmar(antes.every((s) => s.titulo !== s.mercadoria) && todos.every((p) => !p.nome.includes('_')), 'mercadoria e casa deveriam aparecer com o nome do tema');

  // 3. dois − no moinho
  await apertar('[data-distribuicao="corn|mill"][data-passo="-1"]');
  await apertar('[data-distribuicao="corn|mill"][data-passo="-1"]');
  const baixado = (await ler()).flatMap((s) => s.pares);
  const moinho = baixado.find((p) => p.par === 'corn|mill');
  afirmar(moinho.valor === maximo - 2 && !moinho.mais && !moinho.menos, `o moinho deveria mostrar ${maximo - 2} com os dois botoes ativos: ${JSON.stringify(moinho)}`);
  afirmar(baixado.filter((p) => p.par !== 'corn|mill').every((p) => p.valor === maximo), 'so o par apertado deveria mudar');

  // 4. captura e volta ao maximo
  await capturar('moinho-guarda-menos');
  await apertar('[data-distribuicao="corn|mill"][data-passo="1"]');
  await apertar('[data-distribuicao="corn|mill"][data-passo="1"]');
  const devolta = (await ler()).flatMap((s) => s.pares).find((p) => p.par === 'corn|mill');
  afirmar(devolta.valor === maximo && devolta.mais, `de volta ao maximo, o + deveria desabilitar: ${JSON.stringify(devolta)}`);

  // 5. a ultima linha nao cabe no painel de 720 px: o `#corpo-aba` rola ate ela
  const ultima = await page.evaluate(() => {
    const li = [...window.document.querySelectorAll('#distribuicao li')].pop();
    const corpoAba = window.document.getElementById('corpo-aba');
    li.scrollIntoView({ block: 'nearest' });
    const r = li.getBoundingClientRect();
    const c = corpoAba.getBoundingClientRect();
    return { dentro: corpoAba.contains(li), visivel: r.top >= c.top - 1 && r.bottom <= c.bottom + 1, rolou: corpoAba.scrollTop };
  });
  afirmar(ultima.dentro && ultima.visivel, `a ultima linha deveria ficar alcancavel rolando o corpo da aba: ${JSON.stringify(ultima)}`);

  console.log(`D-TRANSPORTE-02: ${JSON.stringify({ corpo, secoes: antes.map((s) => s.titulo), moinho, devolta })}`);
}

module.exports = { roteiro };
