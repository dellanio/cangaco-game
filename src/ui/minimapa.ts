// D-TELA-02 — o minimapa: o terreno, os predios na cor do bando, a vista da camera, e o
// clique (ou o arrasto) que leva a camera. Um <canvas> no lugar do placeholder da moldura
// (UI-barra-a); o carimbo de pausa e o contador da paz continuam por cima.
//
// Le o estado e desenha; nao emite comando, porque camera nao e jogo. Nao importa
// `sim/data` nem `render/mapa.ts`: o terreno, o footprint e a camera chegam do `main.ts`,
// a raiz de composicao, como a lista de mercadorias do painel (C-TELA-05).
//
// Redesenha por QUADRO, e nao por tick: a vista anda com a camera mesmo com o jogo pausado.
import type { GameState } from '../sim/state';
import { LADO_DO_JOGADOR } from '../sim/state';
import { prediosInimigosForaDaVista, texturaDaNevoa } from '../render/nevoa';
import type { CoresDaNevoa } from '../render/nevoa';
import { corDoBando } from '../render/cor-do-bando';
import { enquadrar, pixelsDoTerreno, retanguloNoMinimapa, tileDoMinimapa, vistaEmTiles } from '../render/minimapa';
import type { Enquadro, RetanguloEmTiles } from '../render/minimapa';

