import { Buffer } from 'node:buffer';
import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const kind = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  kind.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng({ width, height, data }) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1)
    throw new Error('PNG: dimensões inválidas');
  if (data.length !== width * height * 4) throw new Error('PNG: RGBA incompleto');
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * stride, stride)
    .copy(raw, y * (stride + 1) + 1);
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
  return da <= db && da <= dc ? a : db <= dc ? b : c;
}

export function decodePng(bytes) {
  const input = Buffer.from(bytes);
  if (!input.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG: assinatura inválida');
  let pos = 8, width, height, channels, palette, transparency;
  const idat = [];
  while (pos + 12 <= input.length) {
    const len = input.readUInt32BE(pos);
    const end = pos + 12 + len;
    if (end > input.length) throw new Error('PNG: chunk truncado');
    const type = input.toString('ascii', pos + 4, pos + 8);
    const body = input.subarray(pos + 8, pos + 8 + len);
    if (crc32(input.subarray(pos + 4, pos + 8 + len)) !== input.readUInt32BE(pos + 8 + len))
      throw new Error(`PNG: CRC inválido em ${type}`);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[12] !== 0 || ![2, 3, 6].includes(body[9]))
        throw new Error('PNG: suporte apenas a 8 bits RGB, indexado ou RGBA sem entrelaçamento');
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 1;
    } else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') transparency = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos = end;
  }
  if (!width || !height || !idat.length) throw new Error('PNG: IHDR/IDAT ausente');
  if (width * height > 100_000_000) throw new Error('PNG: imagem grande demais');
  if (channels === 1 && !palette) throw new Error('PNG: paleta ausente');
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== height * (stride + 1)) throw new Error('PNG: tamanho descomprimido inválido');
  const decoded = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1);
    const filter = raw[row];
    if (filter > 4) throw new Error(`PNG: filtro ${filter} não suportado`);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? decoded[y * stride + x - channels] : 0;
      const b = y > 0 ? decoded[(y - 1) * stride + x] : 0;
      const c = y > 0 && x >= channels ? decoded[(y - 1) * stride + x - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >>> 1 : paeth(a, b, c);
      decoded[y * stride + x] = (raw[row + 1 + x] + predictor) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const src = i * channels, dst = i * 4;
    if (channels === 1) {
      const idx = decoded[src];
      if (idx * 3 + 2 >= palette.length) throw new Error('PNG: índice de paleta inválido');
      data[dst] = palette[idx * 3]; data[dst + 1] = palette[idx * 3 + 1]; data[dst + 2] = palette[idx * 3 + 2];
      data[dst + 3] = transparency?.[idx] ?? 255;
    } else {
      data[dst] = decoded[src]; data[dst + 1] = decoded[src + 1]; data[dst + 2] = decoded[src + 2];
      data[dst + 3] = channels === 4 ? decoded[src + 3] : 255;
    }
  }
  return { width, height, data };
}
