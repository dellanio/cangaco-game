'use strict';

const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const { createHash } = require('node:crypto');
const mapa = require('../../data/maps/sertao-128.json');
const terreno = require('../../data/terrain.json');
const manifesto = require('../../assets/manifest.json');
const SAIDA = 'test-output/D-TELA-COSTURA-DOS-TILES.json';
// BUG-ROTEIRO-DE-DUAS-ETAPAS (decisao do operador, 2026-10-04: A, separar). Sem variavel, o roteiro
// e de NAO-REGRESSAO: mede e afirma so o que vale sozinho, no codigo de hoje, e grava a medida em
// `regressao`, sem tocar `antes`/`depois`. A comparacao antes/depois e um modo pedido por
// `CANGACO_COSTURA_ETAPA=antes|depois`, e so ele exige a medida "antes". O que saiu para o modo de
// comparacao: a baseline existir, a arte ser a mesma do antes, e os bytes das 16 celulas internas
// iguais ao antes no zoom 1.
const ETAPA = process.env.CANGACO_COSTURA_ETAPA ?? 'regressao';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

// O bloco de 12x12 garante que o recorte central seja terreno puro nos tres zooms.
function vistaPura(tipo) {
  const simbolo = Object.keys(mapa.legenda).find((ch) => mapa.legenda[ch] === tipo);
  for (let gy = 0; gy <= mapa.altura - 12; gy += 1) {
    for (let gx = 0; gx <= mapa.largura - 12; gx += 1) {
      let pura = true;
      for (let y = gy; y < gy + 12; y += 1) for (let x = gx; x < gx + 12; x += 1) {
        if (mapa.linhas[y][x] !== simbolo) pura = false;
      }
      if (pura) return { gx: gx + 6, gy: gy + 6 };
    }
  }
  throw new Error(`Nao ha bloco puro de ${tipo}.`);
}

function fontes() {
  // Todos os PNGs sao somente lidos: registra inclusive variantes e bordas para detectar
  // uma comparacao acidental entre artes diferentes depois do rebase.
  const arquivos = [...new Set(manifesto.assets.filter((a) => a.tipo === 'terreno')
    .flatMap((a) => Object.values(a.estados)))].sort();
  return Object.fromEntries(arquivos.map((f) => [f, sha(fs.readFileSync(`assets/${f}`))]));
}

async function pixelsDaCaptura(page, arquivo, retangulo) {
  return page.evaluate(async ({ b64, retangulo }) => {
    const imagem = new window.Image();
    imagem.src = `data:image/png;base64,${b64}`;
    await imagem.decode();
    const canvas = window.document.createElement('canvas');
    canvas.width = imagem.width;
    canvas.height = imagem.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imagem, 0, 0);
    const x0 = Math.round(retangulo.x + retangulo.width / 2) - 208;
    const y0 = Math.round(retangulo.y + retangulo.height / 2) - 208;
    return { largura: 416, x0, y0, pixels: Array.from(ctx.getImageData(x0, y0, 416, 416).data) };
  }, { b64: fs.readFileSync(arquivo).toString('base64'), retangulo });
}

// Diferença RGB entre pixels adjacentes, na borda de tiles e no meio deles.
// Exclui cruzamentos: cada segmento usa os 50% centrais do lado do tile.
function medir({ largura, pixels, x0, y0 }, camera, canvas, centro) {
  const passo = terreno.tile_px * camera.zoom;
  const origemX = canvas.x + canvas.width / 2 + (centro.gx * terreno.tile_px - camera.scrollX - canvas.width / 2) * camera.zoom;
  const origemY = canvas.y + canvas.height / 2 + (centro.gy * terreno.tile_px - camera.scrollY - canvas.height / 2) * camera.zoom;
  const diferenca = (x, y, dx, dy) => {
    const a = ((y - y0) * largura + x - x0) * 4;
    const b = ((y + dy - y0) * largura + x + dx - x0) * 4;
    return (Math.abs(pixels[a] - pixels[b]) + Math.abs(pixels[a + 1] - pixels[b + 1])
      + Math.abs(pixels[a + 2] - pixels[b + 2])) / 3;
  };
  const medias = {};
  for (const eixo of ['colunas', 'linhas']) for (const onde of ['borda', 'meio']) {
    let soma = 0; let n = 0;
    for (let i = -2; i <= 1; i += 1) for (let j = -2; j <= 1; j += 1) {
      const pos = Math.round((eixo === 'colunas' ? origemX : origemY) + (i + (onde === 'meio' ? 0.5 : 0)) * passo);
      const inicio = Math.round((eixo === 'colunas' ? origemY : origemX) + (j + 0.25) * passo);
      const fim = Math.round((eixo === 'colunas' ? origemY : origemX) + (j + 0.75) * passo);
      for (let k = inicio; k < fim; k += 1) {
        soma += eixo === 'colunas' ? diferenca(pos - 1, k, 1, 0) : diferenca(k, pos - 1, 0, 1);
        n += 1;
      }
    }
    medias[`${eixo}_${onde}`] = { media: soma / n, pares: n };
  }
  // Quatro por quatro celulas, sem o pixel da borda. Igualdade dos bytes, nao tolerancia.
  const interiores = [];
  if (camera.zoom === 1) {
    for (let j = -2; j <= 1; j += 1) for (let i = -2; i <= 1; i += 1) {
      const bytes = [];
      for (let y = origemY + j * passo + 1; y < origemY + (j + 1) * passo - 1; y += 1) {
        for (let x = origemX + i * passo + 1; x < origemX + (i + 1) * passo - 1; x += 1) {
          const p = ((y - y0) * largura + x - x0) * 4;
          bytes.push(...pixels.slice(p, p + 4));
        }
      }
      interiores.push(sha(Buffer.from(bytes)));
    }
  }
  return { ...medias, interiores };
}

