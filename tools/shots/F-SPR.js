'use strict';

// Roteiro da F-SPR — O CARREGAMENTO DE SPRITE NAO QUEBRA O PLACEHOLDER.
//
// A feature nao traz arte nenhuma: so o caminho manifesto -> loader -> cena para
// terreno, recurso, vegetacao e unidade. O que este roteiro mede e a REGRA, nao o
// retrato do dia (licao da F17f): a cena so publica arte para o id que o manifesto
// declara, e tudo o que nao declara continua desenhado como antes — cor chapada,
// marcador, retangulo. Quando a arte chegar, o mesmo roteiro continua valendo.
//
// Afirma numero publicado pela cena (CLAUDE.md §8), nunca pixel. Nenhum id esta
// digitado aqui: sai de `assets/manifest.json` e de `data/units.json`.

const { retanguloDoCanvas, pontoDoTileNaTela, arrastarDentroDoCanvas } = require('./_canvas');
const manifesto = require('../../assets/manifest.json');
const unidades = require('../../data/units.json');
const economia = require('../../data/economy.json');
const terreno = require('../../data/terrain.json');
const { predios } = require('../../data/buildings.json');

const TILE_PX = terreno.tile_px;

const DIRECOES_DE_QUATRO = ['n', 'l', 's', 'o'];
const DIRECOES_DE_OITO = ['n', 'ne', 'l', 'se', 's', 'so', 'o', 'no'];

/** Os ids que o manifesto declara num tipo de camada. */
const declarados = (tipo) => new Set(manifesto.assets.filter((e) => e.tipo === tipo).map((e) => e.id));

/** Tipo de unidade -> 4 | 8 | null, lido do dado como `render/direcoes-de-sprite.ts` le. */
function direcoesDoDado() {
  const mapa = new Map();
  for (const grupo of ['civis', 'militares', 'mercenarios']) {
    const g = unidades[grupo];
    for (const t of g.tipos) mapa.set(t.id, t.direcoesDeSprite ?? g._comum?.direcoesDeSprite ?? null);
  }
  return mapa;
}

async function roteiro(ctx) {
  const { page, capturar, estado, afirmar } = ctx;
  const avancar = (n) => page.evaluate((k) => window.__cangaco.avancar(k), n);
  const soma = (contagem) => Object.values(contagem || {}).reduce((a, n) => a + n, 0);
  const direcoes = direcoesDoDado();

  // ---- 0. a abertura: cada camada so tem arte onde o manifesto declara -----
  let s = await estado();
  afirmar(s.arteDasCamadas !== undefined, 'a cena deveria publicar `arteDasCamadas`');
  for (const tipo of ['terreno', 'recurso', 'vegetacao']) {
    const comArte = s.arteDasCamadas[tipo];
    const fora = comArte.filter((id) => !declarados(tipo).has(id));
    afirmar(
      fora.length === 0,
      `${tipo}: a cena resolveu arte para ${fora.join(', ')}, que o manifesto nao declara`,
    );
  }
  if (declarados('vegetacao').size === 0) {
    afirmar(
      s.vegetacaoRenderizada === 0,
      `sem vegetacao no manifesto nao ha sprite de arvore, veio ${s.vegetacaoRenderizada}`,
    );
  }

  // O placeholder continua desenhado: terreno com mais de um tipo, marcador de recurso.
  // "Tipo desenhado" e contagem > 0 — a contagem zera todo tipo conhecido antes de contar.
  const terrenos = Object.keys(s.terrenoVisivel).filter((t) => s.terrenoVisivel[t] > 0);
  afirmar(
    terrenos.length >= 2,
    `a abertura deveria desenhar mais de um terreno, veio ${JSON.stringify(s.terrenoVisivel)}`,
  );
  afirmar(
    soma(s.recursosVisiveis) > 0,
    `a abertura deveria desenhar marcador de recurso, veio ${JSON.stringify(s.recursosVisiveis)}`,
  );

  // ---- 1. unidade: direcao do dado, sprite so com entrada no manifesto -----
  const conferirUnidades = (quadro, rotulo) => {
    afirmar(quadro.unidadesRenderizadas.length > 0, `${rotulo}: deveria haver unidade desenhada`);
    for (const u of quadro.unidadesRenderizadas) {
      const n = direcoes.get(u.tipo) ?? null;
      if (n === null) {
        afirmar(u.direcao === null && u.sprite === null, `${rotulo}: ${u.id} (${u.tipo}) nao tem direcao de sprite no dado`);
        continue;
      }
      const validas = n === 4 ? DIRECOES_DE_QUATRO : DIRECOES_DE_OITO;
      afirmar(validas.includes(u.direcao), `${rotulo}: ${u.id} (${u.tipo}, ${n}) olha para '${u.direcao}'`);
      if (!declarados('unidade').has(u.tipo)) {
        afirmar(u.sprite === null, `${rotulo}: ${u.id} (${u.tipo}) sem entrada no manifesto veio com sprite ${u.sprite}`);
      }
    }
  };
  conferirUnidades(s, 'abertura');
  await capturar('abertura-placeholder');

  // ---- 2. o tempo passa: a direcao acompanha o passo -----------------------
  // Na abertura ninguem tem trabalho e ninguem anda. Uma rua ao longo da borda sul
  // do armazem (a mesma geometria da F08, tirada dos JSON) poe laborer e serf na
  // rua. Parado, todo mundo olha para o sul (o padrao); andando, ao menos um sai
  // dele — se a direcao nunca mudasse, o sprite de unidade nunca viraria.
  const canvas = await retanguloDoCanvas(page);
  const armazem = economia.estadoInicial.predios.find((p) => p.id === 'storehouse');
  const [larguraDoArmazem, alturaDoArmazem] = predios.find((p) => p.id === 'storehouse').tamanho;
  const yRua = armazem.gy + alturaDoArmazem;
  const inicio = { gx: armazem.gx, gy: yRua };
  const fim = { gx: armazem.gx + larguraDoArmazem + 1, gy: yRua };
  await page.keyboard.press('r');
  await page.waitForTimeout(150);
  await arrastarDentroDoCanvas(page, canvas, [
    pontoDoTileNaTela(canvas, inicio, s.camera, TILE_PX),
    pontoDoTileNaTela(canvas, fim, s.camera, TILE_PX),
  ]);
  await page.keyboard.press('Escape');
  await avancar(1);
  await page.waitForTimeout(200);
  s = await estado();
  afirmar(
    s.estradasPlanejadasRenderizadas > 0,
    `o arrasto deveria desenhar canteiro de rua, veio ${s.estradasPlanejadasRenderizadas}`,
  );

  const antes = new Map(s.unidadesRenderizadas.map((u) => [u.id, u.direcao]));
  let mudou = false;
  for (let i = 0; i < 20 && !mudou; i += 1) {
    await avancar(10);
    await page.waitForTimeout(100);
    s = await estado();
    mudou = s.unidadesRenderizadas.some((u) => u.direcao !== null && antes.has(u.id) && u.direcao !== antes.get(u.id));
  }
  afirmar(mudou, 'em 200 ticks, nenhuma unidade mudou de direcao');
  conferirUnidades(s, 'depois de andar');
  await capturar('unidades-andando');
}

module.exports = { roteiro };
