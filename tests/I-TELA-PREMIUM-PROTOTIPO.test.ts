// I-TELA-PREMIUM-PROTOTIPO — as regras puras do visual premium: a chave da URL, quem ganha sombra de contato, a elipse
// da sombra e os retratos da barra da tropa. A tela (sombras desenhadas, gradacao, barra) fica no roteiro.
import { describe, expect, it } from 'vitest';
import { elipseDaSombra, fatorDaSombra, visualPremium } from '../src/render/visual-premium-regra';
import { ACOES_ESPELHADAS, retratosDaSelecao } from '../src/ui/barra-da-tropa';
import { gameData } from '../src/sim/data';
import { hpMaximoDoTipo } from '../src/sim/vida';
import type { GameState } from '../src/sim/state';

describe('I-TELA-PREMIUM-PROTOTIPO', () => {
  it('liga so com ?premium', () => {
    expect(visualPremium('')).toBe(false);
    expect(visualPremium('?pausado')).toBe(false);
    expect(visualPremium('?premium')).toBe(true);
    expect(visualPremium('?pausado&premium')).toBe(true);
  });

  it('ganha sombra o que fica de pe no chao, pelo tipo da textura; chao, estrada e interface nao', () => {
    for (const chave of ['predio:inn:completo', 'unidade:militia:atlas', 'vegetacao:arvore:normal', 'enfeite:cacto:normal', 'animal:bode:normal']) {
      expect(fatorDaSombra(chave), chave).not.toBeNull();
    }
    for (const chave of ['terreno:grama:padrao', 'estrada:estrada:m0', 'interface:canteiro-estaca:normal', 'recurso:stone:normal', 'premium:sombra-de-contato']) {
      expect(fatorDaSombra(chave), chave).toBeNull();
    }
  });

  it('a elipse e centrada no x do pe, achatada, e a do predio cai a frente da base', () => {
    const forma = fatorDaSombra('predio:inn:completo');
    expect(forma).not.toBeNull();
    if (forma === null) return;
    const e = elipseDaSombra({ x: 100, y: 200 }, 200, forma);
    expect(e.x).toBe(100);
    expect(e.w).toBeGreaterThan(200);
    expect(e.h).toBeLessThan(e.w / 2);
    expect(e.y).toBeGreaterThan(200);
    const unidade = fatorDaSombra('unidade:militia:atlas');
    if (unidade === null) throw new Error('unidade sem sombra');
    expect(elipseDaSombra({ x: 0, y: 50 }, 64, unidade).y).toBeLessThan(50);
  });

  it('os retratos: um por soldado vivo da selecao, a vida em fracao do maximo, a imagem do parado do tipo', () => {
    const maximo = hpMaximoDoTipo('militia', gameData) ?? 1;
    const estado = {
      unidades: {
        ordem: ['u1', 'u2'],
        porId: {
          u1: { id: 'u1', tipo: 'militia', hp: maximo / 2 },
          u2: { id: 'u2', tipo: 'militia' },
        },
      },
    } as unknown as GameState;
    const urls = { 'sprites/units/militia/parado.png': '/m.png' };
    const r = retratosDaSelecao(estado, ['u1', 'u2', 'sumiu'], gameData, urls);
    expect(r.map((x) => x.id)).toEqual(['u1', 'u2']);
    expect(r[0]?.vida).toBeCloseTo(0.5);
    expect(r[1]?.vida).toBe(1);
    expect(r[0]?.imagem).toBe('/m.png');
  });

  it('a barra so espelha comandos do painel do grupo', () => {
    expect([...ACOES_ESPELHADAS]).toEqual(['alimentar', 'menos-colunas', 'mais-colunas', 'investida', 'converter']);
  });
});
