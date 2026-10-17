/**
 * I-TELA-TERRENO-NATURAL (pedido do operador, 2026-10-17) — o chao menos quadrado: a borda da areia arredondada e
 * irregular, e manchas grandes de tom de sertao. Pura e sem `phaser`: devolve grades de alfa e de cor, que a cena poe
 * em texturas e estica por cima do chao. O mapa e a sim nao mudam.
 */
export interface ConfigDoTerrenoNatural {
  /** os mapas (o `idDoMapa`) com o chao natural */
  readonly mapas: readonly string[];
  /** amostras por tile na grade da borda */
  readonly amostrasPorTile: number;
  /** o raio do desfoque da ocupacao da areia, em tiles */
  readonly desfoqueTiles: number;
  /** o tamanho do ruido da borda, em tiles, e a forca dele somada ao campo */
  readonly ruido: { readonly escalaTiles: number; readonly forca: number };
  /** o limiar do campo e a meia largura da transicao suave (0..1) */
  readonly limiar: number;
  readonly suavidade: number;
  readonly tons: {
    readonly escalaTiles: number;
    readonly alfaMaximo: number;
    readonly cores: readonly string[];
  };
}

/** Um numero estavel em [0, 1) por ponto inteiro e semente. */
function hash01(x: number, y: number, semente: number): number {
  let h = (Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(semente, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Ruido de valor suave (interpolacao cubica entre os pontos da grade), em [0, 1). */
export function ruidoDeValor(x: number, y: number, semente: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash01(x0, y0, semente), b = hash01(x0 + 1, y0, semente);
  const c = hash01(x0, y0 + 1, semente), d = hash01(x0 + 1, y0 + 1, semente);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}

function suave(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Desfoque de caixa separavel, raio `r` amostras, em grade `w` x `h` (a borda repete o ultimo valor). */
function desfocar(v: Float32Array<ArrayBuffer>, w: number, h: number, r: number): Float32Array<ArrayBuffer> {
  if (r <= 0) return v;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let soma = 0;
    for (let k = -r; k <= r; k++) soma += v[y * w + Math.min(w - 1, Math.max(0, k))]!;
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = soma / n;
      soma += v[y * w + Math.min(w - 1, x + r + 1)]! - v[y * w + Math.max(0, x - r)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let soma = 0;
    for (let k = -r; k <= r; k++) soma += tmp[Math.min(h - 1, Math.max(0, k)) * w + x]!;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = soma / n;
      soma += tmp[Math.min(h - 1, y + r + 1) * w + x]! - tmp[Math.max(0, y - r) * w + x]!;
    }
  }
  return out;
}

export interface CampoDaAreia {
  readonly largura: number;
  readonly altura: number;
  /** 0..1 por amostra: 1 e areia */
  readonly areia: Float32Array;
}

/**
 * O campo da areia, numa grade de `amostrasPorTile` por tile: a ocupacao dos tiles de areia, desfocada (dois passes de
 * caixa, quase gaussiano), mais o ruido de valor centrado em zero, passado pela transicao suave em volta do limiar.
 */
export function campoDaAreia(
  ehAreia: (gx: number, gy: number) => boolean, larguraTiles: number, alturaTiles: number,
  semente: number, config: ConfigDoTerrenoNatural,
): CampoDaAreia {
  const a = config.amostrasPorTile;
  const w = larguraTiles * a, h = alturaTiles * a;
  let v = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) v[y * w + x] = ehAreia(Math.floor(x / a), Math.floor(y / a)) ? 1 : 0;
  const r = Math.max(1, Math.round((config.desfoqueTiles * a) / 2));
  v = desfocar(desfocar(v, w, h, r), w, h, r);
  const areia = new Float32Array(w * h);
  const escala = config.ruido.escalaTiles * a;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ruido = (ruidoDeValor(x / escala, y / escala, semente) - 0.5) * 2 * config.ruido.forca
      + (ruidoDeValor(x / (escala / 3), y / (escala / 3), semente + 7) - 0.5) * config.ruido.forca * 0.6;
    areia[y * w + x] = suave(config.limiar - config.suavidade, config.limiar + config.suavidade, v[y * w + x]! + ruido);
  }
  return { largura: w, altura: h, areia };
}

/**
 * As duas mascaras por cima do chao de hoje (0..255 por amostra): a da AREIA, so nos tiles de grama (onde o campo diz
 * areia, ela avanca), e a da GRAMA, so nos tiles de areia (onde o campo diz grama, ela cobre o canto). Fora desses
 * tiles, 0: o chao de hoje fica como esta.
 */
export function mascarasDaBorda(
  campo: CampoDaAreia, tipoDoTile: (gx: number, gy: number) => 'areia' | 'grama' | 'outro', amostrasPorTile: number,
): { readonly areia: Uint8Array; readonly grama: Uint8Array } {
  const { largura: w, altura: h } = campo;
  const areia = new Uint8Array(w * h), grama = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const tipo = tipoDoTile(Math.floor(x / amostrasPorTile), Math.floor(y / amostrasPorTile));
    const i = y * w + x;
    if (tipo === 'grama') areia[i] = Math.round(campo.areia[i]! * 255);
    else if (tipo === 'areia') grama[i] = Math.round((1 - campo.areia[i]!) * 255);
  }
  return { areia, grama };
}

/** As manchas de tom: uma cor RGBA por tile (alfa ate `alfaMaximo`), de ruido de valor grande; a cena estica a grade. */
export function manchasDeTom(larguraTiles: number, alturaTiles: number, semente: number, config: ConfigDoTerrenoNatural): Uint8Array {
  const cores = config.tons.cores.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const);
  const out = new Uint8Array(larguraTiles * alturaTiles * 4);
  const e = config.tons.escalaTiles;
  for (let y = 0; y < alturaTiles; y++) for (let x = 0; x < larguraTiles; x++) {
    // qual cor: o ruido grande escolhe; a forca: outro ruido, para a mancha ter miolo e sumir nas bordas
    const escolha = ruidoDeValor(x / e, y / e, semente + 101);
    const forca = suave(0.45, 0.85, ruidoDeValor(x / (e * 0.7), y / (e * 0.7), semente + 202));
    const cor = cores[Math.min(cores.length - 1, Math.floor(escolha * cores.length))]!;
    const i = (y * larguraTiles + x) * 4;
    out[i] = cor[0]; out[i + 1] = cor[1]; out[i + 2] = cor[2];
    out[i + 3] = Math.round(forca * config.tons.alfaMaximo * 255);
  }
  return out;
}
