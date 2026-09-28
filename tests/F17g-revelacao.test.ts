/**
 * F17g — a obra revelada pelo hp: madeira e pedra. Item em `BUILD_PLAN.md`.
 *
 * Os dois lados da virada madeira -> pedra, com `hpTotal` e custo vindos do DADO
 * (nunca digitados aqui), nos tres custos da tabela do aceite: 3/2 (quarry),
 * 4/3 (sawmill) e 6/6 (barracks). Mais a propriedade que nenhum caso isolado
 * prova: varrendo `hp` de 50 em 50, nenhuma fracao desce e a soma sobe sempre.
 *
 * E o manifesto: o par (`madeira` + `completo`) e o que liga a revelacao, e so
 * uma das duas chaves NAO liga — o predio fica nos seis estagios de hoje, que e
 * o fallback decidido pelo operador. Os dois lados, como a F17f fez.
 */
import { describe, it, expect } from 'vitest';
import { revelacaoDaObra, chaveDaRevelacao } from '../src/render/estagio-obra';
import type { Fracao, RevelacaoDaObra } from '../src/render/estagio-obra';
import { aparenciaDoPredio } from '../src/render/predios';
import { assetDoPredio, temParDeRevelacao, CHAVES_DA_REVELACAO } from '../src/render/manifesto';
import type { EntradaDeAsset, Manifesto } from '../src/render/manifesto';
import manifestoJson from '../assets/manifest.json';
import { gravarEvidencia } from './helpers/evidence';

interface Caso { readonly tipo: string; readonly hpTotal: number; readonly timber: number; readonly stone: number }

const casoDe = (tipo: string): Caso => {
  const a = aparenciaDoPredio(tipo);
  return { tipo, hpTotal: a.hpTotal, timber: a.custo['timber'] ?? 0, stone: a.custo['stone'] ?? 0 };
};

const CASOS = [casoDe('quarry'), casoDe('sawmill'), casoDe('barracks')];

/** a/b < c/d sem float: produto cruzado (denominadores positivos). */
const compara = ([a, b]: Fracao, [c, d]: Fracao): number => a * d - c * b;
const soma = (r: RevelacaoDaObra): Fracao => [
  r.madeira[0] * r.pedra[1] + r.pedra[0] * r.madeira[1], r.madeira[1] * r.pedra[1],
];
/** Obra ja martelada: a revelacao existe. Com `hp <= 0` a funcao devolve `null`
 *  (BUG-M) — quem pergunta pelo hp 0 usa `revelaOuNada`. */
const revela = (c: Caso, hp: number): RevelacaoDaObra => {
  const r = revelacaoDaObra(hp, c.hpTotal, c.timber, c.stone);
  if (r === null) throw new Error(`${c.tipo}: hp ${hp} deveria revelar`);
  return r;
};
/** O hp 0 medido como a TELA o mede: nada revelado. A monotonia e a chave comecam
 *  dali, e nao do hp 50 — senao o primeiro degrau sairia da prova. */
const NADA_REVELADO: RevelacaoDaObra = { madeira: [0, 1], pedra: [0, 1] };
const revelaOuNada = (c: Caso, hp: number): RevelacaoDaObra =>
  revelacaoDaObra(hp, c.hpTotal, c.timber, c.stone) ?? NADA_REVELADO;
/** O hp da virada, em inteiro so quando cai em inteiro: `hpTotal*timber/(timber+stone)`. */
const virada = (c: Caso): number => (c.hpTotal * c.timber) / (c.timber + c.stone);

function entradaSintetica(estados: Record<string, string>): EntradaDeAsset {
  return {
    id: 'storehouse', tipo: 'predio', footprint: [3, 3], tamanho: [192, 128], anchor: [0.5, 1],
    estados, licenca: 'sintetica, so no teste', origem: { base: 'base/storehouse/x.png', semente: null },
  };
}

describe('F17g — os custos da tabela do aceite, do dado', () => {
  it('quarry 3/2 hp 250, sawmill 4/3 hp 350, barracks 6/6 hp 600', () => {
    expect(CASOS.map((c) => [c.tipo, c.timber, c.stone, c.hpTotal])).toEqual([
      ['quarry', 3, 2, 250], ['sawmill', 4, 3, 350], ['barracks', 6, 6, 600],
    ]);
  });
});

