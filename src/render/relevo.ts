/**
 * D-TELA-07 — a conta da luz do relevo, pura: nenhum Phaser aqui, para rodar no Vitest sem tela.
 * Quem desenha e `camada-de-relevo.ts`.
 *
 * O relevo e SO DE RENDER (opcao A, docs/planos/relevo-a.md): a altura sai do gerador de mapa
 * (D-TERRENO-01) para `data/maps/<id>.relevo.json`, e este e o UNICO arquivo que a importa. A sim
 * nao sabe que ela existe — o teste da D-TELA-07 guarda isso pelo import resolvido.
 *
 * A luz (decisoes do operador, 2026-09-30):
 *   - vem de cima, inclinada para o sul, SEM leste-oeste: L = (0, sen t, cos t), com y para o sul;
 *   - o chao plano e 1,0 EXATO. Abaixo de 1, a camada de sombra (MULTIPLY); acima, a de luz
 *     ([DST_COLOR, ONE], que da c * (1 + s)). No plano, as duas sao neutras exatas: 255 e 0;
 *   - o sprite escurece na sombra e nao recebe o realce (`tetoDoTintDoSprite`, hoje 1).
 */
import dadosDoRelevo from '../../data/relevo.json';
import alturaDoSertao from '../../data/maps/sertao-128.relevo.json';

export interface ParametrosDaLuz {
  readonly fatorMinimo: number;
  readonly tetoDoTintDoSprite: number;
  /** So existe se a saturacao da areia pedir (decisao 10 do plano). Ausente: o chao nao tem teto. */
  readonly tetoDaLuzDoChao?: number;
  readonly pxDeMundoPorDegrau: number;
  readonly inclinacaoParaOSulGraus: number;
}

/** A altura por VERTICE, row-major. O tile (gx,gy) tem os cantos (gx,gy) a (gx+1,gy+1). */
export interface AlturasDoRelevo {
  readonly largura: number;
  readonly altura: number;
  readonly h: Uint8Array;
}

/** O fator de luz por vertice: 1 no plano, < 1 na sombra, > 1 na luz. */
export interface MapaDeLuz {
  readonly largura: number;
  readonly altura: number;
  readonly fator: Float32Array;
}

const opcionais = dadosDoRelevo as { readonly tetoDaLuzDoChao?: number };

export const parametrosDaLuz: ParametrosDaLuz = {
  fatorMinimo: dadosDoRelevo.fatorMinimo,
  tetoDoTintDoSprite: dadosDoRelevo.tetoDoTintDoSprite,
  ...(opcionais.tetoDaLuzDoChao === undefined ? {} : { tetoDaLuzDoChao: opcionais.tetoDaLuzDoChao }),
  pxDeMundoPorDegrau: dadosDoRelevo.pxDeMundoPorDegrau,
  inclinacaoParaOSulGraus: dadosDoRelevo.luz.inclinacaoParaOSulGraus,
};

/** A flag do dado. Quem pergunta se o relevo foi pedido e `relevoPedido`. */
export const relevoLigadoNoDado: boolean = dadosDoRelevo.ligado;

/** O formato do arquivo emitido: um char base-36 por vertice (tools/gerar-mapa.js). */
const DIGITOS = '0123456789abcdefghijklmnopqrstuvwxyz';

export function lerAlturas(arquivo: {
  readonly largura: number; readonly altura: number; readonly linhas: readonly string[];
}): AlturasDoRelevo {
  const { largura, altura, linhas } = arquivo;
  if (linhas.length !== altura) throw new Error(`relevo: ${linhas.length} linhas, esperava ${altura}`);
  const h = new Uint8Array(largura * altura);
  linhas.forEach((linha, y) => {
    if (linha.length !== largura) throw new Error(`relevo: linha ${y} com ${linha.length} vertices, esperava ${largura}`);
    for (let x = 0; x < largura; x += 1) {
      const degrau = DIGITOS.indexOf(linha[x]!);
      if (degrau < 0) throw new Error(`relevo: char '${linha[x]}' fora do formato em (${x},${y})`);
      h[y * largura + x] = degrau;
    }
  });
  return { largura, altura, h };
}

/** A altura do mapa do jogo, lida do arquivo emitido. */
export function alturasDoMapa(): AlturasDoRelevo {
  return lerAlturas(alturaDoSertao);
}

/**
 * Lambert com a luz do sul, normalizado pelo plano: f = (n . L) / cos t. O gradiente e a diferenca
 * central (presa na borda), em px de mundo por px de mundo. No plano, n . L = cos t e f = 1 exato.
 */
