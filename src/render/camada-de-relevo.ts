/**
 * D-TELA-LUZ-RELEVO (luz do relevo) — o que toca o Phaser: as duas camadas de luz sobre o chao e o
 * tint dos sprites. A conta e de `relevo.ts`, pura e testada sem tela; aqui so se desenha.
 *
 * Desligado por padrao (`data/relevo.json`, `ligado: false`): sem o pedido, `criarCamadaDeRelevo`
 * devolve `null`, nao cria textura nem objeto, nao escreve no debug, e todo gancho da cena e
 * `luz?.…`. Nao ha caminho de Canvas: a D-TELA-06 exige WebGL antes de o jogo carregar.
 *
 * As duas camadas (decisao 7 do plano, docs/planos/relevo-a.md):
 *   - SOMBRA: MULTIPLY do Phaser, [DST_COLOR, ONE_MINUS_SRC_ALPHA]. Textura opaca, entao e c * s;
 *     s = 255 no plano, neutro exato;
 *   - LUZ: modo proprio [DST_COLOR, ONE], que da c * s + c = c * (1 + s); s = 0 no plano, neutro
 *     exato. SCREEN e ADD somam em vez de multiplicar e lavam a grama (estudo, 3.A).
 * Cada uma e UMA imagem de um texel por vertice (129 x 129), esticada sobre o mundo com filtro
 * linear: o centro do texel (i, j) cai no vertice (i * tilePx, j * tilePx).
 */
import Phaser from 'phaser';
import {
  alturasDoMapa, calcularLuz, fatorEm, parametrosDaLuz, pxPorDegrauDaBusca, relevoLigadoNoDado,
  relevoPedido, texturasDaLuz, tintDoSprite,
  type MapaDeLuz, type ParametrosDaLuz,
} from './relevo';
import type { EstadoDebug } from './debug';

/** Acima do chao, das transicoes, da grade, dos recursos (0,5), da estrada (1) e do canteiro de
 *  campo (2), que recebem a luz pelas camadas; abaixo de todo sprite, cujo depth e o y do pe
 *  (`depthDeY`), sempre dezenas de px. Numero de TELA, como `DEPTH_DA_ESTRADA`. */
const DEPTH_DA_LUZ = 3;

const CHAVE_DA_SOMBRA = 'relevo-sombra';
const CHAVE_DA_LUZ = 'relevo-luz';

export interface LuzDoRelevo {
  /** Objeto fixo (arvore, rocha): tinge uma vez, ao nascer, pelo chao sob o pe. */
  tingir(obj: Phaser.GameObjects.Image, xPe: number, yPe: number, rotulo: string): void;
  /** Predio: todo `Image` do container (corpo, pilhas, trabalho, animais), recursivo, com o fator
   *  do pe do predio. Retangulo, texto e poligono (medidor, placa, bandeira, placeholder) ficam
   *  sem tint por construcao: so `Image` tem tint. */
  tingirContainer(c: Phaser.GameObjects.Container, xPe: number, yPe: number, rotulo: string): void;
  /** Unidade: o tint segue a POSICAO do pe, bilinear como o chao (decisao 6: por tile, o tom
   *  saltava ate 61 niveis de cinza no pe da serra). So chama `setTint` quando o cinza muda, ou
   *  quando a imagem e nova. */
  tingirPelaPosicao(img: Phaser.GameObjects.Image | null, xPe: number, yPe: number, rotulo: string): void;
}

/** O modo [DST_COLOR, ONE], registrado uma vez por renderer. */
const modoDaLuzPorRenderer = new WeakMap<Phaser.Renderer.WebGL.WebGLRenderer, number>();

function modoDaLuz(renderer: Phaser.Renderer.WebGL.WebGLRenderer): number {
  const ja = modoDaLuzPorRenderer.get(renderer);
  if (ja !== undefined) return ja;
  const gl = renderer.gl;
  const modo = renderer.addBlendMode([gl.DST_COLOR, gl.ONE], gl.FUNC_ADD);
  modoDaLuzPorRenderer.set(renderer, modo);
  return modo;
}