export interface FonteDoMinimapa {
  readonly terreno: {
    readonly codigos: Uint8Array; readonly cores: readonly string[];
    readonly largura: number; readonly altura: number;
  };
  readonly tilePx: number;
  /** O footprint do predio em tiles, ou `null` para tipo sem tamanho. */
  caixaDoPredio(tipo: string, gx: number, gy: number): RetanguloEmTiles | null;
  /** O `worldView` da camera, ou `null` antes de a cena existir. */
  vista(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
  centrarEm(tile: { readonly gx: number; readonly gy: number }): void;
  /** F-TELA-NEVOA — a cor e os alfas da nevoa (`configDoMapa.nevoa`). */
  readonly nevoa: CoresDaNevoa;
}

export interface Minimapa {
  atualizar(estado: GameState): void;
}

/** O menor lado, em px de minimapa, de um predio: 4x3 tiles num mapa de 128 dariam 2 px. */
const LADO_MINIMO_DO_PREDIO_PX = 3;
const COR_DA_VISTA = '#f4e4bc';

export function montarMinimapa(fonte: FonteDoMinimapa): Minimapa {
  const moldura = document.getElementById('minimapa');
  if (!moldura) throw new Error('minimapa: #minimapa nao existe no index.html');
  const canvas = document.createElement('canvas');
  canvas.className = 'mapa';
  canvas.dataset.campo = 'minimapa';
  const lugar = moldura.querySelector('.placeholder');
  if (lugar !== null) lugar.replaceWith(canvas);
  else moldura.prepend(canvas);
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('minimapa: sem contexto 2d');
  const pincel: CanvasRenderingContext2D = ctx;

  // O terreno e fixo na partida: vai UMA vez para um canvas fora da tela, um px por tile.
  const { largura, altura } = fonte.terreno;
  const terreno = document.createElement('canvas');
  terreno.width = largura;
  terreno.height = altura;
  terreno.getContext('2d')?.putImageData(new ImageData(pixelsDoTerreno(fonte.terreno), largura, altura), 0, 0);

  let ultimo: GameState | null = null;
  const nevoa = document.createElement('canvas');
  nevoa.width = largura;
  nevoa.height = altura;
  const pixelsDaNevoa = new Uint8ClampedArray(largura * altura * 4);
  let estadoDaNevoa: GameState | null = null;
  let enquadro: Enquadro = enquadrar(largura, altura, { largura: 1, altura: 1 });

  function desenhar(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    enquadro = enquadrar(largura, altura, { largura: w, altura: h });
    const e = enquadro;
    pincel.clearRect(0, 0, w, h);
    pincel.imageSmoothingEnabled = false;
    pincel.drawImage(terreno, e.x0, e.y0, largura * e.pxPorTile, altura * e.pxPorTile);

    // F-TELA-NEVOA: o escuro da nevoa por cima do terreno (um px por tile, repintado so quando o
    // estado muda), e o predio inimigo fora da vista nao entra
    if (ultimo !== null && ultimo !== estadoDaNevoa) {
      estadoDaNevoa = ultimo;
      texturaDaNevoa(ultimo, fonte.nevoa, { largura, altura }, pixelsDaNevoa);
      nevoa.getContext('2d')?.putImageData(new ImageData(pixelsDaNevoa, largura, altura), 0, 0);
    }
    pincel.drawImage(nevoa, e.x0, e.y0, largura * e.pxPorTile, altura * e.pxPorTile);
    let predios = 0;
    let inimigos = 0;
    if (ultimo !== null) {
      const foraDaVista = prediosInimigosForaDaVista(ultimo);
      for (const id of ultimo.predios.ordem) {
        const p = ultimo.predios.porId[id];
        const caixa = p === undefined ? null : fonte.caixaDoPredio(p.tipo, p.gx, p.gy);
        if (p === undefined || caixa === null || foraDaVista.has(id)) continue;
        if (p.lado !== LADO_DO_JOGADOR) inimigos += 1;
        const r = retanguloNoMinimapa(caixa, e);
        const lw = Math.max(LADO_MINIMO_DO_PREDIO_PX, r.largura);
        const lh = Math.max(LADO_MINIMO_DO_PREDIO_PX, r.altura);
        pincel.fillStyle = corDoBando(p.lado);
        pincel.fillRect(Math.round(r.x + (r.largura - lw) / 2), Math.round(r.y + (r.altura - lh) / 2), Math.round(lw), Math.round(lh));
        predios += 1;
      }
    }

    const worldView = fonte.vista();
    if (worldView !== null) {
      const v = retanguloNoMinimapa(vistaEmTiles(worldView, fonte.tilePx), e);
      pincel.strokeStyle = COR_DA_VISTA;
      pincel.lineWidth = 1;
      pincel.strokeRect(Math.round(v.x) + 0.5, Math.round(v.y) + 0.5, Math.round(v.largura), Math.round(v.altura));
      canvas.dataset.vista = [v.x, v.y, v.largura, v.altura].map((n) => n.toFixed(1)).join(',');
    }
    // para o roteiro afirmar numero, e nao pixel da captura
    canvas.dataset.predios = String(predios);
    // F-TELA-NEVOA: quantos predios de outro lado o minimapa desenhou (so os que estao a vista)
    canvas.dataset.prediosInimigos = String(inimigos);
    canvas.dataset.pxPorTile = String(e.pxPorTile);
    canvas.dataset.x0 = String(e.x0);
    canvas.dataset.y0 = String(e.y0);
  }

  const quadro = (): void => {
    desenhar();
    window.requestAnimationFrame(quadro);
  };
  window.requestAnimationFrame(quadro);

  // clique ou arrasto: a camera vai para o tile sob o ponteiro
  let arrastando = false;
  const levar = (evento: PointerEvent): void => {
    fonte.centrarEm(tileDoMinimapa(evento.offsetX, evento.offsetY, enquadro, largura, altura));
  };
  canvas.addEventListener('pointerdown', (evento) => {
    if (evento.button !== 0) return;
    arrastando = true;
    canvas.setPointerCapture(evento.pointerId);
    levar(evento);
  });
  canvas.addEventListener('pointermove', (evento) => {
    if (arrastando) levar(evento);
  });
  const soltar = (): void => {
    arrastando = false;
  };
  canvas.addEventListener('pointerup', soltar);
  canvas.addEventListener('pointercancel', soltar);

  return {
    atualizar(estado) {
      ultimo = estado;
    },
  };
}
