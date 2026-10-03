'use strict';

// D-ARTE-02: geometria e fonte bitmap próprias; nenhum arquivo de arte é lido.
const { Buffer } = require('node:buffer');
const { deflateSync } = require('node:zlib');
const { mkdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const DIRECOES = ['n', 'ne', 'l', 'se', 's'];
const ANIMACOES = {
  parado: { quadros: 4, fps: 10, laco: true },
  andar: { quadros: 8, tilesPorCiclo: 2, laco: true },
  morrer: { quadros: 6, fps: 10, laco: false },
};
const FONTE = {
  n: ['101','111','111','111','101'], e: ['111','100','110','100','111'],
  l: ['100','100','100','100','111'], s: ['111','100','111','001','111'],
  0: ['111','101','101','101','111'], 1: ['010','110','010','010','111'],
  2: ['111','001','111','100','111'], 3: ['111','001','111','001','111'],
  4: ['101','101','111','001','001'], 5: ['111','100','111','001','111'],
  6: ['111','100','111','101','111'], 7: ['111','001','010','010','010'],
};

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(tipo, dados) {
  const nome = Buffer.from(tipo);
  const tamanho = Buffer.alloc(4); tamanho.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([nome, dados])));
  return Buffer.concat([tamanho, nome, dados, crc]);
}
function png(largura, altura, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura); ihdr.writeUInt32BE(altura, 4); ihdr[8] = 8; ihdr[9] = 6;
  const linhas = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) pixels.copy(linhas, y * (1 + largura * 4) + 1, y * largura * 4, (y + 1) * largura * 4);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(linhas, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function gerarSerf(destino) {
  const largura = 512, altura = 1080;
  const pixels = Buffer.alloc(largura * altura * 4);
  const frames = {};
  let indice = 0;
  for (const [animacao, dado] of Object.entries(ANIMACOES)) {
    for (const [d, direcao] of DIRECOES.entries()) {
      for (let q = 0; q < dado.quadros; q++) {
        const x = (indice % 8) * 64, y = Math.floor(indice / 8) * 90;
        const recorte = { x: 12 + q % 3, y: 18 + q % 4, w: 40 - 2 * (q % 3), h: 78 - q % 4 };
        const pixel = (px, py, cor) => {
          const offset = ((y + py - recorte.y) * largura + x + px - recorte.x) * 4;
          pixels.set(cor, offset);
        };
        const retangulo = (px, py, w, h, cor) => {
          for (let yy = py; yy < py + h; yy++) for (let xx = px; xx < px + w; xx++) pixel(xx, yy, cor);
        };
        const tinta = [40 + d * 40, 180 - d * 20, 80 + q * 20, 255];
        retangulo(24, 38 + q % 4, 16, 43 - q % 4, tinta);
        retangulo(28, 81, 3, 14, tinta); retangulo(35, 81, 3, 14, tinta);
        // Linha do pé y=95 em todos os quadros, inclusive os recortados.
        retangulo(recorte.x, 95, recorte.w, 1, [255,255,255,255]);
        let tx = 20;
        for (const letra of `${direcao}${q}`) {
          FONTE[letra].forEach((linha, yy) => [...linha].forEach((b, xx) => {
            if (b === '1') retangulo(tx + xx * 2, 22 + yy * 2, 2, 2, [255,255,255,255]);
          }));
          tx += 8;
        }
        frames[`serf/${animacao}/${direcao}/${String(q).padStart(4, '0')}`] = {
          frame: { x, y, w: recorte.w, h: recorte.h }, rotated: false, trimmed: true,
          spriteSourceSize: recorte, sourceSize: { w: 64, h: 96 },
        };
        indice++;
      }
    }
  }
  mkdirSync(join(destino, 'serf'), { recursive: true });
  writeFileSync(join(destino, 'serf/serf.png'), png(largura, altura, pixels));
  writeFileSync(join(destino, 'serf/serf.json'), JSON.stringify({ frames, meta: { image: 'serf.png', size: { w: largura, h: altura }, scale: '1' } }, null, 2) + '\n');
  writeFileSync(join(destino, 'manifesto.json'), JSON.stringify({ versao: 1, assets: [{
    id: 'serf', tipo: 'unidade', footprint: [1,1], tamanho: [64,96], anchor: [0.5,1],
    estados: {}, atlas: 'depuracao/serf/serf.json', animacoes: ANIMACOES,
    licenca: 'CC0, formas de depuração', origem: { base: 'depuracao/serf/serf.png', semente: null, nota: 'tools/gerar-sprites-depuracao.js' },
  }] }, null, 2) + '\n');
}
// Fixtures geométricas; não são arte final. O serf acima mantém seus bytes.
function gerarTipo(destino, id, acao) {
  const animacoes = {
    parado: ANIMACOES.parado, andar: ANIMACOES.andar,
    [acao]: { quadros: 6, fps: 10, laco: true }, morrer: ANIMACOES.morrer,
  };
  const largura = 512, altura = 1440;
  const pixels = Buffer.alloc(largura * altura * 4), frames = {};
  let indice = 0;
  for (const [animacao, dado] of Object.entries(animacoes)) {
    for (const [d, direcao] of DIRECOES.entries()) for (let q = 0; q < dado.quadros; q++) {
      const x = indice % 8 * 64, y = Math.floor(indice / 8) * 96;
      const rect = (px, py, w, h, cor) => {
        for (let yy = py; yy < py + h; yy++) for (let xx = px; xx < px + w; xx++) {
          pixels.set(cor, ((y + yy - 10) * largura + x + xx - 6) * 4);
        }
      };
      const alpha = animacao === 'morrer' && q >= 4 ? (q === 4 ? 128 : 32) : 255;
      const tinta = [60 + 30 * d, 150, 110 + 15 * q, alpha], osso = [235,235,215,alpha];
      const esqueleto = animacao === 'morrer' && q >= 2;
      if (esqueleto) {
        rect(19, 76, 7, 6, osso); rect(26, 79, 21, 2, osso);
        rect(31, 73, 2, 14, osso); rect(37, 74, 2, 12, osso);
        rect(44, 80, 10, 2, osso);
      } else {
        const caindo = animacao === 'morrer';
        rect(26, caindo ? 65 : 30, 12, 12, tinta);
        rect(caindo ? 21 : 24, caindo ? 78 : 42, caindo ? 28 : 16, caindo ? 10 : 36, tinta);
        rect(27, 78, 4, 17, tinta); rect(35, 78, 4, 17, tinta);
        if (id === 'militia') {
          rect(13, 48, 7, 21, [45,90,200,alpha]); // escudo, esquerda
          rect(45, 33 + q % 3, 3, 36, [240,150,30,alpha]); // arma, direita
        } else {
          rect(44, 35 + q % 3, 3, 39, [160,110,60,alpha]);
          rect(40, 32 + q % 3, 13, 5, [230,230,230,alpha]);
        }
      }
      // Linha técnica de assentamento, também no quadro dissipado.
      rect(6, 95, 52, 1, [255,255,255,alpha]);
      const sigla = { parado: 'p', andar: 'a', atacar: 't', trabalhar: 't', morrer: 'm' }[animacao];
      let tx = 12;
      for (const letra of `${sigla}${direcao}${q}`) {
        FONTE[letra].forEach((linha, yy) => [...linha].forEach((b, xx) => {
          if (b === '1') rect(tx + xx * 2, 12 + yy * 2, 2, 2, [255,255,255,255]);
        }));
        tx += 8;
      }
      frames[`${id}/${animacao}/${direcao}/${String(q).padStart(4, '0')}`] = {
        frame: { x, y, w: 52, h: 86 }, rotated: false, trimmed: true,
        spriteSourceSize: { x: 6, y: 10, w: 52, h: 86 }, sourceSize: { w: 64, h: 96 },
      };
      indice++;
    }
  }
  mkdirSync(join(destino, id), { recursive: true });
  writeFileSync(join(destino, `${id}/${id}.png`), png(largura, altura, pixels));
  writeFileSync(join(destino, `${id}/${id}.json`), JSON.stringify({ frames,
    meta: { image: `${id}.png`, size: { w: largura, h: altura }, scale: '1' } }, null, 2) + '\n');
  return { id, tipo: 'unidade', footprint: [1,1], tamanho: [64,96], anchor: [0.5,1],
    estados: {}, atlas: `depuracao/${id}/${id}.json`, animacoes,
    licenca: 'CC0, formas de depuração', origem: { base: `depuracao/${id}/${id}.png`, semente: null,
      nota: 'tools/gerar-sprites-depuracao.js; morte, esqueleto, dissipação' } };
}
FONTE.p = ['110','101','110','100','100']; FONTE.a = ['010','101','111','101','101'];
FONTE.t = ['111','010','010','010','010']; FONTE.m = ['101','111','111','101','101'];
function gerar(destino = 'assets/depuracao') {
  gerarSerf(destino);
  const { readFileSync } = require('node:fs');
  const manifesto = JSON.parse(readFileSync(join(destino, 'manifesto.json'), 'utf8'));
  for (const [id, acao] of [['militia','atacar'], ['woodcutter','trabalhar'], ['laborer','trabalhar']]) {
    manifesto.assets.push(gerarTipo(destino, id, acao));
  }
  writeFileSync(join(destino, 'manifesto.json'), JSON.stringify(manifesto, null, 2) + '\n');
}
if (require.main === module) gerar(process.argv[2]);
module.exports = { gerar };
