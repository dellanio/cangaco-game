import { describe, expect, it } from 'vitest';
import { quadroDoChaoDaCanaMudou } from '../src/render/chao-da-roca';
import { gravarEvidencia } from './helpers/evidence';

const anterior = { tick: 7, vista: '0,0,1280,720' };
describe('D-TELA-CHAO-DA-CANA-SO-QUANDO-MUDA', () => {
  it.each([
    ['primeiro quadro', null, anterior, true, true],
    ['tick e vista iguais', anterior, { ...anterior }, false, false],
    ['tick novo', anterior, { ...anterior, tick: 8 }, true, true],
    ['so vista nova', anterior, { ...anterior, vista: '640,128,1280,720' }, false, true],
    ['tick e vista novos', anterior, { tick: 8, vista: '640,128,1280,720' }, true, true],
    ['tick volta ao carregar', anterior, { ...anterior, tick: 1 }, true, true],
    ['zoom novo', anterior, { ...anterior, vista: '0,0,640,360' }, false, true],
  ] as const)('%s', (_nome, antes, atual, varrerRecursos, contarVista) => {
    expect(quadroDoChaoDaCanaMudou(antes, atual)).toEqual({ varrerRecursos, contarVista });
    expect(quadroDoChaoDaCanaMudou(antes, atual)).toEqual(quadroDoChaoDaCanaMudou(antes, atual));
  });
  it('na sequencia pausada camera so reconta a vista e o tick retoma a varredura', () => {
    const quadros = [anterior, anterior, { ...anterior, vista: '64,0,1280,720' },
      { ...anterior, vista: '64,0,1280,720' }, { tick: 8, vista: '64,0,1280,720' }];
    const trabalhos = quadros.map((q, i) => quadroDoChaoDaCanaMudou(quadros[i - 1] ?? null, q));
    expect(trabalhos.map((t) => t.varrerRecursos)).toEqual([true, false, false, false, true]);
    expect(trabalhos.map((t) => t.contarVista)).toEqual([true, false, true, false, true]);
    gravarEvidencia('D-TELA-CHAO-DA-CANA-SO-QUANDO-MUDA', { quadros, trabalhos });
  });
});
