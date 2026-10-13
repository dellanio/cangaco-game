import { expect, it } from 'vitest';
import { criarLeitorDeDimensoes } from './helpers/png-cabecalho';
import { gravarEvidencia } from './helpers/evidence';

function png(w = 128, h = 64): Buffer {
  const b = Buffer.alloc(1_000_000);
  Buffer.from([137,80,78,71,13,10,26,10]).copy(b);
  b.writeUInt32BE(13,8);
  b.write('IHDR',12);
  b.writeUInt32BE(w,16);
  b.writeUInt32BE(h,20);
  return b;
}

function memoria(conteudo = png(), parcial = 24) {
  const custo = {bytes:0,aberturas:0,fechamentos:0};
  const exigir = (path: string) => {
    if (path !== 'a.png') throw new Error('ENOENT');
    return conteudo;
  };
  const io = {
    abrir(path: string) { exigir(path); custo.aberturas++; return 1; },
    ler(_fd: number, b: Buffer, offset: number, n: number, pos: number) {
      const lidos = Math.max(0,Math.min(n,parcial,conteudo.length-pos));
      conteudo.copy(b,offset,pos,pos+lidos);
      custo.bytes += lidos;
      return lidos;
    },
    fechar() { custo.fechamentos++; },
  };
  return {io,custo};
}

it('le 24 bytes uma vez por caminho e conserva cada resultado declarado', () => {
  const s = memoria();
  const ler = criarLeitorDeDimensoes(s.io);
  const a = ler('a.png');
  expect(a).toEqual([128,64]);
  a[0] = 999;
  expect(ler('a.png')).toEqual([128,64]);
  gravarEvidencia('TIMEOUTS-png-custo',s.custo);
  expect(s.custo).toEqual({bytes:24,aberturas:1,fechamentos:1});
});

it('leitura parcial completa o cabecalho e fecha o descritor', () => {
  const s = memoria(png(),7);
  expect(criarLeitorDeDimensoes(s.io)('a.png')).toEqual([128,64]);
  expect(s.custo).toEqual({bytes:24,aberturas:1,fechamentos:1});
});

it('rejeita arquivo ausente, cabecalho curto e PNG invalido, fechando em erro', () => {
  const s = memoria();
  expect(() => criarLeitorDeDimensoes(s.io)('ausente.png')).toThrow('ENOENT');
  for (const conteudo of [Buffer.alloc(12),Buffer.alloc(24),png(0,64)]) {
    const f = memoria(conteudo);
    expect(() => criarLeitorDeDimensoes(f.io)('a.png')).toThrow();
    expect(f.custo.fechamentos).toBe(1);
  }
});
