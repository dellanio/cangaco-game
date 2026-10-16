/**
 * I-TELA-OBRA-EM-ORDEM-DE-CONSTRUCAO (pedido do operador, 2026-10-16) — o momento em que cada pixel da arte da obra
 * entra, lido da propria arte, para a obra subir como uma construcao de verdade e nao em quadrados soltos. Pura e sem
 * `phaser`: recebe RGBA e devolve, por pixel, um passo de 0 a `PASSOS - 1` (`TRANSPARENTE` para quem nunca entra).
 *
 * - Camada `madeira` (a estrutura): a FUNDACAO (pedra: saturacao relativa baixa) primeiro, da frente para tras; depois os
 *   PILARES (madeira numa corrida vertical longa e estreita), subindo do chao; por ultimo as VIGAS e TESOURAS (o resto da
 *   madeira), de baixo para a cumeeira.
 * - Camada `pedra` (o acabamento, a arte completa): do chao para cima; o telhado, que e o mais alto, cobre por ultimo.
 *
 * O contorno escuro (pouca luz, sem cor para dizer de que e) segue a classe da maioria dos vizinhos.
 */
export const PASSOS = 32;
export const TRANSPARENTE = 255;

export type CamadaDaObra = 'madeira' | 'pedra';
export interface ImagemRgba { readonly width: number; readonly height: number; readonly data: ArrayLike<number> }

/** As faixas de cada parte da estrutura, em fracao da camada de madeira. */
const FAIXAS = { fundacao: [0, 0.25], pilar: [0.25, 0.6], viga: [0.6, 1] } as const;
const ALFA_MINIMO = 40;
const LUZ_MINIMA = 50;
const SATURACAO_DA_PEDRA = 0.5;
/** um pilar e madeira que corre na vertical pelo menos isto, e mais que o dobro do que corre na horizontal */
const CORRIDA_MINIMA_DO_PILAR = 18;

// as classes de cada pixel: 0 nada, 1 pedra, 2 madeira, 3 escuro (o contorno)

function classes(img: ImagemRgba): Uint8Array {
  const c = new Uint8Array(img.width * img.height);
  for (let i = 0; i < c.length; i++) {
    const r = img.data[i * 4]!, g = img.data[i * 4 + 1]!, b = img.data[i * 4 + 2]!, a = img.data[i * 4 + 3]!;
    if (a < ALFA_MINIMO) continue;
    const max = Math.max(r, g, b);
    if (max < LUZ_MINIMA) { c[i] = 3; continue; }
    c[i] = (max - Math.min(r, g, b)) / max < SATURACAO_DA_PEDRA ? 1 : 2;
  }
  // o contorno escuro fica com a classe da maioria dos vizinhos (5x5); sem vizinho com cor, madeira
  const saida = Uint8Array.from(c);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const i = y * img.width + x;
    if (c[i] !== 3) continue;
    let pedra = 0, madeira = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= img.width || yy >= img.height) continue;
      const k = c[yy * img.width + xx];
      if (k === 1) pedra++; else if (k === 2) madeira++;
    }
    saida[i] = pedra > madeira ? 1 : 2;
  }
  return saida;
}

/** O comprimento da corrida de pixels de madeira que passa pelo pixel, na direcao (dx, dy). */
function corrida(cl: Uint8Array, w: number, h: number, x: number, y: number, dx: number, dy: number): number {
  let n = 1;
  for (let k = 1; ; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= w || yy >= h || cl[yy * w + xx] !== 2) break; n++; }
  for (let k = 1; ; k++) { const xx = x - dx * k, yy = y - dy * k; if (xx < 0 || yy < 0 || xx >= w || yy >= h || cl[yy * w + xx] !== 2) break; n++; }
  return n;
}

/** O pe da corrida vertical de madeira que passa pelo pixel encosta na pedra (ate `FOLGA_DO_APOIO` px abaixo): o
 *  pilar fica de pe na fundacao. A peca vertical da tesoura, no alto, nao encosta, e entra com as vigas. */
const FOLGA_DO_APOIO = 4;
function apoiadoNaFundacao(cl: Uint8Array, w: number, h: number, x: number, y: number): boolean {
  let pe = y;
  while (pe + 1 < h && cl[(pe + 1) * w + x] === 2) pe++;
  for (let k = 1; k <= FOLGA_DO_APOIO && pe + k < h; k++) if (cl[(pe + k) * w + x] === 1) return true;
  return false;
}

