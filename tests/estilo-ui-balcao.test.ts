/**
 * Layout 2, fatia 1 (docs/propostas/ui-releitura-rts.md §8): a regra do balcao
 * e os rotulos que a prancha e o balcao leem do tema.
 *
 * A regra e pura e mora em `ui/balcao.ts`: o balcao abre quando ha algo
 * escolhido e fecha quando nao ha; recolhido a mao, fica fechado so enquanto
 * a selecao for a mesma. A montagem no DOM e provada pelos roteiros de tela
 * (F06 mede a grade nos estados; F16b mede o balcao abrindo e a alca).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { estadoDoBalcao } from '../src/ui/balcao';
import temaSertao from '../data/theme-sertao.json';
import { gravarEvidencia } from './helpers/evidence';

describe('Layout 2 — a regra do balcao', () => {
  it('sem selecao, fechado — recolhido a mao ou nao', () => {
    expect(estadoDoBalcao(false, false)).toBe('fechado');
    expect(estadoDoBalcao(false, true)).toBe('fechado');
  });

  it('com selecao, aberto; recolhido a mao, fechado', () => {
    expect(estadoDoBalcao(true, false)).toBe('aberto');
    expect(estadoDoBalcao(true, true)).toBe('fechado');
  });
});

describe('Layout 2 — os rotulos vem do tema', () => {
  it('prancha e balcao tem rotulo, e nenhum e vazio', () => {
    const { prancha, balcao } = temaSertao.paineis;
    for (const texto of [prancha.recolher, balcao.recolher, balcao.abrir, balcao.vazio]) {
      expect(typeof texto).toBe('string');
      expect(texto.trim().length).toBeGreaterThan(0);
    }
  });

  it('os modulos novos de ui/ nao importam sim/data nem phaser (a guarda da F05b, por nome)', () => {
    for (const arquivo of ['prancha.ts', 'balcao.ts']) {
      const fonte = readFileSync(join('src/ui', arquivo), 'utf-8');
      expect(/from\s+['"].*sim\/data['"]/.test(fonte)).toBe(false);
      expect(/from\s+['"]phaser['"]/.test(fonte)).toBe(false);
    }
    // e os dois existem de fato no diretorio, para a lista acima nao envelhecer
    const nomes = readdirSync('src/ui');
    expect(nomes).toContain('prancha.ts');
    expect(nomes).toContain('balcao.ts');
  });
});

afterAll(() => {
  gravarEvidencia('estilo-ui-1', {
    feature: 'estilo-ui-1-grade-e-retracao',
    regra: {
      semSelecao: estadoDoBalcao(false, false),
      comSelecao: estadoDoBalcao(true, false),
      recolhidoAMao: estadoDoBalcao(true, true),
    },
    rotulos: temaSertao.paineis,
    verificacaoVisual: 'fora deste arquivo: npm run shot -- F06 e npm run shot -- F16b',
  });
});