/** Uma textura de um byte por vertice, cinza e opaca. */
function criarTextura(cena: Phaser.Scene, chave: string, luz: MapaDeLuz, bytes: Uint8ClampedArray): string {
  if (cena.textures.exists(chave)) cena.textures.remove(chave);
  const textura = cena.textures.createCanvas(chave, luz.largura, luz.altura);
  if (textura === null) throw new Error(`relevo: o Phaser nao criou a textura ${chave}`);
  const pixels = new ImageData(luz.largura, luz.altura);
  for (let i = 0; i < bytes.length; i += 1) {
    const v = bytes[i]!;
    pixels.data[i * 4] = v;
    pixels.data[i * 4 + 1] = v;
    pixels.data[i * 4 + 2] = v;
    pixels.data[i * 4 + 3] = 255; // opaca: o ONE_MINUS_SRC_ALPHA do MULTIPLY vira 0
  }
  textura.context.putImageData(pixels, 0, 0);
  textura.refresh();
  textura.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return chave;
}

function criarImagem(cena: Phaser.Scene, chave: string, luz: MapaDeLuz, tilePx: number): Phaser.GameObjects.Image {
  return cena.add.image(-tilePx / 2, -tilePx / 2, chave)
    .setOrigin(0, 0)
    .setDisplaySize(luz.largura * tilePx, luz.altura * tilePx)
    .setDepth(DEPTH_DA_LUZ);
}

export function criarCamadaDeRelevo(
  cena: Phaser.Scene, config: { readonly tilePx: number }, busca: string, debug: EstadoDebug,
): LuzDoRelevo | null {
  if (!relevoPedido(busca, relevoLigadoNoDado)) return null;

  const { tilePx } = config;
  const p: ParametrosDaLuz = {
    ...parametrosDaLuz,
    pxDeMundoPorDegrau: pxPorDegrauDaBusca(busca, parametrosDaLuz.pxDeMundoPorDegrau),
  };
  const luz = calcularLuz(alturasDoMapa(), p, tilePx);
  const { sombra, luz: realce } = texturasDaLuz(luz);

  // A D-TELA-06 garante o WebGL antes de o jogo existir (src/render/webgl.ts).
  const renderer = cena.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  criarImagem(cena, criarTextura(cena, CHAVE_DA_SOMBRA, luz, sombra), luz, tilePx)
    .setBlendMode(Phaser.BlendModes.MULTIPLY);
  criarImagem(cena, criarTextura(cena, CHAVE_DA_LUZ, luz, realce), luz, tilePx)
    .setBlendMode(modoDaLuz(renderer));

  let minimo = Number.POSITIVE_INFINITY;
  let maximo = Number.NEGATIVE_INFINITY;
  for (const f of luz.fator) {
    if (f < minimo) minimo = f;
    if (f > maximo) maximo = f;
  }
  const fatores: Record<string, number> = {};
  const tintagens: Record<string, number> = {};
  const imagens: Record<string, number> = {};
  const registrar = (rotulo: string, f: number, quantas: number): void => {
    imagens[rotulo] = quantas;
    fatores[rotulo] = f;
    tintagens[rotulo] = (tintagens[rotulo] ?? 0) + 1;
  };
  debug.relevo = {
    ativo: true,
    pxDeMundoPorDegrau: p.pxDeMundoPorDegrau,
    vertices: [luz.largura, luz.altura],
    faixa: [minimo, maximo],
    fatores,
    tintagens,
    imagens,
  };

  const aplicar = (img: Phaser.GameObjects.Image, f: number): void => {
    img.setTint(tintDoSprite(f, p));
  };
  const cinzaDaImagem = new WeakMap<Phaser.GameObjects.Image, number>();

  /** Tinge todo `Image` da lista, recursivo nos containers, e devolve quantos tingiu. */
  const tingirLista = (lista: readonly Phaser.GameObjects.GameObject[], f: number): number => {
    let quantas = 0;
    for (const filho of lista) {
      if (filho instanceof Phaser.GameObjects.Image) {
        aplicar(filho, f);
        quantas += 1;
      } else if (filho instanceof Phaser.GameObjects.Container) {
        quantas += tingirLista(filho.list, f);
      }
    }
    return quantas;
  };

  return {
    tingir(obj, xPe, yPe, rotulo) {
      const f = fatorEm(luz, xPe, yPe, tilePx);
      aplicar(obj, f);
      registrar(rotulo, f, 1);
    },
    tingirContainer(c, xPe, yPe, rotulo) {
      const f = fatorEm(luz, xPe, yPe, tilePx);
      registrar(rotulo, f, tingirLista(c.list, f));
    },
    tingirPelaPosicao(img, xPe, yPe, rotulo) {
      if (img === null) return;
      const f = fatorEm(luz, xPe, yPe, tilePx);
      const cinza = tintDoSprite(f, p);
      if (cinzaDaImagem.get(img) === cinza) return;
      cinzaDaImagem.set(img, cinza);
      img.setTint(cinza);
      registrar(rotulo, f, 1);
    },
  };
}