/** A parte da estrutura de cada pixel da camada de madeira: 0 nada, 1 fundacao, 2 pilar, 3 viga. */
export function partesDaEstrutura(img: ImagemRgba, cl: Uint8Array = classes(img)): Uint8Array {
  const { width: w, height: h } = img;
  const partes = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (cl[i] === 0) continue;
    if (cl[i] === 1) { partes[i] = 1; continue; }
    const v = corrida(cl, w, h, x, y, 0, 1);
    const hz = corrida(cl, w, h, x, y, 1, 0);
    partes[i] = v >= CORRIDA_MINIMA_DO_PILAR && v > 2 * hz && apoiadoNaFundacao(cl, w, h, x, y) ? 2 : 3;
  }
  // pilar e so o trecho continuo do pe ate a primeira viga que o cruza: o pedaco acima dela entra com as vigas
  for (let x = 0; x < w; x++) {
    let acimaDeViga = false;
    for (let y = h - 1; y >= 0; y--) {
      const i = y * w + x;
      if (partes[i] === 3) acimaDeViga = true;
      else if (partes[i] !== 2) acimaDeViga = false;
      else if (acimaDeViga) partes[i] = 3;
    }
  }
  return partes;
}

/** 0 no pe do pilar, 1 no topo: a corrida vertical de MADEIRA (vigas que cruzam incluidas) que passa por (x, y). O pedaco
 *  de pilar acima de uma viga mede a subida desde o pe de verdade, e nao nasce solto no ar. */
function subidaNoPilar(cl: Uint8Array, w: number, h: number, x: number, y: number): number {
  let pe = y, topo = y;
  while (pe + 1 < h && cl[(pe + 1) * w + x] === 2) pe++;
  while (topo - 1 >= 0 && cl[(topo - 1) * w + x] === 2) topo--;
  return pe === topo ? 0 : (pe - y) / (pe - topo);
}

function passo(fracao: number): number {
  return Math.min(PASSOS - 1, Math.max(0, Math.floor(fracao * PASSOS)));
}

/** O passo em que cada pixel entra (0 o primeiro), ou `TRANSPARENTE`. */
export function ordemDeConstrucao(img: ImagemRgba, camada: CamadaDaObra): Uint8Array {
  const { width: w, height: h } = img;
  const ordem = new Uint8Array(w * h).fill(TRANSPARENTE);
  let topo = h, chao = -1;
  for (let i = 0; i < w * h; i++) if (img.data[i * 4 + 3]! >= ALFA_MINIMO) { const y = Math.floor(i / w); topo = Math.min(topo, y); chao = Math.max(chao, y); }
  if (chao < 0) return ordem;
  const altura = Math.max(1, chao - topo);
  /** 0 no chao, 1 no alto */
  const subida = (y: number): number => (chao - y) / altura;
  if (camada === 'pedra') {
    for (let i = 0; i < w * h; i++) if (img.data[i * 4 + 3]! >= ALFA_MINIMO) ordem[i] = passo(subida(Math.floor(i / w)));
    return ordem;
  }
  const cl = classes(img);
  const partes = partesDaEstrutura(img, cl);
  // a subida dentro de cada parte vai de 0 a 1 entre o pixel mais baixo e o mais alto dela
  const faixa = new Map<number, [number, number]>();
  for (let i = 0; i < w * h; i++) {
    const p = partes[i]!; if (p === 0) continue;
    const y = Math.floor(i / w); const f = faixa.get(p) ?? [y, y];
    faixa.set(p, [Math.min(f[0], y), Math.max(f[1], y)]);
  }
  for (let i = 0; i < w * h; i++) {
    const p = partes[i]!; if (p === 0) continue;
    const y = Math.floor(i / w); const x = i % w; const [yTopo, yChao] = faixa.get(p)!;
    // o pilar cresce do proprio pe (todos sobem juntos); fundacao e vigas, de baixo para cima no lote todo
    const dentro = p === 2 ? subidaNoPilar(cl, w, h, x, y) : yChao === yTopo ? 0 : (yChao - y) / (yChao - yTopo);
    const [a, b] = p === 1 ? FAIXAS.fundacao : p === 2 ? FAIXAS.pilar : FAIXAS.viga;
    // limite de cada parte nunca invade a seguinte: o ultimo passo de uma vem antes do primeiro da outra
    ordem[i] = Math.min(passo(b) - (b < 1 ? 1 : 0), passo(a + (b - a) * dentro));
  }
  return ordem;
}
