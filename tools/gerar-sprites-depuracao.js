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
function gerar(destino = 'assets/depuracao') {
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
if (require.main === module) gerar(process.argv[2]);
module.exports = { gerar };
