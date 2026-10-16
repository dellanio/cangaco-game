/**
 * I-TELA-PREMIUM-PROTOTIPO (P2, plano docs/planos/2026-10-16-migracao-visual-premium.md, Fase 0) — a luz do visual
 * premium, so com `?premium` na URL: uma sombra de contato sob cada objeto de pe no chao (predio, arvore,
 * animal, unidade) e a gradacao de cor quente com vinheta na camera. Sem `?premium`, nada daqui roda.
 *
 * A sombra e de contato (o objeto "assentado"), e nao projetada: a luz do projeto e de cima, levemente do sul
 * (decisao de 2026-10-01), e uma sombra longa lateral contrariaria a arte. Ela acompanha o objeto a cada quadro, e o
 * render so le: nenhum estado de jogo mora aqui (CLAUDE.md §10).
 */
import Phaser from 'phaser';

import { elipseDaSombra, fatorDaSombra } from './visual-premium-regra';

const OPACIDADE = 0.5;
/** Margem fora da vista, em px, para a sombra nao nascer em cima de quem entra na tela. */
const MARGEM_DA_VISTA = 128;
/** Acima do chao, da estrada (1) e do canteiro; abaixo de todo objeto (predio e unidade ordenam pelo y em px). */
const PROFUNDIDADE = 1.5;
/** So objeto ancorado no pe projeta sombra no chao. */
const ORIGEM_MINIMA = 0.8;
const CHAVE_DA_SOMBRA = 'premium:sombra-de-contato';
const LADO_DA_TEXTURA = 128;

function criarTextura(cena: Phaser.Scene): void {
  if (cena.textures.exists(CHAVE_DA_SOMBRA)) return;
  const tela = cena.textures.createCanvas(CHAVE_DA_SOMBRA, LADO_DA_TEXTURA, LADO_DA_TEXTURA);
  if (tela === null) return;
  const ctx = tela.getContext();
  const meio = LADO_DA_TEXTURA / 2;
  const gradiente = ctx.createRadialGradient(meio, meio, 0, meio, meio, meio);
  gradiente.addColorStop(0, 'rgba(20, 10, 4, 1)');
  gradiente.addColorStop(0.45, 'rgba(20, 10, 4, 0.85)');
  gradiente.addColorStop(0.75, 'rgba(20, 10, 4, 0.4)');
  gradiente.addColorStop(1, 'rgba(20, 10, 4, 0)');
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, LADO_DA_TEXTURA, LADO_DA_TEXTURA);
  tela.refresh();
}

type ObjetoComTextura = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

function ehObjetoComTextura(o: Phaser.GameObjects.GameObject): o is ObjetoComTextura {
  return o instanceof Phaser.GameObjects.Image || o instanceof Phaser.GameObjects.Sprite;
}

export interface SombrasDeContato {
  /** Quantas sombras estao desenhadas agora (a ponte do roteiro le). */
  quantas(): number;
}

/** Liga as sombras de contato na cena: a cada quadro, uma sombra por objeto elegivel visivel, e nenhuma a mais. */
export function ligarSombrasDeContato(cena: Phaser.Scene): SombrasDeContato {
  criarTextura(cena);
  const sombras = new Map<ObjetoComTextura, Phaser.GameObjects.Image>();
  const vistos = new Set<ObjetoComTextura>();
  const matriz = new Phaser.GameObjects.Components.TransformMatrix();

  const visitar = (o: Phaser.GameObjects.GameObject, visivelAcima: boolean): void => {
    if (o instanceof Phaser.GameObjects.Container) {
      const visivel = visivelAcima && o.visible && o.alpha > 0;
      for (const filho of o.list) visitar(filho, visivel);
      return;
    }
    if (!ehObjetoComTextura(o) || !visivelAcima || !o.visible || o.alpha <= 0 || o.originY < ORIGEM_MINIMA) return;
    // o bloco recortado e a obra subindo (F17g, I-TELA-OBRA-PARTE-A-PARTE): cada bloco e a imagem inteira recortada, e
    // uma sombra por bloco empilhava o chao ate o preto. Obra nao tem sombra; o predio pronto tem uma
    if (o.isCropped) return;
    const fator = fatorDaSombra(o.texture.key);
    if (fator === null) return;
    o.getWorldTransformMatrix(matriz);
    const vista = cena.cameras.main.worldView;
    if (matriz.tx < vista.x - MARGEM_DA_VISTA || matriz.tx > vista.right + MARGEM_DA_VISTA
      || matriz.ty < vista.y - MARGEM_DA_VISTA || matriz.ty > vista.bottom + MARGEM_DA_VISTA * 4) return;
    // a matriz do mundo ja traz a escala do objeto e a do container: o pe e a base do quadro, abaixo da origem
    const pe = { x: matriz.tx, y: matriz.ty + o.height * (1 - o.originY) * Math.abs(matriz.scaleY) };
    const e = elipseDaSombra(pe, o.width * Math.abs(matriz.scaleX), fator);
    let sombra = sombras.get(o);
    if (sombra === undefined) {
      sombra = cena.add.image(0, 0, CHAVE_DA_SOMBRA).setDepth(PROFUNDIDADE).setAlpha(OPACIDADE);
      sombras.set(o, sombra);
    }
    sombra.setPosition(e.x, e.y).setDisplaySize(e.w, e.h).setVisible(true);
    vistos.add(o);
  };

  const aoQuadro = (): void => {
    vistos.clear();
    for (const o of cena.children.list) {
      visitar(o, true);
    }
    for (const [o, sombra] of sombras) {
      if (vistos.has(o)) continue;
      if (!o.active) {
        sombra.destroy();
        sombras.delete(o);
      } else {
        sombra.setVisible(false);
      }
    }
  };
  cena.events.on(Phaser.Scenes.Events.POST_UPDATE, aoQuadro);
  cena.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    cena.events.off(Phaser.Scenes.Events.POST_UPDATE, aoQuadro);
    for (const s of sombras.values()) s.destroy();
    sombras.clear();
  });
  return { quantas: () => vistos.size };
}

/** A gradacao do fim de tarde: o vermelho sobe, o azul desce, um pouco de contraste; e a vinheta nas bordas. */
export function ligarGradacaoDeCor(camera: Phaser.Cameras.Scene2D.Camera): boolean {
  const fx = (camera as Phaser.Cameras.Scene2D.Camera & { postFX?: Phaser.GameObjects.Components.FX }).postFX;
  if (fx === undefined || fx === null) return false;
  const cor = fx.addColorMatrix();
  cor.set([
    1.08, 0.04, 0, 0, 0.012,
    0.02, 1.0, 0, 0, 0.004,
    0, 0, 0.86, 0, -0.01,
    0, 0, 0, 1, 0,
  ]);
  cor.contrast(0.08, true);
  fx.addVignette(0.5, 0.5, 0.92, 0.32);
  return true;
}
