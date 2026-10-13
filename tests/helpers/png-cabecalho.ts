import { openSync, readSync, closeSync } from 'node:fs';

export interface ArquivosPng {
  abrir(caminho: string): number;
  ler(fd: number, buffer: Buffer, offset: number, tamanho: number, posicao: number): number;
  fechar(fd: number): void;
}

const arquivos: ArquivosPng = {
  abrir: caminho => openSync(caminho,'r'),
  ler: (fd,buffer,offset,tamanho,posicao) => readSync(fd,buffer,offset,tamanho,posicao),
  fechar: closeSync,
};

export function criarLeitorDeDimensoes(io: ArquivosPng = arquivos): (caminho: string) => [number,number] {
  const cache = new Map<string,[number,number]>();
  return caminho => {
    const existente = cache.get(caminho);
    if (existente !== undefined) return [...existente];
    const fd = io.abrir(caminho);
    try {
      const b = Buffer.alloc(24);
      let offset = 0;
      while (offset < b.length) {
        const n = io.ler(fd,b,offset,b.length-offset,offset);
        if (n <= 0) throw new Error(`${caminho}: cabecalho PNG incompleto`);
        offset += n;
      }
      const assinatura = Buffer.from([137,80,78,71,13,10,26,10]);
      if (!b.subarray(0,8).equals(assinatura) || b.readUInt32BE(8) !== 13 || b.toString('ascii',12,16) !== 'IHDR') {
        throw new Error(`${caminho}: cabecalho PNG invalido`);
      }
      const dimensoes: [number,number] = [b.readUInt32BE(16),b.readUInt32BE(20)];
      if (dimensoes.some(n => n <= 0)) throw new Error(`${caminho}: dimensao PNG invalida`);
      cache.set(caminho,dimensoes);
      return [...dimensoes];
    } finally {
      io.fechar(fd);
    }
  };
}
