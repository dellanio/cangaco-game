import { describe, expect, it } from 'vitest';
import { terrenoRecebeDetalhe } from '../src/render/detalhes-do-terreno';
import { texturaDaCamada, ESTADO_DO_TERRENO, type Manifesto } from '../src/render/manifesto';

describe('D-TELA-VEU-DOS-DETALHES — detalhe apenas no placeholder', () => {
  it.each([
    ['agua', ['agua', 'grama'], false],
    ['grama', ['agua', 'grama'], false],
    ['areia', ['agua', 'grama'], true],
    ['agua', [], true],
  ] as const)('%s com lista %j recebe detalhe: %s', (tipo, arte, recebe) => {
    expect(terrenoRecebeDetalhe(tipo, arte)).toBe(recebe);
  });

  it('manifesto sintetico sem arte conserva celulas elegiveis; textura nao carregada tambem', () => {
    const manifesto = { assets: [{
      id: 'agua', tipo: 'terreno', footprint: [1, 1], tamanho: [64, 64], anchor: [0.5, 1],
      estados: { [ESTADO_DO_TERRENO]: 'agua.png' }, licenca: 'teste',
      origem: { base: 'agua.png', semente: null },
    }] } as unknown as Manifesto;
    const tipos = ['agua', 'grama'];
    for (const carregada of [true, false]) {
      const arte = tipos.filter((tipo) => texturaDaCamada(manifesto, 'terreno', tipo,
        ESTADO_DO_TERRENO, () => carregada) !== null);
      const celulas = ['agua', 'grama', 'grama'].filter((tipo) => terrenoRecebeDetalhe(tipo, arte));
      expect(celulas.filter((tipo) => tipo === 'grama')).toHaveLength(2);
      expect(celulas.filter((tipo) => tipo === 'agua')).toHaveLength(carregada ? 0 : 1);
    }
  });
});