describe('F17g — os dois lados da virada madeira -> pedra', () => {
  for (const c of CASOS) {
    it(`${c.tipo}: antes da virada so madeira, depois madeira inteira e pedra subindo`, () => {
      const v = virada(c);
      const antes = Math.ceil(v) - 1;
      const depois = Math.floor(v) + 1;
      const rAntes = revela(c, antes);
      expect(compara(rAntes.madeira, [1, 1])).toBeLessThan(0);
      expect(rAntes.pedra[0]).toBe(0);
      const rDepois = revela(c, depois);
      expect(compara(rDepois.madeira, [1, 1])).toBe(0);
      expect(rDepois.pedra[0]).toBeGreaterThan(0);
      // Na virada exata (quando cai em inteiro) a madeira fecha e a pedra ainda e zero.
      if (Number.isInteger(v)) {
        const r = revela(c, v);
        expect(compara(r.madeira, [1, 1])).toBe(0);
        expect(r.pedra[0]).toBe(0);
      }
    });

    it(`${c.tipo}: hp 0 nao e revelacao (a cena cai no canteiro), hpTotal revela tudo`, () => {
      // BUG-M: `[0,1]`/`[0,1]` desenhava NADA na tela. `null` manda a cena para os
      // seis estagios, que desenham o lote, o nome e o canteiro da F17d.
      expect(revelacaoDaObra(0, c.hpTotal, c.timber, c.stone)).toBeNull();
      expect(revelacaoDaObra(1, c.hpTotal, c.timber, c.stone)).not.toBeNull();
      expect(revela(c, c.hpTotal)).toEqual({ madeira: [1, 1], pedra: [1, 1] });
    });

    it(`${c.tipo}: meia madeira e meia pedra caem onde a conta manda`, () => {
      // metade do trecho da madeira e metade do trecho da pedra, em fracao exata
      const r1 = revelacaoDaObra(c.hpTotal * c.timber, 2 * c.hpTotal * (c.timber + c.stone), c.timber, c.stone);
      expect(r1 && compara(r1.madeira, [1, 2])).toBe(0);
      const hpMeiaPedra = c.hpTotal * (2 * c.timber + c.stone);
      const r2 = revelacaoDaObra(hpMeiaPedra, 2 * c.hpTotal * (c.timber + c.stone), c.timber, c.stone);
      expect(r2 && compara(r2.pedra, [1, 2])).toBe(0);
    });
  }
});

describe('F17g — monotonia: de 50 em 50, nada desce e a soma sobe', () => {
  for (const c of CASOS) {
    it(c.tipo, () => {
      let anterior = revelaOuNada(c, 0);
      for (let hp = 50; hp <= c.hpTotal; hp += 50) {
        const r = revela(c, hp);
        expect(compara(r.madeira, anterior.madeira), `madeira em hp ${hp}`).toBeGreaterThanOrEqual(0);
        expect(compara(r.pedra, anterior.pedra), `pedra em hp ${hp}`).toBeGreaterThanOrEqual(0);
        expect(compara(soma(r), soma(anterior)), `soma em hp ${hp}`).toBeGreaterThan(0);
        anterior = r;
      }
    });
  }
});

describe('F17g — o manifesto liga a revelacao pelo par, e so pelo par', () => {
  it('as duas chaves sao `madeira` e `completo` (a pedra e o predio de pe)', () => {
    expect([...CHAVES_DA_REVELACAO]).toEqual(['madeira', 'completo']);
  });

  it('com o par, revela; so uma das chaves, fallback nos seis estagios', () => {
    expect(temParDeRevelacao(entradaSintetica({
      madeira: 'sprites/x/madeira.png', completo: 'sprites/x/completo.png',
    }))).toBe(true);
    expect(temParDeRevelacao(entradaSintetica({ completo: 'sprites/x/completo.png' }))).toBe(false);
    expect(temParDeRevelacao(entradaSintetica({ madeira: 'sprites/x/madeira.png' }))).toBe(false);
    expect(temParDeRevelacao(entradaSintetica({
      marcacao: 'sprites/x/marcacao.png', estrutura: 'sprites/x/estrutura.png', completo: 'sprites/x/completo.png',
    }))).toBe(false);
  });

  it('no manifesto de hoje, o armazem tem o par', () => {
    const entrada = assetDoPredio(manifestoJson as unknown as Manifesto, 'storehouse');
    expect(entrada).toBeTruthy();
    expect(entrada && temParDeRevelacao(entrada)).toBe(true);
  });

  it('a chave de redesenho muda a cada martelada, e so ela', () => {
    const c = CASOS[0] as Caso;
    const chaves = new Set<string>();
    // o hp 0 entra com a chave que a CENA usa para "sem revelacao" (`'-'`,
    // WorldScene): continua sendo um desenho distinto de todos os outros
    for (let hp = 0; hp <= c.hpTotal; hp += 1) {
      const r = revelacaoDaObra(hp, c.hpTotal, c.timber, c.stone);
      chaves.add(r === null ? '-' : chaveDaRevelacao(r));
    }
    expect(chaves.size).toBe(c.hpTotal + 1);
  });

  it('grava a evidencia', () => {
    const tabela = CASOS.map((c) => ({
      ...c,
      virada: virada(c),
      antes: { hp: Math.ceil(virada(c)) - 1, ...revela(c, Math.ceil(virada(c)) - 1) },
      depois: { hp: Math.floor(virada(c)) + 1, ...revela(c, Math.floor(virada(c)) + 1) },
      aCada50: Array.from({ length: Math.floor(c.hpTotal / 50) + 1 }, (_, i) => ({
        hp: i * 50, ...(revelacaoDaObra(i * 50, c.hpTotal, c.timber, c.stone) ?? { semRevelacao: true }),
      })),
    }));
    gravarEvidencia('F17g', { feature: 'F17g-revelacao-da-obra', chaves: CHAVES_DA_REVELACAO, tabela });
  });
});