async function roteiro({ page, estado, afirmar, capturar }) {
  afirmar(['antes', 'depois', 'regressao'].includes(ETAPA), 'etapa deve ser antes ou depois (ou nenhuma, a nao-regressao)');
  const anterior = fs.existsSync(SAIDA) ? JSON.parse(fs.readFileSync(SAIDA, 'utf8')) : {};
  if (ETAPA === 'depois') afirmar(Boolean(anterior.antes), 'baseline anterior a mudanca precisa existir');
  const fontesAtuais = fontes();
  if (ETAPA === 'depois') afirmar(JSON.stringify(fontesAtuais) === JSON.stringify(anterior.antes.fontes),
    'a arte precisa ser a mesma na medida antes/depois');
  const canvas = await page.locator('#jogo canvas').boundingBox();
  afirmar(canvas !== null, 'canvas existe');
  const resultado = { fontes: fontesAtuais, tick: (await estado()).tick, vistas: {} };
  for (const tipo of ['areia', 'agua']) {
    const centro = vistaPura(tipo);
    resultado.vistas[tipo] = {};
    for (const zoom of [1, 0.75, 1.5]) {
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
      for (let tentativas = 0; (await estado()).camera.zoom !== zoom && tentativas < 5; tentativas += 1) {
        await page.mouse.wheel(0, (await estado()).camera.zoom < zoom ? -100 : 100);
        await page.waitForTimeout(100);
      }
      afirmar((await estado()).camera.zoom === zoom, `zoom ${zoom} aplicado`);
      await page.evaluate(({ x, y }) => window.__cangaco.fixarCamera({ scrollX: x, scrollY: y }), {
        x: centro.gx * terreno.tile_px - canvas.width / 2,
        y: centro.gy * terreno.tile_px - canvas.height / 2,
      });
      // O realce do tile sob o mouse nao e costura: tira o ponteiro do canvas.
      await page.mouse.move(100, 100);
      const arquivo = await capturar(`${ETAPA}-${tipo}-zoom-${zoom}`);
      const s = await estado();
      afirmar(s.tick === resultado.tick && s.pausado, 'medidas usam o mesmo tick pausado');
      afirmar(Number.isInteger(s.camera.scrollX) && Number.isInteger(s.camera.scrollY), 'camera em pixel inteiro');
      const medidas = medir(await pixelsDaCaptura(page, arquivo, canvas), s.camera, canvas, centro);
      resultado.vistas[tipo][zoom] = { centro, camera: s.camera, arquivo, ...medidas };
      if (ETAPA === 'depois' && zoom === 1) {
        afirmar(JSON.stringify(medidas.interiores) === JSON.stringify(anterior.antes.vistas[tipo][zoom].interiores),
          `${tipo}: bytes de todas as 16 celulas internas iguais ao antes no zoom 1`);
      }
      console.log(`${ETAPA} ${tipo} zoom ${zoom}: ${JSON.stringify(Object.fromEntries(Object.entries(medidas).filter(([k]) => k !== 'interiores')))}`);
    }
  }
  fs.mkdirSync('test-output', { recursive: true });
  fs.writeFileSync(SAIDA, JSON.stringify({ ...anterior, [ETAPA]: resultado }, null, 2) + '\n');
}

module.exports = { roteiro };