export function calcularLuz(alt: AlturasDoRelevo, p: ParametrosDaLuz, tilePx: number): MapaDeLuz {
  const { largura, altura, h } = alt;
  const theta = (p.inclinacaoParaOSulGraus * Math.PI) / 180;
  const ly = Math.sin(theta);
  const lz = Math.cos(theta); // lx = 0: sem leste-oeste
  const escala = p.pxDeMundoPorDegrau / tilePx;
  const em = (x: number, y: number): number =>
    h[Math.min(altura - 1, Math.max(0, y)) * largura + Math.min(largura - 1, Math.max(0, x))]!;
  const fator = new Float32Array(largura * altura);
  for (let y = 0; y < altura; y += 1) {
    for (let x = 0; x < largura; x += 1) {
      const gx = ((em(x + 1, y) - em(x - 1, y)) / 2) * escala;
      const gy = ((em(x, y + 1) - em(x, y - 1)) / 2) * escala;
      const nDotL = (-gy * ly + lz) / Math.hypot(gx, gy, 1);
      const f = Math.max(p.fatorMinimo, nDotL / lz);
      fator[y * largura + x] = p.tetoDaLuzDoChao === undefined ? f : Math.min(p.tetoDaLuzDoChao, f);
    }
  }
  return { largura, altura, fator };
}

/** O fator sob um ponto do mundo: bilinear entre os 4 vertices do tile, preso na borda do mapa. */
export function fatorEm(luz: MapaDeLuz, xMundo: number, yMundo: number, tilePx: number): number {
  const { largura, altura, fator } = luz;
  const vx = Math.min(largura - 1, Math.max(0, xMundo / tilePx));
  const vy = Math.min(altura - 1, Math.max(0, yMundo / tilePx));
  const x0 = Math.floor(vx);
  const y0 = Math.floor(vy);
  const x1 = Math.min(largura - 1, x0 + 1);
  const y1 = Math.min(altura - 1, y0 + 1);
  const tx = vx - x0;
  const ty = vy - y0;
  const f = (x: number, y: number): number => fator[y * largura + x]!;
  const cima = f(x0, y0) + (f(x1, y0) - f(x0, y0)) * tx;
  const baixo = f(x0, y1) + (f(x1, y1) - f(x0, y1)) * tx;
  return cima + (baixo - cima) * ty;
}

/** As duas texturas, um byte por vertice. Sombra: min(f,1) em 0-255 (MULTIPLY, 255 neutro). Luz:
 *  max(f-1,0) em 0-255 ([DST_COLOR, ONE] da c*(1+s), 0 neutro). */
export function texturasDaLuz(luz: MapaDeLuz): { sombra: Uint8ClampedArray; luz: Uint8ClampedArray } {
  const n = luz.fator.length;
  const sombra = new Uint8ClampedArray(n);
  const realce = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i += 1) {
    const f = luz.fator[i]!;
    sombra[i] = Math.round(Math.min(f, 1) * 255);
    realce[i] = Math.round(Math.max(f - 1, 0) * 255);
  }
  return { sombra, luz: realce };
}

/** O cinza 0xRRGGBB do fator, preso em [0, 1]: e o que o `setTint` aceita. */
export function tintDoFator(f: number): number {
  const g = Math.round(Math.min(1, Math.max(0, f)) * 255);
  return (g << 16) | (g << 8) | g;
}

/** O tint do sprite: escurece na sombra, e nao passa de `tetoDoTintDoSprite` (S1). */
export function tintDoSprite(f: number, p: ParametrosDaLuz): number {
  return tintDoFator(Math.min(f, p.tetoDoTintDoSprite));
}

/** O relevo foi pedido: a flag do dado, ou `?relevo` na URL (o roteiro). */
export function relevoPedido(busca: string, ligadoNoDado: boolean): boolean {
  return ligadoNoDado || new URLSearchParams(busca).has('relevo');
}

/** `?relevoPx=<n>` troca o px por degrau SO para o roteiro comparar as duas geometrias (decisao 9
 *  do plano) sem editar o dado. Ausente, nao numerico ou <= 0: vale o dado. */
export function pxPorDegrauDaBusca(busca: string, doDado: number): number {
  const cru = new URLSearchParams(busca).get('relevoPx');
  const valor = cru === null ? Number.NaN : Number(cru);
  return Number.isFinite(valor) && valor > 0 ? valor : doDado;
}

/** A chave do tile sob o pe: e ela que diz quando a unidade cruzou de tile. */
export function tileDoPe(x: number, y: number, tilePx: number): string {
  return `${Math.floor(x / tilePx)},${Math.floor(y / tilePx)}`;
}
