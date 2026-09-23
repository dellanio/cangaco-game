/**
 * F17e — os SEIS estagios visuais da obra. Plano em
 * `docs/planos/F17e-estagios-da-obra.md`.
 *
 * Os dois lados de cada fronteira, com `hpTotal` vindo do DADO (nunca digitado
 * aqui), mais a propriedade que nenhum caso isolado prova: varrendo `hp` de 0 a
 * `hpTotal`, o estagio nunca anda para tras.
 *
 * A `barracks` esta aqui de proposito: 600 de HP faz as duas fronteiras do meio
 * cairem em 200 e 400 EXATOS, que e onde comparacao de float seria sorteio.
 */
import { describe, it, expect } from 'vitest';
import { gameData } from '../src/sim/data';
import {
  estagioDaObra, estaEmObra, contagemDeEstagios, ORDEM_DOS_ESTAGIOS,
} from '../src/render/estagio-obra';
import type { EstagioDaObra } from '../src/render/estagio-obra';
import { gravarEvidencia } from './helpers/evidence';

const hpDe = (id: string): number => {
  const def = gameData.predios.find((p) => p.id === id);
  if (!def) throw new Error(`o dado nao tem o predio '${id}'`);
  return def.hp;
};

const HP_BARRACKS = hpDe('barracks');
const HP_QUARRY = hpDe('quarry');
const posicao = (e: EstagioDaObra): number => ORDEM_DOS_ESTAGIOS.indexOf(e);

describe('F17e — as seis fronteiras', () => {
  it('a barracks tem os 600 de HP que fazem as fronteiras cairem em inteiro', () => {
    expect(HP_BARRACKS).toBe(600);
  });

  it('hp === 0 e NAO nivelada e marcacao; hp === 0 e nivelada e fundacao', () => {
    expect(estagioDaObra(0, HP_BARRACKS, false)).toBe('marcacao');
    expect(estagioDaObra(0, HP_BARRACKS, true)).toBe('fundacao');
  });

  it('o primeiro martelo tira a obra da fundacao, nivelada ou nao', () => {
    expect(estagioDaObra(1, HP_BARRACKS, true)).toBe('estrutura');
    expect(estagioDaObra(1, HP_BARRACKS, false)).toBe('estrutura');
  });

  it('estrutura -> paredes cai em 200 na barracks (600/3), nos dois lados', () => {
    expect(estagioDaObra(200, HP_BARRACKS, true)).toBe('estrutura');
    expect(estagioDaObra(201, HP_BARRACKS, true)).toBe('paredes');
  });

  it('paredes -> cobertura cai em 400 na barracks (600*2/3), nos dois lados', () => {
    expect(estagioDaObra(400, HP_BARRACKS, true)).toBe('paredes');
    expect(estagioDaObra(401, HP_BARRACKS, true)).toBe('cobertura');
  });

  it('cobertura -> completo cai no hpTotal, nos dois lados', () => {
    expect(estagioDaObra(HP_BARRACKS - 1, HP_BARRACKS, true)).toBe('cobertura');
    expect(estagioDaObra(HP_BARRACKS, HP_BARRACKS, true)).toBe('completo');
  });

  it('num hpTotal que NAO divide por 3 as fronteiras truncam (quarry, 250)', () => {
    expect(HP_QUARRY).toBe(250); // 250/3 = 83,33 e 500/3 = 166,66
    expect(estagioDaObra(83, HP_QUARRY, true)).toBe('estrutura');
    expect(estagioDaObra(84, HP_QUARRY, true)).toBe('paredes');
    expect(estagioDaObra(166, HP_QUARRY, true)).toBe('paredes');
    expect(estagioDaObra(167, HP_QUARRY, true)).toBe('cobertura');
  });

  it('passar do teto nao trava a funcao', () => {
    expect(estagioDaObra(9999, HP_QUARRY, true)).toBe('completo');
    expect(estagioDaObra(-5, HP_QUARRY, false)).toBe('marcacao');
  });
});

describe('F17e — monotonicidade: o estagio nunca anda para tras', () => {
  for (const nivelada of [false, true]) {
    it(`varrendo hp de 0 a hpTotal com nivelada=${nivelada}`, () => {
      for (const hpTotal of [HP_QUARRY, HP_BARRACKS]) {
        let anterior = -1;
        for (let hp = 0; hp <= hpTotal; hp++) {
          const p = posicao(estagioDaObra(hp, hpTotal, nivelada));
          expect(p, `hp=${hp} de ${hpTotal} caiu num estagio fora da ordem`).toBeGreaterThanOrEqual(0);
          expect(p, `hp=${hp} de ${hpTotal} andou para tras`).toBeGreaterThanOrEqual(anterior);
          anterior = p;
        }
      }
    });
  }

  it('todos os seis aparecem em ALGUM hp da varredura (nenhum e inalcancavel)', () => {
    const vistos = new Set<EstagioDaObra>();
    for (const nivelada of [false, true]) {
      for (let hp = 0; hp <= HP_BARRACKS; hp++) vistos.add(estagioDaObra(hp, HP_BARRACKS, nivelada));
    }
    expect([...vistos].sort()).toEqual([...ORDEM_DOS_ESTAGIOS].sort());
  });
});

describe('F17e — a ordem e a contagem sao a MESMA lista', () => {
  it('contagemDeEstagios tem exatamente as chaves de ORDEM_DOS_ESTAGIOS', () => {
    expect(Object.keys(contagemDeEstagios()).sort()).toEqual([...ORDEM_DOS_ESTAGIOS].sort());
    expect(Object.values(contagemDeEstagios()).every((n) => n === 0)).toBe(true);
  });

  it('estaEmObra separa os cinco do completo, sem lista paralela', () => {
    expect(ORDEM_DOS_ESTAGIOS.filter(estaEmObra)).toHaveLength(ORDEM_DOS_ESTAGIOS.length - 1);
    expect(estaEmObra('completo')).toBe(false);
  });

  it('grava a evidencia', () => {
    const fronteiras = [
      { tipo: 'quarry', hpTotal: HP_QUARRY },
      { tipo: 'barracks', hpTotal: HP_BARRACKS },
    ].map(({ tipo, hpTotal }) => {
      const transicoes: { hp: number; de: EstagioDaObra; para: EstagioDaObra }[] = [];
      for (let hp = 1; hp <= hpTotal; hp++) {
        const de = estagioDaObra(hp - 1, hpTotal, true);
        const para = estagioDaObra(hp, hpTotal, true);
        if (de !== para) transicoes.push({ hp, de, para });
      }
      return {
        tipo,
        hpTotal,
        semNivelar: estagioDaObra(0, hpTotal, false),
        nivelada: estagioDaObra(0, hpTotal, true),
        transicoes,
      };
    });
    gravarEvidencia('F17e', {
      feature: 'F17e-estagios-da-obra',
      ordem: ORDEM_DOS_ESTAGIOS,
      emObra: ORDEM_DOS_ESTAGIOS.filter(estaEmObra),
      fronteiras,
    });
  });
});
