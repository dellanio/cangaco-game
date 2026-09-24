/**
 * F18f — unidade empilhada nao some.
 *
 * Civis ocupam o mesmo tile (regra da F03, intacta): o que muda e o DESENHO. Aqui se prova a
 * aritmetica do deslocamento — pura, sem Phaser e sem tela. O que so a tela responde (as N
 * unidades aparecem separadas no quadro) fica no roteiro `tools/shots/F18f.js`.
 *
 * Nada neste arquivo toca `src/sim/`: o deslocamento nunca chega ao `GameState`.
 */
import { describe, it, expect } from 'vitest';
import {
  deslocamentoDaUnidade, gridToScreenCentro, screenToGrid, ESCALA_DO_MUNDO,
  LADO_DA_UNIDADE_EM_TILES, POSICOES_DO_ANEL, RAIO_DO_ANEL_EM_TILES,
} from '../src/render/grid';
import { gravarEvidencia } from './helpers/evidence';

const TILE_PX = 64;
const RAIO = RAIO_DO_ANEL_EM_TILES * TILE_PX * ESCALA_DO_MUNDO;
const idsDoAnel = Array.from({ length: POSICOES_DO_ANEL }, (_, i) => `u${i}`);

const desvio = (id: string, escala = ESCALA_DO_MUNDO) => deslocamentoDaUnidade(id, TILE_PX, escala);
const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Onde a unidade e desenhada: o centro do tile mais o desvio do id. */
function pixelDe(id: string, gx: number, gy: number): { x: number; y: number } {
  const centro = gridToScreenCentro({ gx, gy }, TILE_PX, ESCALA_DO_MUNDO);
  const d = desvio(id);
  return { x: centro.x + d.x, y: centro.y + d.y };
}

describe('F18f — o deslocamento separa quem esta no mesmo tile', () => {
  it('N unidades de slots distintos no MESMO tile tem N centros distintos', () => {
    const centros = new Set(idsDoAnel.map((id) => {
      const p = pixelDe(id, 38, 33);
      return `${p.x.toFixed(9)},${p.y.toFixed(9)}`;
    }));
    expect(centros.size).toBe(POSICOES_DO_ANEL);
  });

  it('a menor distancia entre dois centros do anel e o raio — nao menos', () => {
    const pixels = idsDoAnel.map((id) => pixelDe(id, 38, 33));
    let menor = Infinity;
    for (const [i, a] of pixels.entries()) {
      for (const b of pixels.slice(i + 1)) menor = Math.min(menor, distancia(a, b));
    }
    // Vizinhos do anel de 6 ficam a 2 * r * sen(30 graus) = r. E o numero que o aceite do
    // roteiro afirma; se alguem aumentar `POSICOES_DO_ANEL` sem mexer no aceite, cai aqui.
    expect(menor).toBeCloseTo(RAIO, 9);
  });

  it('o desenho nao VAZA do tile: o desvio mais meia unidade cabe em meio tile', () => {
    for (const id of idsDoAnel) {
      const d = desvio(id);
      expect(Math.hypot(d.x, d.y)).toBeCloseTo(RAIO, 9);
      const meiaUnidade = (LADO_DA_UNIDADE_EM_TILES * TILE_PX) / 2;
      expect(Math.abs(d.x) + meiaUnidade).toBeLessThanOrEqual(TILE_PX / 2 + 1e-9);
      expect(Math.abs(d.y) + meiaUnidade).toBeLessThanOrEqual(TILE_PX / 2 + 1e-9);
    }
  });
});

describe('F18f — o desvio vem do id, e so do id', () => {
  it('mesma entrada, mesma saida: a foto do roteiro tem de repetir', () => {
    for (const id of ['u0', 'u7', 'serf-12', 'sem-digito']) {
      expect(desvio(id)).toEqual(desvio(id));
    }
  });

  it('nao depende de quem mais esta no tile: a unidade nao salta quando outra chega', () => {
    // O desvio de `u4` e o mesmo com o tile vazio ou cheio porque a funcao nem recebe os
    // vizinhos. E o que a alternativa (agrupar por tile e espalhar pelo indice) perderia.
    expect(desvio('u4')).toEqual(deslocamentoDaUnidade('u4', TILE_PX, ESCALA_DO_MUNDO));
  });

  it('id sem digito cai no slot 0, e nao quebra', () => {
    expect(desvio('capataz')).toEqual(desvio('u0'));
    expect(desvio('u12')).toEqual(desvio('u0'));
  });

  it('o limite conhecido: ids congruentes modulo o anel se escondem', () => {
    // Registrado no BUILD_PLAN como limite, nao resolvido. Esta assercao existe para que ele
    // seja uma escolha visivel — se um dia deixar de valer, foi porque alguem mexeu no anel.
    expect(desvio('u1')).toEqual(desvio(`u${1 + POSICOES_DO_ANEL}`));
  });

  it('a escala multiplica o desvio, como multiplica o centro do tile', () => {
    const emDobro = desvio('u5', 2);
    const normal = desvio('u5', 1);
    expect(emDobro.x).toBeCloseTo(normal.x * 2, 9);
    expect(emDobro.y).toBeCloseTo(normal.y * 2, 9);
  });
});

describe('F18f — o deslocamento e de DESENHO', () => {
  it('nao mexe no tile: `screenToGrid` do ponto desenhado volta ao mesmo tile', () => {
    for (const id of idsDoAnel) {
      expect(screenToGrid(pixelDe(id, 38, 33), TILE_PX, ESCALA_DO_MUNDO)).toEqual({ gx: 38, gy: 33 });
    }
    gravarEvidencia('F18f', {
      posicoesDoAnel: POSICOES_DO_ANEL,
      raioEmPx: RAIO,
      // a pilha medida no cenario do roteiro, tick 157, tile (38,33)
      pilhaMedida: ['u4', 'u7', 'u8'].map((id) => ({ id, desvio: desvio(id), pixel: pixelDe(id, 38, 33) })),
    });
  });
});
